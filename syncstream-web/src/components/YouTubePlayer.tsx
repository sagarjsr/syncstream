/** React wrapper for YouTube IFrame Player API with play/pause/seek */

'use client';

import { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';

// YouTube Player interface
interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
}

// YouTube API interface
interface YTEvent {
  data: number;
}

interface YTPlayerConfig {
  width: number;
  height: number;
  videoId: string;
  playerVars: Record<string, number>;
  events: {
    onReady: () => void;
    onStateChange: (event: YTEvent) => void;
    onError: (event: YTEvent) => void;
  };
}

declare global {
  interface Window {
    YT: {
      Player: new (element: HTMLElement | string, config: YTPlayerConfig) => YTPlayer;
      PlayerState: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

export interface PlayerRef {
  play: () => void;
  pause: () => void;
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
}

interface YouTubePlayerProps {
  videoId: string;
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onTimeUpdate?: (time: number) => void;
  onStateChange?: (state: number) => void;
  autoplay?: boolean;
  muted?: boolean;
  width?: number;
  height?: number;
}

const YouTubePlayer = forwardRef<PlayerRef, YouTubePlayerProps>(({
  videoId,
  onReady,
  onPlay,
  onPause,
  onTimeUpdate,
  onStateChange,
  autoplay = false,
  muted = false,
  width = 640,
  height = 390
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isAPIReady, setIsAPIReady] = useState(false);

  // Memoize callbacks to prevent unnecessary re-renders
  const handleReady = useCallback(() => {
    console.log('YouTube player ready');
    onReady?.();
    
    // Start time update interval
    if (timeUpdateIntervalRef.current) {
      clearInterval(timeUpdateIntervalRef.current);
    }
    
    timeUpdateIntervalRef.current = setInterval(() => {
      if (playerRef.current) {
        const currentTime = playerRef.current.getCurrentTime();
        onTimeUpdate?.(currentTime);
      }
    }, 100); // Update every 100ms for smooth sync
  }, [onReady, onTimeUpdate]);

  const handleStateChange = useCallback((event: YTEvent) => {
    const state = event.data;
    onStateChange?.(state);
    
    // YT.PlayerState constants: PLAYING = 1, PAUSED = 2
    if (state === 1) {
      onPlay?.();
    } else if (state === 2) {
      onPause?.();
    }
  }, [onStateChange, onPlay, onPause]);

  const handleError = useCallback((event: YTEvent) => {
    console.error('YouTube player error:', event.data);
  }, []);

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT) {
      setIsAPIReady(true);
      return;
    }

    // Load the API script
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.head.appendChild(script);

    // Set up the ready callback
    window.onYouTubeIframeAPIReady = () => {
      setIsAPIReady(true);
    };

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  // Initialize player when API is ready and videoId changes
  useEffect(() => {
    if (!isAPIReady || !videoId || !containerRef.current) return;

    // Destroy existing player
    if (playerRef.current) {
      playerRef.current.destroy();
    }

    // Create new player
    playerRef.current = new window.YT.Player(containerRef.current, {
      width,
      height,
      videoId,
      playerVars: {
        autoplay: autoplay ? 1 : 0,
        mute: muted ? 1 : 0,
        controls: 1,
        disablekb: 0,
        fs: 1,
        modestbranding: 1,
        playsinline: 1,
        rel: 0
      },
      events: {
        onReady: handleReady,
        onStateChange: handleStateChange,
        onError: handleError
      }
    });

    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, [isAPIReady, videoId, width, height, autoplay, muted, handleReady, handleStateChange, handleError]);

  // Expose player methods via ref
  useImperativeHandle(ref, () => ({
    play: () => {
      playerRef.current?.playVideo();
    },
    pause: () => {
      playerRef.current?.pauseVideo();
    },
    seekTo: (time: number) => {
      playerRef.current?.seekTo(time, true);
    },
    getCurrentTime: () => {
      return playerRef.current?.getCurrentTime() || 0;
    },
    getDuration: () => {
      return playerRef.current?.getDuration() || 0;
    },
    getPlayerState: () => {
      return playerRef.current?.getPlayerState() || -1;
    }
  }), []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, []);

  return (
    <div className="youtube-player-container">
      <div 
        ref={containerRef}
        className="youtube-player"
        style={{ width, height }}
      />
      {!isAPIReady && (
        <div 
          className="loading-placeholder bg-gray-200 flex items-center justify-center text-gray-600"
          style={{ width, height }}
        >
          Loading YouTube player...
        </div>
      )}
    </div>
  );
});

YouTubePlayer.displayName = 'YouTubePlayer';

export default YouTubePlayer;
