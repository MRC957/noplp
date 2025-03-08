import React, { useState, useEffect, useRef } from "react";
import TextBox from "./TextBox";
import "./Song.css";

// Lyric state constants
export const STATE_LYRICS_NONE = 'none';
export const STATE_LYRICS_SUGGESTED = 'suggested';
export const STATE_LYRICS_FROZEN = 'frozen';
export const STATE_LYRICS_VALIDATE = 'validate';
export const STATE_LYRICS_REVEAL = 'reveal';

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
  });

  // Add a ref to always track the current lyrics state
  const lyricsStateRef = useRef(lyricsState);
  
  // Update ref whenever lyricsState changes
  useEffect(() => {
    lyricsStateRef.current = lyricsState;
  }, [lyricsState]);
  
  // Internal suggested lyrics state - will be updated from props
  const [suggestedLyricsState, setSuggestedLyricsState] = useState({
    content: '',
    state: STATE_LYRICS_NONE,
    wordsClass: []
  });

  // Track pending song load
  const [pendingTrackId, setPendingTrackId] = useState(null);

  // Refs
  const spotifyApiRef = useRef(null);
  const spotifyControllerRef = useRef(null);
  const playerContainerRef = useRef(null);
  const musicBedTimeoutRef = useRef(null);
  const pauseOffsetRef = useRef(500);

  // Update internal state when suggestedLyrics props change
  useEffect(() => {
    if (suggestedLyrics) {
      console.log("Received new suggested lyrics prop:", suggestedLyrics.state);
      
      // Update our internal state from props
      setSuggestedLyricsState(prev => ({
        ...prev,
        content: suggestedLyrics.content,
        state: suggestedLyrics.state,
      }));
    }
  }, [suggestedLyrics]);

  // Effect for handling lyrics state changes and applying visual effects
  useEffect(() => {
    if (suggestedLyricsState.state !== STATE_LYRICS_NONE && 
        lyricsState.currentLyricIndex >= 0) {
      handleLyricsStateChange();
    }
  }, [suggestedLyricsState.state, lyricsState.currentLyricIndex]);

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
    });
    
    setSuggestedLyricsState({
      content: '',
      state: STATE_LYRICS_NONE,
      wordsClass: []
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
    const { lyrics, currentLyricIndex, lyricsToGuess } = lyricsStateRef.current;
    
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
    if (!playerState.pausedForGuessing && controller) {
        for (let i = 0; i < lyrics.length; i++) {
            const timeUntilLyric = lyrics[i].startTimeMs - currentTime;
            
            if (timeUntilLyric > 0 && timeUntilLyric <= pauseOffsetRef.current) {
                if (lyricsToGuess.some(g => g.startTimeMs === lyrics[i].startTimeMs)) {
                    console.log(`Pausing before lyric with words to guess`);
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

  // Format time for display
  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle lyrics state changes
  const handleLyricsStateChange = () => {
    const { lyrics, currentLine } = lyricsState;
    const { state, content } = suggestedLyricsState;
    
    if (shouldShowSuggestedLyrics()) {
      if (lyrics.length === 0 || currentLine < 0) return;
      
      const correctWords = lyrics[currentLine].content.split(' ');
      const suggestedWords = content.split(' ');
      
      const wordsClass = validateWords(correctWords, suggestedWords, state);
      
      setSuggestedLyricsState(prev => ({
        ...prev,
        wordsClass
      }));
      
      const effect = determineEffect(wordsClass, correctWords.length);
      if (effect) {
        colorFlash(effect);
        jukebox(effect);
      }
    }
  };

  // Check if suggested lyrics should be shown
  const shouldShowSuggestedLyrics = () => {
    return suggestedLyricsState.state !== STATE_LYRICS_NONE && 
           song?.guess_line === lyricsState.currentLine;
  };

  // Validate words compared to the correct lyrics
  const validateWords = (correctWords, suggestedWords, state) => {
    return suggestedWords.map((word, index) => {
      if (state === STATE_LYRICS_FROZEN) {
        return 'freeze';
      }
      if (state === STATE_LYRICS_VALIDATE) {
        return getWordValidationClass(word, correctWords[index]);
      }
      return '';
    });
  };

  // Get validation class for a word
  const getWordValidationClass = (suggestedWord, correctWord) => {
    if (!correctWord) return 'bad';
    return suggestedWord.toUpperCase() === correctWord.toUpperCase() 
      ? 'good' 
      : 'bad';
  };

  // Determine effect based on word validation
  const determineEffect = (wordsClass, correctWordsLength) => {
    const isFreeze = wordsClass.includes('freeze');
    const isBad = wordsClass.includes('bad');
    const isGood = wordsClass.filter(c => c === 'good').length === correctWordsLength;
    if (isFreeze) return 'freeze';
    if (isBad) return 'bad';
    if (isGood) return 'good';
    return '';
  };

  // Render suggested lyrics
  const renderSuggestedLyrics = () => {
    const { lyrics, currentLine } = lyricsState;
    
    // Show previous line + suggested lyrics
    if (currentLine <= 0 || lyrics.length === 0) {
      return <TextBox content=" " />;
    }
    const previousLine = lyrics[currentLine - 1].content;
    const LyricsToDisplay = getLyricsToDisplay();
    const words = renderWords(LyricsToDisplay);
    return (
      <div>
        <TextBox content={previousLine}></TextBox>
        <TextBox>{words}</TextBox>
      </div>
    );
  };

  // Render words with appropriate classes
  const renderWords = (lyrics) => {
    if (!lyrics) return null;
    
    return lyrics.split(' ').map((word, index) => (
      <span 
        className={`lyrics-word ${suggestedLyricsState.wordsClass[index] || ''}`} 
        key={`word-${index}`}
      >
        {`${word} `}
      </span>
    ));
  };

  // Get lyrics to display based on state
  const getLyricsToDisplay = () => {
    const { state, content } = suggestedLyricsState;
    const { lyrics, currentLine } = lyricsState;
    
    if (currentLine < 0 || lyrics.length === 0) {
      return "";
    }
    
    return state === STATE_LYRICS_REVEAL 
      ? lyrics[currentLine].content 
      : content;
  };

  // Render suggested lyrics
  const renderNormalLyrics = () => {
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
        let displayText = processLyricLine(line, guessEntry);
        
        visibleLyrics.push(
            <div 
                key={i} 
                className={`lyrics-line ${i === currentLyricIndex ? 'active' : ''} ${guessEntry ? 'guessable' : ''}`}
            >
                {displayText}
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
        if (!guessEntry) return line.words;
        
        const wordCount = guessEntry.word_count || 1;
        const placeholder = '_ '.repeat(wordCount);
        
        if (guessEntry.words) {
            return line.words.replace(guessEntry.words, placeholder);
        }
        
        if (guessEntry.startIndex !== undefined && guessEntry.endIndex !== undefined) {
            const before = line.words.substring(0, guessEntry.startIndex);
            const after = line.words.substring(guessEntry.endIndex);
            return before + placeholder + after;
        }
        
        return placeholder;
    };

  // Render lyrics based on state
  const renderLyrics = () => {
    if (shouldShowSuggestedLyrics()) {
      return renderSuggestedLyrics();
    }
    return renderNormalLyrics();
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
      {renderTimecode()}
      {renderLyrics()}
      
      {playerState.pausedForGuessing && (
        <TextBox className="guess-notice">
          Playback paused: Fill in the missing words!
        </TextBox>
      )}
    </div>
  );
};

export default Song;
