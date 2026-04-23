import mongoose, { Schema, Document, Types } from "mongoose";

export interface IJob extends Document {
  title: string;
  department: string;
  location: string;
  employment_type: "Full-time" | "Part-time" | "Contract" | "Internship" | "";
  experience_level: string;
  description: string;
  required_skills: string[];
  preferred_skills: string[];
  salary_range_min?: number | null;
  salary_range_max?: number | null;
  currency_symbol: string;
  status: "Draft" | "Active" | "Paused" | "Closed";
  screening_weights: {
    skills: number;
    experience: number;
    education: number;
    relevance: number;
  };
  last_screened_at?: Date | null;
  userId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema = new Schema<IJob>(
  {
    title:            { type: String, required: true, trim: true },
    department:       { type: String, trim: true, default: "" },
    location:         { type: String, trim: true, default: "" },
    employment_type:  { type: String, enum: ["Full-time", "Part-time", "Contract", "Internship", ""], default: "" },
    experience_level: { type: String, trim: true, default: "" },
    description:      { type: String, trim: true, default: "" },
    required_skills:  [{ type: String, trim: true }],
    preferred_skills: [{ type: String, trim: true }],
    salary_range_min: { type: Number, default: null },
    salary_range_max: { type: Number, default: null },
    currency_symbol:  { type: String, default: "USD" },
    status: {
      type: String,
      enum: ["Draft", "Active", "Paused", "Closed"],
      default: "Draft",
    },
    screening_weights: {
      skills:     { type: Number, default: 40 },
      experience: { type: Number, default: 30 },
      education:  { type: Number, default: 15 },
      relevance:  { type: Number, default: 15 },
    },
    last_screened_at: { type: Date, default: null },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (_doc: unknown, ret: Record<string, unknown>) => { ret["__v"] = undefined; return ret; } },
  }
);

JobSchema.index({ userId: 1 });
JobSchema.index({ status: 1 });

export default mongoose.model<IJob>("Job", JobSchema);
