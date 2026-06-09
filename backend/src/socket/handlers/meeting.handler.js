import {
  addUserToRoom,
  removeUserFromRoom,
  getRoomParticipants,
  setRoomMetadata,
} from '../../services/redis.service.js';
import ParticipantActivity from '../../models/ParticipantActivity.js';
import Meeting from '../../models/Meeting.js';

async function canAccessMeeting(meeting, socket) {
  if (socket.user.role === 'admin') return true;
  const isHost = String(meeting.host) === socket.userId;
  const isParticipant = meeting.participants.some((participant) => {
    if (!participant) return false;
    if (typeof participant === 'string') return participant === socket.userId;
    if (participant._id) return String(participant._id) === socket.userId;
    return String(participant) === socket.userId;
  });
  return isHost || isParticipant;
}

/**
 * Register meeting room event handlers.
 */
export function registerMeetingHandlers(io, socket) {
  // Track which rooms this socket is in
  const joinedRooms = new Set();

  socket.on('join-room', async (data, callback) => {
    try {
      const { meetingId } = data;
      if (!meetingId) {
        return callback?.({ error: 'meetingId is required' });
      }

      const meeting = await Meeting.findById(meetingId)
        .populate('participants', 'name')
        .lean();

      if (!meeting) {
        return callback?.({ error: 'Meeting not found' });
      }

      if (!(await canAccessMeeting(meeting, socket))) {
        return callback?.({ error: 'Access denied' });
      }

      const roomId = `meeting:${meetingId}`;
      socket.join(roomId);
      joinedRooms.add(meetingId);
      console.log(`[meeting] ${socket.user.name} (${socket.id}) joined ${roomId}`);

      // Track in Redis
      const isHost = String(meeting.host) === socket.userId;
      let meetingStatus = meeting.status;

      if (meeting.status === 'scheduled') {
        if (isHost) {
          await Meeting.findByIdAndUpdate(meetingId, { status: 'live', startTime: new Date() });
          meetingStatus = 'live';
          // Notify everyone in the room that the meeting has started!
          io.to(roomId).emit('meeting-started', { meetingId, status: 'live' });
        }
      }

      await addUserToRoom(meetingId, socket.userId, socket.id, socket.user.name);
      await setRoomMetadata(meetingId, {
        meetingId,
        title: meeting.title,
        hostId: String(meeting.host),
        status: meetingStatus,
        joinedAt: Date.now(),
      });

      // Create or update participant activity
      await ParticipantActivity.findOneAndUpdate(
        { meeting: meetingId, user: socket.userId },
        {
          $set: { joinedAt: new Date(), userName: socket.user.name },
          $setOnInsert: { meeting: meetingId, user: socket.userId },
        },
        { upsert: true }
      );

      // Get current participants
      const participants = await getRoomParticipants(meetingId);

      // Send the joining socket a deterministic participant snapshot to bootstrap WebRTC peers.
      socket.emit('room-participants', {
        meetingId,
        participants,
      });

      // Notify others in the room
      socket.to(roomId).emit('user-joined', {
        userId: socket.userId,
        user: socket.user,
        socketId: socket.id,
        participants,
        timestamp: Date.now(),
      });

      console.log(`${socket.user.name} joined room ${meetingId}`);

      callback?.({
        success: true,
        participants,
        roomId,
        meeting: {
          _id: String(meeting._id),
          title: meeting.title,
          status: meetingStatus,
          hostId: String(meeting.host),
        },
      });
    } catch (err) {
      console.error('join-room error:', err.message);
      callback?.({ error: 'Failed to join room' });
    }
  });

  socket.on('leave-room', async (data, callback) => {
    try {
      const { meetingId } = data;
      if (!meetingId) return;

      await handleLeaveRoom(io, socket, meetingId);
      joinedRooms.delete(meetingId);

      callback?.({ success: true });
    } catch (err) {
      console.error('leave-room error:', err.message);
      callback?.({ error: 'Failed to leave room' });
    }
  });

  socket.on('end-meeting', async (data, callback) => {
    try {
      const { meetingId } = data;
      if (!meetingId) return callback?.({ error: 'meetingId is required' });

      const meeting = await Meeting.findById(meetingId);
      if (!meeting) return callback?.({ error: 'Meeting not found' });

      const isHost = String(meeting.host) === socket.userId;
      if (!isHost && socket.user.role !== 'admin') {
        return callback?.({ error: 'Only the host can end the meeting' });
      }

      await Meeting.findByIdAndUpdate(meetingId, {
        status: 'ended',
        endTime: new Date(),
      });

      // Kick everyone out of the room and notify
      io.to(`meeting:${meetingId}`).emit('meeting-ended', {
        meetingId,
        endedBy: socket.userId,
        endedByName: socket.user.name,
        timestamp: Date.now(),
      });

      joinedRooms.delete(meetingId);
      callback?.({ success: true });
    } catch (err) {
      console.error('end-meeting error:', err.message);
      callback?.({ error: 'Failed to end meeting' });
    }
  });

  socket.on('mute-user', (data) => {
    const { meetingId, targetUserId } = data;
    if (!meetingId || !targetUserId) return;

    // Only broadcast - the target user decides whether to comply
    io.to(`meeting:${meetingId}`).emit('force-mute', {
      targetUserId,
      requestedBy: socket.userId,
      requestedByName: socket.user.name,
    });
  });

  socket.on('raise-hand', (data) => {
    const { meetingId } = data;
    if (!meetingId) return;

    socket.to(`meeting:${meetingId}`).emit('hand-raised', {
      userId: socket.userId,
      userName: socket.user.name,
      timestamp: Date.now(),
    });
  });

  socket.on('lower-hand', (data) => {
    const { meetingId } = data;
    if (!meetingId) return;

    socket.to(`meeting:${meetingId}`).emit('hand-lowered', {
      userId: socket.userId,
      timestamp: Date.now(),
    });
  });

  // Handle disconnect — leave all rooms
  socket.on('disconnect', async () => {
    for (const meetingId of joinedRooms) {
      await handleLeaveRoom(io, socket, meetingId);
    }
    joinedRooms.clear();
  });
}

async function handleLeaveRoom(io, socket, meetingId) {
  const roomId = `meeting:${meetingId}`;
  socket.leave(roomId);
  console.log(`[meeting] ${socket.user.name} (${socket.id}) left ${roomId}`);

  await removeUserFromRoom(meetingId, socket.userId);

  // Update participant activity
  const activity = await ParticipantActivity.findOne({
    meeting: meetingId,
    user: socket.userId,
  });
  if (activity && activity.joinedAt) {
    activity.leftAt = new Date();
    activity.duration = Math.floor((activity.leftAt - activity.joinedAt) / 1000);
    await activity.save();
  }

  const participants = await getRoomParticipants(meetingId);

  io.to(roomId).emit('user-left', {
    userId: socket.userId,
    user: socket.user,
    socketId: socket.id,
    participants,
    timestamp: Date.now(),
  });

  console.log(`${socket.user.name} left room ${meetingId}`);
}
