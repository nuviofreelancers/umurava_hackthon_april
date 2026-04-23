import nodemailer from "nodemailer";
import logger from "../utils/logger";

function createTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT ?? "587", 10),
    secure: parseInt(SMTP_PORT ?? "587", 10) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

interface InterviewEmailPayload {
  to: string;
  candidateName: string;
  jobTitle: string;
  interviewDate: Date;
  platform: string;
  link?: string;
}

export async function sendInterviewEmail(payload: InterviewEmailPayload): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    logger.warn("SMTP not configured — skipping interview email");
    return;
  }

  const dateStr = payload.interviewDate.toLocaleString("en-US", {
    weekday: "long", year: "numeric", month: "long",
    day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  await transport.sendMail({
    from: process.env.SMTP_FROM ?? "TalentScreen <noreply@talentscreen.io>",
    to: payload.to,
    subject: `Interview Scheduled: ${payload.jobTitle}`,
    html: `
      <h2>Your interview has been scheduled</h2>
      <p>Hi ${payload.candidateName},</p>
      <p>We're pleased to invite you to an interview for the <strong>${payload.jobTitle}</strong> position.</p>
      <table>
        <tr><td><strong>Date & Time:</strong></td><td>${dateStr}</td></tr>
        <tr><td><strong>Platform:</strong></td><td>${payload.platform}</td></tr>
        ${payload.link ? `<tr><td><strong>Link:</strong></td><td><a href="${payload.link}">${payload.link}</a></td></tr>` : ""}
      </table>
      <p>Please confirm your attendance by replying to this email.</p>
      <p>Best regards,<br/>TalentScreen HR Team</p>
    `,
  });

  logger.info(`Interview email sent to ${payload.to}`);
}
