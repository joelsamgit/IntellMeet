import mongoose from "mongoose";

function miniUser(u) {
  if (!u) return null;
  const o = u._doc || u;
  return {
    _id: o._id,
    name: o.name,
    email: o.email,
    role: o.role,
    ...(o.avatar ? { avatar: o.avatar } : {}),
  };
}

/** Shape meetings for the IntellMeet frontend (see frontend/src/types/index.ts). */
export function serializeMeeting(meeting) {
  const m = meeting.toObject ? meeting.toObject({ virtuals: true }) : { ...meeting };
  const hostId = m.host?._id || m.host;
  const participants = (m.participants || []).map((p) => miniUser(p)).filter(Boolean);
  return {
    _id: m._id,
    title: m.title,
    hostId: hostId?.toString?.() || String(hostId),
    participants,
    startTime: m.scheduledTime instanceof Date ? m.scheduledTime.toISOString() : m.scheduledTime,
    ...(m.endTime
      ? { endTime: m.endTime instanceof Date ? m.endTime.toISOString() : m.endTime }
      : {}),
    status: m.status,
    ...(m.summary ? { summary: m.summary } : {}),
    ...(m.recording ? { recording: m.recording } : {}),
    meetingCode: m.meetingCode,
    ...(m.actionItems?.length
      ? {
          actionItems: m.actionItems.map((ai) => ({
            _id: ai._id,
            text: ai.text,
            ...(ai.assignee ? { assignee: miniUser(ai.assignee) } : {}),
            status: ai.status,
            meetingId: String(m._id),
          })),
        }
      : { actionItems: [] }),
  };
}

export function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
}
