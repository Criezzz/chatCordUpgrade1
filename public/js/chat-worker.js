// Web Worker for handling chat messages

let socket = null;
let messageQueue = [];
let isProcessing = false;

// Initialize socket connection
self.onmessage = function(e) {
  const { type, data } = e.data;

  switch(type) {
    case 'INIT_SOCKET':
      initializeSocket(data);
      break;
    
    case 'SEND_MESSAGE':
      queueMessage(data);
      break;
    
    case 'JOIN_ROOM':
      if (socket) {
        socket.emit('joinRoom', data);
      }
      break;
    
    case 'DISCONNECT':
      if (socket) {
        socket.disconnect();
      }
      break;
  }
};

function initializeSocket(config) {
  // Import socket.io client in worker
  importScripts('https://cdn.socket.io/4.5.4/socket.io.min.js');
  
  socket = io(config.url, {
    auth: {
      token: config.token
    },
    transports: ['websocket']
  });

  // Socket event listeners
  socket.on('connect', () => {
    self.postMessage({
      type: 'SOCKET_CONNECTED',
      data: { socketId: socket.id }
    });
  });

  socket.on('message', (message) => {
    self.postMessage({
      type: 'MESSAGE_RECEIVED',
      data: message
    });
  });

  socket.on('chatHistory', (messages) => {
    self.postMessage({
      type: 'CHAT_HISTORY',
      data: messages
    });
  });

  socket.on('roomUsers', (data) => {
    self.postMessage({
      type: 'ROOM_USERS',
      data: data
    });
  });

  socket.on('rateLimitExceeded', (data) => {
    self.postMessage({
      type: 'RATE_LIMIT_EXCEEDED',
      data: data
    });
  });

  socket.on('disconnect', () => {
    self.postMessage({
      type: 'SOCKET_DISCONNECTED'
    });
  });

  socket.on('error', (error) => {
    self.postMessage({
      type: 'SOCKET_ERROR',
      data: { error: error.message }
    });
  });
}

function queueMessage(message) {
  messageQueue.push(message);
  processQueue();
}

function processQueue() {
  if (isProcessing || messageQueue.length === 0 || !socket) {
    return;
  }

  isProcessing = true;
  const message = messageQueue.shift();

  socket.emit('chatMessage', message.text);
  
  self.postMessage({
    type: 'MESSAGE_SENT',
    data: { text: message.text, timestamp: Date.now() }
  });

  // Small delay before processing next message
  setTimeout(() => {
    isProcessing = false;
    processQueue();
  }, 100);
}