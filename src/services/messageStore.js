const config = require('../config');
const { getRedisClient } = require('./redisClient');

async function saveMessage(room, message) {
  const client = await getRedisClient();
  const key = `messages:${room}`;
  const str = JSON.stringify(message);
  // push to right, trim to keep last N messages
  await client.rPush(key, str);
  await client.lTrim(key, -config.MESSAGE_HISTORY_COUNT, -1);
}

async function getRecentMessages(room, count = 50) {
  const client = await getRedisClient();
  const key = `messages:${room}`;
  const start = -count;
  const end = -1;
  const arr = await client.lRange(key, start, end);
  return arr.map((s) => {
    try { return JSON.parse(s); } catch (e) { return null; }
  }).filter(Boolean);
}

module.exports = { saveMessage, getRecentMessages };
