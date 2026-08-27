import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { createDatabase, type DatabaseHandle } from "./client.js";
import { runMigrations } from "./migrate.js";
import { boards, taskDependencies, tasks, users } from "./schema.js";

/**
 * These run against PGlite — real Postgres, in-process. They assert the
 * constraints we are relying on actually exist in the database rather than
 * only in application code.
 */
describe("schema", () => {
  let handle: DatabaseHandle;
  let userId: string;
  let boardId: string;

  beforeAll(async () => {
    handle = createDatabase(undefined);
    await runMigrations(handle);

    const [user] = await handle.db
      .insert(users)
      .values({
        email: "ada@example.com",
        name: "Ada",
        passwordHash: "scrypt$placeholder",
        color: "#7c3aed",
      })
      .returning();
    userId = user!.id;

    const [board] = await handle.db
      .insert(boards)
      .values({ name: "Demo", ownerId: userId })
      .returning();
    boardId = board!.id;
  }, 60_000);

  afterAll(async () => {
    await handle?.close();
  });

  it("runs on a real Postgres engine, not a lookalike", async () => {
    // `execute` returns { rows } on some drivers and a bare array on others.
    const result = await handle.db.execute(sql`select version()`);
    const rows = (Array.isArray(result) ? result : result.rows) as { version: string }[];
    expect(rows[0]?.version).toMatch(/PostgreSQL/);
  });

  it("enforces case-insensitive email uniqueness", async () => {
    await expect(
      handle.db.insert(users).values({
        email: "ADA@example.com",
        name: "Impostor",
        passwordHash: "x",
        color: "#000",
      })
    ).rejects.toThrow();
  });

  it("applies column defaults for status, priority and description", async () => {
    const [task] = await handle.db
      .insert(tasks)
      .values({ boardId, title: "Defaults", position: "a0V" })
      .returning();
    expect(task!.status).toBe("todo");
    expect(task!.priority).toBe("low");
    expect(task!.description).toBe("");
    expect(task!.completedAt).toBeNull();
  });

  it("rejects a status outside the enum", async () => {
    await expect(
      handle.db.execute(
        sql`insert into tasks (board_id, title, position, status)
            values (${boardId}, 'Bad', 'a1', 'archived')`
      )
    ).rejects.toThrow();
  });

  it("returns a due date as the exact calendar day it was written", async () => {
    // The v1 bug class: a timezone-shifted date landing on the wrong day.
    const [task] = await handle.db
      .insert(tasks)
      .values({ boardId, title: "Due", position: "a1V", dueDate: "2026-01-01" })
      .returning();
    expect(task!.dueDate).toBe("2026-01-01");
  });

  it("cascades subtask deletion from the parent", async () => {
    const [parent] = await handle.db
      .insert(tasks)
      .values({ boardId, title: "Parent", position: "a2V" })
      .returning();
    await handle.db
      .insert(tasks)
      .values({ boardId, title: "Child", position: "a3V", parentId: parent!.id });

    await handle.db.delete(tasks).where(eq(tasks.id, parent!.id));
    const remaining = await handle.db
      .select()
      .from(tasks)
      .where(eq(tasks.parentId, parent!.id));
    expect(remaining).toHaveLength(0);
  });

  it("nulls the assignee rather than deleting the task when a user is removed", async () => {
    const [temp] = await handle.db
      .insert(users)
      .values({ email: "temp@example.com", name: "Temp", passwordHash: "x", color: "#111" })
      .returning();
    const [task] = await handle.db
      .insert(tasks)
      .values({ boardId, title: "Assigned", position: "a4V", assigneeId: temp!.id })
      .returning();

    await handle.db.delete(users).where(eq(users.id, temp!.id));
    const [after] = await handle.db.select().from(tasks).where(eq(tasks.id, task!.id));
    expect(after).toBeDefined();
    expect(after!.assigneeId).toBeNull();
  });

  it("stores a dependency edge once", async () => {
    const [a] = await handle.db
      .insert(tasks)
      .values({ boardId, title: "A", position: "a5V" })
      .returning();
    const [b] = await handle.db
      .insert(tasks)
      .values({ boardId, title: "B", position: "a6V" })
      .returning();

    await handle.db.insert(taskDependencies).values({ blockerId: a!.id, blockedId: b!.id });
    await expect(
      handle.db.insert(taskDependencies).values({ blockerId: a!.id, blockedId: b!.id })
    ).rejects.toThrow();
  });
});
