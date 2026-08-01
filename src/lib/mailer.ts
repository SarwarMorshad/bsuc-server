import nodemailer, { type Transporter } from "nodemailer";
import { env, isProduction } from "../config/env";

let transporter: Transporter | null = null;

/**
 * Returns the mail transport, creating it on first use.
 *
 * With SMTP_HOST configured, mail is sent for real. Without it — the usual case
 * in development — an Ethereal test account is created on the fly: nothing is
 * delivered to real inboxes, and each message gets a preview URL logged to the
 * console so the flow can be tested end to end without credentials.
 */
async function getTransporter(): Promise<Transporter> {
  if (transporter) return transporter;

  if (env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
    });
    return transporter;
  }

  if (isProduction) {
    throw new Error("SMTP_HOST must be configured in production");
  }

  const testAccount = await nodemailer.createTestAccount();
  console.log(
    "\n[mailer] No SMTP configured — using an Ethereal test inbox.\n" +
      "         Messages are not delivered; a preview link is logged for each one.\n",
  );
  transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
  return transporter;
}

export async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const tx = await getTransporter();
  const info = await tx.sendMail({ from: env.MAIL_FROM, ...options });

  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) console.log(`[mailer] Preview: ${preview}`);

  return info;
}
