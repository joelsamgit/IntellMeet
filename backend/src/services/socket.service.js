import { Server } from "socket.io";
import mongoose from "mongoose";
import { verifyAccessToken } from "../utils/jwt.js";
import User from "../models/User.js";
import Meeting from "../models/Meeting.js";
import Chat from "../models/Chat.js";
import { canAccessMeeting } from "../utils/access.js";
import { serializeChatMessage } from "../controllers/chat.controller.js";
import { setNotificationSocket, notifyUsers } from "./notification.service.js";
import { isJtiBlacklisted } from "./cache.service.js";

const liveParticipants = new Map();
const SOCKET_BUILD_TAG = "socket-service-2026-06-01-hoppscotch-meeting-lookup";

function parseAllowedOrigins() {
  const raw = process.env.CLIENT_URL || "http://localhost:5173,http://127.0.0.1:5173";
  return [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
}

function isAllowedDevOrigin(origin) {
  if (!origin) return true;
  if (process.env.NODE_ENV === "production") return false;
  if (origin === "app://hoppscotch") return true;
  try {
    const url = new URL(origin);
    const localHost =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname.startsWith("192.168.") ||
      url.hostname.startsWith("10.") ||
      url.hostname.startsWith("172.");
    const hoppscotch = url.hostname === "hoppscotch.io" || url.hostname.endsWith(".hoppscotch.io");
    return (
      (localHost && ["http:", "https:", "ws:", "wss:"].includes(url.protocol)) ||
      hoppscotch ||
      url.protocol === "chrome-extension:" ||
      url.protocol === "app:"
    );
  } catch {
    return false;
  }
}

function socketCorsOrigin(origin, callback) {
  const allowed = parseAllowedOrigins();
  if (!origin || allowed.includes(origin) || isAllowedDevOrigin(origin)) {
    return callback(null, true);
  }
  console.warn(`[Socket.IO CORS] Blocked origin: ${origin}`);
  return callback(null, false);
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
  const idOrCode = String(meetingId || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (!idOrCode) {
    throw new Error("meetingId is required");
  }
  const query = mongoose.Types.ObjectId.isValid(idOrCode)
    ? { $or: [{ _id: new mongoose.Types.ObjectId(idOrCode) }, { meetingCode: idOrCode }] }
    : { meetingCode: idOrCode };
  const meeting = await Meeting.findOne(query);
  if (process.env.NODE_ENV !== "production") {
    console.info("[Socket.IO meeting lookup]", {
      meetingId: idOrCode,
      query,
      found: Boolean(meeting),
      userId: String(socket.user?._id || ""),
      role: socket.user?.role,
      db: mongoose.connection.name,
      host: mongoose.connection.host,
    });
  }
  if (!meeting) {
    throw new Error("Meeting not found");
  }
  if (!canAccessMeeting(meeting, socket.user._id, socket.user.role)) {
    throw new Error("Access denied for this meeting");
  }

  // Automatically register participant if the meeting is live
  const uid = String(socket.user._id);
  const isParticipant = (meeting.participants || []).some((p) => String(p?._id || p) === uid);
  if (!isParticipant && meeting.status === "live") {
    meeting.participants.push(socket.user._id);
    await meeting.save();
  }

  return meeting;
}

function extractToken(socket) {
  const authHeader =
    socket.handshake.headers?.authorization ||
    socket.handshake.headers?.Authorization ||
    socket.handshake.auth?.authorization ||
    socket.handshake.auth?.Authorization;

  return (
    socket.handshake.auth?.token ||
    socket.handshake.query?.token ||
    (typeof authHeader === "string" ? authHeader.replace(/^Bearer\s+/i, "") : "")
  );
}

function normalizePayload(data) {
  if (Array.isArray(data)) {
    return normalizePayload(data[0]);
  }
  if (typeof data === "string") {
    try {
      return normalizePayload(JSON.parse(data));
    } catch {
      return {};
    }
  }
  if (data && typeof data === "object") {
    if (data.data && typeof data.data === "object") return normalizePayload(data.data);
    if (data.message && typeof data.message === "object") return normalizePayload(data.message);
    return data;
  }
  return {};
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

async function joinMeeting(io, socket, data = {}, ack) {
  try {
    data = normalizePayload(data);
    if (process.env.NODE_ENV !== "production") {
      console.info("[Socket.IO meeting:join payload]", data);
    }
    const { meetingId } = data;
    const meeting = await getAccessibleMeeting(meetingId, socket);
    const id = String(meeting._id);
    socket.join(meetingRoom(id));
    addParticipant(id, socket);
    const participants = [...liveParticipants.get(id).values()];
    const participant = participantPayload(socket.user, socket.id);

    socket.to(meetingRoom(id)).emit("participant:joined", {
      meetingId: id,
      participant,
    });
    socket.to(meetingRoom(id)).emit("user-joined", {
      meetingId: id,
      userId: String(socket.user._id),
      user: participant,
      socketId: socket.id,
      participants,
      timestamp: Date.now(),
    });
    socket.emit("room-participants", { meetingId: id, participants });
    io.to(meetingRoom(id)).emit("participants:update", { meetingId: id, participants });
    ack?.({ ok: true, success: true, meetingId: id, roomId: meetingRoom(id), participants });
  } catch (err) {
    ack?.({ ok: false, success: false, message: err.message, error: err.message });
  }
}

function leaveMeeting(io, socket, data = {}, ack) {
  data = normalizePayload(data);
  const id = String(data.meetingId || "");
  if (!id) {
    ack?.({ ok: false, success: false, message: "meetingId is required", error: "meetingId is required" });
    return;
  }
  socket.leave(meetingRoom(id));
  liveParticipants.get(id)?.delete(socket.id);
  const participants = [...(liveParticipants.get(id)?.values() || [])];
  if (participants.length === 0) liveParticipants.delete(id);

  const payload = {
    meetingId: id,
    socketId: socket.id,
    userId: String(socket.user._id),
  };
  socket.to(meetingRoom(id)).emit("participant:left", payload);
  socket.to(meetingRoom(id)).emit("user-left", {
    ...payload,
    user: participantPayload(socket.user, socket.id),
    participants,
    timestamp: Date.now(),
  });
  io.to(meetingRoom(id)).emit("participants:update", { meetingId: id, participants });
  ack?.({ ok: true, success: true, participants });
}

async function sendChatMessage(io, socket, data = {}, ack) {
  try {
    data = normalizePayload(data);
    const meetingId = data.meetingId;
    const message = data.message || data.content || data.text;
    await getAccessibleMeeting(meetingId, socket);
    const chat = await Chat.create({
      meeting: meetingId,
      sender: socket.user._id,
      message,
      attachments: data.attachments || [],
    });
    const populated = await Chat.findById(chat._id).populate("sender", "name email role avatar");
    const payload = serializeChatMessage(populated);
    io.to(meetingRoom(String(meetingId))).emit("chat:message", payload);
    io.to(meetingRoom(String(meetingId))).emit("receive-message", {
      _id: String(payload._id),
      meetingId: String(payload.meeting),
      senderId: String(payload.sender?._id || ""),
      senderName: payload.sender?.name,
      senderAvatar: payload.sender?.avatar,
      text: payload.message,
      content: payload.message,
      type: payload.kind || "text",
      timestamp: payload.createdAt,
      clientMessageId: data.clientMessageId,
    });
    ack?.({ ok: true, success: true, message: payload });
  } catch (err) {
    ack?.({ ok: false, success: false, message: err.message, error: err.message });
  }
}

async function forwardSignal(socket, eventName, data = {}, ack) {
  try {
    data = normalizePayload(data);
    const meetingId = data.meetingId;
    await getAccessibleMeeting(meetingId, socket);
    const to = data.to || data.targetSocketId;
    if (!to) throw new Error("target socket id is required");
    const payload = {
      meetingId,
      from: socket.id,
      fromUserId: String(socket.user._id),
      fromUserName: socket.user.name,
    };
    if (eventName === "signal:offer") payload.offer = data.offer;
    if (eventName === "signal:answer") payload.answer = data.answer;
    if (eventName === "signal:ice-candidate") payload.candidate = data.candidate;
    socket.to(to).emit(eventName, payload);
    const aliasEvent =
      eventName === "signal:offer"
        ? "offer"
        : eventName === "signal:answer"
          ? "answer"
          : "ice-candidate";
    socket.to(to).emit(aliasEvent, {
      ...payload,
      targetSocketId: to,
    });
    ack?.({ ok: true, success: true });
  } catch (err) {
    ack?.({ ok: false, success: false, message: err.message, error: err.message });
  }
}

async function toggleScreenShare(socket, data = {}, isStarting, ack) {
  try {
    data = normalizePayload(data);
    const meeting = await getAccessibleMeeting(data.meetingId, socket);
    const id = String(meeting._id);
    const user = participantPayload(socket.user, socket.id);
    if (isStarting) {
      socket.to(meetingRoom(id)).emit("screen-share:started", { meetingId: id, user });
      socket.to(meetingRoom(id)).emit("screen-share-start", {
        meetingId: id,
        userId: String(socket.user._id),
        userName: socket.user.name,
        socketId: socket.id,
      });
      await notifyUsers(meeting.participants, {
        type: "screen_share",
        meeting: meeting._id,
        message: `${socket.user.name} started screen sharing in ${meeting.title}`,
      });
    } else {
      socket.to(meetingRoom(id)).emit("screen-share:stopped", {
        meetingId: id,
        userId: String(socket.user._id),
      });
      socket.to(meetingRoom(id)).emit("screen-share-stop", {
        meetingId: id,
        userId: String(socket.user._id),
        socketId: socket.id,
      });
    }
    ack?.({ ok: true, success: true });
  } catch (err) {
    ack?.({ ok: false, success: false, message: err.message, error: err.message });
  }
}

export function initializeSocket(server) {
  console.log(`[Socket.IO] Initializing ${SOCKET_BUILD_TAG}`);
  const io = new Server(server, {
    cors: {
      origin: socketCorsOrigin,
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingInterval: 25000,
    pingTimeout: 20000,
    maxHttpBufferSize: 5e6,
  });

  io.use(async (socket, next) => {
    try {
      const token = extractToken(socket);
      if (!token) return next(new Error("Not authenticated"));
      const payload = verifyAccessToken(token);
      if (payload.typ !== "access") return next(new Error("Not authenticated"));
      if (await isJtiBlacklisted(payload.jti)) return next(new Error("Token revoked"));
      const user = await User.findById(payload.sub);
      if (!user) return next(new Error("Not authenticated"));
      socket.user = user;
      socket.userId = String(user._id);
      socket.join(`user:${String(user._id)}`);
      return next();
    } catch (err) {
      return next(new Error(err.message || "Not authenticated"));
    }
  });

  setNotificationSocket(io);

  io.on("connection", (socket) => {
    console.log("[Socket.IO] Connected", {
      build: SOCKET_BUILD_TAG,
      socketId: socket.id,
      userId: String(socket.user._id),
      email: socket.user.email,
    });
    socket.emit("socket:connected", {
      build: SOCKET_BUILD_TAG,
      socketId: socket.id,
      userId: String(socket.user._id),
      user: participantPayload(socket.user, socket.id),
    });
    socket.emit("connected", {
      build: SOCKET_BUILD_TAG,
      socketId: socket.id,
      userId: String(socket.user._id),
      user: participantPayload(socket.user, socket.id),
    });

    socket.on("meeting:join", (data, ack) => joinMeeting(io, socket, data, ack));
    socket.on("join-room", (data, ack) => joinMeeting(io, socket, data, ack));

    socket.on("meeting:leave", (data, ack) => leaveMeeting(io, socket, data, ack));
    socket.on("leave-room", (data, ack) => leaveMeeting(io, socket, data, ack));

    socket.on("chat:send", (data, ack) => sendChatMessage(io, socket, data, ack));
    socket.on("send-message", (data, ack) => sendChatMessage(io, socket, data, ack));

    socket.on("signal:offer", (data, ack) => forwardSignal(socket, "signal:offer", data, ack));
    socket.on("offer", (data, ack) => {
      forwardSignal(socket, "signal:offer", { ...data, to: data.to || data.targetSocketId }, ack);
    });

    socket.on("signal:answer", (data, ack) => forwardSignal(socket, "signal:answer", data, ack));
    socket.on("answer", (data, ack) => {
      forwardSignal(socket, "signal:answer", { ...data, to: data.to || data.targetSocketId }, ack);
    });

    socket.on("signal:ice-candidate", (data, ack) => forwardSignal(socket, "signal:ice-candidate", data, ack));
    socket.on("ice-candidate", (data, ack) => {
      forwardSignal(socket, "signal:ice-candidate", { ...data, to: data.to || data.targetSocketId }, ack);
    });

    socket.on("screen-share:start", (data, ack) => toggleScreenShare(socket, data, true, ack));
    socket.on("screen-share-start", (data, ack) => toggleScreenShare(socket, data, true, ack));

    socket.on("screen-share:stop", (data, ack) => toggleScreenShare(socket, data, false, ack));
    socket.on("screen-share-stop", (data, ack) => toggleScreenShare(socket, data, false, ack));

    socket.on("media-state-change", (data = {}) => {
      if (!data.meetingId || !socket.rooms.has(meetingRoom(String(data.meetingId)))) return;
      socket.to(meetingRoom(String(data.meetingId))).emit("media-state-change", {
        meetingId: String(data.meetingId),
        userId: String(socket.user._id),
        userName: socket.user.name,
        socketId: socket.id,
        audio: data.audio,
        video: data.video,
      });
    });

    socket.on("disconnect", () => {
      removeParticipant(socket);
    });
  });

  return io;
}
