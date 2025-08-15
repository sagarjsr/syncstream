import { io } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
  autoConnect: false,
  withCredentials: true,
  path: '/socket.io/',
  forceNew: true
});

// Debug connection issues
socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error);
});

socket.on('connect', () => {
  console.log('Socket connected successfully');
  console.log('Transport:', socket.io.engine.transport.name);
});

socket.on('reconnect_attempt', (attempt) => {
  console.log(`Socket reconnection attempt ${attempt}`);
});

socket.on('disconnect', (reason) => {
  console.log('Socket disconnected:', reason);
});

// Export for use in components
export default socket;
