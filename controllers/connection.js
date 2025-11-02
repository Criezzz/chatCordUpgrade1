import redis from "../configs/redis.js"

const blacklist = async (ip) => {
    const blockval = redis.get(`blocked:${ip}`);
    if (!blockval) {
        redis.set(`blocked:${ip}`, JSON.stringify({
            time: 1000,
            blockedAt: Date.now(),
        }))
    } else {
        redis.set(`blocked:${ip}`, JSON.stringify({
            time: blockval.time * 10,
            blockedAt: Date.now(),
        }))
    }
}

const accept = async (socketid) => {
    await redis.sAdd("valid_sockets", socketid);
}

const isBlocked = async (ip) => {
    return await redis.exists(`blocked:${ip}`);
}

export { blacklist, accept, isBlocked };