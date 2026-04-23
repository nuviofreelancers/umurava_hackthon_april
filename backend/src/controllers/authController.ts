import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { AuthRequest } from "../middlewares/authMiddleware";
import logger from "../utils/logger";

function signToken(id: string): string {
  const secret = process.env.JWT_SECRET!;
  const expiresIn = process.env.JWT_EXPIRES_IN ?? "7d";
  return jwt.sign({ id }, secret, { expiresIn } as jwt.SignOptions);
}

// POST /api/auth/login
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");

    if (!user || !(await user.comparePassword(password))) {
      logger.warn(`[login] FAILED login attempt for email="${email}"`);
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const token = signToken(user.id as string);
    logger.info(`[login] SUCCESS user=${user.id} email="${user.email}"`);

    res.json({
      token,
      user: {
        id:         user.id,
        full_name:  user.full_name,
        email:      user.email,
        role:       user.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me
export async function getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
}

// PUT /api/auth/me
export async function updateMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { full_name, email, password, phone_number, specialisation, bio } = req.body as {
      full_name?: string;
      email?: string;
      password?: string;
      phone_number?: string;
      specialisation?: string;
      bio?: string;
    };

    const user = await User.findById(req.user!.id).select("+password");
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (full_name)    user.full_name    = full_name;
    if (email)        user.email        = email.toLowerCase().trim();
    if (phone_number) user.phone_number = phone_number;
    if (specialisation) user.specialisation = specialisation;
    if (bio)          user.bio          = bio;
    if (password) {
      if (password.length < 6) {
        res.status(400).json({ message: "Password must be at least 6 characters" });
        return;
      }
      user.password = password; // Pre-save hook will re-hash
    }

    await user.save();
    res.json(user);
  } catch (err) {
    next(err);
  }
}
