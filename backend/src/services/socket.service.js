import { Server } from "socket.io";
import { verifyAccessToken } from "../utils/jwt.js";
import User from "../models/User.js";
import Meeting from "../models/Meeting.js";
import Chat from "../models/Chat.js";
import { canAccessMeeting } from "../utils/access.js";
import { serializeChatMessage } from "../controllers/chat.controller.js";
import { setNotificationSocket, notifyUsers } from "./notification.service.js";

const liveParticipants = new Map();

function parseAllowedOrigins() {
  const raw = process.env.CLIENT_URL || "http://localhost:5173,http://127.0.0.1:5173";
  return [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
}

function meetingRoom(meetingId) {
  return `meeting:${meetingId}`;
}

function participantPayload(user, socketId) {
  return {
    socketId,
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    ...(user.avatar ? { avatar: user.avatar } : {}),
  };
}

async function getAccessibleMeeting(meetingId, socket) {
  const meeting = await Meeting.findById(meetingId);
  if (!meeting || !canAccessMeeting(meeting, socket.user._id, socket.user.role)) {
    throw new Error("Meeting not found");
  }
  return meeting;
}

function addParticipant(meetingId, socket) {
  const key = String(meetingId);
  if (!liveParticipants.has(key)) liveParticipants.set(key, new Map());
  liveParticipants.get(key).set(socket.id, participantPayload(socket.user, socket.id));
}

function removeParticipant(socket) {
  for (const [meetingId, participants] of liveParticipants.entries()) {
    if (participants.delete(socket.id)) {
      socket.to(meetingRoom(meetingId)).emit("participant:left", {
        meetingId,
        socketId: socket.id,
        userId: String(socket.user._id),
      });
      socket.to(meetingRoom(meetingId)).emit("participants:update", {
        meetingId,
        participants: [...participants.values()],
      });
    }
    if (participants.size === 0) liveParticipants.delete(meetingId);
  }
}

export function initializeSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: parseAllowedOrigins(),
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");
      if (!token) return next(new Error("Not authenticated"));
      const payload = verifyAccessToken(token);
      if (payload.typ !== "access") return next(new Error("Not authenticated"));
      const user = await User.findById(payload.sub);
      if (!user) return next(new Error("Not authenticated"));
      socket.user = user;
      socket.join(`user:${String(user._id)}`);
      return next();
    } catch {
      return next(new Error("Not authenticated"));
    }
  });

  setNotificationSocket(io);

  io.on("connection", (socket) => {
    socket.on("meeting:join", async ({ meetingId }, ack) => {
      try {
        const meeting = await getAccessibleMeeting(meetingId, socket);
        const id = String(meeting._id);
        socket.join(meetingRoom(id));
        addParticipant(id, socket);
        const participants = [...liveParticipants.get(id).values()];
        socket.to(meetingRoom(id)).emit("participant:joined", {
          meetingId: id,
          participant: participantPayload(socket.user, socket.id),
        });
        io.to(meetingRoom(id)).emit("participants:update", { meetingId: id, participants });
        ack?.({ ok: true, participants });
      } catch (err) {
        ack?.({ ok: false, message: err.message });
      }
    });

    socket.on("meeting:leave", ({ meetingId }, ack) => {
      const id = String(meetingId);
      socket.leave(meetingRoom(id));
      liveParticipants.get(id)?.delete(socket.id);
      const participants = [...(liveParticipants.get(id)?.values() || [])];
      socket.to(meetingRoom(id)).emit("participant:left", {
        meetingId: id,
        socketId: socket.id,
        userId: String(socket.user._id),
      });
      io.to(meetingRoom(id)).emit("participants:update", { meetingId: id, participants });
      ack?.({ ok: true });
    });

    socket.on("chat:send", async ({ meetingId, message, attachments }, ack) => {
      try {
        await getAccessibleMeeting(meetingId, socket);
        const chat = await Chat.create({
          meeting: meetingId,
          sender: socket.user._id,
          message,
          attachments: attachments || [],
        });
        const populated = await Chat.findById(chat._id).populate("sender", "name email role avatar");
        const payload = serializeChatMessage(populated);
        io.to(meetingRoom(String(meetingId))).emit("chat:message", payload);
        ack?.({ ok: true, message: payload });
      } catch (err) {
        ack?.({ ok: false, message: err.message });
      }
    });

    socket.on("signal:offer", async ({ meetingId, to, offer }, ack) => {
      try {
        await getAccessibleMeeting(meetingId, socket);
        io.to(to).emit("signal:offer", { meetingId, from: socket.id, offer });
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, message: err.message });
      }
    });

    socket.on("signal:answer", async ({ meetingId, to, answer }, ack) => {
      try {
        await getAccessibleMeeting(meetingId, socket);
        io.to(to).emit("signal:answer", { meetingId, from: socket.id, answer });
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, message: err.message });
      }
    });

    socket.on("signal:ice-candidate", async ({ meetingId, to, candidate }, ack) => {
      try {
        await getAccessibleMeeting(meetingId, socket);
        io.to(to).emit("signal:ice-candidate", { meetingId, from: socket.id, candidate });
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, message: err.message });
      }
    });

    socket.on("screen-share:start", async ({ meetingId }, ack) => {
      try {
        const meeting = await getAccessibleMeeting(meetingId, socket);
        socket.to(meetingRoom(String(meetingId))).emit("screen-share:started", {
          meetingId,
          user: participantPayload(socket.user, socket.id),
        });
        await notifyUsers(meeting.participants, {
          type: "screen_share",
          meeting: meeting._id,
          message: `${socket.user.name} started screen sharing in ${meeting.title}`,
        });
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, message: err.message });
      }
    });

    socket.on("screen-share:stop", async ({ meetingId }, ack) => {
      try {
        await getAccessibleMeeting(meetingId, socket);
        socket.to(meetingRoom(String(meetingId))).emit("screen-share:stopped", {
          meetingId,
          userId: String(socket.user._id),
        });
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, message: err.message });
      }
    });

    socket.on("disconnect", () => {
      removeParticipant(socket);
    });
  });

  return io;
}
