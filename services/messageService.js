// services/messageService.js
import { Queue } from 'bullmq';
import sharedConnection from '../configs/bullmq-redis.js';

const messageQueue = new Queue('save_queue', { 
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: true,
    attempts: 1,
  },
  streams: {
    events: {
      maxLen: 1000,
    }
  },
  connection: sharedConnection
});

async function enqueueSaveMessage(room, message) {
  await messageQueue.add("save_message", { room, message });
}

const MEMORY_STORE = new Map(); // room -> [{...messageData}]
// Use the shared BullMQ Redis connection for all message
// operations. If it's not available, fall back to memory.
async function getClient() {
  if (!sharedConnection) {
    console.error("[MessageService] Shared Redis connection not available, using memory store");
    return null;
  }
  return sharedConnection;
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
    if (message.text == 'memory') {
      console.log(MEMORY_STORE.size);
    }
    try {
      const client = await getClient();
      if (!client) {
        throw new Error('Redis unavailable');
      }
      
      const key = `chat:${room}:messages`;
      
      // console.log(`Saving message: room="${room}", key="${key}", timestamp=${messageData.timestamp}`);
      
      // Add message to sorted set (score, member)
      await client.zadd(
        key,
        messageData.timestamp,
        JSON.stringify(messageData)
      );
      
      // Keep only last MAX_MESSAGES_PER_ROOM messages
      await client.zremrangebyrank(key, 0, -(this.MAX_MESSAGES_PER_ROOM + 1));
      
      // Set expiry on the key
      await client.expire(key, this.MESSAGE_EXPIRY);
      
      // Verify it was saved
      const count = await client.zcard(key);
      // console.log(`Saved to Redis: room=${room}, key=${key}, total messages=${count}`);
      
      return true;
    } catch (error) {
      console.error("Error saving message to Redis:", error?.message || error);
      console.error(error.stack);
      // Fallback to memory on any error
      this.memoryPush(room, messageData);
      // console.log(`Fallback to memory: room=${room}`);
      return true; // Still return true since we saved to memory
    }
  }

  async getMessages(room, days = 7, limit = 100) {
  try {
    const client = await getClient();
    if (!client) {
      // Redis down → degrade gracefully
      return [];
    }

    const key = `chat:${room}:messages`;
    const cutoff = Date.now() - days * 86400_000;

    const raw = await client.zrangebyscore(
      key,
      cutoff,
      '+inf',
      'LIMIT',
      Math.max(0, -limit),
      limit
    );

    return raw.map(JSON.parse);
  } catch (err) {
    console.error('[getMessages] Redis error:', err.message);
    return [];
  }
}

  async deleteOldMessages(room, days = 7) {
    try {
      const client = await getClient();
      if (!client) {
        throw new Error('Redis unavailable');
      }
      
      const key = `chat:${room}:messages`;
      const cutoffTimestamp = Date.now() - days * 24 * 60 * 60 * 1000;
      const deletedCount = await client.zremrangebyscore(key, '-inf', cutoffTimestamp);
      
      // console.log(`Deleted ${deletedCount} old messages from room=${room}`);
      return deletedCount;
    } catch (error) {
      console.error("Error deleting old messages:", error?.message || error);
      return this.memoryDeleteOld(room, days);
    }
  }
  
  // Helper to check connection status
  async getStatus() {
    return {
      connected: !!sharedConnection,
      usingMemory: !sharedConnection,
      memoryRooms: Array.from(MEMORY_STORE.keys()),
    };
  }
}

const messageService = new MessageService();
messageService.messageQueue = messageQueue; // Attach queue to service

export default messageService;
export { enqueueSaveMessage, messageQueue };