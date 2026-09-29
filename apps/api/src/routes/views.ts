import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, asc, eq, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  createViewSchema,
  updateViewSchema,
  viewFiltersSchema,
  type SavedView,
  type SortKey,
} from "@auralis/shared";
import { savedViews, users } from "../db/schema.js";
import { conflict, forbidden, notFound } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { assertBoardAccess } from "./tasks.js";
import type { AppContext } from "../lib/context.js";
import type { Database } from "../db/client.js";

/** Saved views, mounted at /api with auth applied per route. */
const router = new Hono<AppContext>();

const boardParamSchema = z.object({ id: z.string().uuid() });
const viewParamSchema = boardParamSchema.extend({ viewId: z.string().uuid() });

type ViewRow = typeof savedViews.$inferSelect;

function toView(row: ViewRow, ownerName: string | null): SavedView {
  return {
    id: row.id,
    boardId: row.boardId,
    ownerId: row.ownerId,
    ownerName,
    name: row.name,
    // Parsed on the way out too, so a row written by an older shape still
    // reaches the client complete, with defaults for anything missing.
    filters: viewFiltersSchema.parse(row.filters ?? {}),
    sortBy: row.sortBy as SortKey,
    sortDirection: row.sortDirection === "desc" ? "desc" : "asc",
    shared: row.shared,
  };
}

async function loadView(db: Database, boardId: string, viewId: string): Promise<ViewRow> {
  const [row] = await db
    .select()
    .from(savedViews)
    .where(and(eq(savedViews.id, viewId), eq(savedViews.boardId, boardId)))
    .limit(1);
  if (!row) throw notFound("That view no longer exists");
  return row;
}

/** A person's own view names are unique on a board, ignoring case. */
async function assertNameFree(
  db: Database,
  boardId: string,
  ownerId: string,
  name: string,
  exceptId?: string
): Promise<void> {
  const [clash] = await db
    .select({ id: savedViews.id })
    .from(savedViews)
    .where(
      and(
        eq(savedViews.boardId, boardId),
        eq(savedViews.ownerId, ownerId),
        sql`lower(${savedViews.name}) = lower(${name})`,
        exceptId ? ne(savedViews.id, exceptId) : undefined
      )
    )
    .limit(1);
  if (clash) throw conflict("You already have a view with that name");
}

/** Only a change to a shared view is news to anyone else. */
function announce(c: Context<AppContext>, boardId: string, affectsOthers: boolean) {
  if (!affectsOthers) return;
  c.get("hub").publish(boardId, { type: "views.changed", origin: c.get("originId"), boardId });
}

router.get(
  "/boards/:id/views",
  requireAuth,
  zValidator("param", boardParamSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const { id } = c.req.valid("param");
    await assertBoardAccess(db, id, user.id, false);

    const rows = await db
      .select({ view: savedViews, ownerName: users.name })
      .from(savedViews)
      .leftJoin(users, eq(users.id, savedViews.ownerId))
      .where(
        and(
          eq(savedViews.boardId, id),
          or(eq(savedViews.ownerId, user.id), eq(savedViews.shared, true))
        )
      )
      .orderBy(asc(savedViews.name));

    return c.json({ views: rows.map((row) => toView(row.view, row.ownerName)) });
  }
);

router.post(
  "/boards/:id/views",
  requireAuth,
  zValidator("param", boardParamSchema),
  zValidator("json", createViewSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    // Anyone on the board may keep private views; sharing one with everyone
    // is a change to the board, so it needs edit access.
    await assertBoardAccess(db, id, user.id, body.shared);
    await assertNameFree(db, id, user.id, body.name);

    const [row] = await db
      .insert(savedViews)
      .values({ boardId: id, ownerId: user.id, ...body })
      .returning();

    announce(c, id, body.shared);
    return c.json({ view: toView(row!, user.name) }, 201);
  }
);

router.patch(
  "/boards/:id/views/:viewId",
  requireAuth,
  zValidator("param", viewParamSchema),
  zValidator("json", updateViewSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const { id, viewId } = c.req.valid("param");
    const updates = c.req.valid("json");

    await assertBoardAccess(db, id, user.id, updates.shared === true);
    const existing = await loadView(db, id, viewId);
    if (existing.ownerId !== user.id)
      throw forbidden("Only the person who saved a view can change it");
    if (updates.name) await assertNameFree(db, id, user.id, updates.name, viewId);

    const [row] = await db
      .update(savedViews)
      .set(updates)
      .where(eq(savedViews.id, viewId))
      .returning();

    announce(c, id, existing.shared || row!.shared);
    return c.json({ view: toView(row!, user.name) });
  }
);

/** The creator can delete a view; the board owner can also remove a shared one. */
router.delete(
  "/boards/:id/views/:viewId",
  requireAuth,
  zValidator("param", viewParamSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const { id, viewId } = c.req.valid("param");
    const role = await assertBoardAccess(db, id, user.id, false);
    const existing = await loadView(db, id, viewId);

    const mine = existing.ownerId === user.id;
    if (!mine && !(existing.shared && role === "owner")) {
      // A private view someone else owns is not even visible, so it reads as missing.
      if (!existing.shared) throw notFound("That view no longer exists");
      throw forbidden("Only the person who saved a view can delete it");
    }

    await db.delete(savedViews).where(eq(savedViews.id, viewId));
    announce(c, id, existing.shared);
    return c.body(null, 204);
  }
);

export default router;
