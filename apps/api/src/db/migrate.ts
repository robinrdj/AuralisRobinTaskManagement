import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { migrate as migrateNodePg } from "drizzle-orm/node-postgres/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { createDatabase, type DatabaseHandle } from "./client.js";

const MIGRATIONS_FOLDER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle"
);

/**
 * Applies pending migrations. Called by `npm run db:migrate`, by the test
 * harness against a throwaway PGlite instance, and on boot in production so
 * a deploy can never serve traffic against a stale schema.
 */
export async function runMigrations(handle: DatabaseHandle): Promise<void> {
  const config = { migrationsFolder: MIGRATIONS_FOLDER };
  if (handle.driver === "postgres") {
    await migrateNodePg(handle.db, config);
  } else {
    await migratePglite(handle.db as never, config);
  }
}

/** True when this module is the process entry point rather than an import. */
function isEntryPoint(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
}

if (isEntryPoint()) {
  const handle = createDatabase();
  console.log(`Running migrations against ${handle.driver}…`);
  await runMigrations(handle);
  console.log("Migrations applied.");
  await handle.close();
}
