import { getUser } from "./auth.js";

const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const roomName = document.getElementById('room-name');
const userCount = document.getElementById('user-count');
const SOFT_DELAY = 1000;
const lastMsg = {
  time: 0,
  msg: "",
}

// Get username and room from URL
const { username, room } = Qs.parse(location.search, {
  ignoreQueryPrefix: true,
});

// Biến quản lý rate limit
let isRateLimited = false;
let rateLimitMessageTimeout = null;

const user = getUser();
const uid = user.uid;

// Initialize Web Worker
let chatWorker = null;

// Join chatroom
const joinRoom = (idToken) => {
  // Create worker
  chatWorker = new Worker('/js/chat-worker.js');
  
  // Setup worker message handler
  setupWorkerHandlers();
  
  // Initialize socket in worker
  chatWorker.postMessage({
    type: 'INIT_SOCKET',
    data: {
      url: window.location.origin,
      token: idToken
    }
  });
  
  // Join room after socket connects
  setTimeout(() => {
    chatWorker.postMessage({
      type: 'JOIN_ROOM',
      data: { uid, username, room }
    });
  }, 500);
}

user.getIdToken(true).then(joinRoom);

// Setup worker event handlers
function setupWorkerHandlers() {
  chatWorker.onmessage = function(e) {
    const { type, data } = e.data;
    
    switch(type) {
      case 'SOCKET_CONNECTED':
        console.log('Socket connected:', data.socketId);
        break;
      
      case 'MESSAGE_RECEIVED':
        handleMessageReceived(data);
        break;
      
      case 'CHAT_HISTORY':
        showHistoryMessages(data);
        break;
      
      case 'ROOM_USERS':
        
        outputRoomName(data.room);
        outputUsers(data.usercount);
        break;
      
      case 'RATE_LIMIT_EXCEEDED':
        handleRateLimitExceeded(data);
        break;
      
      case 'MESSAGE_SENT':
        console.log('Message sent:', data);
        break;
      
      case 'SOCKET_DISCONNECTED':
        console.log('Socket disconnected');
        break;
      
      case 'SOCKET_ERROR':
        console.error('Socket error:', data.error);
        break;
    }
  };

  chatWorker.onerror = function(error) {
    console.error('Worker error:', error);
  };
}

// Handle received message
function handleMessageReceived(message) {
  const isRateLimitMessage = message.username === 'ChatCord Bot' && 
                              message.text.includes('sending messages too fast');
  outputMessage(message, isRateLimitMessage);

  // Scroll down
  chatMessages.scrollTop = chatMessages.scrollHeight;

  if (isRateLimitMessage) {
    handleRateLimitMessage();
  }
}

// Handle rate limit message
function handleRateLimitMessage() {
  isRateLimited = true;
  
  // Disable form
  const messageInput = chatForm.elements.msg;
  const submitBtn = chatForm.querySelector('button[type="submit"]');
  if (messageInput) messageInput.disabled = true;
  if (submitBtn) submitBtn.disabled = true;
  
  // Lấy message element vừa tạo
  const lastMessage = chatMessages.lastElementChild;
  
  // Tự động xóa message sau 3 giây
  rateLimitMessageTimeout = setTimeout(() => {
    if (lastMessage && lastMessage.parentNode) {
      lastMessage.classList.add('fade-out');
      
      setTimeout(() => {
        lastMessage.remove();
      }, 300);
    }
    
    // Enable lại form
    isRateLimited = false;
    if (messageInput) messageInput.disabled = false;
    if (submitBtn) submitBtn.disabled = false;
  }, 3000);
}

// Handle rate limit exceeded
function handleRateLimitExceeded(data) {
  console.log('Rate limit exceeded:', data);
}

