import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { collectCookies, createHarness, signUp, type TestHarness } from "../test/harness.js";
import { refreshTokens, users } from "../db/schema.js";

describe("auth", () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createHarness();
  }, 60_000);

  afterAll(async () => {
    await harness?.close();
  });

  describe("signup", () => {
    it("creates an account, a starter board and a session", async () => {
      const response = await harness.request("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email: "ada@example.com",
          password: "a-sufficiently-long-password",
          name: "Ada",
        }),
      });

      expect(response.status).toBe(201);
      const body = (await response.json()) as { user: { email: string }; boardId: string };
      expect(body.user.email).toBe("ada@example.com");
      expect(body.boardId).toMatch(/^[0-9a-f-]{36}$/);

      const cookies = collectCookies(response);
      expect(cookies.has("auralis_access")).toBe(true);
      expect(cookies.has("auralis_refresh")).toBe(true);
    });

    it("never returns the password hash", async () => {
      const response = await harness.request("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email: "grace@example.com",
          password: "a-sufficiently-long-password",
          name: "Grace",
        }),
      });
      const text = await response.text();
      expect(text).not.toContain("passwordHash");
      expect(text).not.toContain("scrypt");
    });

    it("marks the session cookies httpOnly", async () => {
      const response = await harness.request("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email: "httponly@example.com",
          password: "a-sufficiently-long-password",
          name: "H",
        }),
      });
      for (const header of response.headers.getSetCookie()) {
        expect(header.toLowerCase()).toContain("httponly");
        expect(header.toLowerCase()).toContain("samesite=lax");
      }
    });

    it("rejects a duplicate email regardless of case", async () => {
      const response = await harness.request("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email: "ADA@example.com",
          password: "a-sufficiently-long-password",
          name: "Impostor",
        }),
      });
      expect(response.status).toBe(409);
    });

    it("rejects a short password with a field-level error", async () => {
      const response = await harness.request("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email: "short@example.com", password: "short", name: "S" }),
      });
      expect(response.status).toBe(400);
    });

    it("rejects a malformed email", async () => {
      const response = await harness.request("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email: "not-an-email",
          password: "a-sufficiently-long-password",
          name: "N",
        }),
      });
      expect(response.status).toBe(400);
    });
  });

  describe("login", () => {
    it("accepts correct credentials", async () => {
      const response = await harness.request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "ada@example.com",
          password: "a-sufficiently-long-password",
        }),
      });
      expect(response.status).toBe(200);
    });

    it("is case-insensitive on the email", async () => {
      const response = await harness.request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "AdA@Example.com",
          password: "a-sufficiently-long-password",
        }),
      });
      expect(response.status).toBe(200);
    });

    it("rejects a wrong password", async () => {
      const response = await harness.request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "ada@example.com", password: "wrong-password-here" }),
      });
      expect(response.status).toBe(401);
    });

    it("gives the same answer for an unknown email as for a wrong password", async () => {
      const unknown = await harness.request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "nobody@example.com", password: "wrong-password-here" }),
      });
      const wrong = await harness.request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "ada@example.com", password: "wrong-password-here" }),
      });

      expect(unknown.status).toBe(wrong.status);
      expect(await unknown.json()).toEqual(await wrong.json());
    });
  });

  describe("session", () => {
    it("rejects an unauthenticated request to /me", async () => {
      const response = await harness.request("/api/auth/me");
      expect(response.status).toBe(401);
    });

    it("returns the caller and their boards when authenticated", async () => {
      const session = await signUp(harness, { name: "Board Owner" });
      const response = await harness.request("/api/auth/me", { session });

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        user: { name: string };
        boards: { id: string; role: string }[];
      };
      expect(body.user.name).toBe("Board Owner");
      expect(body.boards).toHaveLength(1);
      expect(body.boards[0]!.role).toBe("owner");
    });

    it("rejects a tampered access token", async () => {
      const session = await signUp(harness);
      session.cookies.set("auralis_access", "not.a.real.token");
      const response = await harness.request("/api/auth/me", { session });
      expect(response.status).toBe(401);
    });

    it("stops accepting a token once the user is deleted", async () => {
      const session = await signUp(harness);
      await harness.handle.db.delete(users).where(eq(users.id, session.userId));
      const response = await harness.request("/api/auth/me", { session });
      expect(response.status).toBe(401);
    });
  });

  describe("refresh token rotation", () => {
    it("issues a new refresh token and invalidates the old one", async () => {
      const session = await signUp(harness);
      const original = session.cookies.get("auralis_refresh")!;

      const first = await harness.request("/api/auth/refresh", { method: "POST", session });
      expect(first.status).toBe(200);

      collectCookies(first, session.cookies);
      expect(session.cookies.get("auralis_refresh")).not.toBe(original);
    });

    it("revokes the whole family when a rotated token is replayed", async () => {
      const session = await signUp(harness);
      const stolen = session.cookies.get("auralis_refresh")!;

      // The legitimate client rotates.
      const rotated = await harness.request("/api/auth/refresh", { method: "POST", session });
      expect(rotated.status).toBe(200);
      collectCookies(rotated, session.cookies);
      const fresh = session.cookies.get("auralis_refresh")!;

      // The attacker replays the token they captured earlier.
      const replay = await harness.request("/api/auth/refresh", {
        method: "POST",
        headers: { Cookie: `auralis_refresh=${stolen}` },
      });
      expect(replay.status).toBe(401);

      // The legitimate client's current token is now dead too — the theft
      // logs everyone out rather than leaving the attacker with access.
      const afterBreach = await harness.request("/api/auth/refresh", {
        method: "POST",
        headers: { Cookie: `auralis_refresh=${fresh}` },
      });
      expect(afterBreach.status).toBe(401);

      const remaining = await harness.handle.db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.userId, session.userId));
      expect(remaining.every((row) => row.revokedAt !== null)).toBe(true);
    });

    it("rejects a refresh with no cookie", async () => {
      const response = await harness.request("/api/auth/refresh", { method: "POST" });
      expect(response.status).toBe(401);
    });
  });

  describe("logout", () => {
    it("clears cookies and revokes the refresh token", async () => {
      const session = await signUp(harness);
      const response = await harness.request("/api/auth/logout", { method: "POST", session });
      expect(response.status).toBe(204);

      const refreshCookie = session.cookies.get("auralis_refresh")!;
      const afterLogout = await harness.request("/api/auth/refresh", {
        method: "POST",
        headers: { Cookie: `auralis_refresh=${refreshCookie}` },
      });
      expect(afterLogout.status).toBe(401);
    });
  });

  describe("guest access", () => {
    it("creates a guest with a board that already has tasks", async () => {
      const response = await harness.request("/api/auth/guest", { method: "POST" });
      expect(response.status).toBe(201);

      const body = (await response.json()) as {
        user: { isGuest: boolean };
        boardId: string;
      };
      expect(body.user.isGuest).toBe(true);

      const session = { cookies: collectCookies(response), userId: "", boardId: body.boardId };
      const tasks = await harness.request(`/api/tasks?boardId=${body.boardId}`, { session });
      const { tasks: rows } = (await tasks.json()) as { tasks: unknown[] };
      expect(rows.length).toBeGreaterThan(5);
    });

    it("gives each guest their own board", async () => {
      const first = await harness.request("/api/auth/guest", { method: "POST" });
      const second = await harness.request("/api/auth/guest", { method: "POST" });
      const a = (await first.json()) as { boardId: string };
      const b = (await second.json()) as { boardId: string };
      expect(a.boardId).not.toBe(b.boardId);
    });

    it("sets an expiry so guest data does not accumulate forever", async () => {
      const response = await harness.request("/api/auth/guest", { method: "POST" });
      const body = (await response.json()) as { user: { id: string } };
      const [row] = await harness.handle.db
        .select()
        .from(users)
        .where(eq(users.id, body.user.id));
      expect(row!.expiresAt).toBeInstanceOf(Date);
      expect(row!.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
