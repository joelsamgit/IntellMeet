import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { uploadBuffer } from "../services/cloudinary.service.js";
import Meeting from "../models/Meeting.js";
import { isValidObjectId } from "../utils/meetingSerializer.js";

export const uploadAttachment = asyncHandler(async (req, res) => {
  if (!req.file?.buffer) throw new AppError("File is required", 400);
  const { meetingId } = req.body;
  let meeting;
  if (meetingId) {
    if (!isValidObjectId(meetingId)) throw new AppError("Invalid meeting id", 400);
    meeting = await Meeting.findById(meetingId);
    if (!meeting) throw new AppError("Meeting not found", 404);
    const uid = String(req.user._id);
    const ok =
      req.user.role === "admin" ||
      String(meeting.host) === uid ||
      meeting.participants.some((p) => String(p) === uid);
    if (!ok) throw new AppError("Not allowed", 403);
  }
  try {
    const up = await uploadBuffer(req.file.buffer, "intellmeet/attachments", req.file.originalname);
    if (meeting) {
      meeting.attachments.push({
        url: up.url,
        publicId: up.publicId,
        originalName: req.file.originalname,
      });
      await meeting.save();
    }
    res.status(201).json({
      url: up.url,
      publicId: up.publicId,
      originalName: req.file.originalname,
    });
  } catch (e) {
    throw new AppError(e.message || "Upload failed — check Cloudinary configuration", 503);
  }
});
