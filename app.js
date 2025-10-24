import express from "express";
import http from "http";
import authRoute from './routes/auth.js';
import homeRoute from './routes/home.js';
import makepath from "./configs/path.js";
import initSocketIo from "./configs/socketio.js";
import { startRedis } from "./configs/redis.js";
import bindEventHandler from "./controllers/chatroom.js";
import { authenticate, checkBlock } from "./middlewares/auth.js";

const app = express();
app.use(express.static(makepath("")));
app.use(express.json());
app.use(authRoute);
app.use(homeRoute);

const server = http.createServer(app);
const io = initSocketIo(server);
io.use(checkBlock);
io.use(authenticate);
startRedis(io);


io.on("connection", (socket) => {
    bindEventHandler(socket, io);
});

io.on('connection', (socket) => {
  console.log('new client', socket.id);
  // catch lỗi trên socket
  socket.on('error', (err) => {
    console.error('socket error', socket.id, err && err.stack || err);
  });

  socket.on('someEvent', (data) => {
    try {
      // xử lý
    } catch (err) {
      console.error('handler error for someEvent', err && err.stack || err);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('disconnect', socket.id, reason);
  });
});
 
server.listen(3000, () => console.log("Server running on port 3000"));