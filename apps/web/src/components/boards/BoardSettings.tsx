import { useState } from "react";
import {
  useDeleteBoardMutation,
  useGetBoardMembersQuery,
  useInviteMemberMutation,
  useRemoveMemberMutation,
  useRenameBoardMutation,
  useUpdateMemberRoleMutation,
  type BoardSummary,
} from "@/store/api";
import { useAppDispatch } from "@/store";
import { setActiveBoard } from "@/store/uiSlice";
import { pushToast } from "@/store/toastSlice";
import { Dialog } from "../ui/Dialog";
import { Button, Skeleton } from "../ui/primitives";
import { errorMessage } from "../ui/labels";
import { LabelManager } from "./LabelManager";

const CONTROL_CLASS =
  "h-9 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none disabled:opacity-60";

/**
 * Name, people and the dangerous buttons for one board.
 *
 * Only the owner can rename, invite, change roles or delete; everyone else
 * sees the member list and a way to leave. The server enforces all of this —
 * the UI only avoids offering what would be refused.
 */
export function BoardSettings({
  board,
  boards,
  userId,
  onClose,
}: {
  board: BoardSummary;
  boards: BoardSummary[];
  userId: string;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const isOwner = board.role === "owner";
  const { data, isLoading } = useGetBoardMembersQuery(board.id);
  const [renameBoard] = useRenameBoardMutation();
  const [deleteBoard, { isLoading: deleting }] = useDeleteBoardMutation();
  const [inviteMember, { isLoading: inviting }] = useInviteMemberMutation();
  const [updateRole] = useUpdateMemberRoleMutation();
  const [removeMember] = useRemoveMemberMutation();

  const [name, setName] = useState(board.name);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const otherBoard = boards.find((candidate) => candidate.id !== board.id);
  const members = data?.members ?? [];

  const report = (error: unknown, fallback: string) =>
    dispatch(pushToast({ message: errorMessage(error, fallback), tone: "danger" }));

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === board.name) {
      setName(board.name);
      return;
    }
    try {
      await renameBoard({ boardId: board.id, name: trimmed }).unwrap();
      dispatch(pushToast({ message: "Board renamed", tone: "success" }));
    } catch (error) {
      setName(board.name);
      report(error, "Could not rename the board.");
    }
  };

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    setInviteError(null);
    try {
      const { member } = await inviteMember({
        boardId: board.id,
        email: email.trim(),
        role,
      }).unwrap();
      setEmail("");
      dispatch(pushToast({ message: `Added ${member.name} to the board`, tone: "success" }));
    } catch (error) {
      setInviteError(errorMessage(error, "Could not add them."));
    }
  };

  /** After leaving or deleting, move to a board the user still has. */
  const moveAway = () => {
    if (otherBoard) dispatch(setActiveBoard(otherBoard.id));
    onClose();
  };

  return (
    <Dialog title="Board settings" onClose={onClose}>
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-1.5">
          <label
            htmlFor="board-name"
            className="text-2xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
          >
            Board name
          </label>
          <input
            id="board-name"
            value={name}
            maxLength={80}
            disabled={!isOwner}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => void saveName()}
            onKeyDown={(event) => {
              if (event.key === "Enter") (event.target as HTMLInputElement).blur();
            }}
            className={CONTROL_CLASS}
          />
        </section>

        <section>
          <h3 className="mb-2 text-2xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Members
          </h3>
          {isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5" aria-label="Board members">
              {members.map((member) => {
                const isSelf = member.userId === userId;
                return (
                  <li key={member.userId} className="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: member.color }}
                    >
                      {member.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[var(--text-primary)]">
                        {member.name}
                        {isSelf && <span className="text-[var(--text-muted)]"> (you)</span>}
                      </p>
                      {member.email && (
                        <p className="truncate text-2xs text-[var(--text-muted)]">
                          {member.email}
                        </p>
                      )}
                    </div>

                    {member.role === "owner" || !isOwner ? (
                      <span className="shrink-0 text-xs capitalize text-[var(--text-secondary)]">
                        {member.role === "viewer" ? "View only" : member.role}
                      </span>
                    ) : (
                      <select
                        value={member.role}
                        aria-label={`Role for ${member.name}`}
                        onChange={(event) =>
                          void updateRole({
                            boardId: board.id,
                            userId: member.userId,
                            role: event.target.value as "editor" | "viewer",
                          })
                            .unwrap()
                            .catch((error) => report(error, "Could not change their role."))
                        }
                        className="h-7 shrink-0 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-1.5 text-xs text-[var(--text-primary)]"
                      >
                        <option value="editor">Editor</option>
                        <option value="viewer">View only</option>
                      </select>
                    )}

                    {isOwner && member.role !== "owner" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Remove ${member.name}`}
                        onClick={() =>
                          void removeMember({ boardId: board.id, userId: member.userId })
                            .unwrap()
                            .then(() =>
                              dispatch(
                                pushToast({
                                  message: `Removed ${member.name}`,
                                  tone: "info",
                                })
                              )
                            )
                            .catch((error) => report(error, "Could not remove them."))
                        }
                      >
                        Remove
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {isOwner && (
          <section>
            <h3 className="mb-2 text-2xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Invite someone
            </h3>
            <form onSubmit={invite} className="flex flex-wrap gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setInviteError(null);
                }}
                placeholder="teammate@example.com"
                aria-label="Email address to invite"
                aria-invalid={inviteError !== null}
                className={`${CONTROL_CLASS} min-w-0 flex-1`}
              />
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as "editor" | "viewer")}
                aria-label="Role for the new member"
                className={CONTROL_CLASS}
              >
                <option value="editor">Editor</option>
                <option value="viewer">View only</option>
              </select>
              <Button type="submit" variant="primary" disabled={inviting || !email.trim()}>
                Invite
              </Button>
            </form>
            {inviteError ? (
              <p role="alert" className="mt-1.5 text-xs text-[var(--danger)]">
                {inviteError}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                They need an account already. Editors can change tasks; view-only members can
                look but not touch.
              </p>
            )}
          </section>
        )}

        <LabelManager boardId={board.id} canEdit={board.role !== "viewer"} />

        <section className="border-t border-[var(--border-subtle)] pt-4">
          {isOwner ? (
            confirmingDelete ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="flex-1 text-sm text-[var(--text-primary)]">
                  Delete "{board.name}" and every task on it? This cannot be undone.
                </p>
                <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)}>
                  Keep it
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={deleting}
                  onClick={() =>
                    void deleteBoard(board.id)
                      .unwrap()
                      .then(moveAway)
                      .catch((error) => report(error, "Could not delete the board."))
                  }
                >
                  Delete forever
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="danger"
                disabled={!otherBoard}
                title={otherBoard ? undefined : "You need at least one other board first"}
                onClick={() => setConfirmingDelete(true)}
              >
                Delete board
              </Button>
            )
          ) : (
            <Button
              size="sm"
              variant="danger"
              disabled={!otherBoard}
              onClick={() =>
                void removeMember({ boardId: board.id, userId })
                  .unwrap()
                  .then(moveAway)
                  .catch((error) => report(error, "Could not leave the board."))
              }
            >
              Leave board
            </Button>
          )}
        </section>
      </div>
    </Dialog>
  );
}
