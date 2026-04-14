import mongoose from "mongoose";


const applicantSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  headline: String,
  bio: String,
  location: String,
  skills: [{ name: String, level: String, yearsOfExperience: Number }],
  experience: [{ company: String, role: String }],
  education: [{ institution: String, degree: String }],
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
  sourceType: String,
  rawText: String
}, { timestamps: true });

const Applicant = mongoose.model("Applicant", applicantSchema);
export default Applicant;