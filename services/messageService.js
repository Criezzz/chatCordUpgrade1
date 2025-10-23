// services/messageService.js
import { createClient } from "redis";

const client = createClient({ url: "redis://localhost:6379" });
await client.connect();

class MessageService {
  constructor(redisClient) {
    this.client = redisClient;
    this.MESSAGE_EXPIRY = 7 * 24 * 60 * 60; // 7 ngày tính bằng giây
    this.MAX_MESSAGES_PER_ROOM = 200; // Giới hạn số tin nhắn lưu trữ
  }

  async saveMessage(room, message) {
    const key = `chat:${room}:messages`;
    
    const messageData = {
      username: message.username,
      uid: message.uid,
      text: message.text,
      time: message.time || new Date().toISOString(),
      timestamp: Date.now() 
    };

    try {
      await this.client.zAdd(key, {
        score: messageData.timestamp,
        value: JSON.stringify(messageData)
      });
      await this.client.zRemRangeByRank(key, 0, -(this.MAX_MESSAGES_PER_ROOM + 1));

      await this.client.expire(key, this.MESSAGE_EXPIRY);

      return true;
    } catch (error) {
      console.error('Error saving message to Redis:', error);
      return false;
    }
  }

  async getMessages(room, days = 7, limit = 100) {
    const key = `chat:${room}:messages`;
    
    const cutoffTimestamp = Date.now() - (days * 24 * 60 * 60 * 1000);

    try {
      const messages = await this.client.zRangeByScore(
        key,
        cutoffTimestamp,
        '+inf', 
        {
          LIMIT: {
            offset: 0,
            count: limit
          }
        }
      );
      return messages.map(msg => JSON.parse(msg));
    } catch (error) {
      console.error('Error getting messages from Redis:', error);
      return [];
    }
  }

  async deleteOldMessages(room, days = 7) {
    const key = `chat:${room}:messages`;
    const cutoffTimestamp = Date.now() - (days * 24 * 60 * 60 * 1000);

    try {
      const deletedCount = await this.client.zRemRangeByScore(
        key,
        '-inf',
        cutoffTimestamp
      );

      console.log(`Deleted ${deletedCount} old messages from ${room}`);
      return deletedCount;
    } catch (error) {
      console.error('Error deleting old messages from Redis:', error);
      return 0;
    }
  }

}

const messageService = new MessageService(client);
export default messageService;