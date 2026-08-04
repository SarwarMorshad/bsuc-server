import type { Request, Response } from "express";
import { z } from "zod";
import * as jobsService from "../services/jobs";
import * as jobMail from "../services/job-mail";
import { AppError } from "../middleware/error";

/** Kept in step with the JobType enum in the schema. */
const JOB_TYPES = [
  "HIWI", "WERKSTUDENT", "INTERNSHIP", "MINIJOB", "PART_TIME", "THESIS",
  "DUAL_STUDY", "ENTRY_LEVEL", "TRAINEE", "FULL_TIME", "PHD", "FREELANCE",
] as const;

/** Express 5 types params as string | string[]; routes here always give one. */
const idOf = (req: Request) => String(req.params.id);

/**
 * Statutory minimum wage from 1 January 2026, in cents. Rises to 1460 on
 * 1 January 2027 — update then.
 */
const MIN_WAGE_CENTS = 1390;

/**
 * Student and research assistant posts at universities are paid on the TdL
 * scale rather than the minimum wage: 13.98 EUR without a degree, 14.59 with
 * a Bachelor's. The lower rate is the floor we check against.
 */
const HIWI_MIN_CENTS = 1398;

/**
 * Types that may carry no figure. A mandatory internship is exempt from the
 * minimum wage outright, and a thesis written at a company is usually unpaid
 * or covered by a small stipend — both explain themselves in payNote.
 */
const PAY_EXEMPT: readonly string[] = ["INTERNSHIP", "THESIS"];

/** The AGG forbids gendered adverts; (m/w/d) is how German ads signal that. */
const GENDER_MARKER = /\((?:m\s*\/\s*w\s*\/\s*d|w\s*\/\s*m\s*\/\s*d|d\s*\/\s*m\s*\/\s*w|m\s*\/\s*f\s*\/\s*d|a|all\s*genders)\)/i;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const requiredText = (min: number, max: number, message: string) =>
  z.string(message).trim().min(min, message).max(max);

export const submitJobSchema = z
  .object({
    title: requiredText(5, 160, "Bitte einen Stellentitel angeben").refine(
      (v) => GENDER_MARKER.test(v),
      "Der Titel muss (m/w/d) enthalten — das AGG verbietet geschlechtsbezogene Ausschreibungen",
    ),
    company: requiredText(2, 120, "Bitte den Firmennamen angeben"),
    companyWebsite: z.url("Bitte eine gültige Web-Adresse angeben").nullable().optional(),
    location: optionalText(160),
    remote: z.boolean().optional(),
    type: z.enum(JOB_TYPES),
    startDate: z.coerce.date().nullable().optional(),
    until: z.coerce.date().nullable().optional(),
    hoursPerWeek: z.coerce.number().int().min(1).max(40).nullable().optional(),

    payCents: z.coerce.number().int().min(0).max(2_000_000).nullable().optional(),
    payUnit: z.enum(["HOUR", "MONTH"]).default("HOUR"),
    payNote: optionalText(200),

    aboutCompany: requiredText(20, 2000, "Bitte das Unternehmen kurz beschreiben"),
    tasks: requiredText(20, 4000, "Bitte die Aufgaben beschreiben"),
    profile: requiredText(20, 4000, "Bitte das gesuchte Profil beschreiben"),
    offer: optionalText(4000),
    germanLevel: z
      .enum(["ENGLISH_OK", "A1", "A2", "B1", "B2", "C1", "C2"])
      .nullable()
      .optional(),

    contactName: optionalText(120),
    applyEmail: z.email("Bitte eine gültige E-Mail-Adresse angeben").nullable().optional(),
    applyUrl: z.url("Bitte eine gültige Web-Adresse angeben").nullable().optional(),
    deadline: z.coerce.date().nullable().optional(),

    submitterName: requiredText(2, 120, "Bitte einen Ansprechpartner angeben"),
    submitterEmail: z.email("Bitte eine gültige E-Mail-Adresse angeben"),
    submitterPhone: optionalText(40),
  })
  .refine((v) => v.applyEmail || v.applyUrl, {
    error: "Bitte angeben, wie man sich bewirbt — E-Mail oder Link",
    path: ["applyEmail"],
  })
  .refine((v) => v.payCents != null || PAY_EXEMPT.includes(v.type), {
    error: "Bitte die Vergütung angeben",
    path: ["payCents"],
  })
  .superRefine((v, ctx) => {
    if (v.payCents == null || v.payUnit !== "HOUR") return;

    // A monthly figure cannot be checked without knowing the hours, so only
    // hourly pay is compared against the statutory floor.
    if (PAY_EXEMPT.includes(v.type)) return;
    const floor = v.type === "HIWI" ? HIWI_MIN_CENTS : MIN_WAGE_CENTS;

    if (v.payCents < floor) {
      ctx.addIssue({
        code: "custom",
        path: ["payCents"],
        message:
          v.type === "HIWI"
            ? `Hilfskraftstellen werden nach TdL vergütet — mindestens ${(HIWI_MIN_CENTS / 100).toFixed(2)} €/Stunde`
            : `Der gesetzliche Mindestlohn liegt bei ${(MIN_WAGE_CENTS / 100).toFixed(2)} €/Stunde`,
      });
    }
  });

