import mongoose from "mongoose";

// One document per candidate per screening run
const screeningResultSchema = new mongoose.Schema({
  job_id: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true, index: true },
  applicant_id: { type: mongoose.Schema.Types.ObjectId, ref: "Applicant", required: true, index: true },
  applicant_name: { type: String, default: "" },
  rank: { type: Number, default: 0 },
  match_score: { type: Number, default: 0 },
  skills_score: { type: Number, default: 0 },
  experience_score: { type: Number, default: 0 },
  education_score: { type: Number, default: 0 },
  relevance_score: { type: Number, default: 0 },
  confidence_level: { type: String, enum: ["High", "Medium", "Low"], default: "Medium" },
  recommendation: { type: String, default: "" },
  strengths: { type: [String], default: [] },
  gaps: [{
    description: { type: String, default: "" },
    type: { type: String, enum: ["dealbreaker", "nice-to-have", ""], default: "" }
  }],
  bias_flags: { type: [String], default: [] }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

const ScreeningResult = mongoose.model("ScreeningResult", screeningResultSchema);
export default ScreeningResult;
