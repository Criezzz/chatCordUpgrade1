// configs/redis.js
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";

const pubClient = createClient({ url: "redis://localhost:6379" });
await pubClient.connect();

const startRedis = async (io) => {
    try {    
        const subClient = pubClient.duplicate();
        io.adapter(createAdapter(pubClient, subClient));
        console.log("Socket.IO Redis adapter attached");
        return { pubClient, subClient };
    } catch (e) {
        console.error("Attach Redis adapter failed, use default adapter:", e.message);
        return null; // không throw để server vẫn chạy
    }
}

export default pubClient;
export { startRedis };
