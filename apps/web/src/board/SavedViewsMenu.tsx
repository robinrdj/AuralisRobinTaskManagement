import { useState } from "react";
import type { SavedView } from "@auralis/shared";
import {
  useCreateViewMutation,
  useDeleteViewMutation,
  useGetViewsQuery,
  useUpdateViewMutation,
} from "@/store/api";
import { useAppDispatch, useAppSelector } from "@/store";
import { applyView, clearFilters, setSort } from "@/store/uiSlice";
import { pushToast } from "@/store/toastSlice";
import { Button } from "@/components/ui/primitives";
import { cx, errorMessage } from "@/components/ui/labels";
import { viewMatches } from "./views";

/**
 * Saved views: apply one in a click, save the current filters as a new one,
 * or bring an existing one up to date.
 */
export function SavedViewsMenu({
  boardId,
  currentUserId,
  isBoardOwner,
  canShare,
}: {
  boardId: string;
  currentUserId: string | undefined;
  isBoardOwner: boolean;
  /** Viewers may keep private views but not share them. */
  canShare: boolean;
}) {
  const dispatch = useAppDispatch();
  const { filters, sortBy, sortDirection } = useAppSelector((state) => state.ui);
  const { data: views = [] } = useGetViewsQuery(boardId);
  const [createView, { isLoading: saving }] = useCreateViewMutation();
  const [updateView] = useUpdateViewMutation();
  const [deleteView] = useDeleteViewMutation();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The last view applied from this menu, so it can be updated after tweaking.
  const [lastAppliedId, setLastAppliedId] = useState<string | null>(null);

  const active = views.find((view) => viewMatches(view, filters, sortBy, sortDirection));
  const lastApplied = views.find((view) => view.id === lastAppliedId);
  const canUpdateLast = lastApplied && !active && lastApplied.ownerId === currentUserId;

  const apply = (view: SavedView) => {
    dispatch(
      applyView({
        filters: view.filters,
        sortBy: view.sortBy,
        sortDirection: view.sortDirection,
      })
    );
    setLastAppliedId(view.id);
    setOpen(false);
  };

  const report = (err: unknown, fallback: string) =>
    dispatch(pushToast({ message: errorMessage(err, fallback), tone: "danger" }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const { view } = await createView({
        boardId,
        name: trimmed,
        filters,
        sortBy,
        sortDirection,
        shared: canShare && shared,
      }).unwrap();
      setName("");
      setShared(false);
      setLastAppliedId(view.id);
      dispatch(pushToast({ message: `Saved the view "${view.name}"`, tone: "success" }));
    } catch (err) {
      setError(errorMessage(err, "Could not save that view."));
    }
  };

  return (
    <div className="relative">
      <Button
        size="md"
        variant={active ? "primary" : "secondary"}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={active ? `Saved views: ${active.name}` : "Saved views"}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="max-w-[9rem] truncate">{active ? active.name : "Views"}</span>
        <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-[54]" onClick={() => setOpen(false)} />
          <div
            role="menu"
            aria-label="Saved views"
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
              // Typing a name must not trigger the board's single-key shortcuts.
              event.stopPropagation();
            }}
            className="absolute left-0 z-[55] mt-2 w-72 rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-overlay)] p-1.5 shadow-[var(--shadow-overlay)]"
          >
            <p className="px-2.5 pb-1 pt-1.5 text-2xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Saved views
            </p>

            {views.length === 0 ? (
              <p className="px-2.5 py-2 text-xs text-[var(--text-muted)]">
                Nothing saved yet. Set up filters and a sort, then save them here.
              </p>
            ) : (
              <ul className="scrollbar-slim max-h-60 overflow-y-auto">
                {views.map((view) => {
                  const mine = view.ownerId === currentUserId;
                  const canDelete = mine || (view.shared && isBoardOwner);
                  return (
                    <li key={view.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        role="menuitemradio"
                        aria-checked={active?.id === view.id}
                        onClick={() => apply(view)}
                        className={cx(
                          "flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-control)] px-2.5 py-2 text-left text-sm hover:bg-[var(--surface-hover)]",
                          active?.id === view.id
                            ? "font-medium text-[var(--accent-text)]"
                            : "text-[var(--text-primary)]"
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{view.name}</span>
                        {view.shared && (
                          <span className="shrink-0 text-2xs text-[var(--text-muted)]">
                            {mine ? "Shared" : `Shared by ${view.ownerName ?? "someone"}`}
                          </span>
                        )}
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          aria-label={`Delete view ${view.name}`}
                          onClick={() =>
                            void deleteView({ boardId, viewId: view.id })
                              .unwrap()
                              .catch((err) => report(err, "Could not delete that view."))
                          }
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--danger)]"
                        >
                          <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
                            <path
                              d="M4 4l8 8M12 4l-8 8"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {canUpdateLast && (
              <button
                type="button"
                role="menuitem"
                onClick={() =>
                  void updateView({
                    boardId,
                    viewId: lastApplied.id,
                    filters,
                    sortBy,
                    sortDirection,
                  })
                    .unwrap()
                    .then(() =>
                      dispatch(
                        pushToast({ message: `Updated "${lastApplied.name}"`, tone: "success" })
                      )
                    )
                    .catch((err) => report(err, "Could not update that view."))
                }
                className="mt-1 w-full rounded-[var(--radius-control)] px-2.5 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
              >
                Update "{lastApplied.name}" with the current filters
              </button>
            )}

            {active && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  dispatch(clearFilters());
                  dispatch(setSort({ by: "position", direction: "asc" }));
                  setOpen(false);
                }}
                className="mt-1 w-full rounded-[var(--radius-control)] px-2.5 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
              >
                Back to everything
              </button>
            )}

            <form
              onSubmit={save}
              className="mt-1 flex flex-col gap-2 border-t border-[var(--border-subtle)] p-2.5"
            >
              <label
                htmlFor="view-name"
                className="text-2xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
              >
                Save the current view
              </label>
              <div className="flex gap-2">
                <input
                  id="view-name"
                  value={name}
                  maxLength={60}
                  onChange={(event) => {
                    setName(event.target.value);
                    setError(null);
                  }}
                  placeholder="e.g. My urgent work"
                  className="h-8 min-w-0 flex-1 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  disabled={saving || !name.trim()}
                >
                  Save view
                </Button>
              </div>
              {canShare && (
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={shared}
                    onChange={(event) => setShared(event.target.checked)}
                    className="h-3.5 w-3.5 accent-[var(--accent)]"
                  />
                  Share with everyone on this board
                </label>
              )}
              {error && (
                <p role="alert" className="text-xs text-[var(--danger)]">
                  {error}
                </p>
              )}
            </form>
          </div>
        </>
      )}
    </div>
  );
}
