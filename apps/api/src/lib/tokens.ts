import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

/**
 * Two-token session model.
 *
 * The access token is a short-lived JWT the API verifies statelessly on every
 * request. The refresh token is opaque, stored hashed, and rotated on each
 * use. Rotation is what makes a stolen refresh token detectable: the thief and
 * the real user both present the same token, the second presentation finds it
 * already used, and the entire token family is revoked.
 */
export interface AccessTokenClaims {
  sub: string;
  isGuest: boolean;
}

const ISSUER = "auralis";
const AUDIENCE = "auralis-web";

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(
  claims: AccessTokenClaims,
  secret: string,
  ttl: string
): Promise<string> {
  return new SignJWT({ isGuest: claims.isGuest })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(secretKey(secret));
}

/** Returns the claims, or null for any token that is invalid or expired. */
export async function verifyAccessToken(
  token: string,
  secret: string
): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string") return null;
    return { sub: payload.sub, isGuest: payload.isGuest === true };
  } catch {
    return null;
  }
}

/**
 * Refresh tokens are random, not signed — there is nothing to read inside
 * them, and the database is the authority on whether one is still live.
 */
export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Stored as a plain SHA-256 digest rather than a slow KDF: the token already
 * has 256 bits of entropy, so there is no guessing attack for a KDF to slow
 * down, and login latency matters.
 */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export function refreshTokensMatch(candidate: string, storedHash: string): boolean {
  const a = Buffer.from(hashRefreshToken(candidate));
  const b = Buffer.from(storedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Deterministic avatar colour so a user looks the same to every viewer. */
export function colorForId(id: string): string {
  const hue =
    Number.parseInt(createHash("sha256").update(id).digest("hex").slice(0, 8), 16) % 360;
  return `hsl(${hue} 70% 55%)`;
}
