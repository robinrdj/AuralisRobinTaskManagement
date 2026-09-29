import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateBoardMutation, type BoardSummary } from "@/store/api";
import { useAppDispatch } from "@/store";
import { setActiveBoard } from "@/store/uiSlice";
import { pushToast } from "@/store/toastSlice";
import { Button } from "../ui/primitives";
import { cx, errorMessage } from "../ui/labels";
import { BoardSettings } from "./BoardSettings";

const ROLE_LABELS: Record<BoardSummary["role"], string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "View only",
};

/**
 * The board name in the header, doubling as the way to move between boards,
 * start a new one, and reach its settings.
 */
export function BoardSwitcher({
  boards,
  activeBoard,
  userId,
}: {
  boards: BoardSummary[];
  activeBoard: BoardSummary;
  userId: string;
}) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createBoard, { isLoading }] = useCreateBoardMutation();

  const choose = (boardId: string) => {
    dispatch(setActiveBoard(boardId));
    setOpen(false);
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = draft.trim();
    if (!name) return;
    try {
      const { board } = await createBoard({ name }).unwrap();
      setDraft("");
      setCreating(false);
      choose(board.id);
      navigate("/board");
      dispatch(pushToast({ message: `Created "${name}"`, tone: "success" }));
    } catch (error) {
      dispatch(
        pushToast({
          message: errorMessage(error, "Could not create that board."),
          tone: "danger",
        })
      );
    }
  };

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Board: ${activeBoard.name}. Switch board`}
        className="flex min-w-0 max-w-[10rem] items-center sm:max-w-[14rem] gap-1 truncate rounded-[var(--radius-pill)] bg-[var(--surface-hover)] px-2 py-0.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-active)] hover:text-[var(--text-primary)]"
      >
        <span className="truncate">{activeBoard.name}</span>
        <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <>
          {/* Above the guide's tip (z-50): a menu the user opened outranks advice. */}
          <div className="fixed inset-0 z-[54]" onClick={() => setOpen(false)} />
          <div
            role="menu"
            aria-label="Boards"
            className="absolute left-0 z-[55] mt-2 w-64 rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-overlay)] p-1.5 shadow-[var(--shadow-overlay)]"
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
            }}
          >
            <p className="px-2.5 pb-1 pt-1.5 text-2xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Your boards
            </p>
            <div className="scrollbar-slim max-h-64 overflow-y-auto">
              {boards.map((board) => (
                <button
                  key={board.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={board.id === activeBoard.id}
                  onClick={() => choose(board.id)}
                  className={cx(
                    "flex w-full items-center gap-2 rounded-[var(--radius-control)] px-2.5 py-2 text-left text-sm hover:bg-[var(--surface-hover)]",
                    board.id === activeBoard.id
                      ? "font-medium text-[var(--accent-text)]"
                      : "text-[var(--text-primary)]"
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{board.name}</span>
                  <span className="shrink-0 text-2xs text-[var(--text-muted)]">
                    {ROLE_LABELS[board.role]}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-1 border-t border-[var(--border-subtle)] pt-1">
              {creating ? (
                <form onSubmit={create} className="flex gap-1.5 p-1.5">
                  <input
                    autoFocus
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    maxLength={80}
                    placeholder="Board name"
                    aria-label="New board name"
                    className="h-8 min-w-0 flex-1 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="primary"
                    disabled={isLoading || draft.trim() === ""}
                  >
                    Create
                  </Button>
                </form>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setCreating(true)}
                  className="w-full rounded-[var(--radius-control)] px-2.5 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                >
                  + New board
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  setSettingsOpen(true);
                }}
                className="w-full rounded-[var(--radius-control)] px-2.5 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
              >
                Board settings and members
              </button>
            </div>
          </div>
        </>
      )}

      {settingsOpen && (
        <BoardSettings
          board={activeBoard}
          boards={boards}
          userId={userId}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
