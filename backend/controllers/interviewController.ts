import { Request, Response } from "express";
import nodemailer from "nodemailer";

// POST /api/interviews/notify
export const notifyInterview = async (req: Request, res: Response) => {
  try {
    const {
      candidate_email,
      candidate_name,
      job_title,
      interview_date,
      interview_time,
      interview_platform,
      interview_link,
      interview_location,
      interview_notes
    } = req.body;

    if (!candidate_email || !interview_date || !interview_time) {
      return res.status(400).json({ message: "candidate_email, interview_date, and interview_time are required" });
    }

    const isOnline = interview_platform === "Online";
    const locationDetail = isOnline
      ? `Join link: ${interview_link || "TBD"}`
      : `Location: ${interview_location || "TBD"}`;

    const emailBody = `
Hi ${candidate_name || "Candidate"},

You have been invited to interview for the position of ${job_title || "the role"}.

Date: ${interview_date}
Time: ${interview_time}
Format: ${interview_platform || "TBD"}
${locationDetail}
${interview_notes ? `\nAdditional Notes:\n${interview_notes}` : ""}

Please confirm your attendance by replying to this email.

Best regards,
HR Team
    `.trim();

    // Only attempt to send if SMTP credentials are configured
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: candidate_email,
        subject: `Interview Invitation: ${job_title || "Position"}`,
        text: emailBody
      });

      return res.json({ message: "Interview notification sent successfully" });
    }

    // SMTP not configured — return success with a warning so the frontend still works
    console.warn("SMTP not configured — email not sent. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env");
    res.json({ message: "Interview scheduled (email not sent — SMTP not configured)", email_body: emailBody });
  } catch (error) {
    console.error("Interview notify error:", error);
    res.status(500).json({ message: "Error sending interview notification" });
  }
};
