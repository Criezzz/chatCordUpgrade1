import formatMessage from "../utils/messages.js";
import { userJoin, getCurrentUser, userLeave, getRoomUsers } from "../utils/users.js";
import { initChatLimiter } from "../configs/ratelimiter.js";
import messageService from "../services/messageService.js";

const botName = "ChatCord Bot";

const joinRoom = (socket, io) => {
  socket.on("joinRoom", async ({ uid, username, room }) => {
    const user = userJoin(socket.id, uid, username, room);
    socket.join(user.room);
    
    socket.emit("message", formatMessage(botName, "Welcome to ChatCord!"));

    try {
      // QUAN TRỌNG: Load messages TRƯỚC, cleanup SAU
      // Lấy 100 tin nhắn gần nhất (không filter theo ngày nữa)
      const chatHistory = await messageService.getMessages(user.room, 365, 100);
      
      console.log(`Loading chat history for room=${user.room}: ${chatHistory.length} messages`);
      
      if (chatHistory.length > 0) {
        // Gửi lịch sử chat cho user vừa join
        socket.emit("chatHistory", chatHistory);
      } else {
        console.log(`No chat history found for room=${user.room}`);
      }

      // Cleanup chạy sau, không ảnh hưởng đến load messages
      // Chỉ xóa messages > 30 ngày (giữ lại nhiều hơn)
      setImmediate(() => {
        messageService.deleteOldMessages(user.room, 30).catch(err => {
          console.error(`Cleanup error for room ${user.room}:`, err);
        });
      });

    } catch (error) {
      console.error("Error loading chat history:", error);
      console.error(error.stack);
    }

    socket.broadcast
      .to(user.room)
      .emit(
        "message",
        formatMessage(botName, `${user.username} has joined the chat`)
      );

    // Send users and room info
    io.to(user.room).emit("roomUsers", {
      room: user.room,
      users: getRoomUsers(user.room),
    });
  });
};

const getChat = (socket, io) => {
  socket.on("chatMessage", async (msg) => {
    const user = getCurrentUser(socket.id);
    
    if (!user) {
      socket.emit("message", formatMessage(botName, "Error: User not found"));
      return;
    }

    try {
      // Kiểm tra rate limit dựa trên user ID
      const rl = await initChatLimiter();
      if (rl && rl.consume) {
        await rl.consume(user.id);
      }

      // Tạo message object với timestamp
      const messageData = {
        username: user.username,
        uid: user.id,
        text: msg,
        time: new Date().toISOString(), // ISO format cho time display
      };

      // Lưu tin nhắn vào Redis (KHÔNG delete ở đây!)
      await messageService.saveMessage(user.room, messageData);

      // Gửi tin nhắn đến tất cả users trong room
      io.to(user.room).emit("message", formatMessage(user.username, msg));
      
    } catch (rateLimiterRes) {
      // Rate limit exceeded - có thể uncomment để thông báo
      // socket.emit(
      //   "message",
      //   formatMessage(
      //     botName,
      //     `You are sending messages too fast! Please wait a few seconds.`
      //   )
      // );
      console.log(`Rate limit hit for user ${user.username}`);
    }
  });
};

const disconnect = (socket, io) => {
  socket.on("disconnect", () => {
    const user = userLeave(socket.id);
    
    if (user) {
      io.to(user.room).emit(
        "message",
        formatMessage(botName, `${user.username} has left the chat`)
      );

      // Send users and room info
      io.to(user.room).emit("roomUsers", {
        room: user.room,
        users: getRoomUsers(user.room),
      });
    }
  });
};

const bindEventHandler = (socket, io) => {
  joinRoom(socket, io);
  getChat(socket, io);
  disconnect(socket, io);
};

export default bindEventHandler;