import pubClient, {bindAdapter} from "./redis.js";
import { Server } from "socket.io";
import bindEventHandler from "../controllers/chatroom.js";
import { checkBlock, authenticate } from "../middlewares/auth.js";

const initSocketIo = async (server) => {
    const io = new Server(server, {
        cors: {
            origin: "http://localhost:3000",
            methods: ["GET", "POST"]
        },
        connectionStateRecovery: {},
        // transports: ['websocket'],
        // adapter: createAdapter()
    });

    await bindAdapter(pubClient, io);

    io.use(checkBlock);
    io.use(authenticate);

    // bind socket handlers
    io.on('connection', (socket) => {
      try {
        bindEventHandler(socket, io);
      } catch (e) {
        console.error('Socket bind error:', e?.message || e);
      }
    });
    
    return io;
}

export default initSocketIo;