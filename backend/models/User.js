"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const userSchema = new mongoose_1.default.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    full_name: { type: String, default: "", trim: true },
    role: { type: String, enum: ["admin", "hr", "recruiter"], default: "hr" }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });
userSchema.methods.comparePassword = async function (candidatePassword) {
    return require("bcryptjs").compare(candidatePassword, this.password);
};
const User = mongoose_1.default.model("User", userSchema);
exports.default = User;
//# sourceMappingURL=User.js.map