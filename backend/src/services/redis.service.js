import { getRedis, isRedisEnabled } from '../config/redis.js';

const ROOM_PREFIX = 'room:';
const SESSION_PREFIX = 'sock:session:';
const SESSION_LATEST_SUFFIX = ':latest';
const ACTIVE_ROOMS_KEY = 'active_rooms';

/**
 * Add user to a meeting room in Redis.
 * @param {string} meetingId - Meeting ID
 * @param {string} userId - User ID
 * @param {string} socketId - Socket.io socket ID
 * @param {string} userName - Display name of the user
 */
export async function addUserToRoom(meetingId, userId, socketId, userName) {
  const redis = await getRedis();
  if (!redis) return;
  const roomKey = `${ROOM_PREFIX}${meetingId}:participants`;
  const data = JSON.stringify({ userId, socketId, userName, joinedAt: Date.now() });
  await redis.hSet(roomKey, userId, data);
  await redis.sAdd(ACTIVE_ROOMS_KEY, meetingId);
}

/**
 * Remove user from a meeting room.
 * @param {string} meetingId - Meeting ID
 * @param {string} userId - User ID
 */
export async function removeUserFromRoom(meetingId, userId) {
  const redis = await getRedis();
  if (!redis) return;
  const roomKey = `${ROOM_PREFIX}${meetingId}:participants`;
  await redis.hDel(roomKey, userId);
  const remaining = await redis.hLen(roomKey);
  if (remaining === 0) {
    await redis.sRem(ACTIVE_ROOMS_KEY, meetingId);
    await redis.del(roomKey);
  }
}

/**
 * Get all participants in a room.
 * @param {string} meetingId - Meeting ID
 * @returns {Promise<Array<{userId: string, socketId: string, userName: string, joinedAt: number}>>}
 */
export async function getRoomParticipants(meetingId) {
  const redis = await getRedis();
  if (!redis) return [];
  const roomKey = `${ROOM_PREFIX}${meetingId}:participants`;
  const entries = await redis.hGetAll(roomKey);
  return Object.values(entries).map((v) => JSON.parse(v));
}

/**
 * Cache socket session (maps userId to socketId).
 * @param {string} userId - User ID
 * @param {string} socketId - Socket.io socket ID
 */
export async function cacheSocketSession(userId, socketId) {
  const redis = await getRedis();
  if (!redis) return;
  const setKey = `${SESSION_PREFIX}${userId}`;
  const latestKey = `${setKey}${SESSION_LATEST_SUFFIX}`;
  await redis.sAdd(setKey, socketId);
  await redis.expire(setKey, 86400);
  await redis.set(latestKey, socketId, { EX: 86400 });
}

/**
 * Get socket ID for a user.
 * @param {string} userId - User ID
 * @returns {Promise<string|null>}
 */
export async function getSocketIdForUser(userId) {
  const redis = await getRedis();
  if (!redis) return null;
  const latestKey = `${SESSION_PREFIX}${userId}${SESSION_LATEST_SUFFIX}`;
  const latest = await redis.get(latestKey);
  if (latest) return latest;

  const members = await redis.sMembers(`${SESSION_PREFIX}${userId}`);
  return members[0] || null;
}

/**
 * Remove socket session.
 * @param {string} userId - User ID
 */
export async function removeSocketSession(userId, socketId = null) {
  const redis = await getRedis();
  if (!redis) return;
  const setKey = `${SESSION_PREFIX}${userId}`;
  const latestKey = `${setKey}${SESSION_LATEST_SUFFIX}`;

  if (socketId) {
    await redis.sRem(setKey, socketId);
  } else {
    await redis.del(setKey);
  }

  const remaining = await redis.sMembers(setKey);
  if (remaining.length === 0) {
    await redis.del(setKey, latestKey);
    return;
  }

  const latest = await redis.get(latestKey);
  if (!latest || (socketId && latest === socketId)) {
    await redis.set(latestKey, remaining[remaining.length - 1], { EX: 86400 });
  }
}

/**
 * Get all active meeting rooms.
 * @returns {Promise<string[]>}
 */
export async function getActiveRooms() {
  const redis = await getRedis();
  if (!redis) return [];
  return redis.sMembers(ACTIVE_ROOMS_KEY);
}

/**
 * Set room metadata (e.g., meeting title, host).
 * @param {string} meetingId - Meeting ID
 * @param {Object} metadata - Room metadata object
 */
export async function setRoomMetadata(meetingId, metadata) {
  const redis = await getRedis();
  if (!redis) return;
  const key = `${ROOM_PREFIX}${meetingId}:meta`;
  await redis.set(key, JSON.stringify(metadata), { EX: 86400 });
}

/**
 * Get room metadata.
 * @param {string} meetingId - Meeting ID
 * @returns {Promise<Object|null>}
 */
export async function getRoomMetadata(meetingId) {
  const redis = await getRedis();
  if (!redis) return null;
  const key = `${ROOM_PREFIX}${meetingId}:meta`;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}
