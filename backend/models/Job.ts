import mongoose from "mongoose";

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true},
  requiredSkills: { type: [String], required: true, default: []},
  experienceLevel: { type: Number, required: true},
  education: { type: String, required: true}
}, { timestamps: true });

const Job = mongoose.model("Job", jobSchema);

export default Job;