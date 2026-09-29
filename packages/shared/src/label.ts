import { z } from "zod";

/**
 * Labels are a board's own tags. They live beside tasks rather than inside
 * them: a task's shape on the wire is unchanged, and the board fetches its
 * labels and their assignments in one request.
 */

/**
 * The colours offered when creating a label. Each is a mid-tone that holds
 * white text and reads on both the light and dark surfaces.
 */
export const LABEL_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#dc2626",
  "#d97706",
  "#65a30d",
  "#0d9488",
  "#475569",
] as const;

export const labelSchema = z.object({
  id: z.string().uuid(),
  boardId: z.string().uuid(),
  name: z.string(),
  color: z.string(),
});

export type Label = z.infer<typeof labelSchema>;

export const createLabelSchema = z.object({
  name: z.string().trim().min(1, "A label needs a name").max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected a hex colour such as #2563eb"),
});

export const updateLabelSchema = createLabelSchema.partial();

export const setTaskLabelsSchema = z.object({
  labelIds: z.array(z.string().uuid()).max(20),
});

export interface LabelAssignment {
  taskId: string;
  labelId: string;
}
