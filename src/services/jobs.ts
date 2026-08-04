import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error";
import type { Prisma } from "../../generated/prisma/client";

export type JobInput = Omit<
  Prisma.JobUncheckedCreateInput,
  "id" | "createdAt" | "updatedAt" | "status" | "reviewedAt" | "reviewedById"
>;

/** Fields safe to show a member. Everything about the submitter is withheld. */
const publicSelect = {
  id: true,
  title: true,
  company: true,
  companyWebsite: true,
  location: true,
  remote: true,
  type: true,
  startDate: true,
  until: true,
  hoursPerWeek: true,
  payCents: true,
  payUnit: true,
  payNote: true,
  aboutCompany: true,
  tasks: true,
  profile: true,
  offer: true,
  germanLevel: true,
  contactName: true,
  applyEmail: true,
  applyUrl: true,
  deadline: true,
  createdAt: true,
} satisfies Prisma.JobSelect;

/**
 * Approved listings for the members-only portal, soonest deadline first.
 * Anything past its deadline drops out on its own.
 */
export async function listForMembers({ type }: { type?: string } = {}) {
  return prisma.job.findMany({
    where: {
      status: "APPROVED",
      OR: [{ deadline: null }, { deadline: { gte: new Date() } }],
      ...(type ? { type: type as Prisma.EnumJobTypeFilter["equals"] } : {}),
    },
    select: publicSelect,
    orderBy: [{ createdAt: "desc" }],
  });
}

/**
 * Columns the moderation list needs. The four advert bodies are deliberately
 * absent — they allow 4000 characters each, and sending them for every row
 * was most of the payload. They are fetched per listing when one is opened.
 */
const adminListSelect = {
  id: true,
  title: true,
  company: true,
  companyWebsite: true,
  location: true,
  remote: true,
  type: true,
  hoursPerWeek: true,
  payCents: true,
  payUnit: true,
  payNote: true,
  germanLevel: true,
  deadline: true,
  status: true,
  rejectionReason: true,
  reviewedAt: true,
  submitterName: true,
  submitterEmail: true,
  submitterPhone: true,
  createdAt: true,
} satisfies Prisma.JobSelect;

export type AdminJobFilter = {
  status?: "PENDING" | "APPROVED" | "REJECTED";
  /** Matches title, company or submitter. */
  q?: string;
  page?: number;
  pageSize?: number;
};

/**
 * One page of listings for the moderation queue, filtered and searched in the
 * database rather than the browser.
 */
export async function listAll({
  status,
  q,
  page = 1,
  pageSize = 25,
}: AdminJobFilter = {}) {
  const search = q?.trim();
  const where: Prisma.JobWhereInput = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { company: { contains: search, mode: "insensitive" } },
            { submitterName: { contains: search, mode: "insensitive" } },
            { submitterEmail: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      select: adminListSelect,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.job.count({ where }),
  ]);

  return { jobs, total, page, pageSize };
}

/** A single listing in full, advert bodies included — for the details modal. */
export async function getForAdmin(id: string) {
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) throw new AppError(404, "Job not found", "NOT_FOUND");
  return job;
}

export async function getById(id: string) {
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) throw new AppError(404, "Job not found", "NOT_FOUND");
  return job;
}

/** A public submission. Always lands as PENDING — never visible on arrival. */
export async function submit(input: JobInput) {
  return prisma.job.create({ data: { ...input, status: "PENDING" } });
}

export async function update(id: string, input: Partial<JobInput>) {
  await getById(id);
  return prisma.job.update({ where: { id }, data: input });
}

/** Approve or reject, recording who decided and when. */
export async function review(
  id: string,
  {
    status,
    rejectionReason,
    reviewerId,
  }: {
    status: "APPROVED" | "REJECTED";
    rejectionReason?: string | null;
    reviewerId: string;
  },
) {
  await getById(id);

  return prisma.job.update({
    where: { id },
    data: {
      status,
      rejectionReason: status === "REJECTED" ? (rejectionReason ?? null) : null,
      reviewedAt: new Date(),
      reviewedById: reviewerId,
    },
  });
}

export async function remove(id: string) {
  await getById(id);
  await prisma.job.delete({ where: { id } });
}

/** Counts for the moderation queue badge. */
export async function counts() {
  const rows = await prisma.job.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  return {
    pending: rows.find((r) => r.status === "PENDING")?._count._all ?? 0,
    approved: rows.find((r) => r.status === "APPROVED")?._count._all ?? 0,
    rejected: rows.find((r) => r.status === "REJECTED")?._count._all ?? 0,
  };
}
