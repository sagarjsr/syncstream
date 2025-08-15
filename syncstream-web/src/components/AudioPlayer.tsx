/** HTML5 Audio wrapper for Media API as YouTubePlayer */

'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';

export interface PlayerRef {
  play: () => void;
  pause: () => void;
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number; // -1: unstarted, 0: ended, 1: playing, 2: paused, 3: buffering, 5: cued
}

interface AudioPlayerProps {
  src: string;
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onTimeUpdate?: (time: number) => void;
  onStateChange?: (state: number) => void;
  autoplay?: boolean;
  muted?: boolean;
  width?: number;
  height?: number;
  disableControls?: boolean; // Disable audio controls for participants
}

const AudioPlayer = forwardRef<PlayerRef, AudioPlayerProps>(({
  src,
  onReady,
  onPlay,
  onPause,
  onTimeUpdate,
  onStateChange,
  autoplay = false,
  muted = false,
  width = 640,
  height = 200,
  disableControls = false
}, ref) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentStateRef = useRef<number>(-1); // Track current state

  // Convert HTML5 audio states to YouTube-like states
  const getPlayerState = useCallback(() => {
    if (!audioRef.current) return -1; // unstarted
    
    const audio = audioRef.current;
    if (audio.ended) return 0; // ended
    if (!audio.paused) return 1; // playing
    if (audio.paused && audio.currentTime > 0) return 2; // paused
    if (audio.readyState < 3) return 3; // buffering
    return 5; // cued/ready
  }, []);

  const updateState = useCallback(() => {
    const newState = getPlayerState();
    if (newState !== currentStateRef.current) {
      currentStateRef.current = newState;
      onStateChange?.(newState);
    }
  }, [getPlayerState, onStateChange]);

  // Handle audio events
  const handleLoadedData = useCallback(() => {
    console.log('Audio player ready');
    onReady?.();
    updateState();
    
    // Start time update interval
    if (timeUpdateIntervalRef.current) {
      clearInterval(timeUpdateIntervalRef.current);
    }
    
    timeUpdateIntervalRef.current = setInterval(() => {
      if (audioRef.current) {
        const currentTime = audioRef.current.currentTime;
        onTimeUpdate?.(currentTime);
      }
    }, 100); // Update every 100ms for smooth sync
  }, [onReady, onTimeUpdate, updateState]);

  const handlePlay = useCallback(() => {
    onPlay?.();
    updateState();
  }, [onPlay, updateState]);

  const handlePause = useCallback(() => {
    onPause?.();
    updateState();
  }, [onPause, updateState]);

  const handleEnded = useCallback(() => {
    updateState();
  }, [updateState]);

  const handleWaiting = useCallback(() => {
    updateState();
  }, [updateState]);

  const handleCanPlay = useCallback(() => {
    updateState();
  }, [updateState]);

  const handleError = useCallback((e: Event) => {
    const error = (e.target as HTMLAudioElement)?.error;
    console.error('Audio player error:', error?.message || 'Unknown error');
  }, []);

  // Setup audio element when src changes
  useEffect(() => {
    if (!audioRef.current || !src) return;

    const audio = audioRef.current;
    
    // Set initial properties
    audio.src = src;
    audio.autoplay = autoplay;
    audio.muted = muted;
    audio.preload = 'metadata';

    // Add event listeners
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);

    return () => {
      // Clean up event listeners
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
      
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
    };
  }, [src, autoplay, muted, disableControls, handleLoadedData, handlePlay, handlePause, handleEnded, handleWaiting, handleCanPlay, handleError]);

  // Expose player methods via ref
  useImperativeHandle(ref, () => ({
    play: () => {
      audioRef.current?.play().catch(e => console.error('Play failed:', e));
    },
    pause: () => {
      audioRef.current?.pause();
    },
    seekTo: (time: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = time;
      }
    },
    getCurrentTime: () => {
      return audioRef.current?.currentTime || 0;
    },
    getDuration: () => {
      return audioRef.current?.duration || 0;
    },
    getPlayerState: getPlayerState
  }), [getPlayerState]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="audio-player-container">
      <div 
        className="audio-player-wrapper bg-gray-100 rounded-lg p-6 flex flex-col items-center justify-center"
        style={{ width, height }}
      >
        <div className="audio-info mb-4 text-center">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Audio Player</h3>
          <p className="text-sm text-gray-600 break-all">
            {src.length > 60 ? `${src.substring(0, 60)}...` : src}
          </p>
          {disableControls && (
            <p className="text-xs text-orange-600 mt-1">
              🔒 Controls disabled - Leader controls playback
            </p>
          )}
        </div>
        
        <audio
          ref={audioRef}
          controls={!disableControls}
          className="w-full max-w-md"
          style={{ 
            minWidth: Math.min(300, width - 48),
            opacity: disableControls ? 0.6 : 1 
          }}
        >
          Your browser does not support the audio element.
        </audio>
        
        <div className="audio-controls mt-4 text-xs text-gray-500">
          <p>State: {currentStateRef.current === -1 ? 'Not started' : 
                     currentStateRef.current === 0 ? 'Ended' :
                     currentStateRef.current === 1 ? 'Playing' :
                     currentStateRef.current === 2 ? 'Paused' :
                     currentStateRef.current === 3 ? 'Buffering' :
                     'Ready'}</p>
        </div>
      </div>
    </div>
  );
});

AudioPlayer.displayName = 'AudioPlayer';

export default AudioPlayer;
