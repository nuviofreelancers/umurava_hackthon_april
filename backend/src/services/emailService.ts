// ─────────────────────────────────────────────────────────────────────────────
// emailService.ts — FULL REPLACEMENT
//
// Changes vs original:
//   1. sendInterviewEmail  — now attaches a .ics calendar invite so candidates
//      get the "Add to Calendar" banner in Gmail / Outlook / Apple Mail.
//   2. sendRoleReferralEmail — NEW. Sends a recruiter-edited referral/transfer
//      email when the AI suggests another open role for a candidate.
// ─────────────────────────────────────────────────────────────────────────────

import nodemailer from "nodemailer";
import logger from "../utils/logger";

// ─── Transport factory ────────────────────────────────────────────────────────

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

// ─── ICS generator ───────────────────────────────────────────────────────────
// Generates a RFC 5545-compliant iCalendar string.
// When attached to an email, every major mail client (Gmail, Outlook, Apple Mail)
// will show the "Add to Calendar / Accept / Decline" banner automatically.

function formatICSDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function generateICS(params: {
  uid: string;
  title: string;
  description: string;
  startDate: Date;
  durationMinutes?: number;
  location?: string;
  organizerEmail: string;
  organizerName: string;
  attendeeEmail: string;
  attendeeName: string;
}): string {
  const {
    uid,
    title,
    description,
    startDate,
    durationMinutes = 60,
    location,
    organizerEmail,
    organizerName,
    attendeeEmail,
    attendeeName,
  } = params;

  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
  const now = new Date();

  // Fold long lines per RFC 5545 (max 75 chars, continuation starts with space)
  const fold = (line: string): string => {
    const chunks: string[] = [];
    while (line.length > 75) {
      chunks.push(line.slice(0, 75));
      line = " " + line.slice(75);
    }
    chunks.push(line);
    return chunks.join("\r\n");
  };

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TalentScreen//TalentScreen HR//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    fold(`UID:${uid}`),
    fold(`DTSTAMP:${formatICSDate(now)}`),
    fold(`DTSTART:${formatICSDate(startDate)}`),
    fold(`DTEND:${formatICSDate(endDate)}`),
    fold(`SUMMARY:${title}`),
    fold(`DESCRIPTION:${description.replace(/\n/g, "\\n")}`),
    location ? fold(`LOCATION:${location}`) : null,
    fold(`ORGANIZER;CN=${organizerName}:mailto:${organizerEmail}`),
    fold(`ATTENDEE;CN=${attendeeName};RSVP=TRUE;ROLE=REQ-PARTICIPANT:mailto:${attendeeEmail}`),
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Interview reminder",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  return lines;
}

// ─── 1. sendInterviewEmail ────────────────────────────────────────────────────

export interface InterviewEmailPayload {
  to: string;
  candidateName: string;
  jobTitle: string;
  interviewDate: Date;
  platform: string;
  link?: string;
  location?: string;
  notes?: string;
  durationMinutes?: number; // default 60
}

