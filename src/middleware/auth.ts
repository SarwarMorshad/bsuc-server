import type { NextFunction, Request, Response } from "express";
import { AUTH_COOKIE, verifyToken, type TokenPayload } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { AppError } from "./error";

/** Reads the session token from the cookie, falling back to a Bearer header. */
function readToken(req: Request): string | undefined {
  const fromCookie = req.cookies?.[AUTH_COOKIE];
  if (fromCookie) return fromCookie;

  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);

  return undefined;
}

/**
 * Resolves the session against the database rather than trusting the token's
 * own copy of the role.
 *
 * The role is baked into the token at sign-in, so it goes stale the moment
 * someone is promoted or demoted — a demoted admin would keep full access
 * until their token expired, up to a week later. Reading it here also drops
 * sessions belonging to accounts deleted since the token was issued.
 *
 * Costs one indexed lookup per authenticated request.
 */
async function resolveSession(req: Request): Promise<TokenPayload | null> {
  const token = readToken(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, tokenVersion: true },
  });
  if (!user) return null;

  // Signed before the last logout or password change, so it is no longer
  // valid anywhere — not just in the browser that signed out.
  if (payload.ver !== user.tokenVersion) return null;

  return { sub: user.id, role: user.role, ver: user.tokenVersion };
}

/** Rejects the request unless it carries a valid session token. */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const user = await resolveSession(req);

  if (!user) {
    throw new AppError(401, "Authentication required", "UNAUTHENTICATED");
  }

  req.user = user;
  next();
}

/**
 * Populates req.user when a valid session is present, but lets the request
 * through either way — for endpoints that show more to signed-in users
 * (for example an admin previewing an unpublished event).
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const user = await resolveSession(req);
  if (user) req.user = user;
  next();
}

/** Rejects the request unless the authenticated user has one of the roles. */
export function requireRole(...roles: TokenRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError(401, "Authentication required", "UNAUTHENTICATED");
    }
    if (!roles.includes(req.user.role)) {
      throw new AppError(403, "Not allowed", "FORBIDDEN");
    }
    next();
  };
}

type TokenRole = "MEMBER" | "ADMIN";
