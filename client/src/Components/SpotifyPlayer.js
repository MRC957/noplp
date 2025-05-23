/**
 * SpotifyPlayer Component
 * 
 * A React component that integrates the Spotify Web Playback SDK for playing music tracks.
 * This component handles:
 * - Loading the Spotify Iframe API
 * - Creating and managing a Spotify player
 * - Playing, pausing, and resuming tracks
 * - Monitoring playback updates
 * - Error handling and recovery
 * 
 * The component uses React's forwardRef and useImperativeHandle to expose control methods
 * to parent components, allowing them to control playback.
 * 
 * @param {Object} props - Component props
 * @param {string} props.trackId - Spotify track ID to play
 * @param {Function} props.onPlayerReady - Callback when Spotify API is loaded and ready
 * @param {Function} props.onAudioReady - Callback when a specific track is ready to play
 * @param {Function} props.onPlaybackUpdate - Callback with current playback position updates
 * @param {Function} props.onError - Callback when errors occur in the player
 * @param {React.Ref} ref - Forwarded ref to expose player control methods
 * @returns {JSX.Element} A container div for the Spotify player iframe
 */
import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import "./Song.css";

const SpotifyPlayer = forwardRef(({ 
  trackId,
  onPlayerReady,
  onAudioReady,
  onPlaybackUpdate,
  onError 
}, ref) => {
  // Track API loading state
  const [isApiLoaded, setIsApiLoaded] = useState(false);
  
  // References
  const spotifyApiRef = useRef(null);         // Reference to the Spotify API
  const spotifyControllerRef = useRef(null);  // Reference to the player controller
  const playerContainerRef = useRef(null);    // Reference to the DOM element containing the player
  const pendingTrackIdRef = useRef(null);     // Track ID waiting to be loaded
  const currentTrackIdRef = useRef(null);     // Currently loaded track ID
  const apiLoadingRef = useRef(false);        // Flag to prevent duplicate API loading
  const playerReinitiateTimeoutRef = useRef(null); // Timeout reference for player initialization

  // Load Spotify iframe API on mount
  useEffect(() => {
    console.log('SpotifyPlayer mounted, loading API');
    loadSpotifyIframeApi();
    
    // Clean up on unmount
    return () => {
      // Clear any pending timeouts
      if (playerReinitiateTimeoutRef.current) {
        clearTimeout(playerReinitiateTimeoutRef.current);
        playerReinitiateTimeoutRef.current = null;
      }
      cleanupPlayer();
    };
  }, []);

  // Effect to handle when both API is loaded and track ID is available
  useEffect(() => {
    console.log('API loaded or Track ID changed:', isApiLoaded, trackId);
    
    if (trackId) {
      // Store the track ID in the ref for later use
      pendingTrackIdRef.current = trackId;
      
      // Check if this is a new track (different from the current one)
      const isNewTrack = currentTrackIdRef.current !== trackId;
      
      if (isNewTrack) {
        console.log(`Switching to new track: ${trackId}`);
        // Update current track ref
        currentTrackIdRef.current = trackId;
        
        // Clean up existing player when changing tracks
        if (spotifyControllerRef.current) {
          cleanupPlayer();
        }
      }
    } else {
      // No trackId provided, but keep the reference to the last one
      console.log('Track ID is null, maintaining current references');
    }
    
    // Only create a new player when the API is loaded and we have a track ID
    if (isApiLoaded && pendingTrackIdRef.current) {
      // Give a small delay to ensure DOM is ready, especially after visibility changes
      if (playerReinitiateTimeoutRef.current) {
        clearTimeout(playerReinitiateTimeoutRef.current);
      }
      
      playerReinitiateTimeoutRef.current = setTimeout(() => {
        // Create a new player with the pending track
        createPlayerAndLoad(pendingTrackIdRef.current);
        playerReinitiateTimeoutRef.current = null;
      }, 100);
    }
  }, [trackId, isApiLoaded]);

  /**
   * Load the Spotify iframe API script
   * This adds the script to the document and sets up a callback for when it's ready
   */
  const loadSpotifyIframeApi = () => {
    // Avoid repeated loading
    if (spotifyApiRef.current || apiLoadingRef.current || window.onSpotifyIframeApiReady) {
      console.log('Spotify API loading handler already exists');
      return;
    }
    
    apiLoadingRef.current = true;
    
    // Set up handler for when Spotify iframe API is ready
    window.onSpotifyIframeApiReady = (IFrameAPI) => {
      console.log('Spotify Iframe API is ready');
      // Store API reference for future use
      spotifyApiRef.current = IFrameAPI;
      // Notify parent component that player is ready
      onPlayerReady(true);
      // Update local state to indicate API is loaded
      setIsApiLoaded(true);
      apiLoadingRef.current = false;
    };
    
    // Create and inject the Spotify script if it doesn't exist
    if (!document.getElementById('spotify-iframe-api')) {
      const script = document.createElement('script');
      script.id = 'spotify-iframe-api';
      script.src = 'https://open.spotify.com/embed/iframe-api/v1';
      script.async = true;
      document.body.appendChild(script);
    }
  };

  /**
   * Create a Spotify player and load the specified track
   * 
   * @param {string} trackId - Spotify track ID to load
   */
  const createPlayerAndLoad = (trackId) => {
    console.log(`Creating player for track: ${trackId}`);
    
    // Make sure we have a container to put the player in
    if (!createPlayerContainer()) {
      onError("Could not create player container");
      return;
    }

    try {
      // Get the container element
      const element = document.getElementById('spotify-player');
      if (!element) throw new Error('Player container not found');
      if (!spotifyApiRef.current) throw new Error('Spotify Iframe API not loaded');
      
      // Configure the Spotify player options
      const options = {
        uri: `spotify:track:${trackId}`,
        width: '100%',
        height: '152',
        theme: 'dark'
      };
      
      // Create the controller for the player
      spotifyApiRef.current.createController(element, options, (controller) => {
        // Store controller for later use (play, pause, etc.)
        spotifyControllerRef.current = controller;
        
        // Listen for player ready event
        controller.addListener('ready', () => {
          console.log('Spotify player is ready for playback');
          // Notify parent that audio is ready to play
          onAudioReady(true);
        });
        
        // Listen for playback updates (current position)
        controller.addListener('playback_update', (data) => {
          if (data?.data?.position !== undefined) {
            const position = data.data.position;
            // Report position to parent component
            onPlaybackUpdate(position, controller);
          }
        });
        
        // Listen for errors
        controller.addListener('error', (error) => {
          console.error('Spotify player error:', error);
          onError(`Error: ${error.message || 'Failed to load track'}`);
          
          // Try to recreate the player after a delay if there's an error
          setTimeout(() => {
            if (pendingTrackIdRef.current) {
              console.log('Attempting to recover from error by recreating player');
              cleanupPlayer();
              createPlayerAndLoad(pendingTrackIdRef.current);
            }
          }, 2000);
        });
      });
    } catch (error) {
      console.error('Error setting up Spotify player:', error);
      onError(`Error: ${error.message || 'Failed to set up player'}`);
    }
  };

  /**
   * Create a new player container element
   * Clears any existing player and creates a new container for the Spotify iframe
   * 
   * @returns {boolean} True if container was created successfully, false otherwise
   */
  const createPlayerContainer = () => {
    const parentContainer = playerContainerRef.current;
    if (!parentContainer) {
      console.error('Player parent container not found');
      return false;
    }
    
    // Clear the container before creating a new player
    parentContainer.innerHTML = '';
    
    // Create the player element
    const playerElement = document.createElement('div');
    playerElement.id = 'spotify-player';
    playerElement.className = 'spotify-player-container';
    
    // Add player element to container
    parentContainer.appendChild(playerElement);
    return true;
  };

  /**
   * Start playback of the current track
   * Logs errors if the player is not ready
   */
  const play = () => {
    if (!spotifyControllerRef.current) {
      console.warn("Cannot play: Spotify controller not initialized");
      return;
    }
    try {
      console.log("Playing track from SpotifyPlayer component");
      spotifyControllerRef.current.play();
    } catch (error) {
      console.error("Error starting Spotify player:", error);
    }
  };

  /**
   * Pause playback of the current track
   */
  const pause = () => {
    if (!spotifyControllerRef.current) return;
    try {
      spotifyControllerRef.current.pause();
    } catch (error) {
      console.error("Error pausing Spotify player:", error);
    }
  };

  /**
   * Resume playback of a paused track
   */
  const resume = () => {
    if (!spotifyControllerRef.current) {
      console.warn("Cannot resume: Spotify controller not initialized");
      return;
    }
    try {
      console.log("Resuming track from SpotifyPlayer component");
      spotifyControllerRef.current.resume();
    } catch (error) {
      console.error("Error resuming Spotify player:", error);
    }
  };

  /**
   * Clean up the player when switching tracks or unmounting
   * Destroys the controller and removes the player from the DOM
   */
  const cleanupPlayer = () => {
    console.log("Cleaning up Spotify player");
    
    // Destroy the controller if it exists
    if (spotifyControllerRef.current) {
      try {
        spotifyControllerRef.current.destroy();
      } catch (error) {
        console.error('Error destroying Spotify controller:', error);
      }
      spotifyControllerRef.current = null;
    }
    
    // Reset player container
    if (playerContainerRef.current) {
      playerContainerRef.current.innerHTML = '';
    }
    
    // Don't reset the current track ID reference,
    // as we want to remember which track was playing
  };

  // Expose player methods to parent component
  useImperativeHandle(ref, () => ({
    play,
    pause,
    resume,
    cleanup: cleanupPlayer,
    reinitialize: () => {
      // Force reinitialization of the player with the current track
      const currentTrack = pendingTrackIdRef.current;
      if (currentTrack) {
        cleanupPlayer();
        createPlayerAndLoad(currentTrack);
      }
    }
  }));

  return (
    <div 
      ref={playerContainerRef}
      className="player-container-wrapper"
      style={{ display: trackId ? 'block' : 'none' }}
      data-track-id={trackId || 'none'}
    />
  );
});

SpotifyPlayer.displayName = 'SpotifyPlayer';

export default SpotifyPlayer;