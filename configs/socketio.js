import { Server } from "socket.io";

const initSocketIo = (server) => {
    const io = new Server(server);
    return io;
}

export default initSocketIo;