import { prisma } from "../lib/prisma";
import { hashPassword, verifyPassword } from "../lib/password";
import { AppError } from "../middleware/error";

/** Fields safe to return — never the password hash. */
const publicUser = {
  id: true,
  name: true,
  email: true,
  matriculationNumber: true,
  program: true,
  countryRegion: true,
  year: true,
  role: true,
  avatarUrl: true,
  emailVerified: true,
  createdAt: true,
} as const;

export type UpdateProfileInput = {
  name?: string;
  program?: string | null;
  countryRegion?: string | null;
  year?: number | null;
};

/**
 * Updates the member's own details. Email, matriculation number and role are
 * deliberately not updatable here: changing an email needs re-verification,
 * the matriculation number is the university-issued identity, and the role is
 * administrative.
 */
export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const data: UpdateProfileInput = {};

  if (input.name !== undefined) data.name = input.name.trim();
  if (input.program !== undefined) data.program = input.program?.trim() || null;
  if (input.countryRegion !== undefined)
    data.countryRegion = input.countryRegion?.trim() || null;
  if (input.year !== undefined) data.year = input.year ?? null;

  return prisma.user.update({
    where: { id: userId },
    data,
    select: publicUser,
  });
}

/** Changes the password after confirming the current one. */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user) {
    throw new AppError(404, "User not found", "USER_NOT_FOUND");
  }

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    throw new AppError(
      400,
      "Your current password is not correct",
      "INVALID_CURRENT_PASSWORD",
    );
  }

  const sameAsBefore = await verifyPassword(newPassword, user.passwordHash);
  if (sameAsBefore) {
    throw new AppError(
      400,
      "Please choose a password different from your current one",
      "PASSWORD_UNCHANGED",
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });
}
