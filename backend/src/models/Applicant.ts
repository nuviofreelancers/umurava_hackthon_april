import mongoose, { Schema, Document, Types } from "mongoose";

// ─── Sub-document interfaces ───────────────────────────────────────────────────

export interface ISkill {
  name: string;
  level: "Beginner" | "Intermediate" | "Advanced" | "Expert";
  yearsOfExperience?: number;
}

export interface ILanguage {
  name: string;
  proficiency: "Basic" | "Conversational" | "Fluent" | "Native";
}

export interface IExperience {
  company: string;
  role: string;
  startDate: string;   // "YYYY-MM"
  endDate: string;     // "YYYY-MM" | "Present"
  description?: string;
  technologies?: string[];
  isCurrent: boolean;
}

export interface IEducation {
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startYear?: number;
  endYear?: number;
}

export interface ICertification {
  name: string;
  issuer: string;
  issueDate?: string; // "YYYY-MM"
}

export interface IProject {
  name: string;
  description: string;
  technologies?: string[];
  role?: string;
  link?: string;
  startDate?: string; // "YYYY-MM"
  endDate?: string;   // "YYYY-MM"
}

export interface IAvailability {
  status: "Available" | "Open to Opportunities" | "Not Available";
  type: "Full-time" | "Part-time" | "Contract";
  startDate?: string; // "YYYY-MM-DD"
}

export interface ISocialLinks {
  linkedin?: string;
  github?: string;
  portfolio?: string;
  website?: string;
  twitter?: string;
  [key: string]: string | undefined;
}

// ─── Main Applicant interface ─────────────────────────────────────────────────

export interface IApplicant extends Document {
  // Basic Info
  full_name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
  headline: string;
  bio?: string;
  location: string;

  // Professional Summary
  current_role?: string;
  current_company?: string;
  experience_years?: number;

  // Umurava Schema Fields
  skills: ISkill[];
  languages: ILanguage[];
  experience: IExperience[];
  education: IEducation[];
  certifications: ICertification[];
  projects: IProject[];
  availability: IAvailability;
  socialLinks?: ISocialLinks;

  // Legacy / Convenience Fields
  education_level: "High School" | "Associate" | "Bachelor" | "Master" | "PhD" | "Other" | "";
  education_field?: string;
  portfolio_url?: string;

  // App Metadata
  jobId?: Types.ObjectId;
  userId?: Types.ObjectId;
  sourceType: "manual" | "pdf" | "csv" | "json" | "docx" | "image_ocr" | "url";
  interview_status: "not_scheduled" | "scheduled" | "completed" | "cancelled";
  interview_date?: Date;
  interview_platform?: string;
  interview_link?: string;
  notes?: string;
  isDeleted: boolean;
  deletedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const SkillSchema = new Schema<ISkill>({
  name:              { type: String, required: true, trim: true },
  level:             { type: String, enum: ["Beginner", "Intermediate", "Advanced", "Expert"], default: "Intermediate" },
  yearsOfExperience: { type: Number, min: 0 },
}, { _id: false });

const LanguageSchema = new Schema<ILanguage>({
  name:        { type: String, required: true, trim: true },
  proficiency: { type: String, enum: ["Basic", "Conversational", "Fluent", "Native"], default: "Conversational" },
}, { _id: false });

const ExperienceSchema = new Schema<IExperience>({
  company:      { type: String, required: true, trim: true },
  role:         { type: String, required: true, trim: true },
  startDate:    { type: String, required: true },
  endDate:      { type: String, default: "Present" },
  description:  { type: String, trim: true },
  technologies: [{ type: String, trim: true }],
  isCurrent:    { type: Boolean, default: false },
}, { _id: false });

const EducationSchema = new Schema<IEducation>({
  institution: { type: String, required: true, trim: true },
  degree:      { type: String, required: true, trim: true },
  fieldOfStudy:{ type: String, trim: true },
  startYear:   { type: Number },
  endYear:     { type: Number },
}, { _id: false });

const CertificationSchema = new Schema<ICertification>({
  name:      { type: String, required: true, trim: true },
  issuer:    { type: String, trim: true },
  issueDate: { type: String },
}, { _id: false });

const ProjectSchema = new Schema<IProject>({
  name:         { type: String, required: true, trim: true },
  description:  { type: String, trim: true },
  technologies: [{ type: String, trim: true }],
  role:         { type: String, trim: true },
  link:         { type: String, trim: true },
  startDate:    { type: String },
  endDate:      { type: String },
}, { _id: false });

const AvailabilitySchema = new Schema<IAvailability>({
  status:    { type: String, enum: ["Available", "Open to Opportunities", "Not Available"], default: "Available" },
  type:      { type: String, enum: ["Full-time", "Part-time", "Contract"], default: "Full-time" },
  startDate: { type: String },
}, { _id: false });

// ─── Main Applicant Schema ────────────────────────────────────────────────────

const ApplicantSchema = new Schema<IApplicant>(
  {
    // Basic Info
    full_name:   { type: String, required: true, trim: true },
    first_name:  { type: String, trim: true },
    last_name:   { type: String, trim: true },
    email:       { type: String, required: true, trim: true, lowercase: true },
    phone:       { type: String, trim: true },
    headline:    { type: String, trim: true, default: "" },
    bio:         { type: String, trim: true },
    location:    { type: String, trim: true, default: "" },

    // Professional Summary
    current_role:     { type: String, trim: true },
    current_company:  { type: String, trim: true },
    experience_years: { type: Number, min: 0 },

    // Umurava Core Fields
    skills:         { type: [SkillSchema],       default: [] },
    languages:      { type: [LanguageSchema],    default: [] },
    experience:     { type: [ExperienceSchema],  default: [] },
    education:      { type: [EducationSchema],   default: [] },
    certifications: { type: [CertificationSchema], default: [] },
    projects:       { type: [ProjectSchema],     default: [] },
    availability: {
      type: AvailabilitySchema,
      default: () => ({ status: "Available", type: "Full-time" }),
    },
    socialLinks: {
      linkedin:  { type: String },
      github:    { type: String },
      portfolio: { type: String },
      website:   { type: String },
      twitter:   { type: String },
    },

    // Legacy Fields
    education_level: {
      type: String,
      enum: ["High School", "Associate", "Bachelor", "Master", "PhD", "Other", ""],
      default: "",
    },
    education_field: { type: String, trim: true },
    portfolio_url:   { type: String, trim: true },

    // App Metadata
    jobId:  { type: Schema.Types.ObjectId, ref: "Job" },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    sourceType: {
      type: String,
      enum: ["manual", "pdf", "csv", "json", "docx", "image_ocr", "url"],
      default: "manual",
    },
    interview_status: {
      type: String,
      enum: ["not_scheduled", "scheduled", "completed", "cancelled"],
      default: "not_scheduled",
    },
    interview_date:     { type: Date },
    interview_platform: { type: String, trim: true },
    interview_link:     { type: String, trim: true },
    notes:              { type: String, trim: true },

    // Soft Delete
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc: unknown, ret: Record<string, unknown>) => {
        ret["id"] = (ret["_id"] as { toString(): string })?.toString();
        ret["__v"] = undefined;
        return ret;
      },
    },
  }
);

// Indexes
ApplicantSchema.index({ email: 1, jobId: 1 });
ApplicantSchema.index({ jobId: 1 });
ApplicantSchema.index({ userId: 1 });
ApplicantSchema.index({ isDeleted: 1 });

export default mongoose.model<IApplicant>("Applicant", ApplicantSchema);
