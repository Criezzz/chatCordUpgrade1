import formatMessage from "../utils/messages.js";
import { userJoin, getCurrentUser, userLeave, getRoomUsers } from "../utils/users.js";

const botName = "ChatCord Bot";

const joinRoom = (socket, io) => {
    socket.on("joinRoom", ({ uid, username, room }) => {
        const user = userJoin(socket.id, uid, username, room);

        socket.join(user.room);

        socket.emit("message", formatMessage(botName, "Welcome to ChatCord!"));
        socket.broadcast
            .to(user.room)
            .emit(
                "message",
                formatMessage(botName, `${user.username} has joined the chat`
            )
        );

        // Send users and room info
        io.to(user.room).emit("roomUsers", {
            room: user.room,
            users: getRoomUsers(user.room),
        });
    });
}

const getChat = (socket, io) => {
    socket.on("chatMessage", (msg) => {
        const user = getCurrentUser(socket.id);
        io.to(user.room).emit("message", formatMessage(user.username, msg));
    });
}

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
}

const bindEventHandler = (socket, io) => {
    joinRoom(socket, io);
    getChat(socket, io);
    disconnect(socket, io);
}

export default bindEventHandler;