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

// Get real client IP from headers when behind proxy
const getRealIP = (socket) => {
    // Try various proxy headers
    const forwarded = socket.handshake.headers['x-forwarded-for'];
    if (forwarded) {
        // X-Forwarded-For can be comma-separated: "client, proxy1, proxy2"
        return forwarded.split(',')[0].trim();
    }
    
    const realIP = socket.handshake.headers['x-real-ip'];
    if (realIP) return realIP;
    
    // Fallback to socket address
    return socket.handshake.address;
};

const authenticate = async (socket, next) => {
    const token = socket.handshake.auth?.token;
    const ip = getRealIP(socket);
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
    const ip = getRealIP(socket);
    if (await isBlocked(ip)) {
        return next(new Error("Try again later"));
    }
    next();
}

export { authenticate, checkBlock };