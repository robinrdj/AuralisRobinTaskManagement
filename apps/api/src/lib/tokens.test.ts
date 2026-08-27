import { describe, expect, it } from "vitest";
import {
  colorForId,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokensMatch,
  signAccessToken,
  verifyAccessToken,
} from "./tokens.js";
import { loadEnv } from "./env.js";

const SECRET = "a".repeat(48);

describe("access tokens", () => {
  it("round-trips claims", async () => {
    const token = await signAccessToken({ sub: "user-1", isGuest: false }, SECRET, "15m");
    await expect(verifyAccessToken(token, SECRET)).resolves.toEqual({
      sub: "user-1",
      isGuest: false,
    });
  });

  it("preserves the guest flag", async () => {
    const token = await signAccessToken({ sub: "guest-1", isGuest: true }, SECRET, "15m");
    const claims = await verifyAccessToken(token, SECRET);
    expect(claims?.isGuest).toBe(true);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signAccessToken({ sub: "user-1", isGuest: false }, SECRET, "15m");
    await expect(verifyAccessToken(token, "b".repeat(48))).resolves.toBeNull();
  });

  it("rejects a tampered payload", async () => {
    const token = await signAccessToken({ sub: "user-1", isGuest: false }, SECRET, "15m");
    const [header, , signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ sub: "admin", isGuest: false, iss: "auralis", aud: "auralis-web" })
    ).toString("base64url");
    await expect(
      verifyAccessToken(`${header}.${forged}.${signature}`, SECRET)
    ).resolves.toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await signAccessToken({ sub: "user-1", isGuest: false }, SECRET, "-1s");
    await expect(verifyAccessToken(token, SECRET)).resolves.toBeNull();
  });

  it("rejects garbage without throwing", async () => {
    for (const bad of ["", "not.a.jwt", "a.b.c"]) {
      await expect(verifyAccessToken(bad, SECRET)).resolves.toBeNull();
    }
  });

  it("refuses the 'none' algorithm", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
      "base64url"
    );
    const payload = Buffer.from(
      JSON.stringify({ sub: "admin", iss: "auralis", aud: "auralis-web" })
    ).toString("base64url");
    await expect(verifyAccessToken(`${header}.${payload}.`, SECRET)).resolves.toBeNull();
  });
});

describe("refresh tokens", () => {
  it("generates unique, high-entropy tokens", () => {
    const tokens = new Set(Array.from({ length: 500 }, generateRefreshToken));
    expect(tokens.size).toBe(500);
    expect(generateRefreshToken().length).toBeGreaterThanOrEqual(43);
  });

  it("matches a token against its stored hash", () => {
    const token = generateRefreshToken();
    expect(refreshTokensMatch(token, hashRefreshToken(token))).toBe(true);
    expect(refreshTokensMatch(generateRefreshToken(), hashRefreshToken(token))).toBe(false);
  });

  it("does not store the token itself", () => {
    const token = generateRefreshToken();
    expect(hashRefreshToken(token)).not.toBe(token);
  });
});

describe("colorForId", () => {
  it("is deterministic and in range", () => {
    expect(colorForId("abc")).toBe(colorForId("abc"));
    expect(colorForId("abc")).not.toBe(colorForId("abd"));
    expect(colorForId("abc")).toMatch(/^hsl\(\d{1,3} 70% 55%\)$/);
  });
});

describe("loadEnv", () => {
  it("supplies a development secret but never in production", () => {
    expect(loadEnv({ NODE_ENV: "development" } as NodeJS.ProcessEnv).JWT_SECRET).toBeTruthy();
    expect(() => loadEnv({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toThrow(
      /JWT_SECRET/
    );
  });

  it("rejects a short secret", () => {
    expect(() =>
      loadEnv({ NODE_ENV: "production", JWT_SECRET: "too-short" } as NodeJS.ProcessEnv)
    ).toThrow(/Invalid environment/);
  });

  it("parses the CORS origin list", () => {
    const env = loadEnv({
      NODE_ENV: "test",
      JWT_SECRET: SECRET,
      CORS_ORIGINS: "http://a.test, http://b.test ,",
    } as NodeJS.ProcessEnv);
    expect(env.corsOrigins).toEqual(["http://a.test", "http://b.test"]);
  });
});
