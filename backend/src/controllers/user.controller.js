import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import User from "../models/User.js";
import { uploadBuffer } from "../services/cloudinary.service.js";

export const getProfile = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toPublicJSON() });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { name, bio, email } = req.body;
  if (email && email !== req.user.email) {
    const taken = await User.findOne({ email });
    if (taken) throw new AppError("Email already in use", 409);
    req.user.email = email;
  }
  if (name !== undefined) req.user.name = name;
  if (bio !== undefined) req.user.bio = bio;
  await req.user.save();
  res.json({ user: req.user.toPublicJSON() });
});

export const listAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select("name email avatar role bio createdAt").lean();
  res.json({ users });
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file?.buffer) throw new AppError("Image file is required", 400);
  try {
    let url;
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      const result = await uploadBuffer(req.file.buffer, "intellmeet/avatars", req.file.originalname);
      url = result.url;
    } else {
      // Resilient local fallback if Cloudinary is not configured
      const path = await import("path");
      const fs = await import("fs");
      const { fileURLToPath } = await import("url");
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      const dir = path.join(__dirname, "../uploads/avatars");
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const ext = path.extname(req.file.originalname) || ".png";
      const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
      const filePath = path.join(dir, filename);
      await fs.promises.writeFile(filePath, req.file.buffer);

      url = `/uploads/avatars/${filename}`;
    }

    req.user.avatar = url;
    await req.user.save();
    res.json({ user: req.user.toPublicJSON() });
  } catch (e) {
    throw new AppError(e.message || "Upload failed", 500);
  }
});
