import { describe, expect, it, vi } from "vitest";
import { render, screen, act, waitForElementToBeRemoved } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { ToastViewport } from "./ToastViewport";
import toastReducer, {
  consumeUndo,
  dismissToast,
  pushToast,
  registerUndo,
} from "@/store/toastSlice";

/**
 * The undo path is the one feature a user is most likely to need under
 * pressure, and the hardest to check by hand — the toast is gone in eight
 * seconds.
 *
 * Timing is asserted against the slice, where the durations are decided, and
 * behaviour is asserted against the DOM with real timers. Driving
 * `AnimatePresence` with fake timers only proves things about the animation
 * library.
 */
function renderWithStore() {
  const store = configureStore({ reducer: { toasts: toastReducer } });
  render(
    <Provider store={store}>
      <ToastViewport />
    </Provider>
  );
  return store;
}

describe("toast durations", () => {
  it("gives an undoable toast twice as long to be read", () => {
    const plain = pushToast({ message: "Plain" });
    const undoable = pushToast({ message: "Undoable", undoToken: "token" });

    expect(plain.payload.durationMs).toBe(4000);
    expect(undoable.payload.durationMs).toBe(8000);
  });

  it("honours an explicit duration", () => {
    expect(pushToast({ message: "Brief", durationMs: 100 }).payload.durationMs).toBe(100);
  });

  it("defaults to the neutral tone and no undo", () => {
    const action = pushToast({ message: "Plain" });
    expect(action.payload.tone).toBe("info");
    expect(action.payload.undoToken).toBeNull();
  });

  it("gives each toast a distinct id", () => {
    const ids = new Set(
      Array.from({ length: 50 }, () => pushToast({ message: "x" }).payload.id)
    );
    expect(ids.size).toBe(50);
  });
});

describe("undo registry", () => {
  it("hands back the handler exactly once", () => {
    const handler = vi.fn();
    const token = registerUndo(handler);

    expect(consumeUndo(token)).toBe(handler);
    // Consumed: a second attempt cannot replay the compensating write.
    expect(consumeUndo(token)).toBeUndefined();
  });

  it("returns undefined for a token it never issued", () => {
    expect(consumeUndo("never-issued")).toBeUndefined();
  });

  it("releases the handler when its toast is dismissed", () => {
    const store = configureStore({ reducer: { toasts: toastReducer } });
    const handler = vi.fn();
    const token = registerUndo(handler);

    store.dispatch(pushToast({ message: "Deleted", undoToken: token }));
    const id = store.getState().toasts.toasts[0]!.id;
    store.dispatch(dismissToast(id));

    // The closure holds a task snapshot; leaking it would pin that memory for
    // the life of the page.
    expect(consumeUndo(token)).toBeUndefined();
  });
});

describe("ToastViewport", () => {
  it("shows a message", () => {
    const store = renderWithStore();
    act(() => {
      store.dispatch(pushToast({ message: "Task added" }));
    });
    expect(screen.getByText("Task added")).toBeInTheDocument();
  });

  it("offers Undo only when there is something to undo", () => {
    const store = renderWithStore();

    act(() => {
      store.dispatch(pushToast({ message: "Just information" }));
    });
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();

    act(() => {
      store.dispatch(
        pushToast({ message: "Deleted a task", undoToken: registerUndo(() => {}) })
      );
    });
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });

  it("runs the undo handler when Undo is clicked", async () => {
    const user = userEvent.setup();
    const store = renderWithStore();
    const handler = vi.fn();

    act(() => {
      store.dispatch(
        pushToast({ message: "Deleted a task", undoToken: registerUndo(handler) })
      );
    });

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(store.getState().toasts.toasts).toHaveLength(0);
  });

  it("can be dismissed by hand", async () => {
    const user = userEvent.setup();
    const store = renderWithStore();
    act(() => {
      store.dispatch(pushToast({ message: "Go away" }));
    });

    await user.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(store.getState().toasts.toasts).toHaveLength(0);
  });

  it("takes itself off screen once its time is up", async () => {
    const store = renderWithStore();
    act(() => {
      store.dispatch(pushToast({ message: "Transient", durationMs: 60 }));
    });

    await waitForElementToBeRemoved(() => screen.queryByText("Transient"), {
      timeout: 2000,
    });
    expect(store.getState().toasts.toasts).toHaveLength(0);
  });

  it("leaves an expired undo unrunnable", async () => {
    const store = renderWithStore();
    const handler = vi.fn();
    const token = registerUndo(handler);

    act(() => {
      store.dispatch(pushToast({ message: "Expiring", undoToken: token, durationMs: 60 }));
    });
    await waitForElementToBeRemoved(() => screen.queryByText("Expiring"), {
      timeout: 2000,
    });

    expect(handler).not.toHaveBeenCalled();
    expect(consumeUndo(token)).toBeUndefined();
  });

  it("caps how many toasts stack up at once", () => {
    const store = renderWithStore();
    act(() => {
      for (let i = 0; i < 8; i++) {
        store.dispatch(pushToast({ message: `Toast ${i}`, durationMs: 60_000 }));
      }
    });

    // A bulk operation must not bury the screen in notifications.
    expect(store.getState().toasts.toasts).toHaveLength(4);
    expect(screen.queryByText("Toast 0")).not.toBeInTheDocument();
    expect(screen.getByText("Toast 7")).toBeInTheDocument();
  });

  it("announces politely rather than interrupting", () => {
    const store = renderWithStore();
    act(() => {
      store.dispatch(pushToast({ message: "Announced", durationMs: 60_000 }));
    });
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });
});
