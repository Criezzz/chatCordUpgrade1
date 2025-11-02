import admin from "../configs/firebase-admin.js";
import { blacklist, accept, isBlocked } from "../controllers/connection.js"

const verifyIdToken = async (token) => {
    try {
        const decoded = await admin.auth().verifyIdToken(token);
        return decoded;
    } catch (err) {
        console.error("Invalid Firebase ID token:", err);
        throw err;
    }
};


const authenticate = async (socket, next) => {
    const token = socket.handshake.auth?.token;
    const ip = socket.handshake.address;
    if (!token) {
        await blacklist(ip);
        return next(new Error('Invalid access'))
    }
    try {
        const user = await verifyIdToken(token);
        socket.user = user;
        socket.ip = ip;
        
        await accept(socket.id);
        next();
    } catch (err) {
        await blacklist(ip);
        console.error("Invalid token", err);
        next(new Error("Unauthorized"));
    }
}

const checkBlock = async (socket, next) => {
    const ip = socket.handshake.address;
    if (await isBlocked(ip)) {
        return next(new Error("Try again later"));
    }
    next();
}

export { authenticate, checkBlock };