import type { Request, Response } from "express";
import { z } from "zod";
import * as profileService from "../services/profile";
import { passwordSchema } from "../lib/validation";
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
  await profileService.changePassword(req.user.sub, currentPassword, newPassword);
  res.status(204).end();
}
