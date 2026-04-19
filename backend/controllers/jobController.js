"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteJob = exports.updateJob = exports.getJobById = exports.getJobs = exports.createJob = void 0;
const Job_1 = __importDefault(require("../models/Job"));
const Applicant_1 = __importDefault(require("../models/Applicant"));
const ScreeningResult_1 = __importDefault(require("../models/ScreeningResult"));
// POST /api/jobs
const createJob = async (req, res) => {
    try {
        const job = await Job_1.default.create({ ...req.body, userId: req.user.id });
        res.status(201).json(job);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error while creating job" });
    }
};
exports.createJob = createJob;
// GET /api/jobs
const getJobs = async (req, res) => {
    try {
        const jobs = await Job_1.default.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.json(jobs);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error while fetching jobs" });
    }
};
exports.getJobs = getJobs;
// GET /api/jobs/:id
const getJobById = async (req, res) => {
    try {
        const job = await Job_1.default.findOne({ _id: req.params.id, userId: req.user.id });
        if (!job)
            return res.status(404).json({ message: "Job not found" });
        res.json(job);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching job" });
    }
};
exports.getJobById = getJobById;
// PUT /api/jobs/:id
const updateJob = async (req, res) => {
    try {
        const job = await Job_1.default.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, req.body, { returnDocument: "after", runValidators: false });
        if (!job)
            return res.status(404).json({ message: "Job not found" });
        res.json(job);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error updating job" });
    }
};
exports.updateJob = updateJob;
// DELETE /api/jobs/:id
const deleteJob = async (req, res) => {
    try {
        const job = await Job_1.default.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!job)
            return res.status(404).json({ message: "Job not found" });
        await ScreeningResult_1.default.deleteMany({ job_id: req.params.id });
        await Applicant_1.default.deleteMany({ jobId: req.params.id });
        res.json({ message: "Job deleted successfully" });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error deleting job" });
    }
};
exports.deleteJob = deleteJob;
//# sourceMappingURL=jobController.js.map