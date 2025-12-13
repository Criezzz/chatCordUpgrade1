// configs/bullmq-redis.js
// Shared Redis connection for all BullMQ queues and workers
import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const usingEnv = !!process.env.REDIS_URL;

console.log('[BullMQ] Creating shared Redis connection:', usingEnv ? 'Using REDIS_URL' : 'Using localhost fallback');

// Create a single shared connection
const sharedConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
});

sharedConnection.on("error", (err) => {
  console.error("[BullMQ Redis] Connection error:", err?.message || err);
});

sharedConnection.on("connect", () => {
  console.log("[BullMQ Redis] Connected successfully");
});

export default sharedConnection;
