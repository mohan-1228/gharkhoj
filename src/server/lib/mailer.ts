import "server-only";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";
import { logger } from "./logger";

/**
 * Email transport: Mailpit (SMTP) locally, Amazon SES in production, or log-only in tests.
 * Failures are logged, never thrown — a notification must not break the user's action.
 */
export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

let smtp: Transporter | undefined;
let ses: SESClient | undefined;

export async function sendEmail(email: Email): Promise<void> {
  try {
    if (env.MAIL_TRANSPORT === "log") {
      logger.info({ to: email.to, subject: email.subject }, "email (log transport)");
      return;
    }
    if (env.MAIL_TRANSPORT === "smtp") {
      smtp ??= nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: false });
      await smtp.sendMail({ from: env.MAIL_FROM, ...email });
      return;
    }
    ses ??= new SESClient({ region: env.AWS_REGION });
    await ses.send(
      new SendEmailCommand({
        Source: env.MAIL_FROM,
        Destination: { ToAddresses: [email.to] },
        Message: {
          Subject: { Data: email.subject, Charset: "UTF-8" },
          Body: { Html: { Data: email.html, Charset: "UTF-8" }, Text: { Data: email.text, Charset: "UTF-8" } },
        },
      }),
    );
  } catch (err) {
    logger.error({ err, subject: email.subject }, "email send failed");
  }
}
