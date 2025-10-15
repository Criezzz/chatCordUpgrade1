const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const roomName = document.getElementById('room-name');
const userList = document.getElementById('users');

// Get username and room from URL
const { username, room } = Qs.parse(location.search, {
  ignoreQueryPrefix: true,
});

// Firebase config (replace with your values)
const firebaseConfig = {
  apiKey: "AIzaSyBpKTmFPk2UPve75gLSZ2zOtkjwJ4lD5Ng",
  authDomain: "device-streaming-443f3261.firebaseapp.com",
  projectId: "device-streaming-443f3261",
  storageBucket: "device-streaming-443f3261.firebasestorage.app",
  messagingSenderId: "196498253672",
  appId: "1:196498253672:web:64d9949756993d841a18dd"
};

// Initialize Firebase (compat)
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();

async function startClient() {
  // Ensure user is signed in - try Google popup first, otherwise sign in anonymously
  let user = auth.currentUser;
  if (!user) {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      // Try popup sign-in; if blocked or user cancels, fallback to anonymous
      const result = await auth.signInWithPopup(provider).catch((err) => {
        console.warn('Google sign-in popup failed or cancelled, falling back to anonymous', err && err.message);
        return null;
      });
      if (result && result.user) {
        user = result.user;
      } else {
        const anon = await auth.signInAnonymously();
        user = anon.user;
      }
    } catch (e) {
      console.error('Sign-in failed', e);
      // proceed without auth (server will reject unauthenticated sockets)
    }
  }

  if (!user) {
    alert('Authentication required. Please enable Firebase auth or provide credentials.');
    return;
  }
  // If username present in URL, set Firebase user's displayName (so server uses it)
  if (username && username.trim()) {
    try {
      await user.updateProfile({ displayName: username.trim() });
      // refresh user object
      user = auth.currentUser;
    } catch (e) {
      console.warn('Could not update displayName', e);
    }
  }

  let token;
  try {
    token = await user.getIdToken();
  } catch (e) {
    console.error('getIdToken failed', e);
    return;
  }

  // Connect socket with token in handshake
  // Use BACKEND_URL global if set (populated after deploy), otherwise same origin
  const backend = (window.BACKEND_URL && window.BACKEND_URL.length) ? window.BACKEND_URL : undefined;
  const socket = backend ? io(backend, { auth: { token } }) : io({ auth: { token } });

  // Join chatroom once connected
  socket.on('connect', () => {
    socket.emit('joinRoom', { room });
  });

  // Get room and users
  socket.on('roomUsers', ({ room, users }) => {
    outputRoomName(room);
    outputUsers(users);
  });

  // Message from server
  socket.on('message', (message) => {
    console.log(message);
    outputMessage(message);

    // Scroll down
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });

  // Message submit
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();

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
}

startClient();

// Output message to DOM
function outputMessage(message) {
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
  document.querySelector('.chat-messages').appendChild(div);
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

//Prompt the user before leave chat room
document.getElementById('leave-btn').addEventListener('click', () => {
  const leaveRoom = confirm('Are you sure you want to leave the chatroom?');
  if (leaveRoom) {
    window.location = '../index.html';
  } else {
  }
});