export async function sendInterviewEmail(
  payload: InterviewEmailPayload
): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    logger.warn("SMTP not configured — skipping interview email");
    return;
  }

  const {
    to,
    candidateName,
    jobTitle,
    interviewDate,
    platform,
    link,
    location,
    notes,
    durationMinutes = 60,
  } = payload;

  const dateStr = interviewDate.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const organizerEmail =
    process.env.SMTP_FROM_ADDRESS ?? process.env.SMTP_USER ?? "noreply@talentscreen.io";
  const organizerName = "TalentScreen HR";

  // Generate .ics calendar attachment
  const uid = `interview-${Date.now()}-${Math.random().toString(36).slice(2)}@talentscreen.io`;
  const icsDescription =
    `Interview for ${jobTitle}\\n` +
    `Platform: ${platform}\\n` +
    (link ? `Link: ${link}\\n` : "") +
    (location ? `Location: ${location}\\n` : "") +
    (notes ? `Notes: ${notes}` : "");

  const icsContent = generateICS({
    uid,
    title: `Interview: ${jobTitle}`,
    description: icsDescription,
    startDate: interviewDate,
    durationMinutes,
    location: location ?? link,
    organizerEmail,
    organizerName,
    attendeeEmail: to,
    attendeeName: candidateName,
  });

  // HTML email body
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Interview Scheduled</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#18181b;padding:28px 36px;">
              <p style="margin:0;color:#a1a1aa;font-size:11px;letter-spacing:2px;text-transform:uppercase;">TalentScreen</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;line-height:1.3;">
                Interview Scheduled
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 20px;color:#3f3f46;font-size:15px;line-height:1.6;">
                Hi ${candidateName},
              </p>
              <p style="margin:0 0 28px;color:#3f3f46;font-size:15px;line-height:1.6;">
                We're pleased to invite you to an interview for the
                <strong style="color:#18181b;">${jobTitle}</strong> position.
                Please find the details below.
              </p>

              <!-- Details card -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#f9f9fb;border:1px solid #e4e4e7;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;color:#71717a;font-size:13px;width:120px;">Date &amp; Time</td>
                        <td style="padding:6px 0;color:#18181b;font-size:13px;font-weight:600;">${dateStr}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#71717a;font-size:13px;">Platform</td>
                        <td style="padding:6px 0;color:#18181b;font-size:13px;font-weight:600;">${platform}</td>
                      </tr>
                      ${
                        link
                          ? `<tr>
                        <td style="padding:6px 0;color:#71717a;font-size:13px;">Meeting Link</td>
                        <td style="padding:6px 0;font-size:13px;">
                          <a href="${link}" style="color:#2563eb;font-weight:600;">${link}</a>
                        </td>
                      </tr>`
                          : ""
                      }
                      ${
                        location
                          ? `<tr>
                        <td style="padding:6px 0;color:#71717a;font-size:13px;">Location</td>
                        <td style="padding:6px 0;color:#18181b;font-size:13px;font-weight:600;">${location}</td>
                      </tr>`
                          : ""
                      }
                      ${
                        notes
                          ? `<tr>
                        <td style="padding:6px 0;color:#71717a;font-size:13px;vertical-align:top;">Notes</td>
                        <td style="padding:6px 0;color:#3f3f46;font-size:13px;">${notes}</td>
                      </tr>`
                          : ""
                      }
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Calendar hint -->
              <p style="margin:0 0 28px;color:#71717a;font-size:13px;line-height:1.6;">
                📅 A calendar invitation is attached to this email — open it to add this interview
                directly to your calendar and set a reminder.
              </p>

              <p style="margin:0 0 6px;color:#3f3f46;font-size:15px;line-height:1.6;">
                Please reply to this email to confirm your attendance, or let us know
                if you need to reschedule.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;color:#a1a1aa;font-size:12px;line-height:1.6;">
                Best regards,<br />
                <strong style="color:#71717a;">TalentScreen HR Team</strong>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  // Plain-text fallback (for email clients that strip HTML)
  const text = [
    `Hi ${candidateName},`,
    "",
    `We're pleased to invite you to an interview for the ${jobTitle} position.`,
    "",
    `Date & Time : ${dateStr}`,
    `Platform    : ${platform}`,
    link ? `Meeting Link: ${link}` : null,
    location ? `Location    : ${location}` : null,
    notes ? `Notes       : ${notes}` : null,
    "",
    "A calendar invitation (.ics) is attached — open it to add this to your calendar.",
    "",
    "Please reply to confirm attendance or to reschedule.",
    "",
    "Best regards,",
    "TalentScreen HR Team",
  ]
    .filter((l) => l !== null)
    .join("\n");

  await transport.sendMail({
    from: `TalentScreen HR <${organizerEmail}>`,
    to,
    subject: `Interview Scheduled: ${jobTitle}`,
    text,
    html,
    attachments: [
      {
        filename: "interview-invite.ics",
        content: icsContent,
        contentType: "text/calendar; charset=utf-8; method=REQUEST",
      },
    ],
  });

  logger.info(`Interview email (+ .ics) sent to ${to}`);
}

// ─── 2. sendRoleReferralEmail ─────────────────────────────────────────────────
// Sends the recruiter-composed referral/transfer email to a candidate.
// The body is written by the recruiter in the UI — this function just delivers it.

export interface RoleReferralEmailPayload {
  to: string;
  candidateName: string;
  appliedRole: string;    // role they originally applied to
  suggestedRole: string;  // role AI suggested they're a better fit for
  subject: string;        // recruiter can edit this in the UI
  body: string;           // recruiter-edited email body (plain text)
}

export async function sendRoleReferralEmail(
  payload: RoleReferralEmailPayload
): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    logger.warn("SMTP not configured — skipping role referral email");
    return;
  }

  const { to, candidateName, appliedRole, suggestedRole, subject, body } = payload;

  const senderEmail =
    process.env.SMTP_FROM_ADDRESS ?? process.env.SMTP_USER ?? "noreply@talentscreen.io";

  // Convert plain-text body to simple HTML (preserve line breaks)
  const htmlBody = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />");

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#18181b;padding:28px 36px;">
              <p style="margin:0;color:#a1a1aa;font-size:11px;letter-spacing:2px;text-transform:uppercase;">TalentScreen</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:20px;font-weight:700;line-height:1.3;">
                An opportunity you might be interested in
              </h1>
            </td>
          </tr>

          <!-- Role context banner -->
          <tr>
            <td style="padding:20px 36px 0;">
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0;color:#1e40af;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">
                      Role Suggestion
                    </p>
                    <p style="margin:6px 0 0;color:#1e3a8a;font-size:13px;">
                      Applied for: <strong>${appliedRole}</strong>
                      &nbsp;→&nbsp;
                      Suggested: <strong>${suggestedRole}</strong>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Recruiter message -->
          <tr>
            <td style="padding:24px 36px 32px;">
              <p style="margin:0;color:#3f3f46;font-size:15px;line-height:1.8;">${htmlBody}</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;color:#a1a1aa;font-size:12px;line-height:1.6;">
                You can reply directly to this email with any questions.<br />
                <strong style="color:#71717a;">TalentScreen HR Team</strong>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  await transport.sendMail({
    from: `TalentScreen HR <${senderEmail}>`,
    replyTo: senderEmail, // candidate replies go to HR inbox
    to,
    subject,
    text: body,
    html,
  });

  logger.info(
    `Role referral email sent to ${to} — suggested: ${suggestedRole}`
  );
}
