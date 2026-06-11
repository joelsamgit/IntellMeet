import multer from "multer";

const storage = multer.memoryStorage();

const maxMb = Number(process.env.MAX_FILE_MB || 10);

export const memoryUpload = multer({
  storage,
  limits: { fileSize: maxMb * 1024 * 1024 },
});
