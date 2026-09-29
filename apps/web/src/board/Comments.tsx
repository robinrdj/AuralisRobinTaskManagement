import { useRef, useState } from "react";
import {
  mentionsToPlainText,
  plainTextToMentions,
  splitMentions,
  COMMENT_MAX_LENGTH,
  type Comment,
} from "@auralis/shared";
import {
  useAddCommentMutation,
  useDeleteCommentMutation,
  useEditCommentMutation,
  useGetCommentsQuery,
  type BoardMember,
} from "@/store/api";
import { useAppDispatch } from "@/store";
import { pushToast } from "@/store/toastSlice";
import { Button, Skeleton } from "@/components/ui/primitives";
import { cx, errorMessage } from "@/components/ui/labels";
import { formatRelativeTime } from "./activityText";
import {
  activeMentionQuery,
  applyMention,
  matchMembers,
  type MentionQuery,
} from "./mentionQuery";

interface PickedMention {
  name: string;
  userId: string;
}

/**
 * The discussion thread on a task.
 *
 * Typing "@" suggests people on the board; picking one keeps a readable
 * "@Name" in the box and converts it to a stored mention on send, so the
 * person is notified even if someone else on the board shares their name.
 */
export function Comments({
  taskId,
  members,
  currentUserId,
  isOwner,
  readOnly,
}: {
  taskId: string;
  members: BoardMember[];
  currentUserId: string | undefined;
  isOwner: boolean;
  readOnly: boolean;
}) {
  const dispatch = useAppDispatch();
  const { data: comments = [], isLoading } = useGetCommentsQuery(taskId);
  const [addComment, { isLoading: sending }] = useAddCommentMutation();
  const [editingId, setEditingId] = useState<string | null>(null);

  const send = async (body: string) => {
    try {
      await addComment({ taskId, body }).unwrap();
      return true;
    } catch (error) {
      dispatch(
        pushToast({
          message: errorMessage(error, "Could not post that comment."),
          tone: "danger",
        })
      );
      return false;
    }
  };

  return (
    <section aria-label="Comments">
      <h3 className="mb-2 flex items-center gap-2 text-2xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Comments
        {comments.length > 0 && (
          <span className="tabular-nums normal-case tracking-normal">{comments.length}</span>
        )}
      </h3>

      {isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : comments.length === 0 ? (
        <p className="mb-2 text-xs text-[var(--text-muted)]">
          {readOnly ? "No comments yet." : "No comments yet. Start the conversation."}
        </p>
      ) : (
        <ol className="mb-3 flex flex-col gap-3">
          {comments.map((comment) =>
            editingId === comment.id ? (
              <li key={comment.id}>
                <EditComment
                  comment={comment}
                  members={members}
                  currentUserId={currentUserId}
                  onDone={() => setEditingId(null)}
                />
              </li>
            ) : (
              <CommentItem
                key={comment.id}
                comment={comment}
                canEdit={!readOnly && comment.authorId === currentUserId}
                canDelete={!readOnly && (comment.authorId === currentUserId || isOwner)}
                currentUserId={currentUserId}
                onEdit={() => setEditingId(comment.id)}
              />
            )
          )}
        </ol>
      )}

      {!readOnly && (
        <CommentBox
          members={members}
          currentUserId={currentUserId}
          submitLabel="Comment"
          busy={sending}
          onSubmit={send}
        />
      )}
    </section>
  );
}

