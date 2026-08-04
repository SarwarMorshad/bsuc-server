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

/**
 * How long a session lasts when "remember me" is left unticked. The cookie is
 * dropped when the browser closes, but the token has to expire too — a
 * non-persistent cookie only constrains the browser, and a copied value would
 * otherwise stay valid for the full week.
 */
export const SHORT_SESSION_SECONDS = 12 * 60 * 60;

export function signToken(
  payload: TokenPayload,
  { remember = true }: { remember?: boolean } = {},
): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: remember ? env.JWT_EXPIRES_IN : SHORT_SESSION_SECONDS,
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
const baseCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/",
};

/**
 * Without "remember me" no maxAge is set, which makes this a non-persistent
 * cookie: the browser discards it on close rather than writing it to disk.
 * OWASP recommends that as the default for session management.
 */
export function authCookieOptions({ remember }: { remember: boolean }) {
  return remember
    ? { ...baseCookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 }
    : baseCookieOptions;
}

/** Matching attributes for clearing the cookie; maxAge must be absent here. */
export const clearCookieOptions = baseCookieOptions;
