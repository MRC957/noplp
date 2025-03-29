import { useEffect, useState, useCallback } from 'react';
import { getSocket, controllerSocket, songSocket } from './socketManager';

/**
 * Enhanced socket hook that provides both the raw socket and domain-specific event handlers.
 * This combines the benefits of React hooks with the central socket management.
 */
export const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socketInstance = getSocket();
    setSocket(socketInstance);
    
    // Track connection state for components
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    
    socketInstance.on('connect', handleConnect);
    socketInstance.on('disconnect', handleDisconnect);
    
    // Set initial connection state
    setIsConnected(socketInstance.connected);
    
    return () => {
      socketInstance.off('connect', handleConnect);
      socketInstance.off('disconnect', handleDisconnect);
    };
  }, []);

  // Create specialized hooks for specific component types
  const useTerminalEvents = () => {
    const [currentView, setCurrentView] = useState(null);
    const [viewData, setViewData] = useState(null);
    
    useEffect(() => {
      if (!socket) return;
      
      const handleToIntro = () => {
        setCurrentView('intro');
        setViewData(null);
      };
      
      const handleToSongList = (data) => {
        setCurrentView('songlist');
        setViewData(data);
      };
      
      const handleToSong = (data) => {
        setCurrentView('song');
        setViewData(data);
      };
      
      const handleToCategories = (data) => {
        setCurrentView('categories');
        setViewData(data);
      };
      
      // Register all event listeners
      socket.on('to-intro', handleToIntro);
      socket.on('to-song-list', handleToSongList);
      socket.on('to-song', handleToSong);
      socket.on('to-categories', handleToCategories);
      
      return () => {
        // Clean up all listeners
        socket.off('to-intro', handleToIntro);
        socket.off('to-song-list', handleToSongList);
        socket.off('to-song', handleToSong);
        socket.off('to-categories', handleToCategories);
      };
    }, [socket]);
    
    return { currentView, viewData };
  };
  
  // React optimized wrapper for lyrics events
  const useLyricsEvents = () => {
    const [lyricsData, setLyricsData] = useState({
      lyrics: [],
      lyricsToGuess: [],
      lyricsLoading: false,
      lyricsError: null
    });
    
    const [suggestedLyrics, setSuggestedLyrics] = useState({
      content: '',
      state: 'none'
    });
    
    useEffect(() => {
      if (!socket) return;
      
      const handleLyricsData = (data) => {
        setLyricsData({
          lyrics: data.lyrics || [],
          lyricsToGuess: data.lyricsToGuess || [],
          lyricsLoading: false,
          lyricsError: null
        });
      };
      
      const handleLyricsLoading = () => {
        setLyricsData(prev => ({
          ...prev,
          lyricsLoading: true
        }));
      };
      
      const handleLyricsError = (error) => {
        setLyricsData(prev => ({
          ...prev,
          lyricsLoading: false,
          lyricsError: error
        }));
      };
      
      const handleSuggestedLyrics = (data) => {
        setSuggestedLyrics(prev => ({
          ...prev,
          content: data,
          state: 'suggested'
        }));
      };
      
      const handleFreezeLyrics = () => {
        setSuggestedLyrics(prev => ({
          ...prev,
          state: 'frozen'
        }));
      };
      
      const handleValidateLyrics = () => {
        setSuggestedLyrics(prev => ({
          ...prev,
          state: 'validate'
        }));
      };
      
      const handleRevealLyrics = () => {
        setSuggestedLyrics(prev => ({
          ...prev,
          state: 'reveal'
        }));
      };
      
      const handleContinueLyrics = () => {
        setSuggestedLyrics(prev => ({
          ...prev,
          state: 'continue'
        }));
      };
      
      // Register all event listeners
      socket.on('lyrics-data', handleLyricsData);
      socket.on('lyrics-loading', handleLyricsLoading);
      socket.on('lyrics-error', handleLyricsError);
      socket.on('show-suggested-lyrics', handleSuggestedLyrics);
      socket.on('freeze-lyrics', handleFreezeLyrics);
      socket.on('validate-lyrics', handleValidateLyrics);
      socket.on('reveal-lyrics', handleRevealLyrics);
      socket.on('continue-lyrics', handleContinueLyrics);
      
      return () => {
        // Clean up all listeners
        socket.off('lyrics-data', handleLyricsData);
        socket.off('lyrics-loading', handleLyricsLoading);
        socket.off('lyrics-error', handleLyricsError);
        socket.off('show-suggested-lyrics', handleSuggestedLyrics);
        socket.off('freeze-lyrics', handleFreezeLyrics);
        socket.off('validate-lyrics', handleValidateLyrics);
        socket.off('reveal-lyrics', handleRevealLyrics);
        socket.off('continue-lyrics', handleContinueLyrics);
      };
    }, [socket]);
    
    return { lyricsData, suggestedLyrics };
  };

  // Send functions that wrap controllerSocket methods
  const sendFunctions = {
    // Navigation
    showIntro: useCallback(() => controllerSocket.showIntro(), []),
    showCategories: useCallback((categories) => controllerSocket.showCategories(categories), []),
    showSongList: useCallback((data) => controllerSocket.showSongList(data), []),
    gotoSong: useCallback((song) => controllerSocket.gotoSong(song), []),
    
    // Lyrics control
    proposeLyrics: useCallback((lyrics) => controllerSocket.proposeLyrics(lyrics), []),
    freezeLyrics: useCallback(() => controllerSocket.freezeLyrics(), []),
    validateLyrics: useCallback(() => controllerSocket.validateLyrics(), []),
    revealLyrics: useCallback(() => controllerSocket.revealLyrics(), []),
    continueLyrics: useCallback(() => controllerSocket.continueLyrics(), []),
    
    // Lyrics data
    sendLyricsData: useCallback((data) => controllerSocket.sendLyricsData(data), []),
    sendLyricsLoading: useCallback(() => controllerSocket.sendLyricsLoading(), []),
    sendLyricsError: useCallback((error) => controllerSocket.sendLyricsError(error), []),
    
    // Song validation
    sendLyricsValidationResult: useCallback((songId, isCorrect) => 
      songSocket.sendLyricsValidationResult(songId, isCorrect), [])
  };

  return { 
    socket, 
    isConnected,
    ...sendFunctions,
    useTerminalEvents,
    useLyricsEvents
  };
};