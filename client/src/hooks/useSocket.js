import { useEffect, useState } from 'react';
import io from 'socket.io-client';

export const useSocket = () => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Get the WebSocket server URL from environment variables, fallback to default
    const wsServer = process.env.REACT_APP_WEBSOCKET_SERVER || 'http://localhost:4001';
    
    // Create socket connection with reconnection options
    const socketConnection = io(wsServer, {
      transports: ['websocket'],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    // Handle connection events
    socketConnection.on('connect', () => {
      console.log('Connected to WebSocket server');
    });

    socketConnection.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
    });

    socketConnection.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    socketConnection.on('error', (error) => {
      console.error('Socket error:', error);
    });

    // Save socket instance to state
    setSocket(socketConnection);

    // Cleanup on unmount
    return () => {
      if (socketConnection) {
        socketConnection.disconnect();
      }
    };
  }, []); // Empty dependency array means this effect runs once on mount

  return { socket };
}; 