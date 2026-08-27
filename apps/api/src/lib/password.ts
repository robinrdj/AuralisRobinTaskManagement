import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

/**
 * `promisify` picks the first overload of `scrypt`, which has no options
 * parameter, so the tuning arguments below would be dropped silently. Wrapping
 * it by hand keeps them typed.
 */
function scrypt(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

/**
 * Password hashing with scrypt from Node's standard library.
 *
 * scrypt is memory-hard and ships with Node, so there is no native module to
 * compile and nothing to go stale. Parameters are stored inside the hash
 * string, which means they can be raised later and old hashes still verify —
 * `needsRehash` reports when a stored hash is below current policy so it can
 * be upgraded on the user's next successful login.
 */
const CURRENT = { N: 2 ** 15, r: 8, p: 1, keyLength: 64 } as const;
const SALT_BYTES = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scrypt(password.normalize("NFKC"), salt, CURRENT.keyLength, {
    N: CURRENT.N,
    r: CURRENT.r,
    p: CURRENT.p,
    // scrypt's default maxmem is too small for N=2^15 and throws without this.
    maxmem: 256 * CURRENT.N * CURRENT.r,
  });

  return [
    "scrypt",
    CURRENT.N,
    CURRENT.r,
    CURRENT.p,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  const salt = Buffer.from(parts[4]!, "base64url");
  const expected = Buffer.from(parts[5]!, "base64url");
  if (salt.length === 0 || expected.length === 0) return false;

  let derived: Buffer;
  try {
    derived = await scrypt(password.normalize("NFKC"), salt, expected.length, {
      N,
      r,
      p,
      maxmem: 256 * N * r,
    });
  } catch {
    // Malformed parameters in the stored hash: treat as a failed verify
    // rather than a 500, so one bad row cannot break the login endpoint.
    return false;
  }

  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/** True when a stored hash was made with weaker parameters than current policy. */
export function needsRehash(stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return true;
  return (
    Number(parts[1]) < CURRENT.N || Number(parts[2]) < CURRENT.r || Number(parts[3]) < CURRENT.p
  );
}
