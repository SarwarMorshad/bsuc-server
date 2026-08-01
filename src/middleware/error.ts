import type { NextFunction, Request, Response } from "express";
import { isProduction } from "../config/env";

/** An error with an intended HTTP status, thrown by services and controllers. */
export class AppError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "AppError";
  }
}

/** 404 handler for unmatched API routes. */
export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

/**
 * Central error handler. Express 5 forwards rejected promises here, so async
 * handlers need no try/catch. Unexpected errors are logged server-side and
 * reported generically so internals never leak to clients.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: isProduction ? "Internal server error" : String(err),
  });
}
