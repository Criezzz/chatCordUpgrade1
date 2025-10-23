import { RateLimiterRedis } from "rate-limiter-flexible";
import { createClient } from "redis";

const client = createClient({ url: "redis://localhost:6379" });
await client.connect();

const chatLimiter = new RateLimiterRedis({
  storeClient: client,
  keyPrefix: "chat_rate_limit",
  points: 5, // cho phép gửi 5 tin
  duration: 5, // trong 5 giây
});

export default chatLimiter;