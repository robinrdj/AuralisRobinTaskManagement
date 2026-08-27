import { z } from "zod";

export const emailSchema = z.string().email().max(254).toLowerCase();

/**
 * 12 characters minimum with no composition rules. Length beats character
 * classes for real-world strength, and composition rules push people toward
 * predictable substitutions.
 */
export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(200, "That is longer than we can hash");

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(1).max(80),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const publicUserSchema = z.object({
  id: z.string().uuid(),
  email: emailSchema,
  name: z.string(),
  /** Deterministic avatar colour, derived from the id at signup. */
  color: z.string(),
  /** Guest accounts are created by the demo flow and expire on their own. */
  isGuest: z.boolean(),
});

export type PublicUser = z.infer<typeof publicUserSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
