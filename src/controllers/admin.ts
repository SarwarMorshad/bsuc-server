import type { Request, Response } from "express";
import { z } from "zod";
import * as adminService from "../services/admin";
import { AppError } from "../middleware/error";

export const setRoleSchema = z.object({
  role: z.enum(["MEMBER", "ADMIN"]),
});

export async function stats(_req: Request, res: Response) {
  res.json(await adminService.getStats());
}

export async function listMembers(req: Request, res: Response) {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  res.json({ members: await adminService.listMembers({ search }) });
}

export async function setRole(req: Request, res: Response) {
  if (!req.user) throw new AppError(401, "Authentication required");
  const member = await adminService.setRole(
    String(req.params.id),
    req.body.role,
    req.user.sub,
  );
  res.json({ member });
}
