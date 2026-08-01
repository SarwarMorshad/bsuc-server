import type { NextFunction, Request, Response } from "express";
import { AUTH_COOKIE, verifyToken } from "../lib/jwt";
import { AppError } from "./error";

/** Reads the session token from the cookie, falling back to a Bearer header. */
function readToken(req: Request): string | undefined {
  const fromCookie = req.cookies?.[AUTH_COOKIE];
  if (fromCookie) return fromCookie;

  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);

  return undefined;
}

/** Rejects the request unless it carries a valid session token. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readToken(req);
  const payload = token ? verifyToken(token) : null;

  if (!payload) {
    throw new AppError(401, "Authentication required", "UNAUTHENTICATED");
  }

  req.user = payload;
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
