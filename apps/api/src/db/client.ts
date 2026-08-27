import { drizzle as drizzleNodePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import * as schema from "./schema.js";

/**
 * One schema, two drivers.
 *
 * Production points DATABASE_URL at a real Postgres. Local development and
 * CI run PGlite — the same Postgres engine compiled to WASM — so tests
 * exercise real Postgres semantics (enums, jsonb, `on conflict`, transactions)
 * with nothing to install and no service container. The alternative, SQLite
 * in dev and Postgres in prod, hides exactly the bugs that matter.
 */
export type Database = NodePgDatabase<typeof schema>;

export interface DatabaseHandle {
  db: Database;
  driver: "postgres" | "pglite";
  close: () => Promise<void>;
}

/**
 * `pg` returns DATE columns as JS Dates in the server's local zone, which
 * shifts a due date across midnight for anyone west of UTC. We store calendar
 * days as text and want them back verbatim.
 */
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

export function createDatabase(url = process.env.DATABASE_URL): DatabaseHandle {
  if (url) {
    const pool = new pg.Pool({
      connectionString: url,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      // Neon and most managed Postgres terminate idle connections; keeping the
      // pool honest avoids handing out a socket the server already closed.
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: url.includes("localhost") ? false : { rejectUnauthorized: true },
    });

    return {
      db: drizzleNodePg(pool, { schema }),
      driver: "postgres",
      close: () => pool.end(),
    };
  }

  // `dataDir` undefined keeps the database in memory, which is what tests want.
  const client = new PGlite(process.env.PGLITE_DATA_DIR);
  return {
    db: drizzlePglite(client, { schema }) as unknown as Database,
    driver: "pglite",
    close: () => client.close(),
  };
}

let handle: DatabaseHandle | undefined;

/** The process-wide handle. Tests build their own with `createDatabase`. */
export function getDatabase(): DatabaseHandle {
  handle ??= createDatabase();
  return handle;
}

export { schema };
