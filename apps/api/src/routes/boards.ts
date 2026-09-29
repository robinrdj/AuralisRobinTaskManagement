import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { streamSSE } from "hono/streaming";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { RealtimeMessage } from "@auralis/shared";
import { boardMembers, boards, users } from "../db/schema.js";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import type { AppContext } from "../lib/context.js";
import type { Database } from "../db/client.js";

const router = new Hono<AppContext>();
router.use("*", requireAuth);

const idParamSchema = z.object({ id: z.string().uuid() });

type Role = "owner" | "editor" | "viewer";

/** The caller's role on a board, or a 403 if they are not a member at all. */
export async function requireMembership(
  db: Database,
  boardId: string,
  userId: string
): Promise<Role> {
  const [membership] = await db
    .select({ role: boardMembers.role })
    .from(boardMembers)
    .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, userId)))
    .limit(1);
  if (!membership) throw forbidden();
  return membership.role;
}

async function requireOwner(db: Database, boardId: string, userId: string): Promise<void> {
  const role = await requireMembership(db, boardId, userId);
  if (role !== "owner") throw forbidden("Only the board owner can do that");
}

/** The target's role, or a 404 — distinct from the caller's own 403. */
async function memberRole(db: Database, boardId: string, userId: string): Promise<Role> {
  const [membership] = await db
    .select({ role: boardMembers.role })
    .from(boardMembers)
    .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, userId)))
    .limit(1);
  if (!membership) throw notFound("They are not on this board");
  return membership.role;
}

/**
 * How many boards a user belongs to. Deleting or leaving the last one would
 * strand them in an app with nothing to show, so both are refused.
 */
async function boardCount(db: Database, userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(boardMembers)
    .where(eq(boardMembers.userId, userId));
  return row?.value ?? 0;
}

router.get("/", async (c) => {
  const rows = await c
    .get("db")
    .select({
      id: boards.id,
      name: boards.name,
      ownerId: boards.ownerId,
      role: boardMembers.role,
      createdAt: boards.createdAt,
    })
    .from(boardMembers)
    .innerJoin(boards, eq(boards.id, boardMembers.boardId))
    .where(eq(boardMembers.userId, c.get("user").id));

  return c.json({
    boards: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
  });
});

const boardNameSchema = z.object({ name: z.string().trim().min(1).max(80) });

router.post("/", zValidator("json", boardNameSchema), async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const id = randomUUID();
  const { name } = c.req.valid("json");

  await db.transaction(async (tx) => {
    await tx.insert(boards).values({ id, name, ownerId: user.id });
    await tx.insert(boardMembers).values({ boardId: id, userId: user.id, role: "owner" });
  });

  return c.json({ board: { id, name, role: "owner" } }, 201);
});

router.patch(
  "/:id",
  zValidator("param", idParamSchema),
  zValidator("json", boardNameSchema),
  async (c) => {
    const db = c.get("db");
    const { id } = c.req.valid("param");
    const { name } = c.req.valid("json");
    await requireOwner(db, id, c.get("user").id);

    await db.update(boards).set({ name }).where(eq(boards.id, id));
    c.get("hub").publish(id, { type: "board.changed", boardId: id });
    return c.json({ board: { id, name } });
  }
);

router.delete("/:id", zValidator("param", idParamSchema), async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const { id } = c.req.valid("param");
  await requireOwner(db, id, user.id);

  if ((await boardCount(db, user.id)) <= 1) {
    throw badRequest("You need at least one board. Create another before deleting this one.");
  }

  // Tasks, memberships and activity all cascade from the board row.
  await db.delete(boards).where(eq(boards.id, id));

  const hub = c.get("hub");
  hub.publish(id, { type: "board.changed", boardId: id });
  hub.disconnectBoard(id);
  return c.body(null, 204);
});

router.get("/:id/members", zValidator("param", idParamSchema), async (c) => {
  const db = c.get("db");
  const { id } = c.req.valid("param");
  await requireMembership(db, id, c.get("user").id);

  const members = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      color: users.color,
      isGuest: users.isGuest,
      role: boardMembers.role,
    })
    .from(boardMembers)
    .innerJoin(users, eq(users.id, boardMembers.userId))
    .where(eq(boardMembers.boardId, id));

  return c.json({
    // A guest's address is a generated placeholder, not something to show.
    members: members.map(({ isGuest, email, ...member }) => ({
      ...member,
      email: isGuest ? null : email,
    })),
  });
});

const inviteBodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(["editor", "viewer"]).default("editor"),
});

/**
 * Adds an existing account to the board by email.
 *
 * There is no email delivery, so an invite can only reach someone who already
 * has an account. Guest accounts are treated as unknown: their addresses are
 * generated, and a guest board is not meant to be shared into.
 */
