import type { Request, Response } from "express";
import { z } from "zod";
import * as eventsService from "../services/events";
import { uploadEventImage } from "../lib/cloudinary";
import { AppError } from "../middleware/error";

/** Express 5 types params as string | string[]; routes here always give one. */
const idOf = (req: Request) => String(req.params.id);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const createEventSchema = z.object({
  title: z.string("Please enter a title").trim().min(2, "Please enter a title").max(160),
  // Accepts an ISO string or a datetime-local value from the admin form.
  date: z.coerce.date("Please enter a valid date"),
  location: optionalText(160),
  description: optionalText(4000),
  imageUrl: z.url("Please enter a valid URL").nullable().optional(),
  imagePublicId: z.string().max(200).nullable().optional(),
  published: z.boolean().optional(),
});

/** Same fields, all optional — an admin may edit just one of them. */
export const updateEventSchema = createEventSchema.partial();

export async function list(req: Request, res: Response) {
  const past = req.query.past === "true";
  res.json({ events: await eventsService.listPublic({ past }) });
}

export async function listAll(_req: Request, res: Response) {
  res.json({ events: await eventsService.listAll() });
}

export async function getOne(req: Request, res: Response) {
  // Admins can open drafts; everyone else only sees published events.
  const includeDrafts = req.user?.role === "ADMIN";
  res.json({ event: await eventsService.getById(idOf(req), { includeDrafts }) });
}

export async function create(req: Request, res: Response) {
  res.status(201).json({ event: await eventsService.create(req.body) });
}

export async function update(req: Request, res: Response) {
  res.json({ event: await eventsService.update(idOf(req), req.body) });
}

export async function remove(req: Request, res: Response) {
  await eventsService.remove(idOf(req));
  res.status(204).end();
}

/**
 * Uploads an event photo and returns its URL, so the admin form can attach a
 * picture while creating an event that does not exist yet.
 */
export async function uploadImage(req: Request, res: Response) {
  if (!req.file) {
    throw new AppError(400, "Please choose an image to upload", "NO_FILE");
  }
  const { url, publicId } = await uploadEventImage(req.file.buffer);
  res.status(201).json({ imageUrl: url, imagePublicId: publicId });
}
