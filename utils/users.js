import Redis from "ioredis";

// Redis client for user management
let redisClient = null;
let connectionFailed = false;
const users = []; // Fallback in-memory storage

const USERS_KEY_PREFIX = 'chat:users:';
const ROOM_USERS_KEY_PREFIX = 'chat:room:';
const USER_EXPIRY = 24 * 60 * 60; // 24 hours

async function getClient() {
  if (redisClient) return redisClient;
  if (connectionFailed) return null;

  const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  const client = new Redis(url);

  client.on("error", (err) => {
    console.error("Redis Users Error:", err?.message || err);
  });

  try {
    await client.ping();
    redisClient = client;
    console.log("Users: Connected to Redis at", url);
    return redisClient;
  } catch (e) {
    console.error("Users: Redis connect failed → using memory store:", e?.message || e);
    connectionFailed = true;
    return null;
  }
}

// Join user to chat
async function userJoin(socid, id, username, room) {
  if (username === 'ChatCord Bot') {
    return null;
  }

  const user = { socid, id, username, room };
  
  try {
    const client = await getClient();
    if (!client) {
      // Fallback to memory
      const existing = users.find(u => u.id === id || u.socid === socid || u.username === username);
      if (existing) return null;
      users.push(user);
      return user;
    }

    // Check if user already exists
    const [byId, bySocid, byUsername] = await Promise.all([
      client.get(`${USERS_KEY_PREFIX}id:${id}`),
      client.get(`${USERS_KEY_PREFIX}socid:${socid}`),
      client.get(`${USERS_KEY_PREFIX}username:${username}`)
    ]);

    if (byId || bySocid || byUsername) {
      return null;
    }

    // Store user with multiple indexes
    const userJson = JSON.stringify(user);
    await Promise.all([
      client.setex(`${USERS_KEY_PREFIX}id:${id}`, USER_EXPIRY, userJson),
      client.setex(`${USERS_KEY_PREFIX}socid:${socid}`, USER_EXPIRY, userJson),
      client.setex(`${USERS_KEY_PREFIX}username:${username}`, USER_EXPIRY, userJson),
      client.sadd(`${ROOM_USERS_KEY_PREFIX}${room}`, socid),
      client.expire(`${ROOM_USERS_KEY_PREFIX}${room}`, USER_EXPIRY)
    ]);

    return user;
  } catch (error) {
    console.error("Error in userJoin:", error?.message || error);
    // Fallback to memory
    const existing = users.find(u => u.id === id || u.socid === socid || u.username === username);
    if (existing) return null;
    users.push(user);
    return user;
  }
}

// Get current user
async function getCurrentUser(socid) {
  try {
    const client = await getClient();
    if (!client) {
      return users.find(user => user.socid === socid);
    }

    const userJson = await client.get(`${USERS_KEY_PREFIX}socid:${socid}`);
    if (!userJson) return null;
    
    return JSON.parse(userJson);
  } catch (error) {
    console.error("Error in getCurrentUser:", error?.message || error);
    return users.find(user => user.socid === socid);
  }
}

// User leaves chat
async function userLeave(socid) {
  try {
    const client = await getClient();
    if (!client) {
      const index = users.findIndex(user => user.socid === socid);
      console.log(users.length);
      if (index !== -1) {
        return users.splice(index, 1)[0];
      }
      return null;
    }

    // Get user data before deleting
    const userJson = await client.get(`${USERS_KEY_PREFIX}socid:${socid}`);
    if (!userJson) return null;

    const user = JSON.parse(userJson);

    // Remove user from all indexes
    await Promise.all([
      client.del(`${USERS_KEY_PREFIX}id:${user.id}`),
      client.del(`${USERS_KEY_PREFIX}socid:${socid}`),
      client.del(`${USERS_KEY_PREFIX}username:${user.username}`),
      client.srem(`${ROOM_USERS_KEY_PREFIX}${user.room}`, socid)
    ]);

    console.log(`User left: ${user.username} from room ${user.room}`);
    return user;
  } catch (error) {
    console.error("Error in userLeave:", error?.message || error);
    const index = users.findIndex(user => user.socid === socid);
    console.log(users.length);
    if (index !== -1) {
      return users.splice(index, 1)[0];
    }
    return null;
  }
}

// Get room users
async function getRoomUsers(room) {
  try {
    const client = await getClient();
    if (!client) {
      return users.filter(user => user.room === room);
    }

    // Get all socket IDs in the room
    const socids = await client.smembers(`${ROOM_USERS_KEY_PREFIX}${room}`);
    if (!socids || socids.length === 0) return [];

    // Get user data for each socket ID
    const userPromises = socids.map(socid => 
      client.get(`${USERS_KEY_PREFIX}socid:${socid}`)
    );
    
    const userJsons = await Promise.all(userPromises);
    
    return userJsons
      .filter(json => json !== null)
      .map(json => JSON.parse(json));
  } catch (error) {
    console.error("Error in getRoomUsers:", error?.message || error);
    return users.filter(user => user.room === room);
  }
}

export {
  userJoin,
  getCurrentUser,
  userLeave,
  getRoomUsers
};