router.post(
  "/:id/members",
  zValidator("param", idParamSchema),
  zValidator("json", inviteBodySchema),
  async (c) => {
    const db = c.get("db");
    const inviter = c.get("user");
    const { id } = c.req.valid("param");
    const { email, role } = c.req.valid("json");
    await requireOwner(db, id, inviter.id);

    const [invitee] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!invitee || invitee.isGuest) {
      throw notFound("No account uses that email. Ask them to sign up first.");
    }

    const inserted = await db
      .insert(boardMembers)
      .values({ boardId: id, userId: invitee.id, role })
      .onConflictDoNothing()
      .returning();
    if (inserted.length === 0) throw conflict("They are already on this board");

    c.get("hub").publish(id, { type: "board.changed", boardId: id });
    return c.json(
      {
        member: {
          userId: invitee.id,
          name: invitee.name,
          email: invitee.email,
          color: invitee.color,
          role,
        },
      },
      201
    );
  }
);

const memberParamSchema = idParamSchema.extend({ userId: z.string().uuid() });

router.patch(
  "/:id/members/:userId",
  zValidator("param", memberParamSchema),
  zValidator("json", z.object({ role: z.enum(["editor", "viewer"]) })),
  async (c) => {
    const db = c.get("db");
    const { id, userId } = c.req.valid("param");
    const { role } = c.req.valid("json");
    await requireOwner(db, id, c.get("user").id);

    if ((await memberRole(db, id, userId)) === "owner") {
      throw badRequest("The owner's role cannot be changed");
    }

    await db
      .update(boardMembers)
      .set({ role })
      .where(and(eq(boardMembers.boardId, id), eq(boardMembers.userId, userId)));

    c.get("hub").publish(id, { type: "board.changed", boardId: id });
    return c.json({ member: { userId, role } });
  }
);

/**
 * Removes a member. The owner can remove anyone else; anyone else can remove
 * only themselves, which is how leaving a board works.
 */
router.delete("/:id/members/:userId", zValidator("param", memberParamSchema), async (c) => {
  const db = c.get("db");
  const caller = c.get("user");
  const { id, userId } = c.req.valid("param");

  const callerRole = await requireMembership(db, id, caller.id);
  const leaving = userId === caller.id;
  if (!leaving && callerRole !== "owner") {
    throw forbidden("Only the board owner can remove people");
  }

  if ((await memberRole(db, id, userId)) === "owner") {
    throw badRequest("The owner cannot leave their own board. Delete it instead.");
  }
  if (leaving && (await boardCount(db, caller.id)) <= 1) {
    throw badRequest("You cannot leave your only board");
  }

  await db
    .delete(boardMembers)
    .where(and(eq(boardMembers.boardId, id), eq(boardMembers.userId, userId)));

  const hub = c.get("hub");
  // Close their live connection too, or they would keep receiving updates
  // from a board they no longer belong to until they reloaded.
  hub.disconnectUser(id, userId);
  hub.publish(id, { type: "board.changed", boardId: id });
  return c.body(null, 204);
});

/**
 * Server-sent events carrying this board's live updates.
 *
 * SSE rather than WebSockets: the traffic is one-directional (the client
 * writes over the REST API and only reads here), it survives proxies that
 * mishandle upgrades, and the browser reconnects on its own. The heartbeat
 * keeps intermediaries from reaping an idle connection.
 */
router.get("/:id/stream", zValidator("param", idParamSchema), async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const { id: boardId } = c.req.valid("param");
  await requireMembership(db, boardId, user.id);

  const hub = c.get("hub");

  return streamSSE(c, async (stream) => {
    const queue: RealtimeMessage[] = [];
    let notify: (() => void) | null = null;

    const unsubscribe = hub.subscribe({
      id: randomUUID(),
      boardId,
      userId: user.id,
      name: user.name,
      color: user.color,
      send: (message) => {
        queue.push(message);
        notify?.();
      },
      close: () => {
        void stream.close();
        notify?.();
      },
    });

    stream.onAbort(() => {
      unsubscribe();
      notify?.();
    });

    try {
      await stream.writeSSE({ event: "ready", data: JSON.stringify({ boardId }) });

      while (!stream.closed) {
        if (queue.length === 0) {
          // Wait for either a published message or the heartbeat interval,
          // whichever comes first.
          await new Promise<void>((resolve) => {
            notify = resolve;
            setTimeout(resolve, 25_000);
          });
          notify = null;
          if (stream.closed) break;
          if (queue.length === 0) {
            await stream.writeSSE({ event: "ping", data: "" });
            continue;
          }
        }

        const message = queue.shift()!;
        await stream.writeSSE({ event: message.type, data: JSON.stringify(message) });
      }
    } finally {
      unsubscribe();
    }
  });
});

export default router;
