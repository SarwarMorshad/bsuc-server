import crypto from "node:crypto";
import { prisma } from "../lib/prisma";
import { sendMail } from "../lib/mailer";
import { verificationEmail } from "../lib/emails";
import { env } from "../config/env";
import { AppError } from "../middleware/error";

const TOKEN_TTL_HOURS = 24;
/** Minimum gap between verification emails for the same account. */
const RESEND_COOLDOWN_MS = 60_000;

/** Tokens are stored hashed so a database leak cannot be used to verify accounts. */
function hash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Creates a token, stores its hash and emails the member a verification link. */
export async function sendVerificationEmail(user: {
  id: string;
  name: string;
  email: string;
}) {
  const recent = await prisma.verificationToken.findFirst({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) } },
    orderBy: { createdAt: "desc" },
  });

  if (recent) {
    throw new AppError(
      429,
      "A verification email was just sent. Please check your inbox, then try again in a minute.",
      "RESEND_TOO_SOON",
    );
  }

  // Invalidate any outstanding tokens so only the newest link works.
  await prisma.verificationToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.verificationToken.create({
    data: {
      tokenHash: hash(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000),
    },
  });

  const url = `${env.CLIENT_ORIGIN}/verify?token=${token}`;
  const mail = verificationEmail(user.name.split(" ")[0] || user.name, url);
  await sendMail({ to: user.email, ...mail });
}

/**
 * Starts an email change: sends a confirmation link to the *new* address. The
 * account keeps its current email until that link is opened, so a typo or a
 * hijacked session cannot lock the owner out.
 */
export async function requestEmailChange(
  user: { id: string; name: string },
  newEmail: string,
) {
  const email = newEmail.toLowerCase().trim();

  const taken = await prisma.user.findUnique({ where: { email } });
  if (taken) {
    throw new AppError(
      409,
      "An account with this email already exists",
      "EMAIL_TAKEN",
    );
  }

  await prisma.verificationToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.$transaction([
    prisma.verificationToken.create({
      data: {
        tokenHash: hash(token),
        userId: user.id,
        newEmail: email,
        expiresAt: new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000),
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { pendingEmail: email },
    }),
  ]);

  const url = `${env.CLIENT_ORIGIN}/verify?token=${token}`;
  const mail = verificationEmail(user.name.split(" ")[0] || user.name, url);
  // Sent to the new address — that is what needs proving.
  await sendMail({ to: email, ...mail });
}

/** Consumes a token: confirms the account, or applies a pending email change. */
export async function verifyToken(token: string) {
  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash: hash(token) },
    include: { user: { select: { id: true, emailVerified: true } } },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError(
      400,
      "This verification link is invalid or has expired. Request a new one.",
      "INVALID_TOKEN",
    );
  }

  // An email-change token: move the new address onto the account.
  if (record.newEmail) {
    const stillFree = await prisma.user.findUnique({
      where: { email: record.newEmail },
    });
    if (stillFree) {
      throw new AppError(
        409,
        "An account with this email already exists",
        "EMAIL_TAKEN",
      );
    }

    await prisma.$transaction([
      prisma.verificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: record.userId },
        data: {
          email: record.newEmail,
          pendingEmail: null,
          emailVerified: new Date(),
        },
      }),
    ]);

    return { alreadyVerified: false, emailChanged: true };
  }

  // Already verified — treat as success so a second click is not an error.
  if (record.user.emailVerified) {
    return { alreadyVerified: true, emailChanged: false };
  }

  await prisma.$transaction([
    prisma.verificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    }),
  ]);

  return { alreadyVerified: false, emailChanged: false };
}

/**
 * Resends a verification link. Callers get the same response whether or not the
 * address exists, so this cannot be used to discover registered emails.
 */
export async function resendVerification(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, name: true, email: true, emailVerified: true },
  });

  if (!user || user.emailVerified) return;

  await sendVerificationEmail(user);
}
