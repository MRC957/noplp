import React, { useState, useEffect, useRef } from "react";
import { useSocket } from '../hooks/useSocket';
import { useAudio } from '../hooks/useAudio';
import { 
  STATES, 
  // Import both new object-based constants and legacy individual constants
  LYRICS_STATES,
  STATE_LYRICS_NONE,
  STATE_LYRICS_SUGGESTED,
  STATE_LYRICS_FROZEN,
  STATE_LYRICS_VALIDATE, 
  STATE_LYRICS_REVEAL,
  STATE_LYRICS_CONTINUE
} from '../constants/states';
import Background from "./Background";
import Categories from "./Categories";
import Logo from "./Logo";
import Song from "./Song";
import SongList from "./SongList";
import './TerminalComponent.css';

const COMPONENT_SOUNDS = {
  [STATES.INTRO]: 'intro',
  [STATES.SONGLIST]: 'bed',
  [STATES.CATEGORIES]: 'bed',
  [STATES.LOADING]: '',
  [STATES.SONG]: '',
};

const TerminalComponent = () => {
  // Track current app state
  const [currentState, setCurrentState] = useState(STATES.LOADING);
  
  // Use ref to track the actual current state value for event handlers
  const currentStateRef = useRef(currentState);
  
  // Update ref whenever currentState changes
  useEffect(() => {
    currentStateRef.current = currentState;
  }, [currentState]);
  
  // Track UI state properties
  const [uiState, setUiState] = useState({
    backgroundType: '',
    perfMode: false,
    payload: {},
  });
  
  // Track lyrics state separately
  const [suggestedLyrics, setSuggestedLyrics] = useState({
    content: '',
    state: STATE_LYRICS_NONE,
  });

  // Store lyrics data that will be passed to the Song component
  const [lyricsData, setLyricsData] = useState({
    lyrics: [],
    lyricsToGuess: [],
    lyricsLoading: false,
    lyricsError: null
  });

  // Store previous song id to detect song changes
  const previousSongIdRef = useRef(null);

  const { socket } = useSocket();
  const { playSound, stopAllSounds } = useAudio();

  const handleFlashColor = (color) => {
    setUiState(prev => ({ ...prev, backgroundType: color }));
  };

  const switchTo = (action, payload = {}) => {
    console.log(`Switching to ${action}`, payload);
    
    // Stop current sounds when switching to song component
    if (action === STATES.SONG) {
      stopAllSounds();

      // Reset lyrics state if switching to a different song
      if (payload.id !== previousSongIdRef.current) {
        setSuggestedLyrics({
          content: '',
          state: STATE_LYRICS_NONE,
        });
        setLyricsData({
          lyrics: [],
          lyricsToGuess: [],
          lyricsLoading: false,
          lyricsError: null
        });
        previousSongIdRef.current = payload.id;
      }
    }
    // Play sound for other components as needed
    else if (currentState !== action) {
      const soundToPlay = COMPONENT_SOUNDS[action];
      if (soundToPlay) {
        playSound(soundToPlay);
      }
    }

    // Log the payload if it contains a track_id (for debugging)
    if (action === STATES.SONG && payload.track_id) {
      console.log(`Received song with track_id: ${payload.track_id}`);
    }

    // Update state
    setCurrentState(action);
    setUiState(prev => ({
      ...prev,
      payload,
      backgroundType: '',
    }));

    // Reset suggested lyrics when switching to any non-song component
    if (action !== STATES.SONG) {
      setSuggestedLyrics({
        content: '',
        state: STATE_LYRICS_NONE,
      });
    }
  };

  const handleSuggestedLyrics = (lyricsState, payload = '') => {
    // Use ref to get the most up-to-date state value
    if (currentStateRef.current !== STATES.SONG) {
      console.warn(`Lyrics update received while not in SONG state. Current state: ${currentStateRef.current}`);
      return;
    }
    
    console.log(`Handling lyrics state: ${lyricsState} with payload:`, payload);
    
    // For suggested state, we need to keep the content from the payload
    // For other states, we want to maintain the previous content but change the state
    setSuggestedLyrics(prev => ({
      content: lyricsState === STATE_LYRICS_SUGGESTED ? payload : prev.content,
      state: lyricsState,
      // Store line index for continue functionality
      lineIndex: lyricsState === STATE_LYRICS_CONTINUE ? prev.lineIndex : undefined
    }));
  };

  // Set up socket listeners
  useEffect(() => {
    if (!socket) return;

    // Clean up previous listeners first to avoid duplicates
    socket.removeAllListeners();

    socket.on('to-intro', () => {
      switchTo(STATES.INTRO);
    });

    socket.on('to-song-list', (data) => {
      switchTo(STATES.SONGLIST, data);
    });

    socket.on('to-song', (data) => {
      switchTo(STATES.SONG, data);
    });

    socket.on('to-categories', async (data) => {
      switchTo(STATES.CATEGORIES, data);
    });

    socket.on('show-suggested-lyrics', data => {
      handleSuggestedLyrics(STATE_LYRICS_SUGGESTED, data);
    });

    socket.on('freeze-lyrics', () => {
      handleSuggestedLyrics(STATE_LYRICS_FROZEN);
    });

    socket.on('validate-lyrics', () => {
      handleSuggestedLyrics(STATE_LYRICS_VALIDATE);
    });

    socket.on('reveal-lyrics', () => {
      handleSuggestedLyrics(STATE_LYRICS_REVEAL);
    });
    
    socket.on('continue-lyrics', () => {
      handleSuggestedLyrics(STATE_LYRICS_CONTINUE);
    });

    socket.on('set-perf-mode', data => {
      setUiState(prev => ({ ...prev, perfMode: data }));
    });

    // New socket listeners for lyrics data
    socket.on('lyrics-data', (data) => {
      setLyricsData({
        lyrics: data.lyrics || [],
        lyricsToGuess: data.lyricsToGuess || [],
        lyricsLoading: false,
        lyricsError: null
      });
    });

    socket.on('lyrics-loading', () => {
      setLyricsData(prev => ({
        ...prev,
        lyricsLoading: true
      }));
    });

    socket.on('lyrics-error', (error) => {
      setLyricsData(prev => ({
        ...prev,
        lyricsLoading: false,
        lyricsError: error
      }));
    });

    // New socket listener for lyrics-to-guess-updated event
    socket.on('lyrics-to-guess-updated', (data) => {
      console.log('Received updated lyrics to guess:', data);
      setLyricsData(prev => ({
        ...prev,
        lyricsToGuess: data.lyricsToGuess || [],
      }));
    });

    return () => {
      socket.removeAllListeners();
    };
  }, [socket]); // Only depend on socket, not currentState

  // For debugging - log state changes
  useEffect(() => {
    console.log(`App state changed to: ${currentState}`);
  }, [currentState]);

  // For debugging - log lyrics state changes
  useEffect(() => {
    if (suggestedLyrics.state !== STATE_LYRICS_NONE) {
      console.log(`Lyrics state updated to: ${suggestedLyrics.state}`, suggestedLyrics.content ? 'with content' : 'without content');
    }
  }, [suggestedLyrics]);

  const renderContent = () => {
    switch (currentState) {
      case STATES.LOADING:
        return (
          <div className="waiting">
            <div>Attente de la régie</div>
            <div className="lds-ellipsis"><div></div><div></div><div></div><div></div></div>
          </div>
        );
      case STATES.INTRO:
        return <Logo />;
      case STATES.SONGLIST:
        return (
          <SongList 
            title={uiState.payload.name} 
            songs={uiState.payload.songs} 
          />
        );
      case STATES.SONG:
        return (
          <Song 
            colorFlash={handleFlashColor}
            song={uiState.payload}
            suggestedLyrics={suggestedLyrics}
            jukebox={playSound}
            lyrics={lyricsData.lyrics}
            lyricsToGuess={lyricsData.lyricsToGuess}
            lyricsLoading={lyricsData.lyricsLoading}
            lyricsError={lyricsData.lyricsError}
          />
        );
      case STATES.CATEGORIES:
        return (
          <Categories 
            categories={uiState.payload} 
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      {currentState !== STATES.LOADING && (
        <Background effect={uiState.backgroundType} perfMode={uiState.perfMode} />
      )}
      <div>
        {renderContent()}
      </div>
    </>
  );
};

export default TerminalComponent;
