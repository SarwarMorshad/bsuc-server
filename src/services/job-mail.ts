import { prisma } from "../lib/prisma";
import { sendMail } from "../lib/mailer";
import { env } from "../config/env";

/**
 * Notifications around job submissions.
 *
 * Written in German: every one of these goes to an employer who submitted a
 * German advert. Failures are swallowed by the callers — a listing that was
 * saved or approved should not appear to fail because a mail server was down.
 */

const escape = (v: string) =>
  v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function layout(heading: string, body: string) {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#1b1b1a">
  <h1 style="font-size:20px;color:#006a4e;margin:0 0 16px">${escape(heading)}</h1>
  ${body}
  <p style="margin-top:28px;font-size:13px;color:#5b5f63">
    Bangladesh Student Union Chemnitz
  </p>
</div>`;
}

/** Tells the committee that something is waiting in the queue. */
export async function notifyAdminsOfSubmission(job: {
  id: string;
  title: string;
  company: string;
  submitterName: string;
  submitterEmail: string;
}) {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { email: true },
  });
  if (admins.length === 0) return;

  const url = `${env.CLIENT_ORIGIN}/admin/jobs`;
  const subject = `Neue Stellenanzeige: ${job.title}`;
  const text = [
    `Eine neue Stellenanzeige wartet auf Prüfung.`,
    ``,
    `Titel:        ${job.title}`,
    `Unternehmen:  ${job.company}`,
    `Eingereicht:  ${job.submitterName} <${job.submitterEmail}>`,
    ``,
    `Prüfen: ${url}`,
  ].join("\n");

  const html = layout("Neue Stellenanzeige wartet auf Prüfung", `
  <p><strong>${escape(job.title)}</strong><br>${escape(job.company)}</p>
  <p style="font-size:14px;color:#5b5f63">
    Eingereicht von ${escape(job.submitterName)} (${escape(job.submitterEmail)})
  </p>
  <p><a href="${url}" style="display:inline-block;background:#006a4e;color:#f5f3ec;padding:10px 20px;border-radius:999px;text-decoration:none">Anzeige prüfen</a></p>`);

  await Promise.all(
    admins.map((a) => sendMail({ to: a.email, subject, text, html })),
  );
}

/** Confirms to the employer that we received it — and that a human reviews it. */
export async function confirmSubmission(job: {
  title: string;
  submitterName: string;
  submitterEmail: string;
}) {
  const subject = `Ihre Stellenanzeige ist eingegangen: ${job.title}`;
  const text = [
    `Guten Tag ${job.submitterName},`,
    ``,
    `vielen Dank für Ihre Stellenanzeige "${job.title}".`,
    ``,
    `Alle Anzeigen werden von unserem Team geprüft, bevor sie für unsere`,
    `Mitglieder sichtbar werden. Wir melden uns, sobald die Anzeige`,
    `freigegeben wurde.`,
    ``,
    `Mit freundlichen Grüßen`,
    `Bangladesh Student Union Chemnitz`,
  ].join("\n");

  const html = layout("Ihre Stellenanzeige ist eingegangen", `
  <p>Guten Tag ${escape(job.submitterName)},</p>
  <p>vielen Dank für Ihre Stellenanzeige <strong>${escape(job.title)}</strong>.</p>
  <p>Alle Anzeigen werden von unserem Team geprüft, bevor sie für unsere
     Mitglieder sichtbar werden. Wir melden uns, sobald die Anzeige
     freigegeben wurde.</p>`);

  await sendMail({ to: job.submitterEmail, subject, text, html });
}

/** Tells the employer the outcome. A rejection always carries its reason. */
export async function notifyDecision(job: {
  title: string;
  submitterName: string;
  submitterEmail: string;
  status: "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
}) {
  const approved = job.status === "APPROVED";

  const subject = approved
    ? `Ihre Stellenanzeige ist online: ${job.title}`
    : `Ihre Stellenanzeige wurde nicht veröffentlicht: ${job.title}`;

  const reason = job.rejectionReason?.trim();

  const text = approved
    ? [
        `Guten Tag ${job.submitterName},`,
        ``,
        `Ihre Anzeige "${job.title}" ist jetzt in unserer Jobbörse sichtbar.`,
        ``,
        `Mit freundlichen Grüßen`,
        `Bangladesh Student Union Chemnitz`,
      ].join("\n")
    : [
        `Guten Tag ${job.submitterName},`,
        ``,
        `wir haben Ihre Anzeige "${job.title}" geprüft und können sie leider`,
        `nicht veröffentlichen.`,
        ``,
        ...(reason ? [`Begründung: ${reason}`, ``] : []),
        `Bei Rückfragen antworten Sie gerne auf diese E-Mail.`,
        ``,
        `Mit freundlichen Grüßen`,
        `Bangladesh Student Union Chemnitz`,
      ].join("\n");

  const html = approved
    ? layout("Ihre Stellenanzeige ist online", `
      <p>Guten Tag ${escape(job.submitterName)},</p>
      <p>Ihre Anzeige <strong>${escape(job.title)}</strong> ist jetzt in unserer
         Jobbörse sichtbar.</p>`)
    : layout("Ihre Stellenanzeige wurde nicht veröffentlicht", `
      <p>Guten Tag ${escape(job.submitterName)},</p>
      <p>wir haben Ihre Anzeige <strong>${escape(job.title)}</strong> geprüft und
         können sie leider nicht veröffentlichen.</p>
      ${reason ? `<p style="background:#f5f3ec;padding:12px 16px;border-radius:8px"><strong>Begründung:</strong><br>${escape(reason)}</p>` : ""}
      <p style="font-size:14px;color:#5b5f63">Bei Rückfragen antworten Sie gerne auf diese E-Mail.</p>`);

  await sendMail({ to: job.submitterEmail, subject, text, html });
}
