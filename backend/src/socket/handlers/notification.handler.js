import Notification from '../../models/Notification.js';

/**
 * Register notification event handlers.
 */
export function registerNotificationHandlers(io, socket) {
  socket.on('send-notification', async (data) => {
    const { recipientId, type = 'system', message } = data;
    if (!recipientId || !message) return;

    try {
      const notification = await Notification.create({
        user: recipientId,
        type,
        message,
      });

      io.to(`user:${recipientId}`).emit('notification', {
        _id: notification._id.toString(),
        type: notification.type,
        message: notification.message,
        read: false,
        createdAt: notification.createdAt.toISOString(),
      });
    } catch (err) {
      console.error('send-notification error:', err.message);
    }
  });

  socket.on('mark-notification-read', async (data) => {
    const { notificationId } = data;
    if (!notificationId) return;

    try {
      await Notification.findOneAndUpdate(
        { _id: notificationId, user: socket.userId },
        { isRead: true }
      );

      socket.emit('notification-read', { notificationId });
    } catch (err) {
      console.error('mark-notification-read error:', err.message);
    }
  });
}
