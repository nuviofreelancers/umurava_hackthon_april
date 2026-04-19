import mongoose from "mongoose";

const applicantSchema = new mongoose.Schema({
  // Core identity
  full_name: { type: String, default: "" },
  email: { type: String, default: "" },
  phone: { type: String, default: "" },

  // Professional info
  current_role: { type: String, default: "" },
  current_company: { type: String, default: "" },
  experience_years: { type: Number, default: 0 },
  headline: { type: String, default: "" },
  bio: { type: String, default: "" },
  location: { type: String, default: "" },

  // Education
  education_level: { type: String, enum: ["High School", "Associate", "Bachelor", "Master", "PhD", "Other", ""], default: "" },
  education_field: { type: String, default: "" },

  // Skills & links
  skills: [{ name: String, level: String, yearsOfExperience: Number }],
  portfolio_url: { type: String, default: "" },
  socialLinks: {
    linkedin: { type: String, default: "" },
    github: { type: String, default: "" },
    website: { type: String, default: "" }
  },

  // Structured profile
  experience: [{ company: String, role: String, startDate: String, endDate: String }],
  education: [{ institution: String, degree: String, field: String, year: String }],
  certifications: [{ name: String, issuer: String, year: String }],
  languages: [{ name: String, level: String }],
  projects: [{ name: String, description: String, url: String }],

  // Interview scheduling
  interview_status: { type: String, enum: ["not_scheduled", "scheduled", "completed", "cancelled"], default: "not_scheduled" },
  interview_date: { type: String, default: null },
  interview_time: { type: String, default: null },
  interview_platform: { type: String, enum: ["Online", "In Person", ""], default: "" },
  interview_link: { type: String, default: "" },
  interview_location: { type: String, default: "" },
  interview_notes: { type: String, default: "" },
  interview_reminder_at: { type: Date, default: null },

  // Availability
  availability: {
    status: { type: String, default: "" },
    type: { type: String, default: "" }
  },

  // Profile completeness (0-100)
  profile_completeness: { type: Number, default: 0 },

  // System fields
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  sourceType: { type: String, enum: ["manual", "pdf", "csv", "json"], default: "manual" },
  rawText: { type: String, select: false } // don't return by default — avoids bloat
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

const Applicant = mongoose.model("Applicant", applicantSchema);
export default Applicant;
