import { createSlice, nanoid, type PayloadAction } from "@reduxjs/toolkit";

export type ToastTone = "info" | "success" | "warning" | "danger";

export interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
  /**
   * Identifies an undo handler registered in the undo registry. The function
   * itself is deliberately not in Redux state — reducers must stay serialisable
   * and time-travel debugging breaks the moment closures live in the store.
   */
  undoToken: string | null;
  createdAt: number;
  durationMs: number;
}

export interface ToastState {
  toasts: Toast[];
}

const initialState: ToastState = { toasts: [] };

/**
 * Undo handlers, keyed by token.
 *
 * v1 implemented undo by delaying the delete for five seconds and hoping the
 * user clicked in time — which meant the task lingered on the board looking
 * deleted but not gone, and a refresh in that window resurrected it. Here the
 * change is applied immediately and undo issues a compensating write, so what
 * you see is always what is stored.
 */
const undoHandlers = new Map<string, () => void | Promise<void>>();

export function registerUndo(handler: () => void | Promise<void>): string {
  const token = nanoid();
  undoHandlers.set(token, handler);
  return token;
}

export function consumeUndo(token: string): (() => void | Promise<void>) | undefined {
  const handler = undoHandlers.get(token);
  undoHandlers.delete(token);
  return handler;
}

export function forgetUndo(token: string): void {
  undoHandlers.delete(token);
}

const toastSlice = createSlice({
  name: "toasts",
  initialState,
  reducers: {
    pushToast: {
      reducer: (state, action: PayloadAction<Toast>) => {
        // A small cap keeps a burst of bulk operations from burying the screen.
        state.toasts = [...state.toasts, action.payload].slice(-4);
      },
      prepare: (input: {
        message: string;
        tone?: ToastTone;
        undoToken?: string | null;
        durationMs?: number;
      }) => ({
        payload: {
          id: nanoid(),
          message: input.message,
          tone: input.tone ?? "info",
          undoToken: input.undoToken ?? null,
          createdAt: Date.now(),
          // Undoable toasts stay longer — there is a decision to make.
          durationMs: input.durationMs ?? (input.undoToken ? 8000 : 4000),
        } satisfies Toast,
      }),
    },

    dismissToast: (state, action: PayloadAction<string>) => {
      const toast = state.toasts.find((candidate) => candidate.id === action.payload);
      if (toast?.undoToken) forgetUndo(toast.undoToken);
      state.toasts = state.toasts.filter((candidate) => candidate.id !== action.payload);
    },

    clearToasts: (state) => {
      for (const toast of state.toasts) {
        if (toast.undoToken) forgetUndo(toast.undoToken);
      }
      state.toasts = [];
    },
  },
});

export const { pushToast, dismissToast, clearToasts } = toastSlice.actions;
export default toastSlice.reducer;
