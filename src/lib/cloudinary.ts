import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";
import { AppError } from "../middleware/error";

export const cloudinaryConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

function assertConfigured() {
  if (!cloudinaryConfigured) {
    throw new AppError(
      503,
      "Image uploads are not configured on this server",
      "UPLOADS_UNAVAILABLE",
    );
  }
}

/**
 * Uploads an avatar from memory. Cloudinary crops to a 512px square focused on
 * the face and serves an optimised format, so avatars stay consistent in the
 * circular frames used across the site.
 */
export function uploadAvatar(
  buffer: Buffer,
  userId: string,
): Promise<{ url: string; publicId: string }> {
  assertConfigured();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "bsuc/avatars",
        public_id: userId,
        overwrite: true,
        resource_type: "image",
        transformation: [
          { width: 512, height: 512, crop: "fill", gravity: "face" },
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error || !result) {
          reject(new AppError(502, "Could not upload the image", "UPLOAD_FAILED"));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );

    stream.end(buffer);
  });
}

/** Removes an image. Failures are ignored: a leftover file must not break the request. */
export async function destroyImage(publicId: string) {
  if (!cloudinaryConfigured) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error("[cloudinary] failed to delete", publicId, err);
  }
}
