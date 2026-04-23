import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User";
import logger from "../utils/logger";

const seedUsers = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    logger.error("❌ MONGODB_URI is not set — cannot seed");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    logger.info("🌱 Connected to MongoDB — seeding users...");

    const demoEmails = [
      "admin@hackathon.dev",
      "hr@hackathon.dev",
      "member3@hackathon.dev",
      "member4@hackathon.dev",
      "judge1@talentscreen.demo",
      "judge2@talentscreen.demo",
    ];

    // Remove any existing demo accounts first (clean slate)
    await User.deleteMany({ email: { $in: demoEmails } });
    logger.info("🗑️  Cleared existing demo accounts");

    const demoUsers = [
      // ── Team accounts ──────────────────────────────────────────────────────
      { full_name: "Admin Demo",  email: "admin@hackathon.dev",     password: "AdminPass123",      role: "admin" as const },
      { full_name: "M_1",         email: "hr@hackathon.dev",         password: "HRPass123",         role: "hr" as const },
      { full_name: "M_2",         email: "member3@hackathon.dev",    password: "RecruiterPass123",  role: "hr" as const },
      { full_name: "M_4",         email: "member4@hackathon.dev",    password: "TeamPass123",       role: "hr" as const },
      // ── Judge accounts ─────────────────────────────────────────────────────
      { full_name: "Judge One",   email: "judge1@talentscreen.demo", password: "Judge#Demo1",       role: "hr" as const },
      { full_name: "Judge Two",   email: "judge2@talentscreen.demo", password: "Judge#Demo2",       role: "hr" as const },
    ];

    for (const userData of demoUsers) {
      // Use the User model's pre-save hook to hash the password
      await User.create(userData);
      logger.info(`  ✅ Created: ${userData.email} (${userData.role})`);
    }

    console.log("\n╔══════════════════════════════════════════════════════╗");
    console.log("║            TalentScreen — Seed Complete              ║");
    console.log("╠══════════════════════════════════════════════════════╣");
    console.log("║  TEAM CREDENTIALS                                    ║");
    demoUsers.slice(0, 4).forEach((u) => {
      console.log(`║  ${u.email.padEnd(30)} / ${u.password.padEnd(18)}║`);
    });
    console.log("╠══════════════════════════════════════════════════════╣");
    console.log("║  JUDGE CREDENTIALS                                   ║");
    demoUsers.slice(4).forEach((u) => {
      console.log(`║  ${u.email.padEnd(30)} / ${u.password.padEnd(18)}║`);
    });
    console.log("╚══════════════════════════════════════════════════════╝\n");

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    logger.error("❌ Seed error:", err);
    process.exit(1);
  }
};

seedUsers();
