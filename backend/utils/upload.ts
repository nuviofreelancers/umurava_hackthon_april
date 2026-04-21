import multer from "multer";

const storage = multer.memoryStorage();

const allowedMimetypes = [
  "text/csv",
  "text/plain",
  "application/json",
  "application/pdf",
  // Word
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  // BUG FIX #4: browsers often send octet-stream for .doc/.docx downloads
  "application/octet-stream",
  // BUG FIX #2: Excel
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  // Images (for scanned resumes)
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/tiff",
  "image/webp",
];

const allowedExtensions = [
  ".csv", ".json",
  ".pdf",
  ".docx", ".doc",
  ".xlsx", ".xls", // BUG FIX #2
  ".jpg", ".jpeg", ".png", ".tiff", ".webp",
];

const fileFilter = (req: any, file: any, cb: any) => {
  const ext = file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase();
  // Accept if either the mimetype OR the extension is in the allowed lists.
  // Extension check is the reliable fallback for octet-stream sent by browsers.
  if (allowedMimetypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file type. Allowed: CSV, JSON, PDF, Word (.docx/.doc), Excel (.xlsx/.xls), or image files."), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});
