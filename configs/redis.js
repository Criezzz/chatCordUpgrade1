import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter"

const pubClient = createClient({ url: "redis://localhost:6379" });
await pubClient.connect();

const startRedis = async (io) => {
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
}

export default pubClient;
export { startRedis };