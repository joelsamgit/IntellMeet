import Notification from "../models/Notification.js";

let ioRef = null;

export function setNotificationSocket(io) {
  ioRef = io;
}

export function serializeNotification(n) {
  const doc = n.toObject ? n.toObject() : n;
  return {
    _id: doc._id,
    message: doc.message,
    read: doc.isRead,
    createdAt: doc.createdAt,
    type: doc.type,
    meeting: doc.meeting,
    task: doc.task,
    meta: doc.meta || {},
  };
}

export async function createNotification({ user, type = "system", message, meeting, task, meta }) {
  const notification = await Notification.create({
    user,
    type,
    message,
    meeting,
    task,
    meta: meta || {},
  });
  const payload = serializeNotification(notification);
  if (ioRef) {
    ioRef.to(`user:${String(user)}`).emit("notification:new", payload);
  }
  return payload;
}

export async function notifyUsers(userIds, data) {
  const uniqueIds = [...new Set((userIds || []).map(String))];
  return Promise.all(uniqueIds.map((user) => createNotification({ ...data, user })));
}
