/** In-memory sync engine: tracks server offset, applies drift correction */

export interface SyncState {
  serverOffset: number;
  lastSyncTime: number;
  isConnected: boolean;
  driftHistory: number[];
}

export class SyncEngine {
  private state: SyncState = {
    serverOffset: 0,
    lastSyncTime: 0,
    isConnected: false,
    driftHistory: []
  };

  private readonly DRIFT_HISTORY_SIZE = 10;
  private readonly MAX_DRIFT_MS = 150; // Target sync accuracy

  constructor() {
    this.calculateServerOffset();
  }

  /**
   * Calculate the offset between client and server time
   * Call this periodically to maintain sync accuracy
   */
  async calculateServerOffset(serverUrl?: string): Promise<void> {
    try {
      const clientStartTime = Date.now();
      
      // If serverUrl is provided, ping the server
      if (serverUrl) {
        const response = await fetch(`${serverUrl}/health`);
        const data = await response.json();
        const clientEndTime = Date.now();
        const roundTripTime = clientEndTime - clientStartTime;
        
        // Estimate server time accounting for network delay
        const serverTime = data.timestamp;
        const estimatedServerNow = serverTime + (roundTripTime / 2);
        this.state.serverOffset = estimatedServerNow - clientEndTime;
      }
      
      this.state.lastSyncTime = Date.now();
      this.state.isConnected = true;
    } catch (error) {
      console.warn('Failed to calculate server offset:', error);
      this.state.isConnected = false;
    }
  }

  /**
   * Convert local time to estimated server time
   */
  getServerTime(localTime: number = Date.now()): number {
    return localTime + this.state.serverOffset;
  }

  /**
   * Convert server time to local time
   */
  getLocalTime(serverTime: number): number {
    return serverTime - this.state.serverOffset;
  }

  /**
   * Calculate what the current media time should be based on leader's state
   */
  calculateCurrentMediaTime(
    leaderMediaTime: number,
    leaderServerTs: number,
    isPlaying: boolean
  ): number {
    if (!isPlaying) {
      return leaderMediaTime;
    }

    const currentServerTime = this.getServerTime();
    const timeSinceLeaderUpdate = (currentServerTime - leaderServerTs) / 1000;
    return leaderMediaTime + timeSinceLeaderUpdate;
  }

  /**
   * Calculate drift between expected and actual media time
   */
  calculateDrift(expectedTime: number, actualTime: number): number {
    return actualTime - expectedTime;
  }

  /**
   * Add drift measurement to history for analysis
   */
  recordDrift(drift: number): void {
    this.state.driftHistory.push(drift);
    if (this.state.driftHistory.length > this.DRIFT_HISTORY_SIZE) {
      this.state.driftHistory.shift();
    }
  }

  /**
   * Get average drift over recent measurements
   */
  getAverageDrift(): number {
    if (this.state.driftHistory.length === 0) return 0;
    
    const sum = this.state.driftHistory.reduce((acc, drift) => acc + drift, 0);
    return sum / this.state.driftHistory.length;
  }

  /**
   * Determine if drift correction is needed
   */
  shouldCorrectDrift(drift: number): boolean {
    return Math.abs(drift) > this.MAX_DRIFT_MS / 1000; // Convert to seconds
  }

  /**
   * Calculate smooth correction amount to avoid jarring jumps
   */
  calculateCorrectionAmount(drift: number): number {
    // For small drifts, correct gradually
    if (Math.abs(drift) < 0.5) {
      return drift * 0.1; // Gentle correction
    }
    
    // For larger drifts, correct more aggressively
    return drift * 0.5;
  }

  /**
   * Apply drift correction to media player
   */
  applyCorrectionIfNeeded(
    expectedTime: number, 
    actualTime: number,
    onSeek: (time: number) => void
  ): boolean {
    const drift = this.calculateDrift(expectedTime, actualTime);
    this.recordDrift(drift);

    if (this.shouldCorrectDrift(drift)) {
      const correction = this.calculateCorrectionAmount(drift);
      const correctedTime = actualTime - correction;
      onSeek(correctedTime);
      
      console.log(`Drift correction applied: ${drift.toFixed(3)}s -> seeking to ${correctedTime.toFixed(3)}s`);
      return true;
    }

    return false;
  }

  /**
   * Get sync statistics for debugging
   */
  getSyncStats(): {
    serverOffset: number;
    lastSyncTime: number;
    isConnected: boolean;
    averageDrift: number;
    driftHistory: number[];
  } {
    return {
      serverOffset: this.state.serverOffset,
      lastSyncTime: this.state.lastSyncTime,
      isConnected: this.state.isConnected,
      averageDrift: this.getAverageDrift(),
      driftHistory: [...this.state.driftHistory]
    };
  }

  /**
   * Reset drift history (call when media changes or seeking occurs)
   */
  resetDriftHistory(): void {
    this.state.driftHistory = [];
  }
}
