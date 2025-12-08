import formatMessage from "../utils/messages.js";
import { userJoin, getCurrentUser, userLeave, getRoomUsers } from "../utils/users.js";
import { initChatLimiter } from "../configs/ratelimiter.js";
import { Worker, Queue } from 'bullmq';
import messageService, { enqueueSaveMessage } from "../services/messageService.js";

const botName = "ChatCord Bot";

// Store io reference for consumer
let globalIo = null;
let sendWorker = null;
let sendQueue = new Queue('send_queue', { 
  limiter: {
    max: 100,
    duration: 100
  },
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: true,
    attempts: 1,
  },
  streams: {
    events: {
      maxLen: 1000,
    }
  },
  connection: { host: process.env.REDIS_HOST || '127.0.0.1', port: Number(process.env.REDIS_PORT) || 6379 }
});
let joinQueue = [];
let joinInProgress = false;
let quitQueue = [];
let quitInProgress = false;

async function joinHandler() {
  let roomJoined = new Set();
  for (let i = 0; i < 50; i++) {
    if (joinQueue.length == 0) break;
    const { socket, uid, username, room } = joinQueue.shift();
    const user = await userJoin(socket.id, uid, username, room);
    if (!user) {
      socket.emit("message", formatMessage(botName, "You are already in a room."));
      socket.disconnect();
      continue;
    }
    socket.join(user.room);
    roomJoined.add(user.room);
    socket.emit("message", formatMessage(botName, "Welcome to ChatCord!"));
    
    try {
      // QUAN TRỌNG: Load messages TRƯỚC, cleanup SAU
      // Lấy 100 tin nhắn gần nhất (không filter theo ngày nữa)
      const chatHistory = await messageService.getMessages(user.room, 3, 100);
      
      if (chatHistory.length > 0) {
        // Gửi lịch sử chat cho user vừa join
        socket.emit("chatHistory", chatHistory);
      }

      // Cleanup chạy sau, không ảnh hưởng đến load messages
      // Chỉ xóa messages > 3 ngày (giữ lại nhiều hơn)

      // Thông báo cho tất cả user trong room về user mới
    } catch (error) {
      console.error("Error loading chat history:", error);
      console.error(error.stack);
    }
  }
  for (const room of roomJoined) {
    const roomUsers = await getRoomUsers(room);
    await enqueueSendMessage("roomUsers", room, { room: room, usercount: roomUsers.length });
    setImmediate(() => {
      messageService.deleteOldMessages(room, 3).catch(err => {
        console.error(`Cleanup error for room ${room}:`, err);
      });
    });
  }
  if (joinQueue.length > 0) {
    setTimeout(joinHandler, 1000);
  } else {
    joinInProgress = false;
  }
}

async function quitHandler() {
  let inProgress = [...quitQueue];
  quitQueue = [];
  let roomLeft = new Set();
  for (let i = 0; i < inProgress.length; i++) {
    let socket = inProgress[i];
    const user = await userLeave(socket.id);
    socket.disconnect();
    socket.removeAllListeners();
    socket = null;
    if (user) {
      roomLeft.add(user.room);
    }
  }
  for (const room of roomLeft) {
    const roomUsers = await getRoomUsers(room);
    await enqueueSendMessage("roomUsers", room, { room: room, usercount: roomUsers.length });
  }
  quitInProgress = false;
}

const joinRoom = (socket, io) => {
  socket.on("joinRoom", async ({ uid, username, room }) => {
    // Thay vì xử lý ngay, đẩy vào queue để xử lý tuần tự
    joinQueue.push({ socket, uid, username, room });

    if (!joinInProgress) {
      joinInProgress = true;
      setTimeout(joinHandler, 1000);
    }
  });
};

// let cnt = 0;
// let start = 0;
// let endcnt = 0;

async function enqueueSendMessage(type, room, message) {
  await sendQueue.add("send_message", { type, room, message });
}

