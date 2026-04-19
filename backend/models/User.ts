import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  full_name: { type: String, default: "", trim: true },
  role: { type: String, enum: ["admin", "hr", "recruiter"], default: "hr" }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return require("bcryptjs").compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;