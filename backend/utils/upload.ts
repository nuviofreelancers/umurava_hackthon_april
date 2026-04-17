import multer from "multer";

// store in memory (best for AI processing)
const storage = multer.memoryStorage();

// optional file filter (PDF only)
const fileFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed"), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
});