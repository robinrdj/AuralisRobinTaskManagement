import { useContext, useState } from "react";
import { LABEL_COLORS, type Label } from "@auralis/shared";
import { useCreateLabelMutation, useSetTaskLabelsMutation } from "@/store/api";
import { useAppDispatch } from "@/store";
import { pushToast } from "@/store/toastSlice";
import { Button } from "@/components/ui/primitives";
import { cx, errorMessage } from "@/components/ui/labels";
import { TaskLabelsContext } from "./boardContext";

/**
 * The labels section of the task panel: what the task carries, and a picker
 * to toggle any of the board's labels or make a new one on the spot.
 */
export function LabelPicker({
  taskId,
  boardId,
  labels,
  readOnly,
}: {
  taskId: string;
  boardId: string;
  labels: Label[];
  readOnly: boolean;
}) {
  const dispatch = useAppDispatch();
  const assigned = useContext(TaskLabelsContext).get(taskId) ?? [];
  const assignedIds = new Set(assigned.map((label) => label.id));
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(LABEL_COLORS[0]);
  const [setTaskLabels] = useSetTaskLabelsMutation();
  const [createLabel, { isLoading: creating }] = useCreateLabelMutation();

  const report = (error: unknown, fallback: string) =>
    dispatch(pushToast({ message: errorMessage(error, fallback), tone: "danger" }));

  const save = (ids: string[]) =>
    setTaskLabels({ boardId, taskId, labelIds: ids })
      .unwrap()
      .catch((error) => report(error, "Could not update the labels."));

  const toggle = (labelId: string) => {
    const next = assignedIds.has(labelId)
      ? [...assignedIds].filter((id) => id !== labelId)
      : [...assignedIds, labelId];
    void save(next);
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const { label } = await createLabel({ boardId, name: trimmed, color }).unwrap();
      setName("");
      // A label made from a task's panel is almost always meant for that task.
      await save([...assignedIds, label.id]);
    } catch (error) {
      report(error, "Could not create that label.");
    }
  };

  return (
    <section aria-label="Labels">
      <h3 className="mb-2 flex items-center gap-2 text-2xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Labels
        {!readOnly && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="ml-auto normal-case tracking-normal text-[var(--accent-text)] hover:underline"
          >
            {open ? "Done" : "Edit labels"}
          </button>
        )}
      </h3>

      {!open &&
        (assigned.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">No labels.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {assigned.map((label) => (
              <li
                key={label.id}
                className="rounded-[var(--radius-pill)] px-2 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: label.color }}
              >
                {label.name}
              </li>
            ))}
          </ul>
        ))}

      {open && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] p-2.5">
          {labels.length > 0 ? (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Board labels">
              {labels.map((label) => {
                const on = assignedIds.has(label.id);
                return (
                  <button
                    key={label.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(label.id)}
                    className={cx(
                      "inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-2 py-0.5 text-xs font-medium transition-colors",
                      on
                        ? "border-transparent text-white"
                        : "border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                    )}
                    style={on ? { backgroundColor: label.color } : undefined}
                  >
                    {!on && (
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: label.color }}
                      />
                    )}
                    {label.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">
              This board has no labels yet. Make the first one below.
            </p>
          )}

          <form onSubmit={create} className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={40}
                placeholder="New label"
                aria-label="New label name"
                className="h-8 min-w-0 flex-1 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
              />
              <Button type="submit" size="sm" disabled={creating || !name.trim()}>
                Create label
              </Button>
            </div>
            <ColorSwatches value={color} onChange={setColor} />
          </form>
        </div>
      )}
    </section>
  );
}

/** The preset label colours as a radio group. */
export function ColorSwatches({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Label colour" className="flex flex-wrap gap-1.5">
      {LABEL_COLORS.map((swatch) => (
        <button
          key={swatch}
          type="button"
          role="radio"
          aria-checked={value === swatch}
          aria-label={`Colour ${swatch}`}
          onClick={() => onChange(swatch)}
          className={cx(
            "h-5 w-5 rounded-full ring-offset-2 ring-offset-[var(--surface-base)]",
            value === swatch && "ring-2 ring-[var(--text-primary)]"
          )}
          style={{ backgroundColor: swatch }}
        />
      ))}
    </div>
  );
}
