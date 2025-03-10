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
  const spotifyApiRef = useRef(null);
  const spotifyControllerRef = useRef(null);
  const playerContainerRef = useRef(null);
  const pendingTrackIdRef = useRef(null);
  const currentTrackIdRef = useRef(null); // Add reference to track current track ID

  // Load Spotify iframe API on mount
  useEffect(() => {
    console.log('SpotifyPlayer mounted, loading API');
    loadSpotifyIframeApi();
    
    return () => {
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
      }
    }
    
    // Only create a new player when the API is loaded and we have a track ID
    if (isApiLoaded && pendingTrackIdRef.current) {
      // Always clean up existing player before creating a new one
      cleanupPlayer();
      
      // Create a new player with the pending track
      createPlayerAndLoad(pendingTrackIdRef.current);
    }
  }, [trackId, isApiLoaded]);

  // Load the Spotify iframe API
  const loadSpotifyIframeApi = () => {
    // Check if API is already being loaded or is loaded
    if (window.onSpotifyIframeApiReady) {
      console.log('Spotify API loading handler already exists');
      // If the handler already exists but API isn't marked as loaded yet,
      // we might be in a partial initialization state
      return;
    }
    
    // Set up handler for when Spotify iframe API is ready
    window.onSpotifyIframeApiReady = (IFrameAPI) => {
      console.log('Spotify Iframe API is ready');
      // Store API reference for future use
      spotifyApiRef.current = IFrameAPI;
      // Notify parent component that player is ready
      onPlayerReady(true);
      // Update local state to indicate API is loaded
      setIsApiLoaded(true);
    };
    
    // Create and inject the Spotify script
    const script = document.createElement('script');
    script.src = 'https://open.spotify.com/embed/iframe-api/v1';
    script.async = true;
    document.body.appendChild(script);
  };

  // Create player container and load track
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
        });
      });
    } catch (error) {
      console.error('Error setting up Spotify player:', error);
      onError(`Error: ${error.message || 'Failed to set up player'}`);
    }
  };

  // Create player container
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

  // Player control methods
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

  const pause = () => {
    if (!spotifyControllerRef.current) return;
    try {
      spotifyControllerRef.current.pause();
    } catch (error) {
      console.error("Error pausing Spotify player:", error);
    }
  };

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

  // Cleanup function - ensure proper teardown of player
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
  };

  // Expose player methods to parent component
  useImperativeHandle(ref, () => ({
    play,
    pause,
    resume,
    cleanup: cleanupPlayer
  }));

  return (
    <div 
      ref={playerContainerRef}
      className="player-container-wrapper"
      style={{ display: trackId ? 'block' : 'none' }}
    />
  );
});

SpotifyPlayer.displayName = 'SpotifyPlayer';

export default SpotifyPlayer;