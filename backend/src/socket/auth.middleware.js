import { verifyAccessToken } from '../utils/jwt.js';
import { isJtiBlacklisted } from '../services/cache.service.js';
import User from '../models/User.js';

/**
 * Socket.io authentication middleware.
 * Verifies JWT from socket handshake auth or query.
 */
export function socketAuthMiddleware(socket, next) {
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization?.replace('Bearer ', '');

  if (!token) {
    return next(new Error('Authentication required'));
  }

  (async () => {
    try {
      const payload = verifyAccessToken(token);

      if (payload.typ !== 'access') {
        return next(new Error('Invalid token type'));
      }

      if (await isJtiBlacklisted(payload.jti)) {
        return next(new Error('Token revoked'));
      }

      const user = await User.findById(payload.sub).select('name email avatar role').lean();
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = {
        _id: String(user._id),
        name: user.name,
        email: user.email,
        avatar: user.avatar || '',
        role: user.role,
      };
      socket.userId = String(user._id);

      next();
    } catch (err) {
      console.error('Socket auth error:', err.message);
      next(new Error('Authentication failed'));
    }
  })();
}
