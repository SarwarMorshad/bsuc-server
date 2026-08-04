import type { NextFunction, Request, Response } from "express";
import { AppError } from "./error";

type Hit = { count: number; resetAt: number };

/**
 * Small fixed-window limiter for public endpoints.
 *
 * Deliberately in-memory: the site runs as a single process, and this only
 * needs to blunt casual spam, not defend against a determined attacker. If
 * the API is ever scaled to several instances this has to move to Redis or
 * the database, since each process would otherwise keep its own count.
 */
export function rateLimit({
  windowMs,
  max,
  message = "Too many requests. Please try again later.",
}: {
  windowMs: number;
  max: number;
  message?: string;
}) {
  const hits = new Map<string, Hit>();

  return (req: Request, _res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip ?? "unknown";

    // Cheap sweep so the map cannot grow without bound.
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }

    const hit = hits.get(key);
    if (!hit || hit.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    hit.count += 1;
    if (hit.count > max) {
      throw new AppError(429, message, "RATE_LIMITED");
    }
    next();
  };
}

/**
 * Rejects submissions that filled in a field no human can see.
 *
 * Answers 201 rather than an error: a bot that is told it failed will retry
 * with the field cleared, whereas one that believes it succeeded moves on.
 */
export function honeypot(field: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.body?.[field];
    if (typeof value === "string" && value.trim() !== "") {
      res.status(201).json({ id: null, status: "PENDING" });
      return;
    }
    delete req.body?.[field];
    next();
  };
}
