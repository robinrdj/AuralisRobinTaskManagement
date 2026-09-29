import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { onError } from "./lib/errors.js";
import { trackOrigin } from "./middleware/auth.js";
import { RealtimeHub } from "./realtime/hub.js";
import authRoutes from "./routes/auth.js";
import boardRoutes from "./routes/boards.js";
import taskRoutes from "./routes/tasks.js";
import commentRoutes from "./routes/comments.js";
import type { AppContext } from "./lib/context.js";
import type { Database } from "./db/client.js";
import type { Env } from "./lib/env.js";

export interface CreateAppOptions {
  db: Database;
  env: Env;
  hub?: RealtimeHub;
}

/**
 * Builds the application.
 *
 * The database, config and realtime hub are injected rather than imported as
 * module singletons, which is what lets each integration test run against its
 * own throwaway Postgres with no shared state between files.
 */
export function createApp({ db, env, hub = new RealtimeHub() }: CreateAppOptions) {
  const app = new Hono<AppContext>();

  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("env", env);
    c.set("hub", hub);
    await next();
  });

  if (env.NODE_ENV !== "test") {
    app.use("*", logger());
  }

  app.use("*", secureHeaders());
  app.use(
    "/api/*",
    cors({
      origin: env.corsOrigins,
      // Cookies only travel cross-origin when the origin is explicitly allowed,
      // so the allowlist is the CSRF boundary as well as the CORS one.
      credentials: true,
      allowHeaders: ["Content-Type", "Authorization", "X-Client-Id"],
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    })
  );
  /**
   * Reject a state-changing request whose Origin is not on the allowlist.
   *
   * With SameSite=None the browser attaches session cookies to cross-site
   * requests, so Lax is no longer standing between an attacker page and a
   * write. CORS already blocks the *response* from being read, but this
   * stops the write from happening at all — the request never reaches a
   * handler. Browsers always send Origin on cross-origin requests, and on
   * same-origin unsafe methods too, so a missing Origin means a non-browser
   * client, which cannot be riding a cookie it never had.
   */
  app.use("/api/*", async (c, next) => {
    const unsafe = ["POST", "PATCH", "PUT", "DELETE"].includes(c.req.method);
    const origin = c.req.header("Origin");

    if (unsafe && origin && !env.corsOrigins.includes(origin)) {
      return c.json(
        { error: { code: "forbidden_origin", message: "That origin is not allowed" } },
        403
      );
    }
    await next();
  });

  app.use("/api/*", trackOrigin);

  app.get("/api/health", (c) => c.json({ status: "ok", uptime: Math.round(process.uptime()) }));

  app.route("/api/auth", authRoutes);
  app.route("/api/boards", boardRoutes);
  app.route("/api/tasks", taskRoutes);
  app.route("/api/tasks", commentRoutes);

  app.notFound((c) =>
    c.json({ error: { code: "not_found", message: "No such endpoint" } }, 404)
  );
  app.onError(onError);

  return app;
}

export type App = ReturnType<typeof createApp>;
