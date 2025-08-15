import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { SyncEngine } from './syncEngine';

export interface Participant {
  id: string;
  name: string;
}

export interface RoomState {
  roomId: string | null;
  participantId: string | null;
  participants: Record<string, { name: string }>;
  leaderId: string | null;
  isLeader: boolean;
  mediaKind: 'youtube' | 'mp3' | null;
  mediaRef: string | null;
  isPlaying: boolean;
  currentTime: number;
}

export interface SyncStreamStore {
  // Connection state
  socket: Socket | null;
  isConnected: boolean;
  connectionError: string | null;
  
  // Join state
  isJoinPending: boolean;
  
  // Room state
  room: RoomState;
  
  // Sync engine
  syncEngine: SyncEngine;
  
  // Actions
  connect: (serverUrl?: string) => void;
  disconnect: () => void;
  joinRoom: (roomId: string, name: string, shareToken?: string) => Promise<boolean>;
  leaveRoom: () => void;
  
  // Media controls (leader only)
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setMedia: (kind: 'youtube' | 'mp3', ref: string) => void;
  
  // Leader management
  promoteLeader: (participantId: string) => void;
  kickParticipant: (participantId: string) => void;
  generateShareLink: () => string;
  
  // Participant approval
  approveParticipant: (requestId: string) => void;
  rejectParticipant: (requestId: string) => void;
  
  // Sync methods
  sendLeaderState: (mediaTime: number, isPlaying: boolean) => void;
  requestSnapshot: () => void;
}

const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

interface JoinRoomResponse {
  error?: string;
  participantId: string;
  isLeader: boolean;
  roomState: {
    mediaKind: 'youtube' | 'mp3' | null;
    mediaRef: string | null;
    isPlaying: boolean;
    leaderMediaTime: number;
    leaderServerTs: number;
  };
}

