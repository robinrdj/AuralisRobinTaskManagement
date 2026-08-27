import { z } from "zod";

/**
 * Configuration is validated once at boot. A missing or weak secret fails the
 * process immediately rather than surfacing as a confusing 401 in production.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url().optional(),
  /** Signs access and refresh tokens. Must be at least 32 bytes of entropy. */
  JWT_SECRET: z.string().min(32),
  /** Comma-separated list of origins allowed to send credentialed requests. */
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  /** Guest accounts created by the demo flow are reaped after this long. */
  GUEST_TTL_HOURS: z.coerce.number().int().positive().default(72),
});

export type Env = z.infer<typeof envSchema> & { corsOrigins: string[] };

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const candidate = { ...source };

  // Development and tests get an ephemeral secret so `npm run dev` works with
  // no setup. Production must supply its own — a regenerated secret would
  // invalidate every session on restart.
  if (!candidate.JWT_SECRET && candidate.NODE_ENV !== "production") {
    candidate.JWT_SECRET = "dev-only-insecure-secret-change-me-in-production";
  }

  const parsed = envSchema.safeParse(candidate);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return {
    ...parsed.data,
    corsOrigins: parsed.data.CORS_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}
