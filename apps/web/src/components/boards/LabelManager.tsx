import { useState } from "react";
import { LABEL_COLORS, type Label } from "@auralis/shared";
import {
  useCreateLabelMutation,
  useDeleteLabelMutation,
  useGetLabelsQuery,
  useUpdateLabelMutation,
} from "@/store/api";
import { useAppDispatch } from "@/store";
import { pushToast } from "@/store/toastSlice";
import { Button } from "../ui/primitives";
import { errorMessage } from "../ui/labels";

/** Rename, recolour and delete a board's labels. */
export function LabelManager({ boardId, canEdit }: { boardId: string; canEdit: boolean }) {
  const dispatch = useAppDispatch();
  const { data } = useGetLabelsQuery(boardId);
  const [createLabel, { isLoading: creating }] = useCreateLabelMutation();
  const [draft, setDraft] = useState("");
  const labels = data?.labels ?? [];

  const report = (error: unknown, fallback: string) =>
    dispatch(pushToast({ message: errorMessage(error, fallback), tone: "danger" }));

  return (
    <section>
      <h3 className="mb-2 text-2xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Labels
      </h3>
      {labels.length === 0 ? (
        <p className="mb-2 text-xs text-[var(--text-muted)]">No labels on this board yet.</p>
      ) : (
        <ul className="mb-2 flex flex-col gap-1.5" aria-label="Board labels">
          {labels.map((label) => (
            <LabelRow key={label.id} label={label} canEdit={canEdit} onError={report} />
          ))}
        </ul>
      )}

      {canEdit && (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const name = draft.trim();
            if (!name) return;
            // New labels take the next colour in turn, so a fresh set is varied.
            const color = LABEL_COLORS[labels.length % LABEL_COLORS.length]!;
            void createLabel({ boardId, name, color })
              .unwrap()
              .then(() => setDraft(""))
              .catch((error) => report(error, "Could not create that label."));
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={40}
            placeholder="New label"
            aria-label="New label name"
            className="h-8 min-w-0 flex-1 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
          />
          <Button type="submit" size="sm" disabled={creating || !draft.trim()}>
            Create label
          </Button>
        </form>
      )}
    </section>
  );
}

function LabelRow({
  label,
  canEdit,
  onError,
}: {
  label: Label;
  canEdit: boolean;
  onError: (error: unknown, fallback: string) => void;
}) {
  const [updateLabel] = useUpdateLabelMutation();
  const [deleteLabel] = useDeleteLabelMutation();
  const [name, setName] = useState(label.name);

  const nextColor = () => {
    const index = LABEL_COLORS.indexOf(label.color as (typeof LABEL_COLORS)[number]);
    return LABEL_COLORS[(index + 1) % LABEL_COLORS.length]!;
  };

  const rename = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === label.name) {
      setName(label.name);
      return;
    }
    void updateLabel({ boardId: label.boardId, labelId: label.id, name: trimmed })
      .unwrap()
      .catch((error) => {
        setName(label.name);
        onError(error, "Could not rename that label.");
      });
  };

  return (
    <li className="flex items-center gap-2">
      <button
        type="button"
        disabled={!canEdit}
        title={canEdit ? "Change colour" : undefined}
        aria-label={`Change colour of ${label.name}`}
        onClick={() =>
          void updateLabel({ boardId: label.boardId, labelId: label.id, color: nextColor() })
            .unwrap()
            .catch((error) => onError(error, "Could not change the colour."))
        }
        className="h-5 w-5 shrink-0 rounded-full disabled:cursor-default"
        style={{ backgroundColor: label.color }}
      />
      <input
        value={name}
        disabled={!canEdit}
        maxLength={40}
        aria-label={`Name of label ${label.name}`}
        onChange={(event) => setName(event.target.value)}
        onBlur={rename}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
        className="h-8 min-w-0 flex-1 rounded-[var(--radius-control)] border border-transparent bg-transparent px-1.5 text-sm text-[var(--text-primary)] hover:border-[var(--border-default)] focus:border-[var(--accent)] focus:outline-none disabled:hover:border-transparent"
      />
      {canEdit && (
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Delete label ${label.name}`}
          onClick={() =>
            void deleteLabel({ boardId: label.boardId, labelId: label.id })
              .unwrap()
              .catch((error) => onError(error, "Could not delete that label."))
          }
        >
          Delete
        </Button>
      )}
    </li>
  );
}
