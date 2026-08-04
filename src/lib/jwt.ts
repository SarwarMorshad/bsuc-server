import jwt, { type SignOptions } from "jsonwebtoken";
import { env, isProduction } from "../config/env";

/** Name of the httpOnly cookie carrying the session token. */
export const AUTH_COOKIE = "bsuc_token";

/**
 * `sub` identifies the user. `role` is a snapshot from sign-in time and is NOT
 * authoritative — requireAuth re-reads the current role from the database on
 * every request, so never authorise on the token's copy.
 */
export type TokenPayload = {
  sub: string;
  role: "MEMBER" | "ADMIN";
};

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as SignOptions);
}

/** Returns the payload, or null when the token is missing, invalid or expired. */
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Cookie options for the session token. httpOnly keeps it out of reach of
 * JavaScript (XSS), sameSite=lax blocks the common CSRF cases, and secure is
 * enabled in production where the site is served over HTTPS.
 */
export const authCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};
