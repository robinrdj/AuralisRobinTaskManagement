import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { streamSSE } from "hono/streaming";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { RealtimeMessage } from "@auralis/shared";
import { boardMembers, boards, users } from "../db/schema.js";
import { forbidden } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import type { AppContext } from "../lib/context.js";

const router = new Hono<AppContext>();
router.use("*", requireAuth);

const idParamSchema = z.object({ id: z.string().uuid() });

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

router.post(
  "/",
  zValidator("json", z.object({ name: z.string().min(1).max(80) })),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const id = randomUUID();

    await db.transaction(async (tx) => {
      await tx.insert(boards).values({ id, name: c.req.valid("json").name, ownerId: user.id });
      await tx.insert(boardMembers).values({ boardId: id, userId: user.id, role: "owner" });
    });

    return c.json({ board: { id, name: c.req.valid("json").name, role: "owner" } }, 201);
  }
);

router.get("/:id/members", zValidator("param", idParamSchema), async (c) => {
  const db = c.get("db");
  const { id } = c.req.valid("param");

  const [membership] = await db
    .select({ role: boardMembers.role })
    .from(boardMembers)
    .where(and(eq(boardMembers.boardId, id), eq(boardMembers.userId, c.get("user").id)))
    .limit(1);
  if (!membership) throw forbidden();

  const members = await db
    .select({
      userId: users.id,
      name: users.name,
      color: users.color,
      role: boardMembers.role,
    })
    .from(boardMembers)
    .innerJoin(users, eq(users.id, boardMembers.userId))
    .where(eq(boardMembers.boardId, id));

  return c.json({ members });
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

  const [membership] = await db
    .select({ role: boardMembers.role })
    .from(boardMembers)
    .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, user.id)))
    .limit(1);
  if (!membership) throw forbidden();

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
