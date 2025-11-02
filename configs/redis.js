// configs/redis.js
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { config } from "dotenv";

config();

const startRedis = async () => {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn("REDIS_URL not set → skip Redis adapter");
    return null;
  }
  const tls = url.startsWith("rediss://");
  const pubClient = createClient({ url, socket: { tls } });
  
  pubClient.on("error", (e) => console.error("Redis pub error:", e));
  try {
    await pubClient.connect();
    console.log("Connected to Redis server");
    return pubClient;
  } catch (e) {
    console.error("Attach Redis adapter failed, use default adapter:", e.message);
    return null; // không throw để server vẫn chạy
  }
}

const bindAdapter = async (pubClient, io) => {
  const subClient = pubClient.duplicate();
  subClient.on("error", (e) => console.error("Redis sub error:", e));
  io.adapter(createAdapter(pubClient, subClient));
  try {
    await subClient.connect();
    console.log("Socket.IO Redis adapter attached");
    return subClient;
  } catch (e) {
    console.error("Attach Redis adapter failed, use default adapter:", e.message);
    return null; // không throw để server vẫn chạy
  }
}

const pubClient = await startRedis();

export default pubClient;
export { bindAdapter };