/** Admins may edit anything afterwards, including fixing a title. */
export const updateJobSchema = z.object({
  title: z.string().trim().min(5).max(160).optional(),
  company: z.string().trim().min(2).max(120).optional(),
  companyWebsite: z.url().nullable().optional(),
  location: optionalText(160),
  remote: z.boolean().optional(),
  type: z.enum(JOB_TYPES).optional(),
  startDate: z.coerce.date().nullable().optional(),
  until: z.coerce.date().nullable().optional(),
  hoursPerWeek: z.coerce.number().int().min(1).max(40).nullable().optional(),
  payCents: z.coerce.number().int().min(0).max(2_000_000).nullable().optional(),
  payUnit: z.enum(["HOUR", "MONTH"]).optional(),
  payNote: optionalText(200),
  aboutCompany: z.string().trim().min(20).max(2000).optional(),
  tasks: z.string().trim().min(20).max(4000).optional(),
  profile: z.string().trim().min(20).max(4000).optional(),
  offer: optionalText(4000),
  germanLevel: z
    .enum(["ENGLISH_OK", "A1", "A2", "B1", "B2", "C1", "C2"])
    .nullable()
    .optional(),
  contactName: optionalText(120),
  applyEmail: z.email().nullable().optional(),
  applyUrl: z.url().nullable().optional(),
  deadline: z.coerce.date().nullable().optional(),
});

export const reviewJobSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: optionalText(500),
});

export async function list(req: Request, res: Response) {
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  res.json({ jobs: await jobsService.listForMembers({ type }) });
}

export const adminListQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export async function listAll(req: Request, res: Response) {
  const parsed = adminListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(400, "Invalid filter", "INVALID_QUERY");
  }

  // Counts cover the whole board, not the current page, so the tabs keep
  // showing the real totals while a search narrows the list below them.
  const [result, counts] = await Promise.all([
    jobsService.listAll(parsed.data),
    jobsService.counts(),
  ]);

  res.json({ ...result, counts });
}

export async function getOne(req: Request, res: Response) {
  res.json({ job: await jobsService.getForAdmin(idOf(req)) });
}

export async function submit(req: Request, res: Response) {
  const job = await jobsService.submit(req.body);

  // Mail is best-effort: the listing is already stored, so a mail server
  // problem must not make a successful submission look like a failure.
  void jobMail
    .notifyAdminsOfSubmission(job)
    .catch((err) => console.error("[jobs] admin notification failed", err));
  void jobMail
    .confirmSubmission(job)
    .catch((err) => console.error("[jobs] submitter confirmation failed", err));

  // Only an acknowledgement: the submitter gets no listing back, because it
  // is not public yet.
  res.status(201).json({ id: job.id, status: job.status });
}

export async function update(req: Request, res: Response) {
  res.json({ job: await jobsService.update(idOf(req), req.body) });
}

export async function review(req: Request, res: Response) {
  const reviewerId = req.user?.sub;
  if (!reviewerId) {
    throw new AppError(401, "Authentication required", "UNAUTHENTICATED");
  }

  const job = await jobsService.review(idOf(req), {
    status: req.body.status,
    rejectionReason: req.body.rejectionReason,
    reviewerId,
  });

  // The employer is told either way, and a rejection carries its reason.
  void jobMail
    .notifyDecision({ ...job, status: req.body.status })
    .catch((err) => console.error("[jobs] decision notification failed", err));

  res.json({ job });
}

export async function remove(req: Request, res: Response) {
  await jobsService.remove(idOf(req));
  res.status(204).end();
}
