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

/** Everything, including submitter details — admin only. */
export async function listAll() {
  return prisma.job.findMany({ orderBy: [{ createdAt: "desc" }] });
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
