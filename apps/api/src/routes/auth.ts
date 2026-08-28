import { Hono } from "hono";
import type { Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import { and, eq, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { loginSchema, signupSchema, type PublicUser } from "@auralis/shared";
import { boardMembers, boards, refreshTokens, users } from "../db/schema.js";
import { hashPassword, needsRehash, verifyPassword } from "../lib/password.js";
import {
  colorForId,
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from "../lib/tokens.js";
import { conflict, unauthorized } from "../lib/errors.js";
import { ACCESS_COOKIE, REFRESH_COOKIE, requireAuth } from "../middleware/auth.js";
import { seedDemoBoard } from "../db/seed.js";
import type { AppContext } from "../lib/context.js";
import type { Database } from "../db/client.js";
import type { Env } from "../lib/env.js";

const auth = new Hono<AppContext>();

function toPublicUser(row: typeof users.$inferSelect): PublicUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    color: row.color || colorForId(row.id),
    isGuest: row.isGuest,
  };
}

/**
 * A real scrypt hash of a random value, computed once on first use.
 *
 * Login verifies against this when the email does not exist, so a wrong email
 * and a wrong password cost the same time and cannot be told apart by an
 * attacker enumerating accounts.
 */
let dummyHash: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(generateRefreshToken());
  return dummyHash;
}

/**
 * Issues a fresh access/refresh pair and sets them as httpOnly cookies.
 * `familyId` ties a rotation chain together so a replayed token can revoke
 * every descendant at once.
 */
async function issueSession(
  c: Context<AppContext>,
  db: Database,
  env: Env,
  user: PublicUser,
  familyId: string = randomUUID()
): Promise<void> {
  const accessToken = await signAccessToken(
    { sub: user.id, isGuest: user.isGuest },
    env.JWT_SECRET,
    env.ACCESS_TOKEN_TTL
  );
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashRefreshToken(refreshToken),
    familyId,
    expiresAt,
  });

  /*
   * SameSite=Lax keeps the cookie first-party, which is both safer and
   * enough when the app and API share an origin. On a split deployment the
   * browser would simply never send it, so the session silently fails —
   * a guest is created and the very next request is a 401.
   */
  const base = {
    // Not readable from JavaScript, so an XSS bug cannot exfiltrate it.
    httpOnly: true,
    // SameSite=None is only honoured on a secure connection.
    secure: env.CROSS_SITE_COOKIES || env.NODE_ENV === "production",
    sameSite: env.CROSS_SITE_COOKIES ? ("none" as const) : ("lax" as const),
    path: "/",
  };

  setCookie(c, ACCESS_COOKIE, accessToken, { ...base, maxAge: 60 * 60 });
  // Scoped to the refresh endpoint so it is not attached to ordinary API calls.
  setCookie(c, REFRESH_COOKIE, refreshToken, {
    ...base,
    path: "/api/auth",
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400,
  });
}

auth.post("/signup", zValidator("json", signupSchema), async (c) => {
  const db = c.get("db");
  const env = c.get("env");
  const { email, password, name } = c.req.valid("json");

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing.length > 0) {
    throw conflict("An account with that email already exists");
  }

  const id = randomUUID();
  const [row] = await db
    .insert(users)
    .values({
      id,
      email,
      name,
      passwordHash: await hashPassword(password),
      color: colorForId(id),
    })
    .returning();

  const user = toPublicUser(row!);
  const board = await seedDemoBoard(db, user.id, { sampleTasks: false });
  await issueSession(c, db, env, user);
  return c.json({ user, boardId: board.id }, 201);
});

auth.post("/login", zValidator("json", loginSchema), async (c) => {
  const db = c.get("db");
  const env = c.get("env");
  const { email, password } = c.req.valid("json");

  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  const ok = await verifyPassword(password, row?.passwordHash ?? (await getDummyHash()));
  if (!row || !ok) {
    throw unauthorized("That email and password do not match");
  }

  // Opportunistically upgrade hashes made under weaker parameters.
  if (needsRehash(row.passwordHash)) {
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(password) })
      .where(eq(users.id, row.id));
  }

  const user = toPublicUser(row);
  await issueSession(c, db, env, user);
  return c.json({ user });
});

/**
 * Creates a throwaway account with a fully populated board.
 *
 * This is the front door for anyone evaluating the app: one click, no signup,
 * and a board that already has something to look at. Guest rows carry an
 * expiry and are reaped by a scheduled job.
 */
auth.post("/guest", async (c) => {
  const db = c.get("db");
  const env = c.get("env");
  const id = randomUUID();

  const [row] = await db
    .insert(users)
    .values({
      id,
      email: `guest-${id}@guest.auralis.local`,
      name: "Guest",
      passwordHash: await hashPassword(generateRefreshToken()),
      color: colorForId(id),
      isGuest: true,
      expiresAt: new Date(Date.now() + env.GUEST_TTL_HOURS * 3_600_000),
    })
    .returning();

  const user = toPublicUser(row!);
  const board = await seedDemoBoard(db, user.id, { sampleTasks: true });
  await issueSession(c, db, env, user);
  return c.json({ user, boardId: board.id }, 201);
});

/**
 * Rotates a refresh token. Presenting a token that was already rotated means
 * it leaked, so the whole family is revoked rather than just that one token.
 */
auth.post("/refresh", async (c) => {
  const db = c.get("db");
  const env = c.get("env");
  const presented = getCookie(c, REFRESH_COOKIE);
  if (!presented) throw unauthorized("No session to refresh");

  const [stored] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashRefreshToken(presented)))
    .limit(1);

  if (!stored) throw unauthorized("Your session has expired");

  if (stored.revokedAt !== null) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.familyId, stored.familyId), isNull(refreshTokens.revokedAt)));
    deleteCookie(c, ACCESS_COOKIE, { path: "/" });
    deleteCookie(c, REFRESH_COOKIE, { path: "/api/auth" });
    throw unauthorized("Your session was ended for security reasons");
  }

  if (stored.expiresAt.getTime() < Date.now()) {
    throw unauthorized("Your session has expired");
  }

  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, stored.id));

  const [row] = await db.select().from(users).where(eq(users.id, stored.userId)).limit(1);
  if (!row) throw unauthorized("Your session has expired");

  const user = toPublicUser(row);
  await issueSession(c, db, env, user, stored.familyId);
  return c.json({ user });
});

auth.post("/logout", async (c) => {
  const db = c.get("db");
  const presented = getCookie(c, REFRESH_COOKIE);
  if (presented) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, hashRefreshToken(presented)));
  }
  deleteCookie(c, ACCESS_COOKIE, { path: "/" });
  deleteCookie(c, REFRESH_COOKIE, { path: "/api/auth" });
  return c.body(null, 204);
});

auth.get("/me", requireAuth, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const memberships = await db
    .select({ id: boards.id, name: boards.name, role: boardMembers.role })
    .from(boardMembers)
    .innerJoin(boards, eq(boards.id, boardMembers.boardId))
    .where(eq(boardMembers.userId, user.id));
  return c.json({ user, boards: memberships });
});

export default auth;
