import mongoose, { Schema, Document, Types } from "mongoose";

export interface IGap {
  description: string;
  type: "dealbreaker" | "nice-to-have" | "";
}

export interface IScreeningResult extends Document {
  job_id: Types.ObjectId;
  applicant_id: Types.ObjectId;
  applicant_name: string;
  rank: number;
  match_score: number;
  skills_score: number;
  experience_score: number;
  education_score: number;
  relevance_score: number;
  confidence_level: "High" | "Medium" | "Low";
  recommendation: "Strong Yes" | "Yes" | "Maybe" | "No";
  strengths: string[];
  gaps: IGap[];
  bias_flags: string[];
  other_matching_roles: {
    job_id: string;
    job_title: string;
    estimated_score: number;
    match_reason: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const GapSchema = new Schema<IGap>({
  description: { type: String, required: true },
  type:        { type: String, enum: ["dealbreaker", "nice-to-have", ""], default: "" },
}, { _id: false });

const RoleMatchSchema = new Schema(
  {
    job_id:          { type: String },
    job_title:       { type: String },
    estimated_score: { type: Number },
    match_reason:    { type: String },
  },
  { _id: false }
);

const ScreeningResultSchema = new Schema<IScreeningResult>(
  {
    job_id:               { type: Schema.Types.ObjectId, ref: "Job", required: true },
    applicant_id:         { type: Schema.Types.ObjectId, ref: "Applicant", required: true },
    applicant_name:       { type: String, required: true },
    rank:                 { type: Number, required: true, min: 1 },
    match_score:          { type: Number, required: true, min: 0, max: 100 },
    skills_score:         { type: Number, default: 0, min: 0, max: 100 },
    experience_score:     { type: Number, default: 0, min: 0, max: 100 },
    education_score:      { type: Number, default: 0, min: 0, max: 100 },
    relevance_score:      { type: Number, default: 0, min: 0, max: 100 },
    confidence_level:     { type: String, enum: ["High", "Medium", "Low"], default: "Medium" },
    recommendation:       { type: String, enum: ["Strong Yes", "Yes", "Maybe", "No"], default: "Maybe" },
    strengths:            [{ type: String }],
    gaps:                 { type: [GapSchema], default: [] },
    bias_flags:           [{ type: String }],
    other_matching_roles: { type: [RoleMatchSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc: unknown, ret: Record<string, unknown>) => {
        ret["__v"] = undefined;
        return ret;
      },
    },
  }
);

ScreeningResultSchema.index({ job_id: 1 });
ScreeningResultSchema.index({ applicant_id: 1 });
ScreeningResultSchema.index({ job_id: 1, rank: 1 });

export default mongoose.model<IScreeningResult>("ScreeningResult", ScreeningResultSchema);