export const useSyncStreamStore = create<SyncStreamStore>((set, get) => ({
  // Initial state
  socket: null,
  isConnected: false,
  connectionError: null,
  isJoinPending: false,
  
  room: {
    roomId: null,
    participantId: null,
    participants: {},
    leaderId: null,
    isLeader: false,
    mediaKind: null,
    mediaRef: null,
    isPlaying: false,
    currentTime: 0,
  },
  
  syncEngine: new SyncEngine(),

  // Connect to the server
  connect: (serverUrl = SOCKET_SERVER_URL) => {
    const socket = io(serverUrl);
    
    socket.on('connect', () => {
      console.log('Connected to SyncStream server');
      set({ 
        socket, 
        isConnected: true, 
        connectionError: null 
      });
      
      // Calculate server offset for sync
      get().syncEngine.calculateServerOffset(serverUrl);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from SyncStream server');
      set({ 
        isConnected: false,
        room: {
          ...get().room,
          roomId: null,
          participantId: null,
          participants: {},
          leaderId: null,
          isLeader: false
        }
      });
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      set({ 
        connectionError: error.message,
        isConnected: false 
      });
    });

    // Room events
    socket.on('participant_joined', ({ name, participants }) => {
      set(state => ({
        room: {
          ...state.room,
          participants
        }
      }));
      console.log(`${name} joined the room`);
    });

    socket.on('participant_left', ({ participantId, participants, newLeaderId }) => {
      set(state => ({
        room: {
          ...state.room,
          participants,
          leaderId: newLeaderId,
          isLeader: newLeaderId === state.room.participantId
        }
      }));
      console.log(`Participant ${participantId} left the room`);
    });

    socket.on('leader_changed', ({ newLeaderId, participants }) => {
      set(state => ({
        room: {
          ...state.room,
          leaderId: newLeaderId,
          isLeader: newLeaderId === state.room.participantId,
          participants
        }
      }));
      console.log(`Leadership changed to ${newLeaderId}`);
    });

    socket.on('room_closed', ({ reason }) => {
      console.log(`Room closed: ${reason}`);
      
      if (reason === 'Leader left the room') {
        const confirmed = confirm(`${reason}. The room will be deleted and all participants will be removed. Click OK to confirm.`);
        if (confirmed) {
          // Reset room state
          set(state => ({
            room: {
              ...state.room,
              roomId: null,
              participantId: null,
              participants: {},
              leaderId: null,
              isLeader: false,
              mediaKind: null,
              mediaRef: null,
              isPlaying: false,
              currentTime: 0,
            }
          }));
        } else {
          // If user cancels, still reset the room state since the room is already closed on server
          set(state => ({
            room: {
              ...state.room,
              roomId: null,
              participantId: null,
              participants: {},
              leaderId: null,
              isLeader: false,
              mediaKind: null,
              mediaRef: null,
              isPlaying: false,
              currentTime: 0,
            }
          }));
        }
      } else {
        alert(`Room closed: ${reason}`);
        // Reset room state
        set(state => ({
          room: {
            ...state.room,
            roomId: null,
            participantId: null,
            participants: {},
            leaderId: null,
            isLeader: false,
            mediaKind: null,
            mediaRef: null,
            isPlaying: false,
            currentTime: 0,
          }
        }));
      }
    });

    socket.on('participant_kicked', ({ reason }) => {
      console.log(`You have been kicked from the room: ${reason}`);
      
      // Show a more prominent notification for the kicked participant
      alert(`🚫 You have been removed from the room by the leader.\n\nYou will be returned to the main page.`);
      
      // Reset room state
      set(state => ({
        room: {
          ...state.room,
          roomId: null,
          participantId: null,
          participants: {},
          leaderId: null,
          isLeader: false,
          mediaKind: null,
          mediaRef: null,
          isPlaying: false,
          currentTime: 0,
        }
      }));
    });

    socket.on('participant_kicked_notification', ({ participantName, kickedBy }) => {
      console.log(`${participantName} was kicked from the room by ${kickedBy}`);
      
      // Show notification to remaining participants
      const message = `${participantName} was removed from the room by the leader.`;
      
      // Create a temporary notification element
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 12px 16px;
        border-radius: 6px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        max-width: 300px;
      `;
      notification.textContent = message;
      
      document.body.appendChild(notification);
      
      // Remove notification after 5 seconds
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 5000);
    });

    socket.on('participant_join_request', ({ requestId, participantName }) => {
      const { room } = get();
      if (!room.isLeader) return;
      
      const confirmed = confirm(`${participantName} wants to join the room. Do you want to approve this request?`);
      if (confirmed) {
        get().approveParticipant(requestId);
      } else {
        get().rejectParticipant(requestId);
      }
    });

    // Sync events
    socket.on('sync_state', ({ leaderMediaTime, leaderServerTs, isPlaying, mediaKind, mediaRef }) => {
      const currentTime = get().syncEngine.calculateCurrentMediaTime(
        leaderMediaTime,
        leaderServerTs,
        isPlaying
      );

      set(state => ({
        room: {
          ...state.room,
          mediaKind: mediaKind || state.room.mediaKind,
          mediaRef: mediaRef || state.room.mediaRef,
          isPlaying,
          currentTime
        }
      }));
    });

    socket.on('control_update', ({ type, toTime, leaderMediaTime, leaderServerTs, isPlaying }) => {
      console.log('📨 Received control_update:', { type, isPlaying, toTime });
      
      let currentTime = get().room.currentTime;
      
      if (type === 'SEEK' && typeof toTime === 'number') {
        currentTime = toTime;
        get().syncEngine.resetDriftHistory(); // Reset drift tracking after seek
      } else {
        currentTime = get().syncEngine.calculateCurrentMediaTime(
          leaderMediaTime,
          leaderServerTs,
          isPlaying
        );
      }

      set(state => ({
        room: {
          ...state.room,
          isPlaying,
          currentTime
        }
      }));

      console.log(`Control update processed: ${type}`, { isPlaying, currentTime });
    });

    socket.on('snapshot_response', ({ mediaKind, mediaRef, isPlaying, leaderMediaTime, leaderServerTs, leaderId, participants }) => {
      const currentTime = get().syncEngine.calculateCurrentMediaTime(
        leaderMediaTime,
        leaderServerTs,
        isPlaying
      );

      set(state => ({
        room: {
          ...state.room,
          mediaKind,
          mediaRef,
          isPlaying,
          currentTime,
          leaderId,
          isLeader: leaderId === state.room.participantId,
          participants
        }
      }));

      console.log('Received room snapshot for resync');
    });

    set({ socket });
  },

  // Disconnect from server
  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ 
        socket: null, 
        isConnected: false,
        room: {
          roomId: null,
          participantId: null,
          participants: {},
          leaderId: null,
          isLeader: false,
          mediaKind: null,
          mediaRef: null,
          isPlaying: false,
          currentTime: 0,
        }
      });
    }
  },

  // Join a room
  joinRoom: async (roomId: string, name: string, shareToken?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const { socket } = get();
      if (!socket) {
        resolve(false);
        return;
      }

      // Set a timeout for join requests (30 seconds)
      const timeout = setTimeout(() => {
        console.log('Join request timed out');
        resolve(false);
      }, 30000);

      socket.emit('join_room', { roomId, name, shareToken }, (response: JoinRoomResponse) => {
        clearTimeout(timeout);
        
        if (response.error) {
          console.error('Failed to join room:', response.error);
          if (response.error.includes('rejected')) {
            alert('Your join request was rejected by the room leader.');
          } else if (response.error.includes('Failed to join room')) {
            alert('Failed to join room. Please try again.');
          }
          resolve(false);
          return;
        }

        set(state => ({
          room: {
            ...state.room,
            roomId,
            participantId: response.participantId,
            isLeader: response.isLeader,
            leaderId: response.isLeader ? response.participantId : state.room.leaderId,
            mediaKind: response.roomState.mediaKind,
            mediaRef: response.roomState.mediaRef,
            isPlaying: response.roomState.isPlaying,
            currentTime: response.roomState.leaderMediaTime || 0
          }
        }));

        console.log(`Joined room ${roomId} as ${name}`);
        resolve(true);
      });
    });
  },

  // Leave current room
  leaveRoom: () => {
    const { socket, room } = get();
    if (!socket || !room.roomId) return;

    if (room.isLeader) {
      // Leader leaving - trigger room deletion
      socket.emit('leader_leave_room', { roomId: room.roomId });
    } else {
      // Regular participant leaving
      socket.disconnect();
      socket.connect(); // Reconnect but don't rejoin room
    }
    
    set(state => ({
      room: {
        ...state.room,
        roomId: null,
        participantId: null,
        participants: {},
        leaderId: null,
        isLeader: false,
        mediaKind: null,
        mediaRef: null,
        isPlaying: false,
        currentTime: 0,
      }
    }));
  },

  // Media controls (leader only)
  play: () => {
    const { socket, room } = get();
    if (!socket || !room.isLeader || !room.roomId) return;

    console.log('🎵 Leader sending PLAY command');
    socket.emit('control', {
      roomId: room.roomId,
      type: 'PLAY'
    });
  },

  pause: () => {
    const { socket, room } = get();
    if (!socket || !room.isLeader || !room.roomId) return;

    console.log('⏸️ Leader sending PAUSE command');
    socket.emit('control', {
      roomId: room.roomId,
      type: 'PAUSE'
    });
  },

  seek: (time: number) => {
    const { socket, room } = get();
    if (!socket || !room.isLeader || !room.roomId) return;

    socket.emit('control', {
      roomId: room.roomId,
      type: 'SEEK',
      toTime: time
    });

    get().syncEngine.resetDriftHistory();
  },

  setMedia: (kind: 'youtube' | 'mp3', ref: string) => {
    set(state => ({
      room: {
        ...state.room,
        mediaKind: kind,
        mediaRef: ref,
        currentTime: 0,
        isPlaying: false
      }
    }));

    get().syncEngine.resetDriftHistory();
  },

  // Promote a participant to leader
  promoteLeader: (participantId: string) => {
    const { socket, room } = get();
    if (!socket || !room.isLeader || !room.roomId) return;

    socket.emit('promote_leader', {
      roomId: room.roomId,
      participantId
    });
  },

  // Kick a participant from the room
  kickParticipant: (participantId: string) => {
    const { socket, room } = get();
    if (!socket || !room.isLeader || !room.roomId) return;

    const participantName = room.participants[participantId]?.name || 'Unknown';
    const confirmed = confirm(`Are you sure you want to kick ${participantName} from the room?`);
    
    if (confirmed) {
      socket.emit('kick_participant', {
        roomId: room.roomId,
        participantId
      });
    }
  },

  // Generate a shareable direct join link
  generateShareLink: () => {
    const { room, socket } = get();
    if (!room.isLeader || !room.roomId || !socket) return '';

    // Generate a share token for this room
    const shareToken = `${room.roomId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Request the server to create a share token
    socket.emit('create_share_token', {
      roomId: room.roomId,
      shareToken
    });

    // Create the shareable URL
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/?join=${room.roomId}&token=${shareToken}`;
  },

  // Approve participant join request
  approveParticipant: (requestId: string) => {
    const { socket, room } = get();
    if (!socket || !room.isLeader || !room.roomId) return;

    socket.emit('approve_participant', {
      roomId: room.roomId,
      requestId
    });
  },

  // Reject participant join request
  rejectParticipant: (requestId: string) => {
    const { socket, room } = get();
    if (!socket || !room.isLeader || !room.roomId) return;

    socket.emit('reject_participant', {
      roomId: room.roomId,
      requestId
    });
  },

  // Send leader state (called periodically by leader)
  sendLeaderState: (mediaTime: number, isPlaying: boolean) => {
    const { socket, room } = get();
    if (!socket || !room.isLeader || !room.roomId) return;

    socket.emit('leader_state', {
      roomId: room.roomId,
      mediaTime,
      serverOffset: get().syncEngine.getSyncStats().serverOffset,
      isPlaying,
      mediaKind: room.mediaKind,
      mediaRef: room.mediaRef
    });
  },

  // Request room snapshot for resync
  requestSnapshot: () => {
    const { socket, room } = get();
    if (!socket || !room.roomId) return;

    socket.emit('snapshot_request', {
      roomId: room.roomId
    });
  }
}));
