import express from "express";
import http from "http";
import authRoute from './routes/auth.js';
import homeRoute from './routes/home.js';
import makepath from "./configs/path.js";
import initSocketIo from "./configs/socketio.js";
import startRedis from "./configs/redis.js";
import bindEventHandler from "./controllers/chatroom.js";

const app = express();
app.use(express.static(makepath("")));
app.use(express.json());
app.use(authRoute);
app.use(homeRoute);

const server = http.createServer(app);
const io = initSocketIo(server);
startRedis(io);

io.on("connection", (socket) => {
    bindEventHandler(socket, io);
});

server.listen(3000, () => console.log("Server running on port 3000"));