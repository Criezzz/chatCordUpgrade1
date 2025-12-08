// configs/redis.js
import Redis from "ioredis";
import { createAdapter } from "@socket.io/redis-adapter";
import { config } from "dotenv";

config();

const startRedis = async () => {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn("REDIS_URL not set → skip Redis adapter");
    return null;
  }
  
  const pubClient = new Redis(url);
  
  pubClient.on("error", (e) => console.error("Redis pub error:", e));
  
  try {
    await pubClient.ping();
    console.log("Connected to Redis server");
    return pubClient;
  } catch (e) {
    console.error("Attach Redis adapter failed, use default adapter:", e.message);
    return null;
  }
}

const bindAdapter = async (pubClient, io) => {
  const subClient = pubClient.duplicate();
  subClient.on("error", (e) => console.error("Redis sub error:", e));
  io.adapter(createAdapter(pubClient, subClient));
  console.log("Socket.IO Redis adapter attached");
  return subClient;
}

const pubClient = await startRedis();

export default pubClient;
export { bindAdapter };