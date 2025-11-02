import express from "express";
import http from "http";
import authRoute from './routes/auth.js';
import homeRoute from './routes/home.js';
import makepath from "./configs/path.js";
import initSocketIo from "./configs/socketio.js";
import { startRedis } from "./configs/redis.js";
import bindEventHandler from "./controllers/chatroom.js";

// Early diagnostics to help Cloud Run troubleshooting
console.log(`[boot] Node ${process.version} starting app.js`);
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err && (err.stack || err.message) || err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason && (reason.stack || reason.message) || reason);
});

const app = express();
app.use(express.static(makepath("")));
app.use(express.json());
app.use(authRoute);
app.use(homeRoute);

app.get('/_ah/health', (req, res) => res.status(200).send('ok'));

const server = http.createServer(app);
const io = initSocketIo(server);
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

// start Redis adapter (non-blocking)
try {
  // fire and forget; internal code handles failures without crashing server
  // no await here to ensure the HTTP server starts immediately
  startRedis(io);
} catch (e) {
  console.error('startRedis failed:', e?.message || e);
}

// QUAN TRỌNG: dùng PORT của Cloud Run và bind 0.0.0.0
const PORT = Number(process.env.PORT) || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
