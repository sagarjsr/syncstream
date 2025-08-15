/**
 * Gets the socket server URL dynamically based on the current environment
 */
export function getSocketServerUrl(): string {
  // If NEXT_PUBLIC_SOCKET_URL is set in .env, use it
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }

  // In browser, detect the current hostname
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:3001`;
  }

  // Fallback for server-side rendering
  return 'http://localhost:3001';
}
