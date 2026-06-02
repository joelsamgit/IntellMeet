import mongoose from "mongoose";

export function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

export function canAccessMeeting(meeting, userId, role) {
  const uid = String(userId);
  if (role === "admin") return true;
  if (String(meeting.host?._id || meeting.host) === uid) return true;
  if (meeting.status === "live") return true;
  return (meeting.participants || []).some((p) => String(p?._id || p) === uid);
}

export function canManageMeeting(meeting, userId, role) {
  if (role === "admin") return true;
  return String(meeting.host?._id || meeting.host) === String(userId);
}