const getChat = (socket, io) => {
  socket.on("chatMessage", async (msg) => {
    const user = await getCurrentUser(socket.id);
    
    if (!user) {
      socket.emit("message", formatMessage(botName, "Error: User not found"));
      return;
    }

    try {
      // Kiểm tra rate limit dựa trên user ID
      // const rl = await initChatLimiter();
      // if (rl && rl.consume) {
      //   await rl.consume(user.id);
      // }

      // Tạo message object với timestamp
      const messageData = {
        username: user.username,
        uid: user.id,
        text: msg,
        time: new Date().toISOString(), // ISO format cho time display
      }
      await enqueueSaveMessage(user.room, messageData);
      io.to(user.room).emit("message", formatMessage(user.username, msg, messageData.time));
      // Queue message for processing (consumer will broadcast it)
      // await enqueueSendMessage("message", user.room, messageData);
      // if (msg == 'start') {
      //   console.log(`Client count: ${io.engine.clientsCount}`);
      //   start = performance.now();
      //   cnt = 0;
      //   endcnt = 0;
      // } else if (msg == 'end') {
      //   endcnt++;
        
      //   if (endcnt == io.engine.clientsCount - 1) {
      //     console.log('All clients ended');
      //     const end = performance.now();
      //     const duration = end - start;
      //     console.log(`Sent ${cnt} messages in ${duration.toFixed(2)} ms (${(cnt / duration * 1000).toFixed(2)} msg/s)`);
          // console.log(await sendQueue.getJobCounts());
      //     console.log('All clients ended 2');
      //   }
      // } else if (msg == 'memory') {
      //   console.log(sendQueue);
      //   console.log(await sendQueue.getJobCounts());
        // console.log(sendWorker)
      //   console.log(sendQueue.getWorkers());
      // }
      // cnt++;
      // await messageService.saveMessage(user.room, messageData);

    } catch (rateLimiterRes) {
      // Rate limit exceeded - có thể uncomment để thông báo
      socket.emit(
        "message",
        formatMessage(
          botName,
          `You are sending messages too fast! Please wait a few seconds.`
        )
      );
      // console.log(`Rate limit hit for user ${user.username}`);
    }
  });
};

const disconnect = (socket, io) => {
  socket.on("disconnect", async () => {
    quitQueue.push( socket );
    if (!quitInProgress) {
      quitInProgress = true;
      setTimeout(quitHandler, 1000);
    }
  });
};

const bindEventHandler = (socket, io) => {
  if (!globalIo) {
    initializeMessageConsumer(io);
  }

  joinRoom(socket, io);
  getChat(socket, io);
  disconnect(socket, io);
};

const initializeMessageConsumer = (io) => {
  if (globalIo) return; // Already initialized
  globalIo = io;
  
  // Create a Worker to process messages from the queue
  sendWorker = new Worker('send_queue', async (job) => {
    let { type, room, message } = job.data;
    
    
    try {
      // Broadcast to all clients in room
      if (type == "message") {
        message = formatMessage(message.username, message.text);
        if (message.text.startsWith('test ') && Number(message.text.split(' ')[1]) % 10000 === 0) {
          console.log(`reach ${message.text.split(' ')[1]}`);
        }
      }

      io.to(room).emit(type, message);
    } catch (error) {
      console.log('worker error: ', message);
      console.error(`[Consumer] Error processing message:`, error.message);
      throw error; // Retry
    }
  }, { 
    concurrency: 100, 
    connection: { host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT) } 
  });

  sendWorker.on('completed', (job) => {
    return;
  });
  
  sendWorker.on('failed', (job, error) => {
    console.error(`[Consumer] Job ${job.data.message} failed:`, error.message);
  });

  sendWorker.on('error', (error) => {
    console.error('[Consumer] Worker error:', error.message);
  });

  sendWorker.on('stalled', (jobId) => {
    console.warn(`[Consumer] Job ${jobId} stalled and will be retried`);
  });

  sendWorker.on('closing', () => {
    console.log('[Consumer] Worker is shutting down');
  });

  sendWorker.on('lockRenewalFailed', (job) => {
    console.error(`[Consumer] Lock renewal failed for job ${job.id}`);
  });

  sendWorker.on('closed', () => {
    console.log('[Consumer] Worker has been closed');
  });

  sendWorker.on('paused', () => {
    console.log('[Consumer] Worker has been paused');
  });
  
  console.log('[Consumer] Message consumer initialized');
};

export default bindEventHandler;