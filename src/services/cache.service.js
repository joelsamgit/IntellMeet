import { getRedis } from "../config/redis.js";

const MEETING_TTL_SEC = Number(process.env.REDIS_MEETING_CACHE_TTL || 120);

export async function cacheUserSession(userId, payload, ttlSec = 86400) {
  const redis = await getRedis();
  if (!redis) return;
  await redis.setEx(`session:user:${userId}`, ttlSec, JSON.stringify(payload));
}

export async function getCachedUserSession(userId) {
  const redis = await getRedis();
  if (!redis) return null;
  const raw = await redis.get(`session:user:${userId}`);
  return raw ? JSON.parse(raw) : null;
}

export async function deleteUserSession(userId) {
  const redis = await getRedis();
  if (!redis) return;
  await redis.del(`session:user:${userId}`);
}

export async function blacklistAccessJti(jti, ttlSeconds) {
  const redis = await getRedis();
  if (!redis) return;
  const ttl = Math.min(Math.max(ttlSeconds, 60), 86400);
  await redis.setEx(`bl:jti:${jti}`, ttl, "1");
}

export async function isJtiBlacklisted(jti) {
  const redis = await getRedis();
  if (!redis) return false;
  const v = await redis.get(`bl:jti:${jti}`);
  return Boolean(v);
}

export async function cacheMeetingDoc(meetingId, jsonString) {
  const redis = await getRedis();
  if (!redis) return;
  await redis.setEx(`meeting:${meetingId}`, MEETING_TTL_SEC, jsonString);
}

export async function getCachedMeeting(meetingId) {
  const redis = await getRedis();
  if (!redis) return null;
  return redis.get(`meeting:${meetingId}`);
}

export async function invalidateMeetingCache(meetingId) {
  const redis = await getRedis();
  if (!redis) return;
  await redis.del(`meeting:${meetingId}`);
}
