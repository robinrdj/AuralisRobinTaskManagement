import { z } from "zod";
import { isoDateSchema, taskPrioritySchema, taskStatusSchema } from "./task.js";

/**
 * Saved views: a named set of filters and a sort order.
 *
 * A view is personal unless its creator shares it with the board, in which
 * case every member sees it in their list. Ids inside the filters (people,
 * labels) may outlive what they point to; a stale id simply matches nothing.
 */

export const SORT_KEYS = ["position", "dueDate", "priority", "title", "createdAt"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const viewFiltersSchema = z.object({
  search: z.string().max(200).default(""),
  priorities: z.array(taskPrioritySchema).max(10).default([]),
  statuses: z.array(taskStatusSchema).max(10).default([]),
  assigneeIds: z.array(z.string().uuid()).max(100).default([]),
  labelIds: z.array(z.string().uuid()).max(100).default([]),
  dueFrom: isoDateSchema.nullable().default(null),
  dueTo: isoDateSchema.nullable().default(null),
  overdueOnly: z.boolean().default(false),
});

export type ViewFilters = z.infer<typeof viewFiltersSchema>;

export const createViewSchema = z.object({
  name: z.string().trim().min(1, "A view needs a name").max(60),
  filters: viewFiltersSchema,
  sortBy: z.enum(SORT_KEYS).default("position"),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
  shared: z.boolean().default(false),
});

export const updateViewSchema = createViewSchema.partial();

export interface SavedView {
  id: string;
  boardId: string;
  /** Null if the creator's account is gone; the view stays for whoever it was shared with. */
  ownerId: string | null;
  ownerName: string | null;
  name: string;
  filters: ViewFilters;
  sortBy: SortKey;
  sortDirection: "asc" | "desc";
  shared: boolean;
}
