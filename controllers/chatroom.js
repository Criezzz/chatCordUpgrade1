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
      // Lấy 50 tin nhắn gần nhất trong 7 ngày
      const chatHistory = await messageService.getMessages(user.room, 7, 50);
      if (chatHistory.length > 0) {
        // Gửi lịch sử chat cho user vừa join
        socket.emit("chatHistory", chatHistory);
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
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
    // Xóa tin nhắn cũ hơn 7 ngày mỗi khi có user mới join
    await messageService.deleteOldMessages(user.room);
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
      // Lưu tin nhắn vào Redis

      await messageService.saveMessage(user.room, {
        username: user.username,
        uid: user.id,
        text: msg,
        time: Date.now(),
      });
      // Xóa tin nhắn cũ hơn 7 ngày
      await messageService.deleteOldMessages(user.room);
      
      // Nếu pass rate limit, gửi tin nhắn
      io.to(user.room).emit("message", formatMessage(user.username, msg));
    } catch (rateLimiterRes) {
    //   socket.emit(
    //     "message",
    //     formatMessage(
    //       botName,
    //       `You are sending your message too fast! Please wait a few seconds.`
    //     )
    //   );
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