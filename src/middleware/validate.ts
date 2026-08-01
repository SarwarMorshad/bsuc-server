import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

/**
 * Validates and replaces `req.body` with the parsed result, so controllers
 * receive data that is already typed and trusted. Validation failures return
 * 400 with per-field messages the client can show inline.
 */
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const fields: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join(".") || "_";
        if (!fields[key]) fields[key] = issue.message;
      }
      res.status(400).json({ error: "Validation failed", fields });
      return;
    }

    req.body = result.data;
    next();
  };
}
