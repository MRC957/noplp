class SpotifyController {
    constructor() {
        this.readyCallback = null;
        this.errorCallback = null;
        this.currentTrackId = null;
        this.isInitialized = false;
        this.iframe = null;
        this.timeUpdateCallback = null;
        this.playbackTimer = null;
        this.playbackStartTime = 0;
        this.estimatedPosition = 0;
    }

    initialize() {
        if (this.isInitialized) {
            return Promise.resolve();
        }

        // Simple initialization since we're not loading SDK anymore
        this.isInitialized = true;
        return Promise.resolve();
    }

    onReady(callback) {
        this.readyCallback = callback;
        // If we already have an iframe element, call ready immediately
        if (this.isInitialized && document.getElementById('spotify-player')) {
            setTimeout(callback, 0);
        }
    }

    onError(callback) {
        this.errorCallback = callback;
    }

    onTimeUpdate(callback) {
        this.timeUpdateCallback = callback;
    }

    // We don't need onPosition anymore as we won't get position updates

    loadUri(uri) {
        // Reset timers when loading a new track
        this.stopPlaybackTimer();
        this.estimatedPosition = 0;
        
        // Extract track ID from URI
        let trackId;
        if (uri.startsWith('spotify:track:')) {
            trackId = uri.split(':')[2];
        } else {
            trackId = uri; // Assume it's already a track ID
        }

        if (!this.isValidTrackId(trackId)) {
            return Promise.reject('Invalid Spotify track ID');
        }

        if (this.currentTrackId === trackId) {
            return Promise.resolve();
        }

        this.currentTrackId = trackId;

        // Create and insert the iframe
        try {
            const container = document.getElementById('spotify-player');
            if (!container) {
                console.error('Player container not found in the DOM');
                return Promise.reject('Player container not found');
            }

            // Clear the container
            container.innerHTML = '';

            // Ensure the container is visible
            container.style.display = 'block';

            // Create the iframe with autoplay parameter
            this.iframe = document.createElement('iframe');
            this.iframe.src = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&autoplay=0`;
            this.iframe.width = '100%';
            this.iframe.height = '352';
            this.iframe.frameBorder = "0";
            this.iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
            this.iframe.loading = "lazy";
            
            // Add a load listener to trigger ready callback and start timer
            this.iframe.onload = () => {
                if (this.readyCallback) {
                    this.readyCallback();
                }
                // Start tracking time once iframe is loaded
                this.startPlaybackTimer();
            };
            
            // Add an error listener
            this.iframe.onerror = (err) => {
                console.error("Error loading Spotify iframe:", err);
                if (this.errorCallback) {
                    this.errorCallback(err);
                }
            };

            container.appendChild(this.iframe);
            return Promise.resolve();
        } catch (error) {
            console.error("Error creating Spotify iframe:", error);
            if (this.errorCallback) {
                this.errorCallback(error);
            }
            return Promise.reject(error);
        }
    }

    startPlaybackTimer() {
        this.stopPlaybackTimer();
        
        // Reset timer to current time
        this.playbackStartTime = Date.now();
        this.estimatedPosition = 0;
        
        console.log("Starting playback timer");
        
        // Start timer to update position
        this.playbackTimer = setInterval(() => {
            this.updateEstimatedPosition();
        }, 1000);
        
        // Notify that playback has started
        if (this.timeUpdateCallback) {
            this.timeUpdateCallback(0); // Send initial time update
        }
    }

    stopPlaybackTimer() {
        if (this.playbackTimer) {
            clearInterval(this.playbackTimer);
            this.playbackTimer = null;
        }
    }

    updateEstimatedPosition() {
        // Calculate time elapsed since playback started
        if (this.playbackStartTime > 0) {
            this.estimatedPosition = (Date.now() - this.playbackStartTime);
            if (this.timeUpdateCallback) {
                this.timeUpdateCallback(this.estimatedPosition);
            }
        }
    }

    getEstimatedPosition() {
        return this.estimatedPosition;
    }

    // These methods don't really do anything now, as the iframe controls playback
    play() {
        this.startPlaybackTimer();
        return Promise.resolve();
    }

    pause() {
        this.stopPlaybackTimer();
        return Promise.resolve();
    }

    destroy() {
        this.stopPlaybackTimer();
        if (this.iframe) {
            try {
                const container = document.getElementById('spotify-player');
                if (container) {
                    container.innerHTML = '';
                }
            } catch (e) {
                console.error("Error removing iframe:", e);
            }
        }
        
        this.currentTrackId = null;
        this.readyCallback = null;
        this.errorCallback = null;
    }

    reset() {
        this.stopPlaybackTimer();
        this.estimatedPosition = 0;
        this.playbackStartTime = 0;
        this.destroy();
    }

    isValidTrackId(trackId) {
        // Spotify track IDs are typically 22 characters
        return typeof trackId === 'string' && 
               /^[a-zA-Z0-9]{22}$/.test(trackId);
    }

    getCurrentTrackId() {
        return this.currentTrackId;
    }

    // Helper method to check if player element exists
    checkPlayerExists() {
        const container = document.getElementById('spotify-player');
        return !!container;
    }
}

export default new SpotifyController();