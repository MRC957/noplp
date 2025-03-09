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

    // Add to window for global access (useful for debugging and functional components)
    window.socket = socket;
  }
  
  return socket;
};

export const emitEvent = (eventName, data) => {
  const socketInstance = getSocket();
  if (socketInstance) {
    console.log(`Emitting ${eventName} event with data:`, data);
    socketInstance.emit(eventName, data);
    return true;
  }
  console.error(`Failed to emit ${eventName} event: Socket not initialized`);
  return false;
};

export default {
  getSocket,
  emitEvent
};