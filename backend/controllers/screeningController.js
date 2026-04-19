"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteResultsByApplicant = exports.deleteResultsByJob = exports.getResults = exports.runScreening = void 0;
const Job_1 = __importDefault(require("../models/Job"));
const Applicant_1 = __importDefault(require("../models/Applicant"));
const ScreeningResult_1 = __importDefault(require("../models/ScreeningResult"));
const aiService_1 = require("../services/aiService");
const mongoose_1 = __importDefault(require("mongoose"));
// Normalize gaps — AI may return strings or {description, type} objects
function normalizeGaps(gaps) {
    if (!Array.isArray(gaps))
        return [];
    return gaps.map(g => {
        if (typeof g === "string")
            return { description: g, type: "" };
        if (typeof g === "object" && g !== null) {
            return {
                description: g.description || g.text || g.gap || String(g),
                type: g.type || g.severity || "",
            };
        }
        return { description: String(g), type: "" };
    });
}
// POST /api/screen
const runScreening = async (req, res) => {
    try {
        const { job_id, weights, shortlistSize } = req.body;
        if (!job_id)
            return res.status(400).json({ message: "job_id is required" });
        // Scope: only allow screening jobs owned by this user
        const job = await Job_1.default.findOne({ _id: job_id, userId: req.user.id });
        if (!job)
            return res.status(404).json({ message: "Job not found" });
        const applicants = await Applicant_1.default.find({
            jobId: new mongoose_1.default.Types.ObjectId(job_id),
            userId: req.user.id,
        });
        if (applicants.length === 0) {
            return res.status(400).json({ message: "No applicants found for this job" });
        }
        const effectiveWeights = weights || job.screening_weights || { skills: 25, experience: 25, education: 25, relevance: 25 };
        const effectiveShortlistSize = shortlistSize ? Number(shortlistSize) : applicants.length;
        // Run AI screening
        const aiResults = await (0, aiService_1.screenAI)(job, applicants, effectiveWeights, effectiveShortlistSize);
        // Delete prior results for this job
        await ScreeningResult_1.default.deleteMany({ job_id: new mongoose_1.default.Types.ObjectId(job_id) });
        // Save one document per candidate
        const savedResults = await ScreeningResult_1.default.insertMany(aiResults.map((r, idx) => ({
            job_id: new mongoose_1.default.Types.ObjectId(job_id),
            applicant_id: new mongoose_1.default.Types.ObjectId(r.applicant_id),
            applicant_name: r.applicant_name || "",
            rank: idx + 1,
            match_score: r.match_score ?? 0,
            skills_score: r.skills_score ?? 0,
            experience_score: r.experience_score ?? 0,
            education_score: r.education_score ?? 0,
            relevance_score: r.relevance_score ?? 0,
            confidence_level: r.confidence_level || "Medium",
            recommendation: r.recommendation || "",
            strengths: r.strengths || [],
            gaps: normalizeGaps(r.gaps || []),
            bias_flags: r.bias_flags || [],
        })));
        await Job_1.default.findByIdAndUpdate(job_id, { last_screened_at: new Date() });
        // Return plain array — matches what the frontend slice expects
        res.json(savedResults);
    }
    catch (error) {
        console.error("Screening error:", error);
        res.status(500).json({ message: "Error running AI screening" });
    }
};
exports.runScreening = runScreening;
// GET /api/results
const getResults = async (req, res) => {
    try {
        const filter = {};
        if (req.query.job_id)
            filter.job_id = new mongoose_1.default.Types.ObjectId(req.query.job_id);
        if (req.query.applicant_id)
            filter.applicant_id = new mongoose_1.default.Types.ObjectId(req.query.applicant_id);
        // Only return results for jobs owned by this user
        if (req.query.job_id) {
            const job = await Job_1.default.findOne({ _id: req.query.job_id, userId: req.user.id });
            if (!job)
                return res.json([]);
        }
        const results = await ScreeningResult_1.default.find(filter).sort({ rank: 1 });
        res.json(results);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching results" });
    }
};
exports.getResults = getResults;
// DELETE /api/results/by-job/:jobId
const deleteResultsByJob = async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await Job_1.default.findOne({ _id: jobId, userId: req.user.id });
        if (!job)
            return res.status(404).json({ message: "Job not found" });
        const { deletedCount } = await ScreeningResult_1.default.deleteMany({ job_id: new mongoose_1.default.Types.ObjectId(jobId) });
        res.json({ message: `${deletedCount} results deleted` });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error deleting results" });
    }
};
exports.deleteResultsByJob = deleteResultsByJob;
// DELETE /api/results/by-applicant/:id
const deleteResultsByApplicant = async (req, res) => {
    try {
        const { id } = req.params;
        const { deletedCount } = await ScreeningResult_1.default.deleteMany({ applicant_id: new mongoose_1.default.Types.ObjectId(id) });
        res.json({ message: `${deletedCount} results deleted` });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error deleting results" });
    }
};
exports.deleteResultsByApplicant = deleteResultsByApplicant;
//# sourceMappingURL=screeningController.js.map