import { configureCloudinary } from "../config/cloudinary.js";
import { Readable } from "stream";

const cloudinary = configureCloudinary();

function bufferToStream(buffer) {
  const r = new Readable();
  r.push(buffer);
  r.push(null);
  return r;
}

/**
 * Uploads a file buffer to Cloudinary under the given folder.
 * @returns {{ url: string, publicId: string }}
 */
export async function uploadBuffer(buffer, folder, originalName) {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error("Cloudinary is not configured");
  }
  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        folder: folder || "intellmeet",
        resource_type: "auto",
        use_filename: true,
        filename_override: originalName?.replace(/\.[^/.]+$/, "") || undefined,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    bufferToStream(buffer).pipe(upload);
  });
}
