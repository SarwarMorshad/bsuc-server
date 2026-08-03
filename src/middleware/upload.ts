import multer from "multer";
import { AppError } from "./error";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

/**
 * Accepts a single image in memory and streams it straight to Cloudinary —
 * nothing is written to the server's disk. The type is checked here, but the
 * limits are enforced again by Cloudinary itself.
 */
export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.includes(file.mimetype)) {
      cb(new AppError(400, "Please upload a JPEG, PNG or WebP image", "BAD_IMAGE_TYPE"));
      return;
    }
    cb(null, true);
  },
}).single("avatar");

/** Turns multer's own errors into the API's standard error shape. */
export function handleUploadErrors(err: unknown): never {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      throw new AppError(413, "The image must be 5 MB or smaller", "IMAGE_TOO_LARGE");
    }
    throw new AppError(400, "Could not read the uploaded file", "BAD_UPLOAD");
  }
  throw err;
}
