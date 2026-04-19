"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const storage = multer_1.default.memoryStorage();
const allowedMimetypes = [
    "text/csv",
    "text/plain",
    "application/json",
    "application/pdf",
    // Word
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    // Images (for scanned resumes)
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/tiff",
    "image/webp",
];
const allowedExtensions = [".csv", ".json", ".pdf", ".docx", ".doc", ".jpg", ".jpeg", ".png", ".tiff", ".webp"];
const fileFilter = (req, file, cb) => {
    const ext = file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase();
    if (allowedMimetypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
        cb(null, true);
    }
    else {
        cb(new Error("Unsupported file type. Allowed: CSV, JSON, PDF, Word (.docx), or image files."), false);
    }
};
exports.upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB — OCR on large scans can be big
});
//# sourceMappingURL=upload.js.map