import pubClient, {bindAdapter} from "./redis.js";
import { Server } from "socket.io";
import bindEventHandler from "../controllers/chatroom.js";
import { checkBlock, authenticate } from "../middlewares/auth.js";

const initSocketIo = async (server) => {
    const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === "production"
      ? [
          "https://chatcord-backend-196498253672.asia-east2.run.app"
        ]
      : "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
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