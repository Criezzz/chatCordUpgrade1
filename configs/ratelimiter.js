// configs/ratelimiter.js
import { RateLimiterRedis, RateLimiterMemory } from "rate-limiter-flexible";
import Redis from "ioredis";

let limiter = null;

export async function initChatLimiter() {
  if (limiter) return limiter;

  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn("REDIS_URL not set → rate limit dùng in-memory");
    limiter = new RateLimiterMemory({ points: 5, duration: 5 });
    return limiter;
  }

  const client = new Redis(url);
  client.on("error", (e) => console.error("Redis client error:", e));

  try {
    await client.ping();
    limiter = new RateLimiterRedis({
      storeClient: client,
      keyPrefix: "chat_rate_limit",
      points: 5,
      duration: 5,
    });
    console.log("Rate limiter: Redis backend");
  } catch (e) {
    console.error("Rate limiter Redis connect failed → fallback memory:", e.message);
    limiter = new RateLimiterMemory({ points: 5, duration: 5 });
  }
  return limiter;
}

export function makeRateLimitMiddleware(getKey = (req) => req.ip) {
  return async (req, res, next) => {
    const rl = await initChatLimiter();
    try {
      await rl.consume(getKey(req));
      next();
    } catch {
      res.status(429).send("Too Many Requests");
    }
  };
}
