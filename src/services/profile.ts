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
  phone: true,
  degreeLevel: true,
  arrivalYear: true,
  bio: true,
  pendingEmail: true,
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
  phone?: string | null;
  degreeLevel?: "BACHELOR" | "MASTER" | "PHD" | "OTHER" | null;
  arrivalYear?: number | null;
  bio?: string | null;
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
  if (input.phone !== undefined) data.phone = input.phone?.trim() || null;
  if (input.degreeLevel !== undefined) data.degreeLevel = input.degreeLevel ?? null;
  if (input.arrivalYear !== undefined) data.arrivalYear = input.arrivalYear ?? null;
  if (input.bio !== undefined) data.bio = input.bio?.trim() || null;

  return prisma.user.update({
    where: { id: userId },
    data,
    select: publicUser,
  });
}

/**
 * Confirms the member's password before a sensitive change, returning the
 * fields needed to act on their account.
 */
export async function assertPassword(userId: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, passwordHash: true },
  });

  if (!user) {
    throw new AppError(404, "User not found", "USER_NOT_FOUND");
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new AppError(400, "Your password is not correct", "INVALID_PASSWORD");
  }

  return { id: user.id, name: user.name };
}

/**
 * Permanently deletes the member's account. Requires the password, so a
 * hijacked session alone cannot destroy someone's data. Verification tokens
 * and RSVPs are removed by the cascade on their foreign keys.
 */
export async function deleteAccount(userId: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, role: true },
  });

  if (!user) {
    throw new AppError(404, "User not found", "USER_NOT_FOUND");
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new AppError(400, "Your password is not correct", "INVALID_PASSWORD");
  }

  // Guard against removing the last administrator and locking everyone out.
  if (user.role === "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    if (admins <= 1) {
      throw new AppError(
        409,
        "You are the only administrator. Make someone else an admin before deleting your account.",
        "LAST_ADMIN",
      );
    }
  }

  await prisma.user.delete({ where: { id: userId } });
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
