import formatMessage from "../utils/messages.js";
import { userJoin, getCurrentUser, userLeave, getRoomUsers } from "../utils/users.js";
import { initChatLimiter } from "../configs/ratelimiter.js";
import { Worker, Queue } from 'bullmq';
import messageService, { enqueueSaveMessage } from "../services/messageService.js";

const botName = "ChatCord Bot";

// Store io reference for consumer
let globalIo = null;
let sendWorker = null;
let joinWorker = null;
let sendQueue = new Queue('send_queue', { connection: { host: '127.0.0.1', port: 6379 } });
let joinQueue = [];
let joinInProgress = false;

async function joinHandler() {
  let roomJoined = new Set();
  for (let i = 0; i < 20; i++) {
    if (joinQueue.length == 0) break;
    const { socket, uid, username, room } = joinQueue.shift();
    const user = userJoin(socket.id, uid, username, room);
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
      const chatHistory = await messageService.getMessages(user.room, 365, 100);
      
      // console.log(`Loading chat history for room=${user.room}: ${chatHistory.length} messages`);
      
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
  roomJoined.forEach(async (room) => {
    await enqueueSendMessage("roomUsers", room, { room: room, usercount: getRoomUsers(room).length });
    setImmediate(() => {
      messageService.deleteOldMessages(room, 3).catch(err => {
        console.error(`Cleanup error for room ${room}:`, err);
      });
    });
  });
  if (joinQueue.length > 0) {
    setTimeout(joinHandler, 100);
  } else {
    joinInProgress = false;
  }
}

const joinRoom = (socket, io) => {
  socket.on("joinRoom", async ({ uid, username, room }) => {
    // Thay vì xử lý ngay, đẩy vào queue để xử lý tuần tự
    joinQueue.push({ socket, uid, username, room });
    // console.log(joinInProgress);
    
    if (!joinInProgress) {
      joinInProgress = true;
      setTimeout(joinHandler, 100);
    }
  });
};

let cnt = 0;
let start = 0;
let endcnt = 0;

async function enqueueSendMessage(type, room, message) {
  await sendQueue.add("send_message", { type, room, message });
}

const getChat = (socket, io) => {
  socket.on("chatMessage", async (msg) => {
    const user = getCurrentUser(socket.id);
    
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
      if (msg == 'start') {
        console.log(`Client count: ${io.engine.clientsCount}`);
        start = performance.now();
        cnt = 0;
        endcnt = 0;
      } else if (msg == 'end') {
        endcnt++;
        
        if (endcnt == io.engine.clientsCount) {
          const end = performance.now();
          const duration = end - start;
          console.log(`Sent ${cnt} messages in ${duration.toFixed(2)} ms (${(cnt / duration * 1000).toFixed(2)} msg/s)`);
        }
      }
      
      cnt++;
      
      // Queue message for processing (consumer will broadcast it)
      
      await enqueueSendMessage("message", user.room, messageData);
      await enqueueSaveMessage(user.room, messageData);
      // console.log(`Process: ${process.pid}`);
      // await messageService.saveMessage(user.room, messageData);
      // io.to(user.room).emit("message", formatMessage(user.username, msg, messageData.time));
    } catch (rateLimiterRes) {
      // Rate limit exceeded - có thể uncomment để thông báo
      // socket.emit(
      //   "message",
      //   formatMessage(
      //     botName,
      //     `You are sending messages too fast! Please wait a few seconds.`
      //   )
      // );
      // console.log(`Rate limit hit for user ${user.username}`);
    }
  });
};

const disconnect = (socket, io) => {
  socket.on("disconnect", async () => {
    const user = userLeave(socket.id);
    console.log(`User disconnected: user=${user ? user.username : 'unknown'}`);
    socket.disconnect();
    socket.removeAllListeners();
    socket = null;
    if (user) {
      // Send users and room info
      await enqueueSendMessage("roomUsers", user.room, { room: user.room, usercount: getRoomUsers(user.room).length });
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
      }
      io.to(room).emit(type, message);
      
      
      return { success: true };
    } catch (error) {
      console.error(`[Consumer] Error processing message:`, error.message);
      throw error; // Retry
    }
  }, { 
    concurrency: 100, 
    connection: { host: '127.0.0.1', port: 6379 } 
  });
  
  sendWorker.on('failed', (job, error) => {
    console.error(`[Consumer] Job ${job.id} failed:`, error.message);
  });
  
  console.log('[Consumer] Message consumer initialized');
};

export default bindEventHandler;