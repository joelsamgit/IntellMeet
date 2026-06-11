import ChatMessage from '../../models/ChatMessage.js';
import ParticipantActivity from '../../models/ParticipantActivity.js';

function isInMeetingRoom(socket, meetingId) {
  return socket.rooms.has(`meeting:${meetingId}`);
}

/**
 * Register chat event handlers.
 */
export function registerChatHandlers(io, socket) {
  socket.on('send-message', async (data, callback) => {
    try {
      const { meetingId, content, type = 'text', clientMessageId } = data;
      if (!meetingId || !content?.trim()) {
        return callback?.({ error: 'meetingId and content are required' });
      }

      if (!isInMeetingRoom(socket, meetingId)) {
        return callback?.({ error: 'Join the meeting room before sending messages' });
      }

      console.log('[chat] send-message received', {
        meetingId,
        socketId: socket.id,
        userId: socket.userId,
        clientMessageId,
      });

      const message = await ChatMessage.create({
        meeting: meetingId,
        sender: socket.userId,
        senderName: socket.user.name,
        content: content.trim(),
        type,
      });

      const messageData = {
        _id: message._id.toString(),
        meetingId,
        senderId: socket.userId,
        senderName: socket.user.name,
        senderAvatar: socket.user.avatar,
        text: message.content,
        type: message.type,
        timestamp: message.createdAt.toISOString(),
        clientMessageId,
      };

      // Broadcast to the room (including sender)
      io.to(`meeting:${meetingId}`).emit('receive-message', messageData);

      // Update message count
      await ParticipantActivity.findOneAndUpdate(
        { meeting: meetingId, user: socket.userId },
        { $inc: { messageCount: 1 } }
      );

      callback?.({ success: true, message: { ...messageData, _id: message._id.toString() } });
    } catch (err) {
      console.error('send-message error:', err.message);
      callback?.({ error: 'Failed to send message' });
    }
  });

  socket.on('typing', (data) => {
    const { meetingId } = data;
    if (!meetingId || !isInMeetingRoom(socket, meetingId)) return;

    socket.to(`meeting:${meetingId}`).emit('typing', {
      userId: socket.userId,
      userName: socket.user.name,
    });
  });

  socket.on('stop-typing', (data) => {
    const { meetingId } = data;
    if (!meetingId || !isInMeetingRoom(socket, meetingId)) return;

    socket.to(`meeting:${meetingId}`).emit('stop-typing', {
      userId: socket.userId,
    });
  });

  socket.on('add-reaction', async (data) => {
    const { meetingId, messageId, emoji } = data;
    if (!meetingId || !messageId || !emoji) return;

    if (!isInMeetingRoom(socket, meetingId)) return;

    try {
      await ChatMessage.findByIdAndUpdate(messageId, {
        $push: { reactions: { user: socket.userId, emoji } },
      });

      io.to(`meeting:${meetingId}`).emit('reaction-added', {
        messageId,
        userId: socket.userId,
        userName: socket.user.name,
        emoji,
      });
    } catch (err) {
      console.error('add-reaction error:', err.message);
    }
  });
}
