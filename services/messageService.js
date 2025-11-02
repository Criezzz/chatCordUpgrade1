// services/messageService.js
import { createClient } from "redis";

// Lazy Redis client with safe fallback to in-memory storage.
let redisClient = null;
let connectPromise = null;
let connectionFailed = false; // Track if connection permanently failed

const MEMORY_STORE = new Map(); // room -> [{...messageData}]

function getRedisUrl() {
  return process.env.REDIS_URL || "redis://127.0.0.1:6379";
}

async function getClient() {
  // If already connected, return immediately
  if (redisClient) return redisClient;
  
  // If connection permanently failed, skip Redis
  if (connectionFailed) return null;
  
  // If connection in progress, wait for it
  if (connectPromise) return connectPromise;

  const url = getRedisUrl();
  const useTls = url.startsWith("rediss://");

  const clientConfig = {
    url,
  };

  // Only add socket config if using TLS
  if (useTls) {
    clientConfig.socket = {
      tls: true,
      rejectUnauthorized: false, // For self-signed certs in dev
    };
  }

  const client = createClient(clientConfig);
  
  client.on("error", (err) => {
    console.error("Redis Client Error:", err?.message || err);
  });

  connectPromise = client
    .connect()
    .then(() => {
      redisClient = client;
      console.log("MessageService: Connected to Redis at", url);
      return redisClient;
    })
    .catch((e) => {
      console.error("MessageService: Redis connect failed → using memory store:", e?.message || e);
      connectionFailed = true; // Don't retry on subsequent calls
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
        // Redis not available, use memory
        this.memoryPush(room, messageData);
        console.log(`Saved to memory: room=${room}`);
        return true;
      }
      
      const key = `chat:${room}:messages`;
      
      console.log(`Saving message: room="${room}", key="${key}", timestamp=${messageData.timestamp}`);
      
      // Add message to sorted set
      await client.zAdd(key, { 
        score: messageData.timestamp, 
        value: JSON.stringify(messageData) 
      });
      
      // Keep only last MAX_MESSAGES_PER_ROOM messages
      await client.zRemRangeByRank(key, 0, -(this.MAX_MESSAGES_PER_ROOM + 1));
      
      // Set expiry on the key
      await client.expire(key, this.MESSAGE_EXPIRY);
      
      // Verify it was saved
      const count = await client.zCard(key);
      console.log(`Saved to Redis: room=${room}, key=${key}, total messages=${count}`);
      
      return true;
    } catch (error) {
      console.error("Error saving message to Redis:", error?.message || error);
      console.error(error.stack);
      // Fallback to memory on any error
      this.memoryPush(room, messageData);
      console.log(`Fallback to memory: room=${room}`);
      return true; // Still return true since we saved to memory
    }
  }

  async getMessages(room, days = 7, limit = 100) {
    try {
      const client = await getClient();
      if (!client) {
        console.log(`Using memory for getMessages: room=${room}`);
        return this.memoryGet(room, days, limit);
      }
      
      const key = `chat:${room}:messages`;
      const cutoffTimestamp = Date.now() - days * 24 * 60 * 60 * 1000;
      
      console.log(`Getting messages: room=${room}, key=${key}`);
      console.log(`  Cutoff: ${cutoffTimestamp} (${new Date(cutoffTimestamp).toISOString()})`);
      console.log(`  Now: ${Date.now()} (${new Date().toISOString()})`);
      
      // Check if key exists and get total count
      const totalCount = await client.zCard(key);
      console.log(`  Total messages in Redis: ${totalCount}`);
      
      if (totalCount === 0) {
        console.log(`  No messages found in Redis for room=${room}`);
        return [];
      }
      
      // Get ALL messages first (ignore days filter for debugging)
      let allMessages = [];
      try {
        allMessages = await client.zRange(key, 0, -1);
        console.log(`  Retrieved all messages: ${allMessages.length}`);
      } catch (e) {
        console.error(`  Error getting all messages:`, e.message);
        return [];
      }

      // Parse all messages
      const parsed = allMessages.map((s) => {
        try {
          return JSON.parse(s);
        } catch {
          return null;
        }
      }).filter(Boolean);

      console.log(`  Parsed messages: ${parsed.length}`);
      
      if (parsed.length > 0) {
        console.log(`  First message timestamp: ${parsed[0].timestamp} (${new Date(parsed[0].timestamp).toISOString()})`);
        console.log(`  Last message timestamp: ${parsed[parsed.length-1].timestamp} (${new Date(parsed[parsed.length-1].timestamp).toISOString()})`);
      }

      // Filter by cutoff and limit
      const filtered = parsed
        .filter(m => m.timestamp >= cutoffTimestamp)
        .slice(-limit); // Get last N messages
      
      console.log(`  After filter (>= ${days} days): ${filtered.length} messages`);
      console.log(`  Returning: ${filtered.length} messages`);
      
      return filtered;
    } catch (error) {
      console.error("Error getting messages from Redis:", error?.message || error);
      console.error(error.stack);
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
      const deletedCount = await client.zRemRangeByScore(key, '-inf', cutoffTimestamp);
      
      console.log(`Deleted ${deletedCount} old messages from room=${room}`);
      return deletedCount;
    } catch (error) {
      console.error("Error deleting old messages:", error?.message || error);
      return this.memoryDeleteOld(room, days);
    }
  }
  
  // Helper to check connection status
  async getStatus() {
    const client = await getClient();
    return {
      connected: !!client,
      usingMemory: !client,
      memoryRooms: Array.from(MEMORY_STORE.keys()),
    };
  }
}

const messageService = new MessageService();
export default messageService;