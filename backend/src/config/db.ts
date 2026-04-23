import mongoose from "mongoose";
import logger from "../utils/logger";

const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not defined in environment variables");

  try {
    await mongoose.connect(uri);
    logger.info(`✅ MongoDB connected: ${mongoose.connection.host}`);

    mongoose.connection.on("error", (err) => logger.error("MongoDB connection error:", err));
    mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected — retrying..."));
  } catch (err) {
    logger.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  }
};

export default connectDB;
