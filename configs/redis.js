// configs/redis.js
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { config } from "dotenv";

config();

export async function startRedis(io) {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn("REDIS_URL not set → skip Redis adapter");
    return null;
  }

  const tls = url.startsWith("rediss://");
  const pubClient = createClient({ url, socket: { tls } });
  const subClient = pubClient.duplicate();

  pubClient.on("error", (e) => console.error("Redis pub error:", e));
  subClient.on("error", (e) => console.error("Redis sub error:", e));

  try {
    await pubClient.connect();
    await subClient.connect();
    io.adapter(createAdapter(pubClient, subClient));
    console.log("Socket.IO Redis adapter attached");
    return { pubClient, subClient };
  } catch (e) {
    console.error("Attach Redis adapter failed, use default adapter:", e.message);
    return null; // không throw để server vẫn chạy
  }
}
