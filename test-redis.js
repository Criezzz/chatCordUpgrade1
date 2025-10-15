/* Quick Redis connection test
   Usage (PowerShell):
   $env:REDIS_URL = 'rediss://default:...@wealthy-magpie-35429.upstash.io:6379'
   node test-redis.js
*/
const { createClient } = require('redis');

(async () => {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.error('Set REDIS_URL environment variable first. Example:');
    console.error("$env:REDIS_URL = 'rediss://default:PASSWORD@host:6379'");
    process.exit(1);
  }

  const client = createClient({ url });
  client.on('error', (err) => console.error('Redis Client Error', err));

  try {
    await client.connect();
    const pong = await client.ping();
    console.log('Connected to Redis, PING ->', pong);
    await client.quit();
    process.exit(0);
  } catch (err) {
    console.error('Connection failed:', err.message || err);
    process.exit(2);
  }
})();
