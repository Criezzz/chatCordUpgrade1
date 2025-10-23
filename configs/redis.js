import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter"

const startRedis = async (io) => {
    const pubClient = createClient({ url: "redis://localhost:6379" });
    await pubClient.connect();
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
}

export default startRedis;