// ===== NHẬN LỊCH SỬ CHAT =====
const showHistoryMessages = (messages) => {
    console.log('Loading chat history:', messages.length, 'messages');
    
    // Xóa messages hiện tại (nếu có)
    chatMessages.innerHTML = '';
    
    // Hiển thị separator cho lịch sử chat
    const separator = document.createElement('div');
    separator.className = 'history-separator';
    separator.innerHTML = `
      <span>━━━━━ Lịch sử chat (${messages.length} tin nhắn) ━━━━━</span>
    `;
    
    // Hiển thị từng message
    messages.forEach(msg => {
      outputMessage({
        username: msg.username,
        text: msg.text,
        time: formatTime(msg.time)
      }, false, true);
    });
    
    chatMessages.appendChild(separator);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
// ===== KẾT THÚC NHẬN LỊCH SỬ =====

// Start event listener
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  // Kiểm tra rate limit
  if (isRateLimited) {
    return false;
  }

  let msg = getMsg(e);
  if (!msg) {
    return false;
  }
  
  sendMsgWithLimitCheck(e, msg);
});

const getMsg = (e) => {
    let msg = e.target.elements.msg.value;
    msg = msg.trim();
    return msg;
}

const sendMsgWithLimitCheck = (e, msg) => {
  const now = Date.now();
  if (now - lastMsg.time < SOFT_DELAY) {
    alert("Too fast. Try again later");
  } else {
    // Send message via worker
    chatWorker.postMessage({
      type: 'SEND_MESSAGE',
      data: { text: msg }
    });

    // Clear input
    e.target.elements.msg.value = '';
    e.target.elements.msg.focus();
    lastMsg.time = now;
    lastMsg.msg = msg;
  }
}

const createMsgToast = (message, isRateLimitWarning, isHistoryMessage) => {
  const div = document.createElement('div');
  div.classList.add('message');

  if (isRateLimitWarning) {
    div.classList.add('rate-limit-message');
  }
  if (isHistoryMessage) {
    div.classList.add('history-message');
  }

  const p = document.createElement('p');
  p.classList.add('meta');
  p.innerText = message.username;
  p.innerHTML += `<span>${message.time}</span>`;
  
  div.appendChild(p);
  
  const para = document.createElement('p');
  para.classList.add('text');
  para.innerText = message.text;
  
  div.appendChild(para);

  return div;
}

const trimOldMsg = (container) => {
  if (container.childElementCount > 50) {
    container.removeChild(container.getElementsByTagName('div')[0]);
  }
}

// Output message to DOM
let cnt = 0;
let start = 0;

function outputMessage(message, isRateLimitWarning = false, isHistoryMessage = false) {
  const container = document.querySelector('.chat-messages');
  const div = createMsgToast(message, isRateLimitWarning, isHistoryMessage);
  trimOldMsg(container);
  container.appendChild(div);
  cnt ++;
  if (message.text == 'start') {
    cnt = 0;
    start = performance.now();
  } else if (message.text == 'end') {
    const end = performance.now();
    const msg = `Processed ${cnt} messages in ${(end - start) / 1000} s. Rate: ${(cnt / (end - start) * 1000)} msg/s`;
    const res = createMsgToast({username: 'Performance', text: msg, time: Date.now()}, false, false);
    container.appendChild(res);
  }
}

// Format time từ ISO string hoặc timestamp
function formatTime(timeString) {
  try {
    const date = new Date(timeString);
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return timeString;
  }
}

// Add room name to DOM
function outputRoomName(room) {
  roomName.innerText = room;
}

// Add users to DOM
function outputUsers(usercnt) {
  console.log('User count:', usercnt);
  userCount.innerHTML = usercnt;
}

// Prompt the user before leave chat room
document.getElementById('leave-btn').addEventListener('click', () => {
  const leaveRoom = confirm('Are you sure you want to leave the chatroom?');
  if (leaveRoom) {
    // Disconnect worker before leaving
    if (chatWorker) {
      chatWorker.postMessage({ type: 'DISCONNECT' });
      chatWorker.terminate();
    }
    window.location.href = '/';
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (chatWorker) {
    chatWorker.postMessage({ type: 'DISCONNECT' });
    chatWorker.terminate();
  }
});