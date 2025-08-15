'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSyncStreamStore } from '@/lib/store';
import YouTubePlayer, { PlayerRef } from './YouTubePlayer';
import AudioPlayer from './AudioPlayer';

interface SyncStreamAppProps {
  className?: string;
}

export default function SyncStreamApp({ className }: SyncStreamAppProps) {
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [showSyncStats, setShowSyncStats] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [shareLink, setShareLink] = useState<string>('');
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  const playerRef = useRef<PlayerRef>(null);
  const leaderStateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const {
    isConnected,
    connectionError,
    room,
    syncEngine,
    connect,
    disconnect,
    joinRoom,
    leaveRoom,
    play,
    pause,
    seek,
    setMedia,
    promoteLeader,
    kickParticipant,
    generateShareLink,
    sendLeaderState,
    isJoinPending
  } = useSyncStreamStore();

  // Connect on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Handle URL parameters for direct room joining (only run once)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const joinRoomId = urlParams.get('join');
      const shareToken = urlParams.get('token');
      
      if (joinRoomId && shareToken) {
        // Auto-fill room ID
        setRoomId(joinRoomId);
      }
    }
  }, []); // Only run on mount

  // Start leader state broadcasting when becoming leader
  useEffect(() => {
    if (room.isLeader && room.roomId) {
      // Clear existing interval
      if (leaderStateIntervalRef.current) {
        clearInterval(leaderStateIntervalRef.current);
      }

      // Start broadcasting leader state every 500ms
      leaderStateIntervalRef.current = setInterval(() => {
        if (playerRef.current && isPlayerReady) {
          try {
            const currentTime = playerRef.current.getCurrentTime();
            const playerState = playerRef.current.getPlayerState();
            const isPlaying = playerState === 1; // YouTube playing state
            
            sendLeaderState(currentTime, isPlaying);
          } catch (error) {
            console.warn('Leader state broadcast error (player may not be ready):', error);
          }
        }
      }, 500);
    } else {
      // Clear interval if not leader
      if (leaderStateIntervalRef.current) {
        clearInterval(leaderStateIntervalRef.current);
        leaderStateIntervalRef.current = null;
      }
    }

    return () => {
      if (leaderStateIntervalRef.current) {
        clearInterval(leaderStateIntervalRef.current);
      }
    };
  }, [room.isLeader, room.roomId, sendLeaderState, isPlayerReady]);

  // Sync follower player with leader state
  useEffect(() => {
    if (!room.isLeader && playerRef.current && room.mediaKind && room.mediaRef && isPlayerReady) {
      const player = playerRef.current;
      
      // Add safety checks for player methods
      try {
        const playerState = player.getPlayerState();
        const actualTime = player.getCurrentTime();
        const isActuallyPlaying = playerState === 1;

        // Calculate expected time based on server state
        const expectedTime = syncEngine.calculateCurrentMediaTime(
          room.currentTime,
          Date.now(), // Approximation - should use server timestamp
          room.isPlaying
        );

        console.log('Follower sync check:', {
          isPlaying: room.isPlaying,
          expectedTime: expectedTime.toFixed(2),
          actualTime: actualTime.toFixed(2),
          playerState,
          isActuallyPlaying
        });

        // Sync play/pause state first
        if (room.isPlaying && !isActuallyPlaying && playerState !== 3) { // Not buffering
          console.log('▶️ Follower: Starting playback');
          player.play();
        } else if (!room.isPlaying && isActuallyPlaying) {
          console.log('⏸️ Follower: Pausing playback');
          player.pause();
        }

        // Apply drift correction if playing and time difference is significant
        if (room.isPlaying && isActuallyPlaying) {
          const timeDrift = Math.abs(expectedTime - actualTime);
          if (timeDrift > 0.5) { // More than 500ms drift
            console.log('🔄 Follower: Correcting drift by', timeDrift.toFixed(2), 's');
            player.seekTo(expectedTime);
            syncEngine.resetDriftHistory();
          }
        }
      } catch (error) {
        console.warn('Player sync error (player may not be ready):', error);
      }
    }
  }, [room.isPlaying, room.currentTime, room.isLeader, room.mediaKind, room.mediaRef, syncEngine, isPlayerReady]);

  const handleJoinRoom = useCallback(async (shareToken?: string) => {
    if (!roomId.trim() || !userName.trim()) return;
    
    setIsJoining(true);
    const success = await joinRoom(roomId.trim(), userName.trim(), shareToken);
    
    if (success) {
      // Clear URL parameters after successful join to prevent auto-rejoin
      if (typeof window !== 'undefined' && shareToken) {
        const url = new URL(window.location.href);
        url.searchParams.delete('join');
        url.searchParams.delete('token');
        window.history.replaceState({}, document.title, url.pathname + url.search);
      }
    } else {
      alert('Failed to join room. Please try again.');
    }
    
    setIsJoining(false);
  }, [roomId, userName, joinRoom]);

  const handleJoinRoomClick = () => {
    // Check if there's a share token in the URL
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const shareToken = urlParams.get('token');
      const joinRoomId = urlParams.get('join');
      
      // If we have a share token and the room ID matches, use it
      if (shareToken && joinRoomId && joinRoomId === roomId.trim()) {
        handleJoinRoom(shareToken);
        return;
      }
    }
    
    // Normal join without share token
    handleJoinRoom();
  };

  const handleSetMedia = () => {
    if (!mediaUrl.trim()) return;

    // Determine media type
    let mediaKind: 'youtube' | 'mp3';
    let mediaRef: string;

    if (mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be')) {
      mediaKind = 'youtube';
      // Extract video ID from URL
      const match = mediaUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
      mediaRef = match ? match[1] : mediaUrl;
    } else {
      mediaKind = 'mp3';
      mediaRef = mediaUrl;
    }

    setMedia(mediaKind, mediaRef);
    setIsPlayerReady(false); // Reset player ready state when changing media
  };

  const handlePlayerReady = useCallback(() => {
    console.log('Player ready');
    setIsPlayerReady(true);
  }, []);

  const handlePlayerPlay = useCallback(() => {
    if (room.isLeader) {
      console.log('Leader initiated play');
      play();
    }
  }, [room.isLeader, play]);

  const handlePlayerPause = useCallback(() => {
    if (room.isLeader) {
      console.log('Leader initiated pause');
      pause();
    }
  }, [room.isLeader, pause]);

  const handlePlayerTimeUpdate = useCallback(() => {
    // Only used for tracking, followers sync via useEffect
  }, []);

  const handleLeaveRoom = () => {
    if (room.isLeader) {
      const confirmed = confirm('As the leader, leaving will delete the room and kick all participants. Are you sure you want to continue?');
      if (!confirmed) {
        return;
      }
    }
    
    // Clear URL parameters to prevent auto-rejoin
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('join');
      url.searchParams.delete('token');
      window.history.replaceState({}, document.title, url.pathname + url.search);
    }
    
    leaveRoom();
    setIsPlayerReady(false);
  };

  const toggleTheme = () => {
    setIsDarkTheme(!isDarkTheme);
  };

  const handleShareRoom = async () => {
    setIsGeneratingLink(true);
    
    try {
      const link = generateShareLink();
      if (link) {
        setShareLink(link);
        
        // Copy to clipboard with proper error handling
        if (navigator.clipboard && navigator.clipboard.writeText) {
          try {
            await navigator.clipboard.writeText(link);
            alert(`✅ Share link copied to clipboard!\n\n${link}\n\nAnyone with this link can join your room directly without approval.\n\n⏰ Link expires in 24 hours.`);
          } catch (err) {
            console.error('Clipboard copy failed:', err);
            // Fallback to prompt
            const userCopied = prompt('📋 Copy this share link (Ctrl+C/Cmd+C):', link);
            if (userCopied !== null) {
              alert('📤 Share this link with others to let them join your room directly!');
            }
          }
        } else {
          // Fallback for browsers without clipboard API
          const userCopied = prompt('📋 Copy this share link (Ctrl+C/Cmd+C):', link);
          if (userCopied !== null) {
            alert('📤 Share this link with others to let them join your room directly!');
          }
        }
      } else {
        alert('❌ Failed to generate share link. Please try again.');
      }
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const participantsList = Object.entries(room.participants).map(([id, participant]) => ({
    id,
    name: participant.name,
    isLeader: id === room.leaderId
  }));

  const syncStats = syncEngine.getSyncStats();

  if (!isConnected && !connectionError) {
    return (
      <div className={`sync-stream-app min-h-screen w-full ${isDarkTheme ? 'bg-gray-900' : 'bg-gray-100'} ${className || ''}`}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${isDarkTheme ? 'border-red-600' : 'border-blue-600'} mx-auto mb-4`}></div>
            <p className={isDarkTheme ? 'text-white' : 'text-gray-800'}>Connecting to SyncStream server...</p>
          </div>
        </div>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className={`sync-stream-app min-h-screen w-full ${isDarkTheme ? 'bg-gray-900' : 'bg-gray-100'} ${className || ''}`}>
        <div className="p-6">
          <div className={`${isDarkTheme ? 'bg-red-900 border-red-600 text-white' : 'bg-red-100 border-red-400 text-red-700'} border px-4 py-3 rounded mb-4`}>
            <strong className="font-bold">Connection Error: </strong>
            <span className="block sm:inline">{connectionError}</span>
          </div>
          <button
            onClick={() => connect()}
            className={`${isDarkTheme ? 'bg-red-600 hover:bg-red-800' : 'bg-blue-600 hover:bg-blue-800'} text-white font-bold py-2 px-4 rounded`}
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`sync-stream-app min-h-screen w-full ${isDarkTheme ? 'bg-gray-900' : 'bg-gray-100'} ${className || ''}`}>
      <div className="max-w-6xl mx-auto p-6">
        {/* Theme Toggle Button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-full transition-colors ${
              isDarkTheme 
                ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' 
                : 'bg-gray-300 hover:bg-gray-400 text-gray-800'
            }`}
            title={`Switch to ${isDarkTheme ? 'light' : 'dark'} theme`}
          >
            {isDarkTheme ? '☀️' : '🌙'}
          </button>
        </div>

        <h1 className={`text-3xl font-bold text-center mb-8 ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>
          🎵 SyncStream
        </h1>

        {!room.roomId ? (
          // Join room form
          <div className={`rounded-lg shadow-md p-6 mb-6 border ${
            isDarkTheme 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-300'
          }`}>
            {/* Show share link indicator */}
            {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('token') && (
              <div className={`mb-4 p-3 rounded border ${
                isDarkTheme
                  ? 'bg-green-900 border-green-600 text-green-200'
                  : 'bg-green-100 border-green-400 text-green-700'
              }`}>
                <div className="flex items-center">
                  <span className="mr-2">🔗</span>
                  <span className="font-medium">Joining via share link</span>
                </div>
                <p className="text-sm mt-1">You can join this room directly without waiting for approval!</p>
              </div>
            )}
            
            <h2 className={`text-xl font-semibold mb-4 ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>Join a Room</h2>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkTheme ? 'text-white' : 'text-gray-700'}`}>
                  Room ID
                </label>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                    isDarkTheme
                      ? 'border-gray-600 focus:ring-red-500 text-white bg-gray-700'
                      : 'border-gray-300 focus:ring-blue-500 text-black bg-white'
                  }`}
                  placeholder="Enter room ID (e.g., ABC123)"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkTheme ? 'text-white' : 'text-gray-700'}`}>
                  Your Name
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                    isDarkTheme
                      ? 'border-gray-600 focus:ring-red-500 text-white bg-gray-700'
                      : 'border-gray-300 focus:ring-blue-500 text-black bg-white'
                  }`}
                  placeholder="Enter your name"
                />
              </div>
              <button
                onClick={handleJoinRoomClick}
                disabled={isJoining || !roomId.trim() || !userName.trim()}
                className={`w-full font-bold py-2 px-4 rounded transition-colors text-white ${
                  isDarkTheme
                    ? 'bg-red-600 hover:bg-red-800 disabled:bg-gray-600'
                    : 'bg-blue-600 hover:bg-blue-800 disabled:bg-gray-400'
                }`}
              >
                {isJoining ? 'Joining...' : 'Join Room'}
              </button>
            </div>
          </div>
        ) : (
          // Room interface
          <div className="space-y-6">
          {/* Room info */}
          <div className={`rounded-lg shadow-md p-4 border ${
            isDarkTheme 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-300'
          }`}>
            <div className="flex justify-between items-center">
              <div>
                <h2 className={`text-xl font-semibold ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>Room: {room.roomId}</h2>
                <p className={isDarkTheme ? 'text-gray-300' : 'text-gray-600'}>
                  {room.isLeader ? '👑 You are the leader' : `👑 Leader: ${room.participants[room.leaderId || '']?.name || 'Unknown'}`}
                </p>
              </div>
              <div className="flex space-x-2">
                {room.isLeader && (
                  <button
                    onClick={handleShareRoom}
                    disabled={isGeneratingLink}
                    className={`font-bold py-2 px-4 rounded text-white ${
                      isDarkTheme
                        ? 'bg-green-600 hover:bg-green-800 disabled:bg-gray-600'
                        : 'bg-green-600 hover:bg-green-800 disabled:bg-gray-400'
                    }`}
                  >
                    {isGeneratingLink ? 'Generating...' : 'Share Room'}
                  </button>
                )}
                <button
                  onClick={handleLeaveRoom}
                  className={`font-bold py-2 px-4 rounded text-white ${
                    isDarkTheme
                      ? 'bg-red-600 hover:bg-red-800'
                      : 'bg-red-500 hover:bg-red-700'
                  }`}
                >
                  Leave Room
                </button>
              </div>
            </div>
          </div>

          {/* Media controls (leader only) */}
          {room.isLeader && (
            <div className={`rounded-lg shadow-md p-4 border ${
              isDarkTheme 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-300'
            }`}>
              <h3 className={`text-lg font-semibold mb-4 ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>Media Controls (Leader)</h3>
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDarkTheme ? 'text-white' : 'text-gray-700'}`}>
                    YouTube URL or MP3 URL
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                      className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                        isDarkTheme
                          ? 'border-gray-600 focus:ring-red-500 text-white bg-gray-700'
                          : 'border-gray-300 focus:ring-blue-500 text-black bg-white'
                      }`}
                      placeholder="https://www.youtube.com/watch?v=... or https://example.com/song.mp3"
                    />
                    <button
                      onClick={handleSetMedia}
                      disabled={!mediaUrl.trim()}
                      className={`font-bold py-2 px-4 rounded text-white ${
                        isDarkTheme
                          ? 'bg-red-600 hover:bg-red-800 disabled:bg-gray-600'
                          : 'bg-green-600 hover:bg-green-800 disabled:bg-gray-400'
                      }`}
                    >
                      Load
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Media player */}
          {room.mediaKind && room.mediaRef && (
            <div className={`rounded-lg shadow-md p-4 border ${
              isDarkTheme 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-300'
            }`}>
              <h3 className={`text-lg font-semibold mb-4 ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>
                {room.mediaKind === 'youtube' ? 'YouTube Player' : 'Audio Player'}
              </h3>
              <div className="flex justify-center">
                {room.mediaKind === 'youtube' ? (
                  <YouTubePlayer
                    key={`youtube-${room.mediaRef}`}
                    ref={playerRef}
                    videoId={room.mediaRef}
                    onReady={handlePlayerReady}
                    onPlay={handlePlayerPlay}
                    onPause={handlePlayerPause}
                    onTimeUpdate={handlePlayerTimeUpdate}
                    width={640}
                    height={390}
                  />
                ) : (
                  <AudioPlayer
                    key={`audio-${room.mediaRef}`}
                    ref={playerRef}
                    src={room.mediaRef}
                    onReady={handlePlayerReady}
                    onPlay={handlePlayerPlay}
                    onPause={handlePlayerPause}
                    onTimeUpdate={handlePlayerTimeUpdate}
                    width={640}
                    height={200}
                  />
                )}
              </div>
            </div>
          )}

          {/* Participants */}
          <div className={`rounded-lg shadow-md p-4 border ${
            isDarkTheme 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-300'
          }`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>
              Participants ({participantsList.length})
            </h3>
            <div className="space-y-2">
              {participantsList.map((participant) => (
                <div
                  key={participant.id}
                  className={`flex justify-between items-center p-2 rounded border ${
                    isDarkTheme
                      ? 'bg-gray-700 border-gray-600'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <span className={`flex items-center ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>
                    {participant.isLeader && '👑 '}
                    {participant.name}
                    {participant.id === room.participantId && ' (You)'}
                  </span>
                  {room.isLeader && !participant.isLeader && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => promoteLeader(participant.id)}
                        className={`text-sm font-bold py-1 px-2 rounded text-white ${
                          isDarkTheme
                            ? 'bg-blue-600 hover:bg-blue-800'
                            : 'bg-blue-600 hover:bg-blue-800'
                        }`}
                      >
                        Make Leader
                      </button>
                      <button
                        onClick={() => kickParticipant(participant.id)}
                        className={`text-sm font-bold py-1 px-2 rounded text-white ${
                          isDarkTheme
                            ? 'bg-red-600 hover:bg-red-800'
                            : 'bg-red-600 hover:bg-red-800'
                        }`}
                      >
                        Kick
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Sync statistics */}
          <div className={`rounded-lg shadow-md p-4 border ${
            isDarkTheme 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-300'
          }`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-lg font-semibold ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>Sync Statistics</h3>
              <button
                onClick={() => setShowSyncStats(!showSyncStats)}
                className={`text-sm ${
                  isDarkTheme
                    ? 'text-red-500 hover:text-red-400'
                    : 'text-blue-500 hover:text-blue-700'
                }`}
              >
                {showSyncStats ? 'Hide' : 'Show'} Details
              </button>
            </div>
            {showSyncStats && (
              <div className={`space-y-2 text-sm font-mono ${
                isDarkTheme ? 'text-gray-300' : 'text-gray-600'
              }`}>
                <p>Server Offset: {syncStats.serverOffset.toFixed(2)}ms</p>
                <p>Connected: {syncStats.isConnected ? '✅' : '❌'}</p>
                <p>Average Drift: {syncStats.averageDrift.toFixed(3)}s</p>
                <p>Last Sync: {new Date(syncStats.lastSyncTime).toLocaleTimeString()}</p>
                <p>Drift History: [{syncStats.driftHistory.map(d => d.toFixed(3)).join(', ')}]</p>
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
