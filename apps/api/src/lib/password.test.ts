import { describe, expect, it } from "vitest";
import { hashPassword, needsRehash, verifyPassword } from "./password.js";

describe("password hashing", () => {
  it("verifies a correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("Correct horse battery staple", hash)).resolves.toBe(false);
    await expect(verifyPassword("", hash)).resolves.toBe(false);
  });

  it("salts, so the same password hashes differently every time", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    expect(a).not.toBe(b);
    await expect(verifyPassword("same password", a)).resolves.toBe(true);
    await expect(verifyPassword("same password", b)).resolves.toBe(true);
  });

  it("never stores the password in the hash string", async () => {
    const hash = await hashPassword("hunter2-hunter2");
    expect(hash).not.toContain("hunter2");
  });

  it("treats a malformed stored hash as a failed verify, not an error", async () => {
    for (const bad of [
      "",
      "garbage",
      "scrypt$1$2$3",
      "bcrypt$1$8$1$aa$bb",
      "scrypt$x$y$z$aa$bb",
    ]) {
      await expect(verifyPassword("anything", bad)).resolves.toBe(false);
    }
  });

  it("normalises unicode so equivalent inputs match", async () => {
    // "é" as one codepoint vs. "e" + combining accent.
    const hash = await hashPassword("caf\u00e9-password");
    await expect(verifyPassword("cafe\u0301-password", hash)).resolves.toBe(true);
  });

  it("flags hashes below current policy for rehashing", async () => {
    expect(needsRehash(await hashPassword("x".repeat(12)))).toBe(false);
    expect(needsRehash("scrypt$1024$8$1$c2FsdA$aGFzaA")).toBe(true);
    expect(needsRehash("not-a-hash")).toBe(true);
  });

  it("handles long passwords without truncating", async () => {
    // bcrypt silently ignores bytes past 72; scrypt must not.
    const long = "a".repeat(200);
    const hash = await hashPassword(long);
    await expect(verifyPassword(long, hash)).resolves.toBe(true);
    await expect(verifyPassword("a".repeat(199), hash)).resolves.toBe(false);
  });
});
