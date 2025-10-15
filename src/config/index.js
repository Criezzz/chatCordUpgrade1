const path = require('path');
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT || '',
  MESSAGE_HISTORY_COUNT: parseInt(process.env.MESSAGE_HISTORY_COUNT, 10) || 100,
  PUBLIC_DIR: path.join(__dirname, '../../public'),
  BOT_NAME: process.env.BOT_NAME || 'ChatCord Bot',
};
