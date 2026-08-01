import type { TokenPayload } from "../lib/jwt";

/**
 * Adds the authenticated user to the Express request, populated by the
 * requireAuth middleware.
 */
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export {};
