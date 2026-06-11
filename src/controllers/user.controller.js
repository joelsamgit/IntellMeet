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
    const { url } = await uploadBuffer(req.file.buffer, "intellmeet/avatars", req.file.originalname);
    req.user.avatar = url;
    await req.user.save();
    res.json({ user: req.user.toPublicJSON() });
  } catch (e) {
    throw new AppError(e.message || "Upload failed — check Cloudinary configuration", 503);
  }
});
