import { createClient } from "redis";

let client;
let enabled = true;

/**
 * Connects Redis. If connection fails, caching is disabled but the API keeps running.
 */
export async function initRedis() {
  if (process.env.REDIS_DISABLED === "true") {
    enabled = false;
    console.warn("Redis disabled via REDIS_DISABLED=true");
    return null;
  }
  const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  client = createClient({ url });
  client.on("error", (err) => console.error("Redis Client Error", err));
  try {
    await client.connect();
    enabled = true;
    console.log("Redis connected");
    return client;
  } catch (e) {
    enabled = false;
    console.warn("Redis not available — continuing without cache/blacklist:", e.message);
    return null;
  }
}

export function isRedisEnabled() {
  return enabled && client?.isOpen;
}

export async function getRedis() {
  if (!isRedisEnabled()) return null;
  return client;
}

export async function closeRedis() {
  if (client?.isOpen) await client.quit();
}
