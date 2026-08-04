import type { Request, Response } from "express";
import { z } from "zod";
import * as jobsService from "../services/jobs";
import { AppError } from "../middleware/error";

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
    type: z.enum(["HIWI", "WERKSTUDENT", "INTERNSHIP", "PART_TIME"]),
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
  .refine((v) => v.payCents != null || v.type === "INTERNSHIP", {
    // Pay is mandatory. Mandatory internships are exempt from the minimum
    // wage entirely, so those may explain themselves in payNote instead.
    error: "Bitte die Vergütung angeben",
    path: ["payCents"],
  })
  .superRefine((v, ctx) => {
    if (v.payCents == null || v.payUnit !== "HOUR") return;

    // A monthly figure cannot be checked without knowing the hours, so only
    // hourly pay is compared against the statutory floor.
    const floor = v.type === "HIWI" ? HIWI_MIN_CENTS : MIN_WAGE_CENTS;
    if (v.type === "INTERNSHIP") return;

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
  type: z.enum(["HIWI", "WERKSTUDENT", "INTERNSHIP", "PART_TIME"]).optional(),
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

export async function listAll(_req: Request, res: Response) {
  const [jobs, counts] = await Promise.all([
    jobsService.listAll(),
    jobsService.counts(),
  ]);
  res.json({ jobs, counts });
}

export async function submit(req: Request, res: Response) {
  const job = await jobsService.submit(req.body);
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
  res.json({ job });
}

export async function remove(req: Request, res: Response) {
  await jobsService.remove(idOf(req));
  res.status(204).end();
}
