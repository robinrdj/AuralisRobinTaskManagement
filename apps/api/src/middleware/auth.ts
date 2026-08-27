import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import { colorForId, verifyAccessToken } from "../lib/tokens.js";
import { unauthorized } from "../lib/errors.js";
import { users } from "../db/schema.js";
import type { AppContext } from "../lib/context.js";

export const ACCESS_COOKIE = "auralis_access";
export const REFRESH_COOKIE = "auralis_refresh";

/**
 * Resolves the caller from the access token and rejects the request if there
 * isn't one. The token is read from an httpOnly cookie so page scripts — and
 * therefore XSS — cannot reach it; the Authorization header is accepted too
 * for non-browser clients and integration tests.
 */
export const requireAuth = createMiddleware<AppContext>(async (c, next) => {
  const header = c.req.header("Authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const token = bearer ?? getCookie(c, ACCESS_COOKIE);
  if (!token) throw unauthorized();

  const claims = await verifyAccessToken(token, c.get("env").JWT_SECRET);
  if (!claims) throw unauthorized("Your session has expired");

  // The token proves who signed in; the row proves they still exist. Without
  // this lookup a deleted user's token stays valid until it expires.
  const [row] = await c.get("db").select().from(users).where(eq(users.id, claims.sub)).limit(1);
  if (!row) throw unauthorized("Your session has expired");

  c.set("user", {
    id: row.id,
    email: row.email,
    name: row.name,
    color: row.color || colorForId(row.id),
    isGuest: row.isGuest,
  });
  await next();
});

/** Records the caller's client id so the realtime hub can skip its own echo. */
export const trackOrigin = createMiddleware<AppContext>(async (c, next) => {
  c.set("originId", c.req.header("X-Client-Id") ?? null);
  await next();
});
