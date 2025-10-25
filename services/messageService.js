// services/messageService.js
import { createClient } from "redis";

// Lazy Redis client with safe fallback to in-memory storage.
let redisClient = null;
let connectPromise = null;

const MEMORY_STORE = new Map(); // room -> [{...messageData}]

function getRedisUrl() {
  return process.env.REDIS_URL || "redis://127.0.0.1:6379";
}

async function getClient() {
  if (redisClient) return redisClient;
  if (connectPromise) return connectPromise;

  const url = getRedisUrl();
  const useTls = url.startsWith("rediss://");

  const client = createClient({ url, socket: { tls: useTls } });
  client.on("error", (err) => {
    console.error("Redis Client Error:", err?.message || err);
  });

  connectPromise = client
    .connect()
    .then(() => {
      redisClient = client;
      console.log("MessageService: Connected to Redis");
      return redisClient;
    })
    .catch((e) => {
      console.error("MessageService: Redis connect failed → using memory store:", e?.message || e);
      redisClient = null;
      return null; // fall back to memory
    })
    .finally(() => {
      connectPromise = null;
    });

  return connectPromise;
}

class MessageService {
  constructor() {
    this.MESSAGE_EXPIRY = 7 * 24 * 60 * 60; // seconds
    this.MAX_MESSAGES_PER_ROOM = 200;
  }

  // Memory helpers
  memoryPush(room, data) {
    const arr = MEMORY_STORE.get(room) || [];
    arr.push(data);
    // trim to last N
    if (arr.length > this.MAX_MESSAGES_PER_ROOM) {
      arr.splice(0, arr.length - this.MAX_MESSAGES_PER_ROOM);
    }
    MEMORY_STORE.set(room, arr);
  }

  memoryGet(room, days = 7, limit = 100) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const arr = (MEMORY_STORE.get(room) || []).filter((m) => m.timestamp >= cutoff);
    return arr.slice(-limit);
  }

  memoryDeleteOld(room, days = 7) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const arr = (MEMORY_STORE.get(room) || []).filter((m) => m.timestamp >= cutoff);
    const deleted = (MEMORY_STORE.get(room) || []).length - arr.length;
    MEMORY_STORE.set(room, arr);
    return deleted;
  }

  async saveMessage(room, message) {
    const messageData = {
      username: message.username,
      uid: message.uid,
      text: message.text,
      time: message.time || new Date().toISOString(),
      timestamp: Date.now(),
    };

    try {
      const client = await getClient();
      if (!client) {
        this.memoryPush(room, messageData);
        return true;
      }
      const key = `chat:${room}:messages`;
      await client.zAdd(key, { score: messageData.timestamp, value: JSON.stringify(messageData) });
      await client.zRemRangeByRank(key, 0, -(this.MAX_MESSAGES_PER_ROOM + 1));
      await client.expire(key, this.MESSAGE_EXPIRY);
      return true;
    } catch (error) {
      console.error("Error saving message:", error?.message || error);
      this.memoryPush(room, messageData);
      return false;
    }
  }

  async getMessages(room, days = 7, limit = 100) {
    try {
      const client = await getClient();
      if (!client) {
        return this.memoryGet(room, days, limit);
      }
      const key = `chat:${room}:messages`;
      const cutoffTimestamp = Date.now() - days * 24 * 60 * 60 * 1000;
      const messages = await client.zRangeByScore(key, cutoffTimestamp, "+inf", {
        LIMIT: { offset: 0, count: limit },
      });
      return messages.map((s) => {
        try {
          return JSON.parse(s);
        } catch {
          return null;
        }
      }).filter(Boolean);
    } catch (error) {
      console.error("Error getting messages:", error?.message || error);
      return this.memoryGet(room, days, limit);
    }
  }

  async deleteOldMessages(room, days = 7) {
    try {
      const client = await getClient();
      if (!client) {
        return this.memoryDeleteOld(room, days);
      }
      const key = `chat:${room}:messages`;
      const cutoffTimestamp = Date.now() - days * 24 * 60 * 60 * 1000;
      const deletedCount = await client.zRemRangeByScore(key, "-inf", cutoffTimestamp);
      return deletedCount;
    } catch (error) {
      console.error("Error deleting old messages:", error?.message || error);
      return this.memoryDeleteOld(room, days);
    }
  }
}

const messageService = new MessageService();
export default messageService;