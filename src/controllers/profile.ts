import type { Request, Response } from "express";
import { z } from "zod";
import * as profileService from "../services/profile";
import * as verificationService from "../services/verification";
import { passwordSchema } from "../lib/validation";
import {
  AUTH_COOKIE,
  authCookieOptions,
  clearCookieOptions,
  signToken,
} from "../lib/jwt";
import { AppError } from "../middleware/error";

/** Empty strings from form inputs are treated as "clear this field". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const currentYear = new Date().getFullYear();

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name").max(120).optional(),
  program: optionalText(160),
  countryRegion: optionalText(120),
  year: z
    .number()
    .int()
    .min(1, "Year must be between 1 and 12")
    .max(12, "Year must be between 1 and 12")
    .nullable()
    .optional(),
  phone: z
    .string()
    .trim()
    .max(32)
    .regex(/^[+0-9()\s-]*$/, "Please enter a valid phone number")
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  degreeLevel: z
    .enum(["BACHELOR", "MASTER", "PHD", "OTHER"])
    .nullable()
    .optional(),
  arrivalYear: z
    .number()
    .int()
    .min(1990, `Year must be between 1990 and ${currentYear + 1}`)
    .max(currentYear + 1, `Year must be between 1990 and ${currentYear + 1}`)
    .nullable()
    .optional(),
  bio: optionalText(500),
});

export const changeEmailSchema = z.object({
  newEmail: z.email("Please enter a valid email address"),
  password: z.string("Please enter your password").min(1),
});

export const deleteAccountSchema = z.object({
  password: z.string("Please enter your password").min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string("Please enter your current password").min(1),
  newPassword: passwordSchema,
});

export async function updateProfile(req: Request, res: Response) {
  if (!req.user) throw new AppError(401, "Authentication required");
  const user = await profileService.updateProfile(req.user.sub, req.body);
  res.json({ user });
}

export async function changePassword(req: Request, res: Response) {
  if (!req.user) throw new AppError(401, "Authentication required");
  const { currentPassword, newPassword } = req.body;
  const user = await profileService.changePassword(
    req.user.sub,
    currentPassword,
    newPassword,
  );

  // Every other session is now invalid. Hand this browser a fresh token so
  // the person who just changed their password is not signed out too — as a
  // non-persistent cookie, since we cannot know whether the old session had
  // "remember me" ticked.
  const token = signToken(
    { sub: user.id, role: user.role, ver: user.tokenVersion },
    { remember: false },
  );
  res.cookie(AUTH_COOKIE, token, authCookieOptions({ remember: false }));

  res.status(204).end();
}

/** Sends a confirmation link to the new address; the change applies on click. */
export async function changeEmail(req: Request, res: Response) {
  if (!req.user) throw new AppError(401, "Authentication required");
  const { newEmail, password } = req.body;

  const user = await profileService.assertPassword(req.user.sub, password);
  await verificationService.requestEmailChange(user, newEmail);

  res.status(202).json({ pendingEmail: newEmail.toLowerCase().trim() });
}

export async function uploadAvatar(req: Request, res: Response) {
  if (!req.user) throw new AppError(401, "Authentication required");
  if (!req.file) {
    throw new AppError(400, "Please choose an image to upload", "NO_FILE");
  }
  const user = await profileService.setAvatar(req.user.sub, req.file.buffer);
  res.json({ user });
}

export async function removeAvatar(req: Request, res: Response) {
  if (!req.user) throw new AppError(401, "Authentication required");
  const user = await profileService.removeAvatar(req.user.sub);
  res.json({ user });
}

export async function deleteAccount(req: Request, res: Response) {
  if (!req.user) throw new AppError(401, "Authentication required");
  await profileService.deleteAccount(req.user.sub, req.body.password);
  res.clearCookie(AUTH_COOKIE, clearCookieOptions);
  res.status(204).end();
}
