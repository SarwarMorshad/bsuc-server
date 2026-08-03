import { z } from "zod";

/**
 * The password policy, shared by registration and password changes so the two
 * can never drift apart. Mirrored in the client for live feedback, but this is
 * the authority.
 */
export const passwordSchema = z
  .string("Please choose a password")
  .min(8, "Password must be at least 8 characters")
  .max(200)
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a number")
  .regex(/[^A-Za-z0-9]/, "Password must include a special character");
