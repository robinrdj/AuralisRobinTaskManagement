import { serve } from "@hono/node-server";
import { lt, and, eq } from "drizzle-orm";
import { createApp } from "./app.js";
import { getDatabase } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { loadEnv } from "./lib/env.js";
import { users } from "./db/schema.js";

const env = loadEnv();
const handle = getDatabase();

// Migrating on boot means a deploy can never serve traffic against a schema
// it was not built for. It is a no-op when everything is already applied.
await runMigrations(handle);

if (handle.driver === "pglite") {
  console.warn(
    "[api] DATABASE_URL is not set — running on an in-memory PGlite database. " +
      "Data will not survive a restart."
  );
}

const app = createApp({ db: handle.db, env });

/** Removes expired guest accounts; their boards and tasks cascade away. */
async function reapGuests(): Promise<void> {
  try {
    const deleted = await handle.db
      .delete(users)
      .where(and(eq(users.isGuest, true), lt(users.expiresAt, new Date())))
      .returning({ id: users.id });
    if (deleted.length > 0) {
      console.log(`[api] reaped ${deleted.length} expired guest account(s)`);
    }
  } catch (err) {
    console.error("[api] guest reaper failed", err);
  }
}

const reaper = setInterval(reapGuests, 60 * 60 * 1000);
reaper.unref();
void reapGuests();

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port} (${handle.driver})`);
});

/**
 * Stop accepting connections, let in-flight requests finish, then close the
 * pool. Without this a deploy can cut off a request mid-transaction.
 */
async function shutdown(signal: string): Promise<void> {
  console.log(`[api] ${signal} received, shutting down`);
  clearInterval(reaper);
  server.close(async () => {
    await handle.close();
    process.exit(0);
  });
  setTimeout(() => {
    console.error("[api] forced exit after 10s");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
