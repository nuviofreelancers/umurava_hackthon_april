import mongoose from "mongoose";

const screeningSchema = new mongoose.Schema({
  jobId: mongoose.Schema.Types.ObjectId,
  candidates: Array
}, { timestamps: true });
const ScreeningResult = mongoose.model("ScreeningResult", screeningSchema);
export default ScreeningResult;