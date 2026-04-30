import { Router, Request, Response } from "express";
import { sendInterviewEmail, sendRoleReferralEmail } from "../services/emailService";
import logger from "../utils/logger";

const router = Router();

/**
 * POST /api/interviews/notify
 *
 * Sends a confirmation email to the candidate and (optionally) schedules
 * a 24-hour reminder. Called by ScheduleInterviewModal after it saves
 * the interview record.
 *
 * Body shape (mirrors what the modal POSTs):
 * {
 *   applicant_id:       string
 *   applicant_name:     string
 *   applicant_email:    string
 *   job_title:          string
 *   interview_type:     "online" | "offline"
 *   interview_date:     string   // "YYYY-MM-DD"
 *   interview_time:     string   // "HH:MM"
 *   interview_link?:    string
 *   interview_location?: string
 *   interview_notes?:   string
 *   reminder_at:        string   // ISO-8601
 * }
 */
router.post("/notify", async (req: Request, res: Response) => {
  const {
    applicant_name,
    applicant_email,
    job_title,
    interview_type,
    interview_date,
    interview_time,
    interview_link,
    interview_location,
    interview_notes,
  } = req.body;

  if (!applicant_email || !applicant_name || !job_title || !interview_date || !interview_time) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const interviewDate = new Date(`${interview_date}T${interview_time}`);
  if (isNaN(interviewDate.getTime())) {
    return res.status(400).json({ error: "Invalid interview_date / interview_time" });
  }

  const platform = interview_type === "online" ? "Online (Video Call)" : "In Person";

  try {
    await sendInterviewEmail({
      to:            applicant_email,
      candidateName: applicant_name,
      jobTitle:      job_title,
      interviewDate: interviewDate,
      platform,
      link:     interview_type === "online"  ? interview_link     : undefined,
      location: interview_type === "offline" ? interview_location : undefined,
      notes:    interview_notes || undefined,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error("Failed to send interview notification email", err);
    return res.status(500).json({ error: "Failed to send email" });
  }
});

/**
 * POST /api/interviews/role-referral
 *
 * Sends the recruiter-composed referral email to a candidate about
 * another open role the AI flagged them as a strong fit for.
 * Called by RoleReferralModal after the recruiter reviews and edits the email.
 *
 * Body shape:
 * {
 *   to:            string  // candidate email
 *   candidateName: string
 *   appliedRole:   string  // role they originally applied to
 *   suggestedRole: string  // role AI matched them to
 *   subject:       string  // recruiter-edited subject line
 *   body:          string  // recruiter-edited email body
 * }
 */
router.post("/role-referral", async (req: Request, res: Response) => {
  const { to, candidateName, appliedRole, suggestedRole, subject, body } = req.body;

  if (!to || !candidateName || !appliedRole || !suggestedRole || !subject || !body) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    await sendRoleReferralEmail({ to, candidateName, appliedRole, suggestedRole, subject, body });
    logger.info(`Role referral email sent to ${to} — suggested role: ${suggestedRole}`);
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error("Failed to send role referral email", err);
    return res.status(500).json({ error: "Failed to send email" });
  }
});

export default router;
