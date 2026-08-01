import { prisma } from "../lib/prisma";
import { hashPassword, verifyPassword } from "../lib/password";
import { AppError } from "../middleware/error";

/** Fields safe to send to the client — never includes the password hash. */
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
  createdAt: true,
} as const;

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  matriculationNumber: string;
  program?: string;
};

export async function register(input: RegisterInput) {
  const email = input.email.toLowerCase().trim();
  const matriculationNumber = input.matriculationNumber.trim();

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { matriculationNumber }] },
    select: { email: true },
  });

  if (existing) {
    // Reported separately so the member knows which value to change.
    throw existing.email === email
      ? new AppError(409, "An account with this email already exists", "EMAIL_TAKEN")
      : new AppError(
          409,
          "An account with this matriculation number already exists",
          "MATRICULATION_TAKEN",
        );
  }

  return prisma.user.create({
    data: {
      name: input.name.trim(),
      email,
      matriculationNumber,
      passwordHash: await hashPassword(input.password),
      program: input.program?.trim() || null,
    },
    select: publicUser,
  });
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  // Same message and comparable timing whether the email exists or not, so the
  // endpoint can't be used to discover which emails are registered.
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) {
    throw new AppError(401, "Incorrect email or password", "INVALID_CREDENTIALS");
  }

  const { passwordHash: _hash, ...safe } = user;
  return safe;
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: publicUser,
  });

  if (!user) {
    throw new AppError(404, "User not found", "USER_NOT_FOUND");
  }

  return user;
}
