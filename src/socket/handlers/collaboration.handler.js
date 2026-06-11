/**
 * Register collaboration event handlers.
 */
export function registerCollaborationHandlers(io, socket) {
  socket.on('cursor-move', (data) => {
    const { meetingId, x, y, element } = data;
    if (!meetingId) return;

    socket.to(`meeting:${meetingId}`).emit('cursor-move', {
      userId: socket.userId,
      userName: socket.user.name,
      x,
      y,
      element,
    });
  });

  socket.on('document-edit', (data) => {
    const { meetingId, documentId, changes, version } = data;
    if (!meetingId) return;

    socket.to(`meeting:${meetingId}`).emit('document-edit', {
      userId: socket.userId,
      userName: socket.user.name,
      documentId,
      changes,
      version,
      timestamp: Date.now(),
    });
  });

  socket.on('meeting-reaction', (data) => {
    const { meetingId, emoji } = data;
    if (!meetingId || !emoji) return;

    io.to(`meeting:${meetingId}`).emit('meeting-reaction', {
      userId: socket.userId,
      userName: socket.user.name,
      emoji,
      timestamp: Date.now(),
    });
  });

  socket.on('whiteboard-draw', (data) => {
    const { meetingId, drawData } = data;
    if (!meetingId) return;

    socket.to(`meeting:${meetingId}`).emit('whiteboard-draw', {
      userId: socket.userId,
      userName: socket.user.name,
      drawData,
    });
  });

  socket.on('whiteboard-clear', (data) => {
    const { meetingId } = data;
    if (!meetingId) return;

    io.to(`meeting:${meetingId}`).emit('whiteboard-clear', {
      userId: socket.userId,
      userName: socket.user.name,
    });
  });
}
