import mongoose from "mongoose";

const jobSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  title: { type: String, required: true },
  department: { type: String, default: "" },
  location: { type: String, default: "" },
  employment_type: { type: String, enum: ["Full-time", "Part-time", "Contract", "Internship", ""], default: "" },
  experience_level: { type: String, default: "" },
  description: { type: String, default: "" },
  required_skills: { type: [String], default: [] },
  preferred_skills: { type: [String], default: [] },
  salary_range_min: { type: Number, default: null },
  salary_range_max: { type: Number, default: null },
  currency_symbol: { type: String, default: "$" },
  status: { type: String, enum: ["Draft", "Active", "Paused", "Closed"], default: "Draft" },
  screening_weights: {
    skills: { type: Number, default: 25 },
    experience: { type: Number, default: 25 },
    education: { type: Number, default: 25 },
    relevance: { type: Number, default: 25 }
  },
  last_screened_at: { type: Date, default: null }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

const Job = mongoose.model("Job", jobSchema);
export default Job;
