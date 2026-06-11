import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import Notification from "../models/Notification.js";
import { serializeNotification } from "../services/notification.service.js";

export const listNotifications = asyncHandler(async (req, res) => {
  const rows = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100);
  res.json({
    notifications: rows.map((r) => serializeNotification(r)),
  });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const n = await Notification.findOne({ _id: req.params.id, user: req.user._id });
  if (!n) throw new AppError("Notification not found", 404);
  n.isRead = true;
  await n.save();
  res.json({ notification: serializeNotification(n) });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, isRead: false }, { $set: { isRead: true } });
  res.json({ message: "All notifications marked read" });
});
