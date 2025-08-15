/** Socket.IO server with rooms in memory; no database.
 * - Create room on first join
 * - Store participants in memory
 * - Only leader can send leader_state
 * - Promote new leader on disconnect
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { 
  createRoom, 
  getRoom, 
  addParticipant, 
  removeParticipant, 
  promoteLeader,
  deleteRoom 
} from './state.js';

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins, location-independent
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"] // Explicitly allow both transports
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Join room event
  socket.on('join_room', ({ roomId, name, shareToken }, callback) => {
    try {
      const existingRoom = getRoom(roomId);
      
      // If room exists and has a leader (not first participant)
      if (existingRoom && existingRoom.leaderId) {
        
        // Check if user has a valid share token
        if (shareToken && existingRoom.shareTokens && existingRoom.shareTokens[shareToken]) {
          const tokenData = existingRoom.shareTokens[shareToken];
          
          // Check if token is still valid
          if (Date.now() < tokenData.expiresAt) {
            // Valid token - allow direct join
            console.log(`${name} (${socket.id}) joining room ${roomId} with valid share token`);
            
            socket.join(roomId);
            const room = addParticipant(roomId, socket.id, name);
            
            // Send acknowledgment with participant info
            callback({ 
              participantId: socket.id,
              isLeader: false, // They can't be leader when using share token
              roomState: {
                mediaKind: room.mediaKind,
                mediaRef: room.mediaRef,
                isPlaying: room.isPlaying,
                leaderMediaTime: room.leaderMediaTime,
                leaderServerTs: room.leaderServerTs
              }
            });

            // Notify other participants about the new joiner
            socket.to(roomId).emit('participant_joined', {
              participantId: socket.id,
              name: name,
              participants: room.participants
            });

            console.log(`${name} (${socket.id}) joined room ${roomId} via share link`);
            return;
          } else {
            // Token expired
            delete existingRoom.shareTokens[shareToken];
            callback({ error: 'Share link has expired. Please request a new one from the room leader.' });
            return;
          }
        }
        
        // No valid share token - require approval
        const requestId = `${socket.id}_${Date.now()}`;
        
        // Store pending request
        if (!existingRoom.pendingRequests) {
          existingRoom.pendingRequests = {};
        }
        existingRoom.pendingRequests[requestId] = {
          socketId: socket.id,
          name: name,
          timestamp: Date.now()
        };
        
        // Send approval request to leader
        socket.to(existingRoom.leaderId).emit('participant_join_request', {
          requestId: requestId,
          participantName: name
        });
        
        // Store the callback for later use when approved/rejected
        socket.joinCallback = callback;
        socket.pendingRoomId = roomId;
        socket.pendingName = name;
        
        console.log(`${name} (${socket.id}) requested to join room ${roomId}, waiting for leader approval`);
        return;
      }
      
      // If no existing room or no leader, join directly (first participant)
      socket.join(roomId);
      const room = addParticipant(roomId, socket.id, name);
      
      // Send acknowledgment with participant info
      callback({ 
        participantId: socket.id,
        isLeader: room.leaderId === socket.id,
        roomState: {
          mediaKind: room.mediaKind,
          mediaRef: room.mediaRef,
          isPlaying: room.isPlaying,
          leaderMediaTime: room.leaderMediaTime,
          leaderServerTs: room.leaderServerTs
        }
      });

      // Notify other participants about the new joiner
      socket.to(roomId).emit('participant_joined', {
        participantId: socket.id,
        name: name,
        participants: room.participants
      });

      console.log(`${name} (${socket.id}) joined room ${roomId}`);
    } catch (error) {
      callback({ error: 'Failed to join room' });
    }
  });

  // Leader state broadcast (only leaders can send this)
  socket.on('leader_state', ({ roomId, mediaTime, serverOffset, isPlaying, mediaKind, mediaRef }) => {
    const room = getRoom(roomId);
    if (!room || room.leaderId !== socket.id) {
      return; // Only leader can send state updates
    }

    // Update room state
    room.leaderMediaTime = mediaTime;
    room.leaderServerTs = Date.now();
    room.isPlaying = isPlaying;
    if (mediaKind) room.mediaKind = mediaKind;
    if (mediaRef) room.mediaRef = mediaRef;

    // Broadcast to all other participants in the room
    socket.to(roomId).emit('sync_state', {
      leaderMediaTime: mediaTime,
      leaderServerTs: room.leaderServerTs,
      isPlaying: isPlaying,
      mediaKind: room.mediaKind,
      mediaRef: room.mediaRef
    });
  });

  // Control events (play, pause, seek)
  socket.on('control', ({ roomId, type, toTime }) => {
    const room = getRoom(roomId);
    if (!room || room.leaderId !== socket.id) {
      return; // Only leader can send control commands
    }

    // Update room state based on control type
    switch (type) {
      case 'PLAY':
        room.isPlaying = true;
        room.leaderServerTs = Date.now();
        break;
      case 'PAUSE':
        room.isPlaying = false;
        room.leaderServerTs = Date.now();
        break;
      case 'SEEK':
        if (typeof toTime === 'number') {
          room.leaderMediaTime = toTime;
          room.leaderServerTs = Date.now();
        }
        break;
    }

    // Broadcast control command to all participants in the room
    io.to(roomId).emit('control_update', {
      type,
      toTime,
      leaderMediaTime: room.leaderMediaTime,
      leaderServerTs: room.leaderServerTs,
      isPlaying: room.isPlaying
    });

    console.log(`Control command ${type} from ${socket.id} in room ${roomId}`);
  });

  // Promote leader
  socket.on('promote_leader', ({ roomId, participantId }) => {
    const room = getRoom(roomId);
    if (!room || room.leaderId !== socket.id) {
      return; // Only current leader can promote someone else
    }

    const updatedRoom = promoteLeader(roomId, participantId);
    if (updatedRoom) {
      io.to(roomId).emit('leader_changed', {
        newLeaderId: participantId,
        participants: updatedRoom.participants
      });
      console.log(`Leadership promoted to ${participantId} in room ${roomId}`);
    }
  });

  // Kick participant from room
  socket.on('kick_participant', ({ roomId, participantId }) => {
    const room = getRoom(roomId);
    if (!room || room.leaderId !== socket.id) {
      return; // Only leader can kick participants
    }

    // Can't kick yourself (the leader)
    if (participantId === socket.id) {
      return;
    }

    const participantSocket = io.sockets.sockets.get(participantId);
    const participantName = room.participants[participantId]?.name || 'Unknown';
    
    if (participantSocket) {
      // Notify the kicked participant
      participantSocket.emit('participant_kicked', {
        reason: 'Removed by room leader'
      });
      
      // Remove them from the room
      participantSocket.leave(roomId);
    }

    // Remove participant from room state
    const updatedRoom = removeParticipant(roomId, participantId);
    
    if (updatedRoom) {
      // Notify other participants about the removal
      socket.to(roomId).emit('participant_left', {
        participantId: participantId,
        participants: updatedRoom.participants,
        newLeaderId: updatedRoom.leaderId,
        reason: 'kicked',
        kickedParticipantName: participantName
      });
      
      // Also send a specific notification about the kick
      socket.to(roomId).emit('participant_kicked_notification', {
        participantId: participantId,
        participantName: participantName,
        kickedBy: 'leader'
      });
    }

    console.log(`${participantName} (${participantId}) was kicked from room ${roomId} by leader ${socket.id}`);
  });

  // Create share token for direct room access
  socket.on('create_share_token', ({ roomId, shareToken }) => {
    const room = getRoom(roomId);
    if (!room || room.leaderId !== socket.id) {
      return; // Only leader can create share tokens
    }

    // Store share tokens with expiration (24 hours)
    if (!room.shareTokens) {
      room.shareTokens = {};
    }
    
    room.shareTokens[shareToken] = {
      createdAt: Date.now(),
      createdBy: socket.id,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };

    console.log(`Share token ${shareToken} created for room ${roomId} by leader ${socket.id}`);
  });

  // Approve participant join request
  socket.on('approve_participant', ({ roomId, requestId }) => {
    const room = getRoom(roomId);
    if (!room || room.leaderId !== socket.id || !room.pendingRequests) {
      return; // Only leader can approve requests
    }

    const request = room.pendingRequests[requestId];
    if (!request) {
      return; // Request not found or already processed
    }

    const participantSocket = io.sockets.sockets.get(request.socketId);
    if (!participantSocket || !participantSocket.joinCallback) {
      // Clean up the request
      delete room.pendingRequests[requestId];
      return;
    }

    try {
      // Add participant to room
      participantSocket.join(roomId);
      addParticipant(roomId, request.socketId, request.name);
      
      // Send acknowledgment to the new participant
      participantSocket.joinCallback({ 
        participantId: request.socketId,
        isLeader: false, // They can't be leader since they're joining existing room
        roomState: {
          mediaKind: room.mediaKind,
          mediaRef: room.mediaRef,
          isPlaying: room.isPlaying,
          leaderMediaTime: room.leaderMediaTime,
          leaderServerTs: room.leaderServerTs
        }
      });

      // Notify other participants about the new joiner
      participantSocket.to(roomId).emit('participant_joined', {
        participantId: request.socketId,
        name: request.name,
        participants: room.participants
      });

      // Clean up request and socket data
      delete room.pendingRequests[requestId];
      delete participantSocket.joinCallback;
      delete participantSocket.pendingRoomId;
      delete participantSocket.pendingName;

      console.log(`${request.name} (${request.socketId}) approved and joined room ${roomId}`);
    } catch (error) {
      console.error('Error approving participant:', error);
      participantSocket.joinCallback({ error: 'Failed to join room' });
    }
  });

  // Reject participant join request
  socket.on('reject_participant', ({ roomId, requestId }) => {
    const room = getRoom(roomId);
    if (!room || room.leaderId !== socket.id || !room.pendingRequests) {
      return; // Only leader can reject requests
    }

    const request = room.pendingRequests[requestId];
    if (!request) {
      return; // Request not found or already processed
    }

    const participantSocket = io.sockets.sockets.get(request.socketId);
    if (participantSocket && participantSocket.joinCallback) {
      participantSocket.joinCallback({ error: 'Join request was rejected by the room leader' });
      
      // Clean up socket data
      delete participantSocket.joinCallback;
      delete participantSocket.pendingRoomId;
      delete participantSocket.pendingName;
    }

    // Clean up the request
    delete room.pendingRequests[requestId];

    console.log(`${request.name} (${request.socketId}) rejected from room ${roomId}`);
  });

  // Leader leave room (with room deletion)
  socket.on('leader_leave_room', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room || room.leaderId !== socket.id) {
      return; // Only leader can trigger room deletion
    }

    console.log(`Leader ${socket.id} is leaving and deleting room ${roomId}`);
    
    // Notify all participants (including leader) that room is being closed
    io.to(roomId).emit('room_closed', {
      reason: 'Leader left the room'
    });

    // Remove the room completely
    deleteRoom(roomId);
    
    // Disconnect all participants from the room
    const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
    if (socketsInRoom) {
      socketsInRoom.forEach(socketId => {
        const participantSocket = io.sockets.sockets.get(socketId);
        if (participantSocket) {
          participantSocket.leave(roomId);
        }
      });
    }

    console.log(`Room ${roomId} deleted by leader`);
  });

  // Snapshot request (for resync after lag)
  socket.on('snapshot_request', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return;

    socket.emit('snapshot_response', {
      mediaKind: room.mediaKind,
      mediaRef: room.mediaRef,
      isPlaying: room.isPlaying,
      leaderMediaTime: room.leaderMediaTime,
      leaderServerTs: room.leaderServerTs,
      leaderId: room.leaderId,
      participants: room.participants
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    
    // Find which rooms this socket was in and clean up
    const rooms = socket.rooms;
    rooms.forEach(roomId => {
      if (roomId !== socket.id) { // Skip the socket's own room
        const room = getRoom(roomId);
        const wasLeader = room && room.leaderId === socket.id;
        
        const updatedRoom = removeParticipant(roomId, socket.id);
        
        if (!updatedRoom) {
          // Room was deleted (either leader left or no participants left)
          if (wasLeader) {
            console.log(`Room ${roomId} deleted - leader left`);
            // Notify all participants that the room is closed
            socket.to(roomId).emit('room_closed', {
              reason: 'Leader left the room'
            });
          } else {
            console.log(`Room ${roomId} deleted - no participants left`);
          }
        } else {
          // Room still exists, notify remaining participants
          socket.to(roomId).emit('participant_left', {
            participantId: socket.id,
            participants: updatedRoom.participants,
            newLeaderId: updatedRoom.leaderId
          });

          // If leadership changed, notify about new leader
          if (updatedRoom.leaderId && updatedRoom.leaderId !== socket.id) {
            socket.to(roomId).emit('leader_changed', {
              newLeaderId: updatedRoom.leaderId,
              participants: updatedRoom.participants
            });
          }
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`SyncStream server running on port ${PORT}`);
  console.log(`Local access: http://localhost:${PORT}`);
  console.log(`Network access: http://192.168.1.2:${PORT}`);
});
