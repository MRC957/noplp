// filepath: d:\Bureau\Autres\Projets_persos\GitHub\noplp\client\src\hooks\socketManager.js
import io from 'socket.io-client';

// Create a singleton socket instance that can be shared across components
let socket = null;

export const getSocket = () => {
  if (!socket) {
    const wsServer = process.env.REACT_APP_WEBSOCKET_SERVER || 'http://localhost:4001';
    
    socket = io(wsServer, {
      transports: ['websocket'],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    // Add event listeners for debugging
    socket.on('connect', () => {
      console.log('Socket connected');
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    // Add to window for global access (useful for debugging)
    window.socket = socket;
  }
  
  return socket;
};

// Dedicated socket entities with specific methods for each component type
export const controllerSocket = {
  // Navigation methods
  showIntro: () => emitEvent('show-intro'),
  showCategories: (categories) => emitEvent('show-categories', categories),
  showSongList: (data) => emitEvent('show-song-list', data),
  gotoSong: (song) => emitEvent('goto-song', song),
  
  // Lyrics control methods
  proposeLyrics: (lyrics) => emitEvent('propose-lyrics', lyrics),
  freezeLyrics: () => emitEvent('freeze-lyrics'),
  validateLyrics: () => emitEvent('validate-lyrics'),
  revealLyrics: () => emitEvent('reveal-lyrics'),
  continueLyrics: () => emitEvent('continue-lyrics'),
  
  // Lyrics data transfer
  sendLyricsData: (data) => emitEvent('lyrics-data', data),
  sendLyricsLoading: () => emitEvent('lyrics-loading'),
  sendLyricsError: (error) => emitEvent('lyrics-error', error),
  
  // Mode settings
  setPerfMode: (mode) => emitEvent('set-perf-mode', mode),
  
  // Event listeners
  onLyricsValidationResult: (callback) => {
    const socketInstance = getSocket();
    if (socketInstance) {
      socketInstance.on('lyrics-validation-result', callback);
      return true;
    }
    return false;
  },
  
  // Remove event listeners
  offLyricsValidationResult: () => {
    const socketInstance = getSocket();
    if (socketInstance) {
      socketInstance.off('lyrics-validation-result');
      return true;
    }
    return false;
  }
};

export const songSocket = {
  // Send lyrics validation results to the server (and thus to controllers)
  sendLyricsValidationResult: (songId, isCorrect) => {
    return emitEvent('lyrics-validation-result', { songId, isCorrect });
  }
};

// General emitter function used by the dedicated socket entities
export const emitEvent = (eventName, data) => {
  const socketInstance = getSocket();
  if (socketInstance) {
    if (data === undefined) {
      console.log(`Emitting ${eventName} event without data`);
      socketInstance.emit(eventName);
    } else {
      console.log(`Emitting ${eventName} event:`, data);
      socketInstance.emit(eventName, data);
    }
    return true;
  }
  console.error(`Failed to emit ${eventName} event: Socket not initialized`);
  return false;
};

export default {
  getSocket,
  controllerSocket,
  songSocket,
  emitEvent
};