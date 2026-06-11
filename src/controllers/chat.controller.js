import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import Chat from "../models/Chat.js";
import Meeting from "../models/Meeting.js";
import { canAccessMeeting } from "../utils/access.js";

export function serializeChatMessage(doc) {
  const msg = doc.toObject ? doc.toObject() : doc;
  return {
    _id: msg._id,
    meeting: msg.meeting?._id || msg.meeting,
    sender: msg.sender
      ? {
          _id: msg.sender._id,
          name: msg.sender.name,
          email: msg.sender.email,
          role: msg.sender.role,
          ...(msg.sender.avatar ? { avatar: msg.sender.avatar } : {}),
        }
      : undefined,
    message: msg.message,
    kind: msg.kind,
    attachments: msg.attachments || [],
    editedAt: msg.editedAt,
    deletedAt: msg.deletedAt,
    createdAt: msg.createdAt,
    updatedAt: msg.updatedAt,
  };
}

async function assertMeetingAccess(meetingId, user) {
  const meeting = await Meeting.findById(meetingId);
  if (!meeting) throw new AppError("Meeting not found", 404);
  if (!canAccessMeeting(meeting, user._id, user.role)) {
    throw new AppError("Meeting not found", 404);
  }
  return meeting;
}

export const listMeetingMessages = asyncHandler(async (req, res) => {
  await assertMeetingAccess(req.params.meetingId, req.user);
  const limit = Math.min(Number(req.query.limit || 50), 100);
  const before = req.query.before ? { createdAt: { $lt: new Date(req.query.before) } } : {};
  const rows = await Chat.find({ meeting: req.params.meetingId, deletedAt: null, ...before })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("sender", "name email role avatar");
  res.json({ messages: rows.reverse().map(serializeChatMessage) });
});

export const createMeetingMessage = asyncHandler(async (req, res) => {
  await assertMeetingAccess(req.params.meetingId, req.user);
  const chat = await Chat.create({
    meeting: req.params.meetingId,
    sender: req.user._id,
    message: req.body.message,
    attachments: req.body.attachments || [],
  });
  const populated = await Chat.findById(chat._id).populate("sender", "name email role avatar");
  res.status(201).json({ message: serializeChatMessage(populated) });
});
