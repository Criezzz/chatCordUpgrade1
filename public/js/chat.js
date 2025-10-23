import auth, {authCheck} from "./auth.js";

const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const roomName = document.getElementById('room-name');
const userList = document.getElementById('users');

// Get username and room from URL
const { username, room } = Qs.parse(location.search, {
  ignoreQueryPrefix: true,
});

const socket = io();

// Biến quản lý rate limit
let isRateLimited = false;
let rateLimitMessageTimeout = null;

authCheck((user) => {
  if (!user) {
    window.location.href = "/login";
  }
});

// Join chatroom
const joinRoom = () => {
  socket.emit('joinRoom', { uid, username, room });
}

let uid = sessionStorage.getItem("uid");
if (!uid) {
  authCheck((user) => {
    if (!user) {
      window.location.href = "/login";
    } else {
      uid = user.uid;
      sessionStorage.setItem('uid', uid);
      joinRoom();
    }
  })
} else {
  joinRoom();
}

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
  
  outputMessage(message, isRateLimitMessage);
  
  // Scroll down
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  // Nếu là rate limit message, tự động xóa sau 3 giây
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

// Message submit
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  // Kiểm tra rate limit
  if (isRateLimited) {
    return false;
  }
  
  // Get message text
  let msg = e.target.elements.msg.value;
  msg = msg.trim();
  if (!msg) {
    return false;
  }
  
  // Emit message to server
  socket.emit('chatMessage', msg);
  
  // Clear input
  e.target.elements.msg.value = '';
  e.target.elements.msg.focus();
});

// Output message to DOM
function outputMessage(message, isRateLimitWarning = false, isHistoryMessage = false) {
  const div = document.createElement('div');
  div.classList.add('message');
  
  // Thêm class đặc biệt
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
  
  document.querySelector('.chat-messages').appendChild(div);
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