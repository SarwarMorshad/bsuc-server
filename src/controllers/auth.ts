import type { Request, Response } from "express";
import { z } from "zod";
import * as authService from "../services/auth";
import { AUTH_COOKIE, authCookieOptions, signToken } from "../lib/jwt";
import { AppError } from "../middleware/error";

// The message passed to z.string(...) also covers a missing field, so the
// client never shows Zod's default "expected string, received undefined".
export const registerSchema = z.object({
  name: z
    .string("Please enter your full name")
    .min(2, "Please enter your full name")
    .max(120),
  email: z.email("Please enter a valid email address"),
  password: z
    .string("Please choose a password")
    .min(8, "Password must be at least 8 characters")
    .max(200),
  program: z.string().max(160).optional(),
});

export const loginSchema = z.object({
  email: z.email("Please enter a valid email address"),
  password: z.string("Please enter your password").min(1, "Please enter your password"),
});

export async function register(req: Request, res: Response) {
  const user = await authService.register(req.body);

  const token = signToken({ sub: user.id, role: user.role });
  res.cookie(AUTH_COOKIE, token, authCookieOptions);
  res.status(201).json({ user });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const user = await authService.login(email, password);

  const token = signToken({ sub: user.id, role: user.role });
  res.cookie(AUTH_COOKIE, token, authCookieOptions);
  res.json({ user });
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie(AUTH_COOKIE, { ...authCookieOptions, maxAge: undefined });
  res.status(204).end();
}

export async function me(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError(401, "Authentication required", "UNAUTHENTICATED");
  }
  res.json({ user: await authService.getUserById(req.user.sub) });
}
