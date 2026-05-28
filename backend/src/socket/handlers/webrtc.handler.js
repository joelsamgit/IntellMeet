/**
 * Register WebRTC signaling event handlers.
 */
export function registerWebRTCHandlers(io, socket) {
  socket.on('offer', (data) => {
    const { targetSocketId, offer, meetingId } = data;
    if (!targetSocketId || !offer) return;

    if (meetingId && !socket.rooms.has(`meeting:${meetingId}`)) return;

    console.log(`[webrtc] offer ${socket.id} -> ${targetSocketId} (${meetingId || 'no-meeting'})`);
    socket.to(targetSocketId).emit('offer', {
      offer,
      from: socket.id,
      fromUserId: socket.userId,
      fromUserName: socket.user.name,
      meetingId,
    });
  });

  socket.on('answer', (data) => {
    const { targetSocketId, answer, meetingId } = data;
    if (!targetSocketId || !answer) return;

    if (meetingId && !socket.rooms.has(`meeting:${meetingId}`)) return;

    console.log(`[webrtc] answer ${socket.id} -> ${targetSocketId} (${meetingId || 'no-meeting'})`);
    socket.to(targetSocketId).emit('answer', {
      answer,
      from: socket.id,
      fromUserId: socket.userId,
      meetingId,
    });
  });

  socket.on('ice-candidate', (data) => {
    const { targetSocketId, candidate, meetingId } = data;
    if (!targetSocketId || !candidate) return;

    if (meetingId && !socket.rooms.has(`meeting:${meetingId}`)) return;

    console.log(`[webrtc] ice-candidate ${socket.id} -> ${targetSocketId} (${meetingId || 'no-meeting'})`);
    socket.to(targetSocketId).emit('ice-candidate', {
      candidate,
      from: socket.id,
      fromUserId: socket.userId,
      meetingId,
    });
  });

  socket.on('screen-share-start', (data) => {
    const { meetingId } = data;
    if (!meetingId) return;

    if (!socket.rooms.has(`meeting:${meetingId}`)) return;

    socket.to(`meeting:${meetingId}`).emit('screen-share-start', {
      userId: socket.userId,
      userName: socket.user.name,
      socketId: socket.id,
    });
  });

  socket.on('screen-share-stop', (data) => {
    const { meetingId } = data;
    if (!meetingId) return;

    if (!socket.rooms.has(`meeting:${meetingId}`)) return;

    socket.to(`meeting:${meetingId}`).emit('screen-share-stop', {
      userId: socket.userId,
      socketId: socket.id,
    });
  });

  // Media state changes
  socket.on('media-state-change', (data) => {
    const { meetingId, audio, video } = data;
    if (!meetingId) return;

    if (!socket.rooms.has(`meeting:${meetingId}`)) return;

    socket.to(`meeting:${meetingId}`).emit('media-state-change', {
      userId: socket.userId,
      userName: socket.user.name,
      socketId: socket.id,
      audio,
      video,
    });
  });

  // Request to renegotiate connection
  socket.on('renegotiate', (data) => {
    const { targetSocketId, meetingId } = data;
    if (!targetSocketId) return;

    if (meetingId && !socket.rooms.has(`meeting:${meetingId}`)) return;

    socket.to(targetSocketId).emit('renegotiate', {
      from: socket.id,
      fromUserId: socket.userId,
      meetingId,
    });
  });
}
