import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { socketAuthMiddleware } from './auth.middleware.js';
import { registerMeetingHandlers } from './handlers/meeting.handler.js';
import { registerChatHandlers } from './handlers/chat.handler.js';
import { registerWebRTCHandlers } from './handlers/webrtc.handler.js';
import { registerNotificationHandlers } from './handlers/notification.handler.js';
import { registerCollaborationHandlers } from './handlers/collaboration.handler.js';
import { cacheSocketSession, removeSocketSession } from '../services/redis.service.js';

let io = null;

/**
 * Get the Socket.io server instance.
 */
export function getIO() {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

/**
 * Emit an event to a specific user (across all their sockets).
 */
export function emitToUser(userId, event, data) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

/**
 * Create and configure the Socket.io server.
 */
export async function createSocketServer(httpServer) {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173,http://127.0.0.1:5173';
  const origins = clientUrl.split(',').map((s) => s.trim()).filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin: origins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
    maxHttpBufferSize: 5e6,
    transports: ['websocket', 'polling'],
  });

  // Setup Redis adapter if available
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    if (process.env.REDIS_DISABLED !== 'true') {
      const pubClient = createClient({ url: redisUrl });
      const subClient = pubClient.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      console.log('Socket.io Redis adapter connected');
    }
  } catch (err) {
    console.warn('Socket.io Redis adapter not available, using in-memory adapter:', err.message);
  }

  // Authentication middleware
  io.use(socketAuthMiddleware);

  // Connection handler
  io.on('connection', async (socket) => {
    console.log(`Socket connected: ${socket.user.name} (${socket.id})`);

    // Join personal notification room
    socket.join(`user:${socket.userId}`);

    // Cache socket session in Redis
    await cacheSocketSession(socket.userId, socket.id);

    // Register all event handlers
    registerMeetingHandlers(io, socket);
    registerChatHandlers(io, socket);
    registerWebRTCHandlers(io, socket);
    registerNotificationHandlers(io, socket);
    registerCollaborationHandlers(io, socket);

    // Handle disconnect
    socket.on('disconnect', async (reason) => {
      console.log(`Socket disconnected: ${socket.user.name} (${reason})`);
      await removeSocketSession(socket.userId, socket.id);
    });

    // Send connection confirmation
    socket.emit('connected', {
      userId: socket.userId,
      socketId: socket.id,
      user: socket.user,
    });
  });

  console.log('Socket.io server initialized');
  return io;
}
