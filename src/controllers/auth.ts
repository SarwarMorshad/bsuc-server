import type { Request, Response } from "express";
import { z } from "zod";
import * as authService from "../services/auth";
import * as verificationService from "../services/verification";
import {
  AUTH_COOKIE,
  authCookieOptions,
  clearCookieOptions,
  signToken,
} from "../lib/jwt";
import { passwordSchema } from "../lib/validation";
import { AppError } from "../middleware/error";

// The message passed to z.string(...) also covers a missing field, so the
// client never shows Zod's default "expected string, received undefined".
export const registerSchema = z.object({
  name: z
    .string("Please enter your full name")
    .min(2, "Please enter your full name")
    .max(120),
  email: z.email("Please enter a valid email address"),
  matriculationNumber: z
    .string("Please enter your matriculation number")
    .trim()
    .min(4, "Please enter a valid matriculation number")
    .max(20, "Please enter a valid matriculation number")
    .regex(/^[A-Za-z0-9-]+$/, "Use only letters, numbers and hyphens"),
  // Enforced server-side as well as in the UI — client validation is a
  // convenience, not a security control.
  password: passwordSchema,
  program: z.string().max(160).optional(),
});

export const loginSchema = z.object({
  email: z.email("Please enter a valid email address"),
  password: z.string("Please enter your password").min(1, "Please enter your password"),
  /** Keeps the session alive after the browser closes. Off by default. */
  remember: z.boolean().optional(),
});

export const resendSchema = z.object({
  email: z.email("Please enter a valid email address"),
});

export const verifySchema = z.object({
  token: z.string("A verification token is required").min(16),
});

/**
 * Creates the account and emails a verification link. No session is issued:
 * sign-in is blocked until the address is confirmed.
 */
export async function register(req: Request, res: Response) {
  const user = await authService.register(req.body);
  await verificationService.sendVerificationEmail(user);
  res.status(201).json({ user, verificationRequired: true });
}

export async function verifyEmail(req: Request, res: Response) {
  const { alreadyVerified } = await verificationService.verifyToken(
    req.body.token,
  );
  res.json({ verified: true, alreadyVerified });
}

export async function resendVerification(req: Request, res: Response) {
  await verificationService.resendVerification(req.body.email);
  // Always the same response, so this cannot reveal which emails are registered.
  res.status(202).json({ sent: true });
}

export async function login(req: Request, res: Response) {
  const { email, password, remember = false } = req.body;
  const user = await authService.login(email, password);

  // "Remember me" is what decides whether this session outlives the browser.
  const token = signToken({ sub: user.id, role: user.role }, { remember });
  res.cookie(AUTH_COOKIE, token, authCookieOptions({ remember }));
  res.json({ user });
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie(AUTH_COOKIE, clearCookieOptions);
  res.status(204).end();
}

export async function me(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError(401, "Authentication required", "UNAUTHENTICATED");
  }
  res.json({ user: await authService.getUserById(req.user.sub) });
}
