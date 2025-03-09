import React, { useState, useEffect, useRef } from "react";
import TextBox from "./TextBox";
import "./Song.css";
import { emitEvent } from "../hooks/socketManager";

// Lyric state constants
export const STATE_LYRICS_NONE = 'none';
export const STATE_LYRICS_SUGGESTED = 'suggested';
export const STATE_LYRICS_FROZEN = 'frozen';
export const STATE_LYRICS_VALIDATE = 'validate';
export const STATE_LYRICS_REVEAL = 'reveal';
export const STATE_LYRICS_CONTINUE = 'continue';

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

  // Add a ref to always track the current lyrics state
  const lyricsStateRef = useRef(lyricsState);
  
  // Update ref whenever lyricsState changes
  useEffect(() => {
    lyricsStateRef.current = lyricsState;
  }, [lyricsState]);

  // Track the previous lyrics state to detect changes
  const previousLyricStateRef = useRef(STATE_LYRICS_NONE);
  
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
          // We'll check if the answer is correct in the validation logic
          // and play either 'good' or 'bad' accordingly
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
          if (lyricsState.currentLyricIndex >= 0) {
            const currentLyric = lyricsState.lyrics[lyricsState.currentLyricIndex];
            if (currentLyric) {
              setLyricsState(prev => ({
                ...prev,
                revealedLyrics: [...prev.revealedLyrics, currentLyric.startTimeMs]
              }));
            }
          }
          break;
        case STATE_LYRICS_CONTINUE:
          // Resume playback when continue is triggered
          resumePlayback();
          // Also mark current lyric as revealed if not already done
          if (lyricsState.currentLyricIndex >= 0) {
            const currentLyric = lyricsState.lyrics[lyricsState.currentLyricIndex];
            if (currentLyric && !lyricsState.revealedLyrics.includes(currentLyric.startTimeMs)) {
              setLyricsState(prev => ({
                ...prev,
                revealedLyrics: [...prev.revealedLyrics, currentLyric.startTimeMs]
              }));
            }
          }
          break;
        default:
          break;
      }
      
      // Update the previous state reference
      previousLyricStateRef.current = currentState;
    }
  }, [suggestedLyrics?.state, jukebox]);

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

  // Track pending song load
  const [pendingTrackId, setPendingTrackId] = useState(null);

  // Refs
  const spotifyApiRef = useRef(null);
  const spotifyControllerRef = useRef(null);
  const playerContainerRef = useRef(null);
  const musicBedTimeoutRef = useRef(null);
  const pauseOffsetRef = useRef(500);
  const preventRepeatedPauseRef = useRef(false); // Prevent immediate re-pause

  // Load Spotify iframe API
  useEffect(() => {
    loadSpotifyIframeApi();
    
    return () => {
      cleanup();
    };
  }, []);

  // Handle song or track_id changes
  useEffect(() => {
    if (song?.track_id) {
      console.log(`Song component received track_id: ${song.track_id}`);
      
      // If Spotify API is ready, load the song immediately
      if (spotifyApiRef.current) {
        loadSong(song.track_id);
      } else {
        // Otherwise, store the track ID to load later when API is ready
        console.log('Spotify API not ready yet, queueing track for later');
        setPendingTrackId(song.track_id);
      }
    }
  }, [song?.id, song?.track_id]);

  // Handle API ready and pending track load
  useEffect(() => {
    if (spotifyApiRef.current && pendingTrackId) {
      console.log(`Spotify API now ready, loading pending track: ${pendingTrackId}`);
      loadSong(pendingTrackId);
      setPendingTrackId(null);
    }
  }, [playerState.playerReady, pendingTrackId]);

  // Start playing when everything is ready
  useEffect(() => {
    if (song && playerState.audioReady && lyricsState.lyricsReady && playerState.playerReady) {
      console.log("All conditions are OK to start playback");
      startPlaying();
    }
  }, [song, playerState.audioReady, lyricsState.lyricsReady, playerState.playerReady]);

  // Load the Spotify iframe API
  const loadSpotifyIframeApi = () => {
    if (window.onSpotifyIframeApiReady) return;
    
    window.onSpotifyIframeApiReady = (IFrameAPI) => {
      console.log('Spotify Iframe API is ready');
      spotifyApiRef.current = IFrameAPI;
      setPlayerState(prev => ({ ...prev, playerReady: true }));
    };
    
    const script = document.createElement('script');
    script.src = 'https://open.spotify.com/embed/iframe-api/v1';
    script.async = true;
    document.body.appendChild(script);
  };

  // Cleanup function
  const cleanup = () => {
    if (musicBedTimeoutRef.current) {
      clearTimeout(musicBedTimeoutRef.current);
      musicBedTimeoutRef.current = null;
    }
    
    if (spotifyControllerRef.current) {
      spotifyControllerRef.current.destroy();
      spotifyControllerRef.current = null;
    }
  };

  // Create player container
  const createPlayerContainer = () => {
    const parentContainer = playerContainerRef.current;
    if (!parentContainer) {
      console.error('Player parent container not found');
      return false;
    }
    
    parentContainer.innerHTML = '';
    
    const playerElement = document.createElement('div');
    playerElement.id = 'spotify-player';
    playerElement.className = 'spotify-player-container';
    
    parentContainer.appendChild(playerElement);
    return true;
  };

  // Load song data and create player
  const loadSong = (trackId) => {
    if (!spotifyApiRef.current) {
      console.warn("Spotify API not ready yet, cannot load song");
      return;
    }
    
    cleanup();
    
    // Reset states
    setPlayerState({
      playerReady: true, // We know the API is ready at this point
      playerVisible: true,
      audioReady: false,
      errorMessage: null,
      currentTime: 0,
      pausedForGuessing: false,
    });
    
    setLyricsState({
      lyricsReady: false,
      lyrics: [],
      lyricsToGuess: [],
      currentLine: -1,
      currentLyricIndex: -1,
      lyricsLoading: true,
      lyricsError: null,
      revealedLyrics: [], // Reset revealed lyrics for new song
    });
    
    if (!song) {
      console.error("No song provided");
      setLyricsState(prev => ({
        ...prev,
        lyricsLoading: false,
        lyricsError: "No song data provided"
      }));
      return;
    }

    if (!trackId) {
      console.warn("No track_id provided in song data");
      setLyricsState(prev => ({
        ...prev,
        lyricsLoading: false,
        lyricsError: "No Spotify track ID provided"
      }));
      return;
    }

    // Create the player container
    if (createPlayerContainer()) {
      console.log(`Loading Spotify player for track: ${trackId}`);
      
      // Create player and fetch lyrics in parallel
      createSpotifyPlayer(trackId);
      fetchLyrics(trackId);
    }
  };

  // Create Spotify player
  const createSpotifyPlayer = (trackId) => {
    try {
      const element = document.getElementById('spotify-player');
      if (!element) throw new Error('Player container not found');
      if (!spotifyApiRef.current) throw new Error('Spotify Iframe API not loaded');
      
      const options = {
        uri: `spotify:track:${trackId}`,
        width: '100%',
        height: '152',
        theme: 'dark'
      };
      
      spotifyApiRef.current.createController(element, options, (controller) => {
        spotifyControllerRef.current = controller;
        
        controller.addListener('ready', () => {
          console.log('Spotify player is ready');
          setPlayerState(prev => ({ ...prev, audioReady: true }));
        });
        
        controller.addListener('playback_update', (data) => {
          if (data?.data?.position !== undefined) {
            const position = data.data.position;
            setPlayerState(prev => ({ ...prev, currentTime: position }));
            updateDisplayedLyrics(position, controller);
          }
        });
        
        controller.addListener('error', (error) => {
          console.error('Spotify player error:', error);
          setPlayerState(prev => ({ 
            ...prev,
            errorMessage: `Error: ${error.message || 'Failed to load track'}`,
            audioReady: false
          }));
        });
      });
    } catch (error) {
      console.error('Error setting up Spotify player:', error);
      setPlayerState(prev => ({
        ...prev,
        errorMessage: `Error: ${error.message || 'Failed to set up player'}`,
        playerVisible: false,
        audioReady: false
      }));
    }
  };

  // Fetch lyrics from backend
  const fetchLyrics = (trackId) => {
    const wordsToGuess = song?.expected_words;
    
    setLyricsState(prev => ({ 
      ...prev,
      lyricsLoading: true, 
      lyricsError: null 
    }));
    
    fetch(`http://localhost:4001/api/getLyrics/${trackId}/${wordsToGuess}`)
      .then(response => {
        if (!response.ok) throw new Error(`Failed to fetch lyrics: ${response.status}`);
        return response.json();
      })
      .then(data => {
        setLyricsState(prev => ({ 
          ...prev,
          lyricsToGuess: data.lyricsToGuess || [], 
          lyrics: data.lyrics || [], 
          lyricsReady: true,
          lyricsLoading: false 
        }));
      })
      .catch(error => {
        console.error('Error fetching lyrics:', error);
        setLyricsState(prev => ({ 
          ...prev,
          lyricsError: `Failed to load lyrics: ${error.message}`,
          lyricsReady: false,
          lyricsLoading: false 
        }));
      });
  };

  // Update displayed lyrics based on current time
  const updateDisplayedLyrics = (currentTime, controller) => {
    // Use the ref to get the latest lyrics state
    const { lyrics, currentLyricIndex, lyricsToGuess, revealedLyrics } = lyricsStateRef.current;
    
    if (!lyrics || lyrics.length === 0) {
      console.log("No lyrics available yet in updateDisplayedLyrics");
      return;
    }
    
    // Find current lyric index
    let newIndex = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i].startTimeMs <= currentTime) {
        newIndex = i;
      } else if (lyrics[i].startTimeMs > currentTime) {
        break;
      }
    }
    
    // Update lyric index if changed
    if (newIndex !== currentLyricIndex) {
      setLyricsState(prev => ({ ...prev, currentLyricIndex: newIndex }));
      if (currentLyricIndex !== -1) setPlayerState(prev => ({ ...prev, pausedForGuessing: false }));
    }

    // Check for upcoming guessable lyrics to pause for
    if (!playerState.pausedForGuessing && controller && !preventRepeatedPauseRef.current) {
        for (let i = 0; i < lyrics.length; i++) {
            const lyricStartTime = lyrics[i].startTimeMs;
            const timeUntilLyric = lyricStartTime - currentTime;
            
            // Check if this lyric is close enough to pause
            if (timeUntilLyric > 0 && timeUntilLyric <= pauseOffsetRef.current) {
                // Only process if this line contains lyrics to guess
                if (lyricsToGuess.some(g => g.startTimeMs === lyricStartTime)) {
                    // Skip if this lyric has been previously revealed
                    if (revealedLyrics.includes(lyricStartTime)) {
                        console.log(`Skipping already revealed lyric at ${lyricStartTime}`);
                        continue;
                    }

                    console.log(`Pausing before lyric with words to guess at time ${lyricStartTime}`);
                    controller.pause();
                    
                    setPlayerState(prev => ({ ...prev, pausedForGuessing: true }));
                    setLyricsState(prev => ({ ...prev, currentLyricIndex: i }));

                    // Start background music for guessing
                    musicBedTimeoutRef.current = setTimeout(() => {
                        jukebox('bed');
                    }, 1000);
                    
                    break;
                }
            }
        }
    }
  };

  // Start playing the song
  const startPlaying = () => {
    if (!playerState.audioReady || !lyricsState.lyricsReady || !spotifyControllerRef.current) {
      return;
    }
    
    console.log('Starting playback');
    spotifyControllerRef.current.play()
  };

  // Resume playback after lyrics reveal
  const resumePlayback = () => {
    if (spotifyControllerRef.current && playerState.pausedForGuessing) {
      console.log("Resuming playback after lyrics reveal");
      
      // Clear any music bed that might be playing
      if (musicBedTimeoutRef.current) {
        clearTimeout(musicBedTimeoutRef.current);
        musicBedTimeoutRef.current = null;
      }
      
      // Stop bed music
      jukebox('stop');
      
      // Set flag to prevent immediate re-pause
      preventRepeatedPauseRef.current = true;
      
      // Reset the flag after a short delay to allow playback to continue
      setTimeout(() => {
        preventRepeatedPauseRef.current = false;
      }, 1000);
      
      // Resume playback
      spotifyControllerRef.current.resume();
      
      // Update state to indicate we're no longer paused for guessing
      setPlayerState(prev => ({ ...prev, pausedForGuessing: false }));
    }
  };

  // Format time for display
  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Render lyrics with suggestion support
  const renderLyrics = () => {
    const { lyrics, lyricsToGuess, currentLyricIndex, lyricsLoading, lyricsError } = lyricsState;
    
    if (lyricsLoading) {
        return <TextBox className="lyrics-container"><div className="lyrics-loading">Loading lyrics...</div></TextBox>;
    }
    
    if (lyricsError) {
        return <TextBox className="lyrics-container"><div className="lyrics-error">{lyricsError}</div></TextBox>;
    }
    
    if (!lyrics || lyrics.length === 0) {
        return <TextBox className="lyrics-container"><div className="lyrics-empty">No lyrics available</div></TextBox>;
    }
    
    // Find visible lyrics range
    const visibleWindow = 1;
    const startIdx = Math.max(0, currentLyricIndex - visibleWindow);
    const endIdx = Math.min(lyrics.length - 1, currentLyricIndex + visibleWindow);
    
    const visibleLyrics = [];
    for (let i = startIdx; i <= endIdx; i++) {
        const line = lyrics[i];
        if (!line) continue;
        
        // Process line for display
        const guessEntry = lyricsToGuess.find(g => g.startTimeMs === line.startTimeMs);
        
        visibleLyrics.push(
            <div 
                key={i} 
                className={`lyrics-line ${i === currentLyricIndex ? 'active' : ''}`}
                // className={`lyrics-line ${i === currentLyricIndex ? 'active' : ''} ${guessEntry ? 'guessable' : ''}`}
            >
                {processLyricLine(line, guessEntry)}
            </div>
        );
    }

    return (
        <TextBox className="lyrics-container">
            <h3 className="lyrics-header"></h3>
            <div className="lyrics-scroll-area">
                {visibleLyrics}
            </div>
        </TextBox>
    );
  };

  const processLyricLine = (line, guessEntry) => {
    // If no guess entry, just show the lyrics as regular text
    if (!guessEntry) {
        return <span>{line.words}</span>;
    }
    
    // If we have suggested lyrics and at the current line with words to guess
    if (suggestedLyrics && suggestedLyrics.state !== STATE_LYRICS_NONE && 
        guessEntry && playerState.pausedForGuessing) {
        
        // Get the original words to guess
        const originalWords = guessEntry.words || '';
        const beforeText = line.words.substring(0, line.words.indexOf(originalWords));
        const afterText = line.words.substring(line.words.indexOf(originalWords) + originalWords.length);
        
        // Handle different states of suggested lyrics
        switch (suggestedLyrics.state) {
            case STATE_LYRICS_SUGGESTED:
                return (
                    <>
                        {beforeText}
                        <span className="lyrics-word">
                            {suggestedLyrics.content}
                        </span>
                        {afterText}
                    </>
                );
            
            case STATE_LYRICS_FROZEN:
                return (
                    <>
                        {beforeText}
                        <span className="lyrics-word freeze">
                            {suggestedLyrics.content}
                        </span>
                        {afterText}
                    </>
                );
            
            case STATE_LYRICS_VALIDATE:
                // Split both texts into words for comparison
                const suggestedWords = suggestedLyrics.content.split(/\s+/);
                const correctWords = originalWords.split(/\s+/);
                
                return (
                    <>
                        {beforeText}
                        {suggestedWords.map((word, index) => {
                            const isCorrect = index < correctWords.length && 
                                            word.toLowerCase() === correctWords[index].toLowerCase();
                            return (
                                <span key={index} className={`lyrics-word ${isCorrect ? 'good' : 'bad'}`}>
                                    {word}{index < suggestedWords.length - 1 ? ' ' : ''}
                                </span>
                            );
                        })}
                        {afterText}
                    </>
                );
            
            case STATE_LYRICS_REVEAL:
            case STATE_LYRICS_CONTINUE:
                return (
                    <>
                        {beforeText}
                        <span className="lyrics-word good">
                            {originalWords}
                        </span>
                        {afterText}
                    </>
                );
            
            default:
                break;
        }
    }

    // Check if this lyric has been revealed via continue state
    const { revealedLyrics } = lyricsStateRef.current;
    if (revealedLyrics.includes(line.startTimeMs)) {
        const originalWords = guessEntry.words || '';
        const beforeText = line.words.substring(0, line.words.indexOf(originalWords));
        const afterText = line.words.substring(line.words.indexOf(originalWords) + originalWords.length);
        
        return (
            <>
                {beforeText}
                <span className="lyrics-word shown">
                    {originalWords}
                </span>
                {afterText}
            </>
        );
    }
    
    // Default behavior - show placeholder for words to guess
    const wordCount = guessEntry.word_count || 1;
    const placeholder = '_ '.repeat(wordCount);
    
    if (guessEntry.words) {
        const beforeText = line.words.substring(0, line.words.indexOf(guessEntry.words));
        const afterText = line.words.substring(line.words.indexOf(guessEntry.words) + guessEntry.words.length);
        return (
            <>
                {beforeText}
                <span>{placeholder}</span>
                {afterText}
            </>
        );
    }
    
    if (guessEntry.startIndex !== undefined && guessEntry.endIndex !== undefined) {
        const before = line.words.substring(0, guessEntry.startIndex);
        const after = line.words.substring(guessEntry.endIndex);
        return (
            <>
                {before}
                <span>{placeholder}</span>
                {after}
            </>
        );
    }
    
    return <span>{placeholder}</span>;
  };

  // Render header with song info
  const renderHeader = () => {
    if (!song) return null;
    
    return (
      <TextBox className="song-info">
        <div className="song-title">{song.title}</div>
        <div className="song-artist">{song.artist}</div>
      </TextBox>
    );
  };

  // Render timecode display
  const renderTimecode = () => {
    return (
      <TextBox className="timecode-display">
        <div className="timecode-label">Current Time:</div>
        <div className="timecode-value">{formatTime(playerState.currentTime)}</div>
      </TextBox>
    );
  };

  // Main render
  return (
    <div className="song-component">
      <div 
        ref={playerContainerRef}
        className="player-container-wrapper"
        style={{ display: playerState.playerVisible ? 'block' : 'none' }}
      />
      
      {playerState.errorMessage && <div className="error-message">{playerState.errorMessage}</div>}
      
      {renderHeader()}
      {/* {renderTimecode()} */}
      {renderLyrics()}

    </div>
  );
};

export default Song;
