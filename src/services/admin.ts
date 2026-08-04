import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error";

/** Fields safe to expose in the members table — never the password hash. */
const memberFields = {
  id: true,
  name: true,
  email: true,
  matriculationNumber: true,
  program: true,
  degreeLevel: true,
  countryRegion: true,
  arrivalYear: true,
  role: true,
  avatarUrl: true,
  emailVerified: true,
  createdAt: true,
} as const;

/** Counts for the dashboard overview. */
export async function getStats() {
  const now = new Date();

  const [
    members,
    admins,
    unverified,
    eventsTotal,
    eventsPublished,
    eventsUpcoming,
    jobsTotal,
    jobsApproved,
    jobsPending,
    recentMembers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { emailVerified: null } }),
    prisma.event.count(),
    prisma.event.count({ where: { published: true } }),
    prisma.event.count({ where: { published: true, date: { gte: now } } }),
    prisma.job.count(),
    prisma.job.count({ where: { status: "APPROVED" } }),
    prisma.job.count({ where: { status: "PENDING" } }),
    prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: memberFields,
    }),
  ]);

  return {
    members: { total: members, admins, unverified },
    events: {
      total: eventsTotal,
      published: eventsPublished,
      drafts: eventsTotal - eventsPublished,
      upcoming: eventsUpcoming,
    },
    // pending is the one an admin has to act on.
    jobs: { total: jobsTotal, approved: jobsApproved, pending: jobsPending },
    recentMembers,
  };
}

/** Members list with an optional name/email/matriculation search. */
export async function listMembers({ search }: { search?: string } = {}) {
  const q = search?.trim();

  return prisma.user.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { matriculationNumber: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    select: memberFields,
  });
}

/** Promotes or demotes a member, keeping at least one administrator. */
export async function setRole(
  targetId: string,
  role: "MEMBER" | "ADMIN",
  actingUserId: string,
) {
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, role: true },
  });

  if (!target) {
    throw new AppError(404, "Member not found", "USER_NOT_FOUND");
  }

  if (target.role === "ADMIN" && role === "MEMBER") {
    // Removing your own admin rights, or the last admin, would lock everyone out.
    if (target.id === actingUserId) {
      throw new AppError(
        409,
        "You cannot remove your own admin access",
        "CANNOT_DEMOTE_SELF",
      );
    }

    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    if (admins <= 1) {
      throw new AppError(
        409,
        "There must always be at least one administrator",
        "LAST_ADMIN",
      );
    }
  }

  return prisma.user.update({
    where: { id: targetId },
    data: { role },
    select: memberFields,
  });
}
