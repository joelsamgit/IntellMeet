import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import Meeting from "../models/Meeting.js";
import User from "../models/User.js";
import { generateMeetingCode } from "../utils/generateMeetingCode.js";
import { serializeMeeting, isValidObjectId } from "../utils/meetingSerializer.js";
import * as cache from "../services/cache.service.js";
import { notifyUsers } from "../services/notification.service.js";

async function findMeetingByParam(idOrCode) {
  if (isValidObjectId(idOrCode)) {
    return Meeting.findById(idOrCode);
  }
  return Meeting.findOne({ meetingCode: String(idOrCode).toLowerCase() });
}

function canAccessMeeting(meeting, userId, role) {
  const uid = String(userId);
  if (role === "admin") return true;
  if (String(meeting.host) === uid) return true;
  return meeting.participants.some((p) => String(p) === uid);
}

function canManageMeeting(meeting, userId, role) {
  if (role === "admin") return true;
  return String(meeting.host) === String(userId);
}

export const createMeeting = asyncHandler(async (req, res) => {
  let code = generateMeetingCode();
  for (let i = 0; i < 8; i++) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await Meeting.exists({ meetingCode: code });
    if (!exists) break;
    code = generateMeetingCode();
  }
  const hostId = String(req.user._id);
  const extra = (req.body.participantIds || []).map(String);
  const participantIds = [...new Set([hostId, ...extra])];
  const meeting = await Meeting.create({
    title: req.body.title,
    description: req.body.description || "",
    host: hostId,
    participants: participantIds,
    meetingCode: code,
    scheduledTime: new Date(req.body.scheduledTime),
    status: req.body.status || "scheduled",
  });
  const populated = await Meeting.findById(meeting._id)
    .populate("host", "name email role avatar")
    .populate("participants", "name email role avatar")
    .populate("actionItems.assignee", "name email role avatar");
  await User.updateMany({ _id: { $in: participantIds } }, { $addToSet: { meetings: meeting._id } });
  await cache.invalidateMeetingCache(String(meeting._id));
  await notifyUsers(participantIds.filter((id) => id !== hostId), {
    type: "meeting",
    meeting: meeting._id,
    message: `You were invited to ${meeting.title}`,
  });
  res.status(201).json({ meeting: serializeMeeting(populated) });
});

export const listMeetings = asyncHandler(async (req, res) => {
  const uid = req.user._id;
  const q =
    req.user.role === "admin"
      ? {}
      : { $or: [{ host: uid }, { participants: uid }] };
  const rows = await Meeting.find(q)
    .sort({ scheduledTime: -1 })
    .populate("host", "name email role avatar")
    .populate("participants", "name email role avatar")
    .populate("actionItems.assignee", "name email role avatar");
  res.json({ meetings: rows.map(serializeMeeting) });
});

export const getMeeting = asyncHandler(async (req, res) => {
  const m = await findMeetingByParam(req.params.id)
    .populate("host", "name email role avatar")
    .populate("participants", "name email role avatar")
    .populate("actionItems.assignee", "name email role avatar");
  if (!m) throw new AppError("Meeting not found", 404);
  if (!canAccessMeeting(m, req.user._id, req.user.role)) {
    throw new AppError("Meeting not found", 404);
  }
  const cacheKey = String(m._id);
  const cached = await cache.getCachedMeeting(cacheKey);
  if (cached) {
    return res.json({ meeting: JSON.parse(cached) });
  }
  const payload = serializeMeeting(m);
  await cache.cacheMeetingDoc(cacheKey, JSON.stringify(payload));
  res.json({ meeting: payload });
});

export const updateMeeting = asyncHandler(async (req, res) => {
  const m = await findMeetingByParam(req.params.id);
  if (!m) throw new AppError("Meeting not found", 404);
  if (!canManageMeeting(m, req.user._id, req.user.role)) {
    throw new AppError("Not allowed to update this meeting", 403);
  }
  const {
    title,
    description,
    scheduledTime,
    endTime,
    status,
    summary,
    recording,
    participantIds,
  } = req.body;
  if (title !== undefined) m.title = title;
  if (description !== undefined) m.description = description;
  if (scheduledTime !== undefined) m.scheduledTime = new Date(scheduledTime);
  if (endTime !== undefined) m.endTime = endTime ? new Date(endTime) : null;
  if (status !== undefined) m.status = status;
  if (summary !== undefined) m.summary = summary;
  if (recording !== undefined) m.recording = recording;
  if (participantIds !== undefined) {
    const hostId = String(m.host);
    const next = [...new Set([hostId, ...participantIds.map(String)])];
    m.participants = next;
  }
  await m.save();
  const populated = await Meeting.findById(m._id)
    .populate("host", "name email role avatar")
    .populate("participants", "name email role avatar")
    .populate("actionItems.assignee", "name email role avatar");
  await cache.invalidateMeetingCache(String(m._id));
  await notifyUsers(m.participants.filter((id) => String(id) !== String(req.user._id)), {
    type: "meeting",
    meeting: m._id,
    message: `Meeting updated: ${m.title}`,
  });
  res.json({ meeting: serializeMeeting(populated) });
});

export const deleteMeeting = asyncHandler(async (req, res) => {
  const m = await findMeetingByParam(req.params.id);
  if (!m) throw new AppError("Meeting not found", 404);
  if (!canManageMeeting(m, req.user._id, req.user.role)) {
    throw new AppError("Not allowed to delete this meeting", 403);
  }
  await User.updateMany({ meetings: m._id }, { $pull: { meetings: m._id } });
  await m.deleteOne();
  await cache.invalidateMeetingCache(String(m._id));
  res.json({ message: "Meeting deleted" });
});
