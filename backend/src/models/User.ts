import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  full_name: string;
  email: string;
  password: string;
  role: "admin" | "hr";
  phone_number?: string;
  specialisation?: string;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    full_name:      { type: String, required: true, trim: true },
    email:          { type: String, required: true, unique: true, trim: true, lowercase: true },
    password:       { type: String, required: true, minlength: 6, select: false },
    role:           { type: String, enum: ["admin", "hr"], default: "hr" },
    phone_number:   { type: String, trim: true },
    specialisation: { type: String, trim: true },
    bio:            { type: String, trim: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        // password stripped by select:false
        (ret as Record<string,unknown>)["__v"] = undefined;
        return ret;
      },
    },
  }
);

// Hash password before saving
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model<IUser>("User", UserSchema);
