// server/state.js
export const rooms = {};

export function createRoom(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      leaderId: null,
      mediaKind: null, // 'youtube' or 'mp3'
      mediaRef: null, // VIDEO_ID or MP3_URL
      isPlaying: false,
      leaderMediaTime: 0,
      leaderServerTs: 0,
      participants: {} // socketId -> { name }
    };
  }
  return rooms[roomId];
}

export function getRoom(roomId) {
  return rooms[roomId];
}

export function deleteRoom(roomId) {
  delete rooms[roomId];
}

export function addParticipant(roomId, socketId, name) {
  const room = createRoom(roomId);
  room.participants[socketId] = { name };
  
  // If this is the first participant, make them the leader
  if (!room.leaderId) {
    room.leaderId = socketId;
  }
  
  return room;
}

export function removeParticipant(roomId, socketId) {
  const room = getRoom(roomId);
  if (!room) return null;
  
  const wasLeader = room.leaderId === socketId;
  delete room.participants[socketId];
  
  // If the leader left, delete the entire room
  if (wasLeader) {
    deleteRoom(roomId);
    return null;
  }
  
  // If no participants left, delete the room
  if (Object.keys(room.participants).length === 0) {
    deleteRoom(roomId);
    return null;
  }
  
  return room;
}

export function promoteLeader(roomId, newLeaderId) {
  const room = getRoom(roomId);
  if (room && room.participants[newLeaderId]) {
    room.leaderId = newLeaderId;
    return room;
  }
  return null;
}
