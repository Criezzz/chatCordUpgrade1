import auth, { getUser } from "./auth.js";

const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const roomName = document.getElementById('room-name');
const userList = document.getElementById('users');
const SOFT_DELAY = 250;
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
// Join chatroom

const joinRoom = (idToken) => {
  const socket = io({ auth: {
    token: idToken,
  }});
  bindEventHandler(socket);
  startEventListener(socket);
  socket.emit('joinRoom', { uid, username, room });
}

user.getIdToken(true).then(joinRoom);

// ===== NHẬN LỊCH SỬ CHAT =====
socket.on('chatHistory', (messages) => {
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
    }, false, true); // Tham số thứ 3: isHistoryMessage
  });
  
  chatMessages.appendChild(separator);
  // Scroll xuống cuối
  chatMessages.scrollTop = chatMessages.scrollHeight;
});
// ===== KẾT THÚC NHẬN LỊCH SỬ =====

const bindEventHandler = (socket) => {
  // Get room and users
  socket.on('roomUsers', ({ room, users }) => {
    outputRoomName(room);
    outputUsers(users);  
  });
  
  // Message from server
  socket.on('message', (message) => {
    // Kiểm tra xem có phải là message rate limit từ bot không
    const isRateLimitMessage = message.username === 'ChatCord Bot' && 
                                message.text.includes('sending messages too fast');
    outputMessage(message);
  
    // Scroll down
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (isRateLimitMessage) {
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
  });

  // Lắng nghe sự kiện rate limit từ server
  socket.on('rateLimitExceeded', (data) => {
    console.log('Rate limit exceeded:', data);
  });
}

const startEventListener = (socket) => {
  // Message submit
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    // Get message text

    // Kiểm tra rate limit
    if (isRateLimited) {
      return false;
    }

    let msg = getMsg(e);
    if (!msg) {
      return false;
    }
    sendMsgWithLimitCheck(e, msg, socket);
  });
}

const getMsg = (e) => {
    // Get message text
    let msg = e.target.elements.msg.value;
    msg = msg.trim();
    return msg
}

const sendMsgWithLimitCheck = (e, msg, socket) => {
  const now = Date.now();
  if (now - lastMsg.time < SOFT_DELAY) {
    alert("Too fast. Try again later")
  } else {
    // Emit message to server
    socket.emit('chatMessage', msg);

    // Clear input
    e.target.elements.msg.value = '';
    e.target.elements.msg.focus();
    lastMsg.time = now;
    lastMsg.msg = msg;
  }
}

const trimOldMsg = (container) => {
  if (container.childElementCount > 100) {
    container.removeChild(container.getElementsByTagName('div')[0])
  }
}

const createMsgToast = (message) => {
  const div = document.createElement('div');
  div.classList.add('message');

  const p = document.createElement('p');
  p.classList.add('meta');
  p.innerText = message.username;
  p.innerHTML += `<span>${message.time}</span>`;
  
  div.appendChild(p);
  
  const para = document.createElement('p');
  para.classList.add('text');
  para.innerText = message.text;
  
  div.appendChild(para);

  return div
}

// Output message to DOM
function outputMessage(message) {
  const container = document.querySelector('.chat-messages')
  const div = createMsgToast(message)
  trimOldMsg(container);
  container.appendChild(div);
}

// Format time từ ISO string hoặc timestamp
function formatTime(timeString) {
  try {
    const date = new Date(timeString);
    return date.toLocaleTimeString('vi-VN', { 
      hour: '2-digit', 
      minute: '2-digit',
      amPm: 'true' 
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
function outputUsers(users) {
  userList.innerHTML = '';
  users.forEach((user) => {
    const li = document.createElement('li');
    li.innerText = user.username;
    userList.appendChild(li);
  });
}

// Prompt the user before leave chat room
document.getElementById('leave-btn').addEventListener('click', () => {
  const leaveRoom = confirm('Are you sure you want to leave the chatroom?');
  if (leaveRoom) {
    window.location.href = '/';
  }
});