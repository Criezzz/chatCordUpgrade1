const path = require('path');
const http = require('http');
const express = require('express');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const socketio = require('socket.io');
const config = require('./config');
const { setupSocket } = require('./sockets');

async function start() {
  const app = express();
  const server = http.createServer(app);
  const io = socketio(server, { cors: { origin: '*' } });

  // Static folder
  app.use(express.static(config.PUBLIC_DIR));

  // Setup redis adapter for socket.io
  try {
    const pubClient = createClient({ url: config.REDIS_URL });
    await pubClient.connect();
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    console.log('Redis adapter configured');
  } catch (e) {
    console.warn('Could not configure Redis adapter', e.message);
  }

  // Setup application socket handlers
  await setupSocket(io);

  const PORT = config.PORT;
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

start();
