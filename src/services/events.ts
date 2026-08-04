import { prisma } from "../lib/prisma";
import { destroyImage } from "../lib/cloudinary";
import { AppError } from "../middleware/error";

export type EventInput = {
  title: string;
  date: Date;
  location?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  imagePublicId?: string | null;
  published?: boolean;
};

/**
 * Events for the public site: published only, upcoming first. Anything in the
 * past is excluded unless explicitly asked for.
 */
export async function listPublic({ past = false }: { past?: boolean } = {}) {
  const now = new Date();

  return prisma.event.findMany({
    where: {
      published: true,
      date: past ? { lt: now } : { gte: now },
    },
    orderBy: { date: past ? "desc" : "asc" },
  });
}

/** Every event including drafts — for the admin panel. */
export async function listAll() {
  return prisma.event.findMany({ orderBy: { date: "desc" } });
}

/** A single event. Drafts are only visible to admins. */
export async function getById(id: string, { includeDrafts = false } = {}) {
  const event = await prisma.event.findUnique({ where: { id } });

  if (!event || (!event.published && !includeDrafts)) {
    throw new AppError(404, "Event not found", "EVENT_NOT_FOUND");
  }

  return event;
}

export async function create(input: EventInput) {
  return prisma.event.create({
    data: {
      title: input.title.trim(),
      date: input.date,
      location: input.location?.trim() || null,
      description: input.description?.trim() || null,
      imageUrl: input.imageUrl?.trim() || null,
      imagePublicId: input.imagePublicId || null,
      published: input.published ?? false,
    },
  });
}

export async function update(id: string, input: Partial<EventInput>) {
  const existing = await getById(id, { includeDrafts: true });

  const data: Partial<EventInput> = {};
  if (input.title !== undefined) data.title = input.title.trim();
  if (input.date !== undefined) data.date = input.date;
  if (input.location !== undefined) data.location = input.location?.trim() || null;
  if (input.description !== undefined)
    data.description = input.description?.trim() || null;
  if (input.published !== undefined) data.published = input.published;

  if (input.imageUrl !== undefined) {
    data.imageUrl = input.imageUrl?.trim() || null;
    data.imagePublicId = input.imagePublicId || null;

    // Drop the previous file once the replacement is recorded, so Cloudinary
    // does not accumulate orphans.
    if (
      existing.imagePublicId &&
      existing.imagePublicId !== data.imagePublicId
    ) {
      await destroyImage(existing.imagePublicId);
    }
  }

  return prisma.event.update({ where: { id }, data });
}

/** True when some event still points at this Cloudinary image. */
export async function isImageInUse(publicId: string) {
  const count = await prisma.event.count({ where: { imagePublicId: publicId } });
  return count > 0;
}

export async function remove(id: string) {
  const existing = await getById(id, { includeDrafts: true });

  if (existing.imagePublicId) {
    await destroyImage(existing.imagePublicId);
  }

  // RSVPs are removed by the cascade on their foreign key.
  await prisma.event.delete({ where: { id } });
}
