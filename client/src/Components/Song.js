import React, { useState, useEffect, useRef, useCallback } from "react";
import { emitEvent } from "../hooks/socketManager";
import SpotifyPlayer from "./SpotifyPlayer";
import LyricsDisplay from "./LyricsDisplay";
import SongHeader from "./SongHeader";
import "./Song.css";

// Import lyric state constants from the new constants file
import {
  STATE_LYRICS_NONE,
  STATE_LYRICS_SUGGESTED,
  STATE_LYRICS_FROZEN,
  STATE_LYRICS_VALIDATE,
  STATE_LYRICS_REVEAL,
  STATE_LYRICS_CONTINUE
} from "../constants/lyricsStates";

const Song = ({ song, colorFlash, jukebox, suggestedLyrics }) => {
  // Player and audio states
  const [playerState, setPlayerState] = useState({
    playerReady: false,
    playerVisible: false,
    audioReady: false,
    errorMessage: null,
    currentTime: 0,
    pausedForGuessing: false,
  });

  // Lyrics states
  const [lyricsState, setLyricsState] = useState({
    lyricsReady: false,
    lyrics: [],             // Spotify API lyrics data
    lyricsToGuess: [],
    currentLine: -1,
    currentLyricIndex: -1,
    lyricsLoading: false,
    lyricsError: null,
    revealedLyrics: [],     // Track revealed lyrics to avoid pausing for them again
  });

  // Track pending song load
  const [pendingTrackId, setPendingTrackId] = useState(null);

  // Add refs to always track the current state
  const lyricsStateRef = useRef(lyricsState);
  const playerStateRef = useRef(playerState);
  
  // Update refs whenever state changes
  useEffect(() => {
    lyricsStateRef.current = lyricsState;
  }, [lyricsState]);

  useEffect(() => {
    playerStateRef.current = playerState;
  }, [playerState]);

  // Additional refs for song handling
  const spotifyPlayerRef = useRef();
  const musicBedTimeoutRef = useRef(null);
  const pauseOffsetRef = useRef(500);
  const preventRepeatedPauseRef = useRef(false); // Prevent immediate re-pause
  const hasInitializedRef = useRef(false); // Track if the current song has been initialized
  const cleanupInProgressRef = useRef(false); // Track if cleanup is in progress
  const songLoadAbortControllerRef = useRef(null); // AbortController for fetch requests
  
  // Track the previous lyrics state to detect changes
  const previousLyricStateRef = useRef(STATE_LYRICS_NONE);
  
  // Store the previous song ID to detect changes
  const previousSongIdRef = useRef(null);
  
  // Effect to play sounds when lyric state changes
  useEffect(() => {
    if (!suggestedLyrics || !jukebox) return;
    
    const currentState = suggestedLyrics.state;
    const prevState = previousLyricStateRef.current;
    
    // Only play sounds if the state has changed
    if (currentState !== prevState) {
      switch (currentState) {
        case STATE_LYRICS_FROZEN:
          jukebox('freeze');
          break;
        case STATE_LYRICS_VALIDATE:
          // Check if the answer is correct
          const isCorrect = checkIfLyricsAreCorrect();
          jukebox(isCorrect ? 'good' : 'bad');
          
          // Emit validation result using our socket manager
          if (song && song.id) {
            emitEvent('lyrics-validation-result', {
              songId: song.id,
              isCorrect: isCorrect
            });
          }
          break;
        case STATE_LYRICS_REVEAL:
          jukebox('good');
          // When lyrics are revealed, add them to the revealedLyrics array
          updateRevealedLyrics();
          break;
        case STATE_LYRICS_CONTINUE:
          // Resume playback when continue is triggered
          resumePlayback();
          // Also mark current lyric as revealed if not already done
          updateRevealedLyrics();
          break;
        default:
          break;
      }
      
      // Update the previous state reference
      previousLyricStateRef.current = currentState;
    }
  }, [suggestedLyrics?.state, jukebox, song]);

  // Helper function to update revealed lyrics
  const updateRevealedLyrics = () => {
    if (lyricsState.currentLyricIndex >= 0) {
      const currentLyric = lyricsState.lyrics[lyricsState.currentLyricIndex];
      if (currentLyric && !lyricsState.revealedLyrics.includes(currentLyric.startTimeMs)) {
        setLyricsState(prev => ({
          ...prev,
          revealedLyrics: [...prev.revealedLyrics, currentLyric.startTimeMs]
        }));
      }
    }
  };

  // Function to check if the suggested lyrics are correct
  const checkIfLyricsAreCorrect = () => {
    if (!suggestedLyrics || !suggestedLyrics.content || !lyricsState.lyricsToGuess.length) {
      return false;
    }

    const currentLyricIndex = lyricsState.currentLyricIndex;
    if (currentLyricIndex < 0) return false;
    
    // Get the current lyric line
    const currentLine = lyricsState.lyrics[currentLyricIndex];
    if (!currentLine) return false;

    // Find the corresponding guess entry
    const guessEntry = lyricsState.lyricsToGuess.find(g => g.startTimeMs === currentLine.startTimeMs);
    if (!guessEntry || !guessEntry.words) return false;

    // Compare the suggested lyrics with the correct ones
    const suggestedWords = suggestedLyrics.content.toLowerCase().trim();
    const correctWords = guessEntry.words.toLowerCase().trim();
    
    return suggestedWords === correctWords;
  };

  // Load the Spotify iframe API - added to fix the undefined reference
  const loadSpotifyIframeApi = () => {
    // Since we're now using the SpotifyPlayer component, this is just a stub
    // The actual implementation is in the SpotifyPlayer component
    console.log('Main Song component delegating Spotify API initialization to SpotifyPlayer');
  };

  // Component cleanup
  useEffect(() => {
    return () => {
      cleanupSong(true); // Full component unmount cleanup
    };
  }, []);

  // Load Spotify iframe API on mount
  useEffect(() => {
    console.log('Song component mounted, loading Spotify API');
    loadSpotifyIframeApi();
    
    // Initialize player visibility if we have a track ID
    if (song?.track_id) {
      console.log('Setting initial track ID and visibility:', song.track_id);
      setPendingTrackId(song.track_id);
      setPlayerState(prev => ({
        ...prev,
        playerVisible: true
      }));
    }
    
    return () => {
      cleanupSong(true);
    };
  }, []);

  // Handle song or track_id changes
  useEffect(() => {
    // Check if song has changed or if we're initializing with a new song
    if (song?.id && (song.id !== previousSongIdRef.current || !previousSongIdRef.current)) {
      console.log(`Song component received a new song: ${song.id}`);
      
      // Store new song ID
      previousSongIdRef.current = song.id;
      
      // Reset lyric state references
      previousLyricStateRef.current = STATE_LYRICS_NONE;
      
      // Reset the initialization flag to ensure playback starts for the new song
      hasInitializedRef.current = false;
      
      // Clean up any existing player and state
      cleanupSong();

      // Set track ID immediately if available
      if (song.track_id) {
        console.log(`Setting track ID for new song: ${song.track_id}`);
        setPendingTrackId(song.track_id);
        setPlayerState(prev => ({
          ...prev,
          playerVisible: true,
          // Reset any error state from previous song
          errorMessage: null
        }));
      }
    }
  }, [song?.id, song?.track_id]);

  // Start playing when everything is ready
  useEffect(() => {
    console.log('Checking playback conditions:', {
      hasInitializedRef: hasInitializedRef.current,
      audioReady: playerState.audioReady,
      lyricsReady: lyricsState.lyricsReady,
      playerReady: playerState.playerReady,
      hasSong: !!song
    });

    // if (song && playerState.audioReady && lyricsState.lyricsReady && playerState.playerReady && !hasInitializedRef.current) {
    if (song && playerState.audioReady && lyricsState.lyricsReady && playerState.playerReady) {
      console.log("All conditions are OK to start playback");
      hasInitializedRef.current = true;
      startPlaying();
    }
  }, [song, playerState.audioReady, lyricsState.lyricsReady, playerState.playerReady]);

  // Comprehensive cleanup function
  const cleanupSong = (isComponentUnmount = false) => {
    // Prevent concurrent cleanup operations
    if (cleanupInProgressRef.current) return;
    cleanupInProgressRef.current = true;

    console.log('Running comprehensive song cleanup');

    // Cancel any pending fetch requests
    if (songLoadAbortControllerRef.current) {
      try {
        songLoadAbortControllerRef.current.abort();
      } catch (error) {
        console.error('Error aborting fetch:', error);
      }
    }
    
    // Clear any bed music timeout
    if (musicBedTimeoutRef.current) {
      clearTimeout(musicBedTimeoutRef.current);
      musicBedTimeoutRef.current = null;
    }
    
    // Stop bed music if playing
    if (jukebox) {
      jukebox('stop');
    }
    
    // Reset control flags
    preventRepeatedPauseRef.current = false;
    hasInitializedRef.current = false;

    // Only reset state if not unmounting the component
    // This prevents React warnings about state updates on unmounted components
    if (!isComponentUnmount) {
      // Reset player state
      setPlayerState({
        playerReady: playerState.playerReady, // Maintain API ready state
        playerVisible: false,
        audioReady: false,
        errorMessage: null,
        currentTime: 0,
        pausedForGuessing: false,
      });
      
      // Reset lyrics state
      setLyricsState({
        lyricsReady: false,
        lyrics: [],
        lyricsToGuess: [],
        currentLine: -1,
        currentLyricIndex: -1,
        lyricsLoading: false,
        lyricsError: null,
        revealedLyrics: [], // Reset revealed lyrics for new song
      });
    }

    // Cleanup complete
    cleanupInProgressRef.current = false;
  };

  // Handler for Spotify player ready event
  const handlePlayerReady = (isReady) => {
    console.log('Spotify player ready:', isReady);
    setPlayerState(prev => ({ 
      ...prev, 
      playerReady: isReady,
      playerVisible: isReady && !!pendingTrackId
    }));
  };

  // Handler for Spotify audio ready event
  const handleAudioReady = (isReady) => {
    console.log('Spotify audio ready:', isReady);
    setPlayerState(prev => ({ 
      ...prev, 
      audioReady: isReady,
      playerVisible: isReady && !!pendingTrackId
    }));
  };

  // Handler for Spotify playback updates
  const handlePlaybackUpdate = (position, controller) => {
    setPlayerState(prev => ({ ...prev, currentTime: position }));
    updateDisplayedLyrics(position, controller);
  };

  // Handler for Spotify player errors
  const handlePlayerError = (errorMessage) => {
    setPlayerState(prev => ({ 
      ...prev, 
      errorMessage,
      audioReady: false,
      playerVisible: false
    }));
  };

  // Update displayed lyrics based on current time
  const updateDisplayedLyrics = (position, controller) => {
    // Use the refs to get the latest state
    const { lyrics, currentLyricIndex, lyricsToGuess, revealedLyrics } = lyricsStateRef.current;
    const { pausedForGuessing } = playerStateRef.current;
    
    if (!lyrics || lyrics.length === 0) {
      return;
    }
    
    // Find current lyric index based on timestamp
    let newIndex = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i].startTimeMs <= position) {
        newIndex = i;
      } else if (lyrics[i].startTimeMs > position) {
        break;
      }
    }
    
    // Update lyric index if changed (but don't update if we're paused for guessing)
    if (newIndex !== currentLyricIndex && !pausedForGuessing) {
      setLyricsState(prev => ({ ...prev, currentLyricIndex: newIndex }));
    }

    // Check for upcoming guessable lyrics to pause for
    if (!pausedForGuessing && controller && !preventRepeatedPauseRef.current) {
      for (let i = 0; i < lyrics.length; i++) {
        const lyricStartTime = lyrics[i].startTimeMs;
        const timeUntilLyric = lyricStartTime - position;
        
        // Check if this lyric is close enough to pause (within the pause offset window)
        if (timeUntilLyric > 0 && timeUntilLyric <= pauseOffsetRef.current) {
          // Only process if this line contains lyrics to guess
          if (lyricsToGuess.some(g => g.startTimeMs === lyricStartTime)) {
            // Skip if this lyric has been previously revealed
            if (revealedLyrics.includes(lyricStartTime)) {
              console.log(`Skipping already revealed lyric at ${lyricStartTime}`);
              continue;
            }

            console.log(`Pausing before lyric with words to guess at time ${lyricStartTime}`);
            
            try {
              // Pause the player when we're approaching lyrics to guess
              controller.pause();
              
              // Set the current lyric index to the line we're about to guess
              // Important: This ensures we display the correct line for guessing
              setLyricsState(prev => ({ ...prev, currentLyricIndex: i }));
              
              // Update player state to indicate we're paused for guessing
              setPlayerState(prev => ({ ...prev, pausedForGuessing: true }));

              // Start background music for guessing after a short delay
              if (musicBedTimeoutRef.current) {
                clearTimeout(musicBedTimeoutRef.current);
              }
              
              musicBedTimeoutRef.current = setTimeout(() => {
                if (jukebox) jukebox('bed');
              }, 1000);
            } catch (error) {
              console.error("Error pausing Spotify player:", error);
            }
            
            break;
          }
        }
      }
    }
  };

  // Fetch lyrics from backend
  const fetchLyrics = useCallback((trackId) => {
    const wordsToGuess = song?.expected_words;
    
    setLyricsState(prev => ({ 
      ...prev,
      lyricsLoading: true, 
      lyricsError: null 
    }));
    
    // Create a new AbortController for this fetch request
    if (songLoadAbortControllerRef.current) {
      songLoadAbortControllerRef.current.abort();
    }
    songLoadAbortControllerRef.current = new AbortController();
    const signal = songLoadAbortControllerRef.current.signal;
    
    fetch(`http://localhost:4001/api/getLyrics/${trackId}/${wordsToGuess}`, { signal })
      .then(response => {
        if (signal.aborted) throw new Error('Request was aborted');
        if (!response.ok) throw new Error(`Failed to fetch lyrics: ${response.status}`);
        return response.json();
      })
      .then(data => {
        if (signal.aborted) throw new Error('Request was aborted');
        
        setLyricsState(prev => ({ 
          ...prev,
          lyricsToGuess: data.lyricsToGuess || [], 
          lyrics: data.lyrics || [], 
          lyricsReady: true,
          lyricsLoading: false 
        }));
        
        // Check if words_to_guess was returned and different from what we expected
        if (data.words_to_guess !== undefined && song?.id) {
          // Get the word count from the API
          const actualWordsToGuess = data.words_to_guess;
          
          // Emit to controllers if it's different from what was requested
          if (actualWordsToGuess !== wordsToGuess) {
            console.log(`Emitting updated word count: ${actualWordsToGuess}`);
            emitEvent('lyrics-words-count', {
              songId: song.id,
              count: actualWordsToGuess
            });
          }
        }
      })
      .catch(error => {
        // Don't update state if request was intentionally aborted
        if (error.name === 'AbortError') {
          console.log('Fetch request was aborted');
          return;
        }
        
        console.error('Error fetching lyrics:', error);
        setLyricsState(prev => ({ 
          ...prev,
          lyricsError: `Failed to load lyrics: ${error.message}`,
          lyricsReady: false,
          lyricsLoading: false 
        }));
      })
      .finally(() => {
        // Clean up the controller reference if it's still the current one
        if (songLoadAbortControllerRef.current && songLoadAbortControllerRef.current.signal === signal) {
          songLoadAbortControllerRef.current = null;
        }
      });
  }, [song]);

  // Start playing the song
  const startPlaying = () => {
    if (!playerState.audioReady || !lyricsState.lyricsReady) {
      return;
    }
    
    console.log('Starting playback');
    
    try {
      // Reset the pause prevention flag before playing
      preventRepeatedPauseRef.current = false;
      
      // Call the play method through the SpotifyPlayer ref
      if (spotifyPlayerRef.current && spotifyPlayerRef.current.play) {
        spotifyPlayerRef.current.play();
      }
    } catch (error) {
      console.error("Error starting Spotify player:", error);
    }
  };

  // Resume playback after lyrics reveal
  const resumePlayback = () => {
    if (playerStateRef.current.pausedForGuessing) {
      console.log("Resuming playback after lyrics reveal");
      
      // Clear any music bed that might be playing
      if (musicBedTimeoutRef.current) {
        clearTimeout(musicBedTimeoutRef.current);
        musicBedTimeoutRef.current = null;
      }
      
      // Stop bed music
      if (jukebox) {
        jukebox('stop');
      }
      
      // Set flag to prevent immediate re-pause
      preventRepeatedPauseRef.current = true;
      
      try {
        // Resume playback through the SpotifyPlayer ref
        if (spotifyPlayerRef.current && spotifyPlayerRef.current.resume) {
          spotifyPlayerRef.current.resume();
        }
      } catch (error) {
        console.error("Error resuming Spotify player:", error);
      }
      
      // Update state to indicate we're no longer paused for guessing
      setPlayerState(prev => ({ ...prev, pausedForGuessing: false }));
      
      // Reset the flag after a short delay to allow playback to continue
      setTimeout(() => {
        preventRepeatedPauseRef.current = false;
      }, 1500); // Increased delay to ensure player has time to continue
    }
  };

  // Effect to load lyrics when track id changes
  useEffect(() => {
    if (pendingTrackId) {
      console.log(`Loading lyrics for track: ${pendingTrackId}`);
      fetchLyrics(pendingTrackId);
    }
  }, [pendingTrackId, fetchLyrics]);

  // Format time for display (utility function)
  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Main render
  return (
    <div className="song-component">
      <SpotifyPlayer
        ref={spotifyPlayerRef}
        trackId={pendingTrackId}
        onPlayerReady={handlePlayerReady}
        onAudioReady={handleAudioReady}
        onPlaybackUpdate={handlePlaybackUpdate}
        onError={handlePlayerError}
      />
      
      {playerState.errorMessage && <div className="error-message">{playerState.errorMessage}</div>}
      
      <SongHeader 
        title={song?.title} 
        artist={song?.artist} 
      />

      <LyricsDisplay
        lyrics={lyricsState.lyrics}
        lyricsToGuess={lyricsState.lyricsToGuess}
        currentLyricIndex={lyricsState.currentLyricIndex}
        revealedLyrics={lyricsState.revealedLyrics}
        suggestedLyrics={suggestedLyrics}
        isLoading={lyricsState.lyricsLoading}
        error={lyricsState.lyricsError}
        isPaused={playerState.pausedForGuessing}
      />
    </div>
  );
};

// Export both the component and the lyric state constants for backward compatibility
export {
  STATE_LYRICS_NONE,
  STATE_LYRICS_SUGGESTED,
  STATE_LYRICS_FROZEN,
  STATE_LYRICS_VALIDATE,
  STATE_LYRICS_REVEAL,
  STATE_LYRICS_CONTINUE
};

export default Song;
