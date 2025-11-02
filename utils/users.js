const users = [];

// Join user to chat
function userJoin( socid, id, username, room) {
  let user = users.find(user => user.id === id);
  if (user) {
    return null;
  } else {
    user = { socid, id, username, room }
    users.push(user);
  }
  
  return user;
}

// Get current user
function getCurrentUser(socid) {
  return users.find(user => user.socid === socid);
}

// User leaves chat
function userLeave(socid) {
  const index = users.findIndex(user => user.socid === socid);

  if (index !== -1) {
    return users.splice(index, 1)[0];
  }
}

var test = function(user) {
  return user.id=id
}

// Get room users
function getRoomUsers(room) {
  return users.filter(user => user.room === room);
}

export {
  userJoin,
  getCurrentUser,
  userLeave,
  getRoomUsers
};
