const { verifyIdToken } = require('../services/firebaseAdmin');
const { getRedisClient } = require('../services/redisClient');
const { saveMessage, getRecentMessages } = require('../services/messageStore');
const formatMessage = require('../../utils/messages');
const config = require('../config');

// Presence keys: presence:<room> -> set of uids or hash uid->socketId
async function setupSocket(io) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || (socket.handshake.headers && socket.handshake.headers.authorization && socket.handshake.headers.authorization.split('Bearer ')[1]);
    if (!token) return next(new Error('Authentication error: no token provided'));
    try {
      const decoded = await verifyIdToken(token);
      socket.data.user = { uid: decoded.uid, name: decoded.name || decoded.email || decoded.uid };
      return next();
    } catch (err) {
      console.error('verify token failed', err);
      return next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const botName = config.BOT_NAME;
    socket.on('joinRoom', async ({ room }) => {
      const uid = socket.data.user.uid;
      const username = socket.data.user.name;
      socket.join(room);

      // add to presence set
      try {
        const client = await getRedisClient();
        await client.sAdd(`presence:${room}`, uid);
        await client.hSet(`sock:${uid}`, { socketId: socket.id, room });
      } catch (e) {
        console.error('presence set failed', e);
      }

      // send recent messages
      try {
        const recent = await getRecentMessages(room, 50);
        recent.forEach((m) => socket.emit('message', m));
      } catch (e) { console.error('getRecentMessages', e); }

      // Welcome
      socket.emit('message', formatMessage(botName, `Welcome to ChatCord!`));

      socket.broadcast.to(room).emit('message', formatMessage(botName, `${username} has joined the chat`));

      // update room users -> fetch presence set members (uids) and map to names (best-effort)
      try {
        const client = await getRedisClient();
        const uids = await client.sMembers(`presence:${room}`);
        const users = uids.map(u => ({ uid: u, username: u }));
        io.to(room).emit('roomUsers', { room, users });
      } catch (e) { console.error('emit roomUsers', e); }
    });

    socket.on('chatMessage', async (msg) => {
      const username = socket.data.user.name;
      const uid = socket.data.user.uid;
      const roomIds = Array.from(socket.rooms).filter(r => r !== socket.id);
      const room = roomIds[0];
      if (!room) return;
      const messageObj = formatMessage(username, msg);
      // save
      try { await saveMessage(room, messageObj); } catch (e) { console.error('saveMessage', e); }
      io.to(room).emit('message', messageObj);
    });

    socket.on('disconnect', async () => {
      // remove presence
      try {
        const client = await getRedisClient();
        // find mapping
        const uid = socket.data.user?.uid;
        const room = (await client.hGetAll(`sock:${uid}`))?.room;
        if (room) {
          await client.sRem(`presence:${room}`, uid);
        }
        await client.del(`sock:${uid}`);
        if (uid && room) {
          io.to(room).emit('message', formatMessage(config.BOT_NAME, `${socket.data.user.name} has left the chat`));
          const uids = await client.sMembers(`presence:${room}`);
          const users = uids.map(u => ({ uid: u, username: u }));
          io.to(room).emit('roomUsers', { room, users });
        }
      } catch (e) { console.error('disconnect presence cleanup', e); }
    });
  });
}

module.exports = { setupSocket };
