"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMe = exports.getMe = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const register = async (req, res) => {
    try {
        const { email, password, full_name, role } = req.body;
        const existingUser = await User_1.default.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }
        const hash = await bcryptjs_1.default.hash(password, 10);
        const user = await User_1.default.create({ email, password: hash, full_name: full_name || "", role: role || "hr" });
        const token = jsonwebtoken_1.default.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });
        res.status(201).json({
            message: "User registered successfully",
            token,
            user: { id: user._id, email: user.email, full_name: user.full_name, role: user.role }
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error during registration" });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User_1.default.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }
        const match = await bcryptjs_1.default.compare(password, user.password);
        if (!match) {
            return res.status(400).json({ message: "Wrong password" });
        }
        const token = jsonwebtoken_1.default.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });
        res.json({
            message: "Login successful",
            token,
            user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role }
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error during login" });
    }
};
exports.login = login;
// GET /api/auth/me
const getMe = async (req, res) => {
    try {
        const user = await User_1.default.findById(req.user.id).select("-password");
        if (!user)
            return res.status(404).json({ message: "User not found" });
        res.json({ id: user.id, email: user.email, full_name: user.full_name, role: user.role });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching profile" });
    }
};
exports.getMe = getMe;
// PUT /api/auth/me
const updateMe = async (req, res) => {
    try {
        const { full_name, email, password } = req.body;
        const updates = {};
        if (full_name)
            updates.full_name = full_name;
        if (email)
            updates.email = email;
        if (password)
            updates.password = await bcryptjs_1.default.hash(password, 10);
        const user = await User_1.default.findByIdAndUpdate(req.user.id, updates, { new: true }).select("-password");
        if (!user)
            return res.status(404).json({ message: "User not found" });
        res.json({ message: "Profile updated", user });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error updating profile" });
    }
};
exports.updateMe = updateMe;
//# sourceMappingURL=authController.js.map