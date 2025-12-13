import redis from "../configs/redis.js";

// Block TTL in seconds (temporary block instead of permanent)
const BLOCK_TTL_SECONDS = 300; // 5 minutes

const blacklist = async (ip) => {
    try {
        const key = `blocked:${ip}`;
        const raw = await redis.get(key);
        let time = 1000;
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed.time === "number") {
                    time = parsed.time * 10;
                }
            } catch {
                // ignore parse error, use default time
            }
        }
        const payload = JSON.stringify({ time, blockedAt: Date.now() });
        // Set with TTL so block expires automatically
        await redis.set(key, payload, "EX", BLOCK_TTL_SECONDS);
    } catch (e) {
        console.error("Error blacklisting IP", ip, e?.message || e);
    }
};

const accept = async (socketid) => {
    try {
        await redis.sadd("valid_sockets", socketid);
    } catch (e) {
        console.error("Error marking socket as valid", socketid, e?.message || e);
    }
};

const isBlocked = async (ip) => {
    try {
        const exists = await redis.exists(`blocked:${ip}`);
        // ioredis returns 0/1; Upstash may return boolean
        return !!exists;
    } catch (e) {
        console.error("Error checking block status for IP", ip, e?.message || e);
        return false;
    }
};

export { blacklist, accept, isBlocked };