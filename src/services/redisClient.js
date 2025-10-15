const { createClient } = require('redis');
const config = require('../config');

let client;

async function getRedisClient() {
  if (client) return client;
  client = createClient({ url: config.REDIS_URL });
  client.on('error', (err) => console.error('Redis Client Error', err));
  await client.connect();
  return client;
}

module.exports = { getRedisClient };