function CommentItem({
  comment,
  canEdit,
  canDelete,
  currentUserId,
  onEdit,
}: {
  comment: Comment;
  canEdit: boolean;
  canDelete: boolean;
  currentUserId: string | undefined;
  onEdit: () => void;
}) {
  const dispatch = useAppDispatch();
  const [deleteComment] = useDeleteCommentMutation();
  const author = comment.authorName ?? "Former member";

  return (
    <li className="flex gap-2.5">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-2xs font-semibold text-white"
        style={{ backgroundColor: comment.authorColor ?? "var(--text-muted)" }}
      >
        {author.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs">
          <span className="font-medium text-[var(--text-primary)]">{author}</span>
          <span className="ml-1.5 text-[var(--text-muted)]">
            {formatRelativeTime(comment.createdAt)}
            {comment.editedAt && " · edited"}
          </span>
        </p>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--text-secondary)]">
          {splitMentions(comment.body).map((segment, index) =>
            segment.type === "text" ? (
              <span key={index}>{segment.text}</span>
            ) : (
              <span
                key={index}
                className={cx(
                  "rounded px-0.5 font-medium",
                  segment.userId === currentUserId
                    ? "bg-[var(--accent-subtle)] text-[var(--accent-text)]"
                    : "text-[var(--accent-text)]"
                )}
              >
                @{segment.name}
              </span>
            )
          )}
        </p>
        {(canEdit || canDelete) && (
          <div className="mt-1 flex gap-3 text-2xs">
            {canEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Edit
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                aria-label={`Delete comment by ${author}`}
                onClick={() =>
                  void deleteComment({ taskId: comment.taskId, commentId: comment.id })
                    .unwrap()
                    .catch((error) =>
                      dispatch(
                        pushToast({
                          message: errorMessage(error, "Could not delete that comment."),
                          tone: "danger",
                        })
                      )
                    )
                }
                className="text-[var(--text-muted)] hover:text-[var(--danger)]"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function EditComment({
  comment,
  members,
  currentUserId,
  onDone,
}: {
  comment: Comment;
  members: BoardMember[];
  currentUserId: string | undefined;
  onDone: () => void;
}) {
  const dispatch = useAppDispatch();
  const [editComment, { isLoading }] = useEditCommentMutation();
  const initial = mentionsToPlainText(comment.body);

  return (
    <CommentBox
      members={members}
      currentUserId={currentUserId}
      initialText={initial.text}
      initialMentions={initial.mentions}
      submitLabel="Save"
      busy={isLoading}
      onCancel={onDone}
      onSubmit={async (body) => {
        try {
          await editComment({ taskId: comment.taskId, commentId: comment.id, body }).unwrap();
          onDone();
          return true;
        } catch (error) {
          dispatch(
            pushToast({
              message: errorMessage(error, "Could not save that edit."),
              tone: "danger",
            })
          );
          return false;
        }
      }}
    />
  );
}

/**
 * A textarea with @-suggestions.
 *
 * Arrow keys move through the suggestions, Enter or Tab picks one, and
 * Escape dismisses the list without closing the panel around it.
 * Ctrl/Cmd-Enter sends.
 */
function CommentBox({
  members,
  currentUserId,
  initialText = "",
  initialMentions = [],
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: {
  members: BoardMember[];
  currentUserId: string | undefined;
  initialText?: string;
  initialMentions?: PickedMention[];
  submitLabel: string;
  busy: boolean;
  onSubmit: (body: string) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(initialText);
  const [mentions, setMentions] = useState<PickedMention[]>(initialMentions);
  const [query, setQuery] = useState<MentionQuery | null>(null);
  const [highlight, setHighlight] = useState(0);

  const others = members.filter((member) => member.userId !== currentUserId);
  const suggestions = query ? matchMembers(others, query.query) : [];
  const suggesting = suggestions.length > 0;

  const refreshQuery = (value: string, caret: number) => {
    setQuery(activeMentionQuery(value, caret));
    setHighlight(0);
  };

  const pick = (member: BoardMember) => {
    const textarea = textareaRef.current;
    if (!query || !textarea) return;
    const result = applyMention(text, query, textarea.selectionStart, member.name);
    setText(result.text);
    setMentions((current) =>
      current.some((entry) => entry.userId === member.userId)
        ? current
        : [...current, { name: member.name, userId: member.userId }]
    );
    setQuery(null);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(result.caret, result.caret);
    });
  };

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const ok = await onSubmit(plainTextToMentions(trimmed, mentions));
    if (ok) {
      setText("");
      setMentions([]);
      setQuery(null);
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="relative flex flex-col gap-2"
    >
      <textarea
        ref={textareaRef}
        value={text}
        maxLength={COMMENT_MAX_LENGTH}
        rows={2}
        placeholder="Write a comment. Type @ to mention someone."
        aria-label={submitLabel === "Save" ? "Edit comment" : "New comment"}
        aria-autocomplete="list"
        aria-expanded={suggesting}
        aria-controls={suggesting ? "mention-suggestions" : undefined}
        // Tells the detail panel to leave Escape to this box while the list is open.
        data-owns-escape={suggesting ? "true" : undefined}
        onChange={(event) => {
          setText(event.target.value);
          refreshQuery(event.target.value, event.target.selectionStart);
        }}
        onClick={(event) =>
          refreshQuery(event.currentTarget.value, event.currentTarget.selectionStart)
        }
        onKeyDown={(event) => {
          if (suggesting) {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const step = event.key === "ArrowDown" ? 1 : -1;
              setHighlight((index) => (index + step + suggestions.length) % suggestions.length);
              return;
            }
            if (event.key === "Enter" || event.key === "Tab") {
              event.preventDefault();
              pick(suggestions[highlight] ?? suggestions[0]!);
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              setQuery(null);
              return;
            }
          }
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void submit();
          }
        }}
        className="w-full resize-y rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
      />

      {suggesting && (
        <ul
          id="mention-suggestions"
          role="listbox"
          aria-label="People to mention"
          className="absolute left-0 top-full z-10 mt-1 w-60 rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-overlay)] p-1 shadow-[var(--shadow-overlay)]"
        >
          {suggestions.map((member, index) => (
            <li
              key={member.userId}
              role="option"
              aria-selected={index === highlight}
              // mousedown, not click: the textarea would lose focus first and close the list.
              onMouseDown={(event) => {
                event.preventDefault();
                pick(member);
              }}
              className={cx(
                "flex cursor-pointer items-center gap-2 rounded-[var(--radius-control)] px-2 py-1.5 text-sm",
                index === highlight
                  ? "bg-[var(--accent-subtle)] text-[var(--accent-text)]"
                  : "text-[var(--text-primary)]"
              )}
            >
              <span
                aria-hidden="true"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-2xs font-semibold text-white"
                style={{ backgroundColor: member.color }}
              >
                {member.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="truncate">{member.name}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" variant="primary" disabled={busy || !text.trim()}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
