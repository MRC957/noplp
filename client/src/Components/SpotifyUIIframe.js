import React from "react";
import TextBox from "./TextBox";
import "./Song.css";

export default class SpotifyUIIframe extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            playerReady: false,
            trackId: '',
            playerVisible: false,
            currentTime: 0,
            trackInfo: null,
            errorMessage: null,
            stopThreshold: 10000, // Default 10 seconds (in ms)
            thresholdReached: false
        };
        
        // References to Spotify objects
        this.spotifyApi = null;
        this.spotifyController = null;
        this.playbackTimer = null;
        this.playbackStartTime = 0;
        this.playerContainerRef = React.createRef(); // Add ref for player container
    }

    componentDidMount() {
        // Load Spotify Iframe API
        this.loadSpotifyIframeApi();
    }

    componentWillUnmount() {
        // Clean up
        this.stopPlaybackTimer();
        if (this.spotifyController) {
            this.spotifyController.destroy();
        }
    }

    loadSpotifyIframeApi() {
        // Check if already loaded
        if (window.onSpotifyIframeApiReady) {
            return;
        }

        window.onSpotifyIframeApiReady = (IFrameAPI) => {
            console.log('Spotify Iframe API is ready');
            this.spotifyApi = IFrameAPI;
            this.setState({ playerReady: true });
        };

        // Load the script
        const script = document.createElement('script');
        script.src = 'https://open.spotify.com/embed/iframe-api/v1';
        script.async = true;
        document.body.appendChild(script);
    }

    handleInputChange = (e) => {
        this.setState({ trackId: e.target.value });
    }

    handleThresholdChange = (e) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value >= 0) {
            this.setState({ stopThreshold: value });
        }
    }

    handleSubmit = (e) => {
        e.preventDefault();
        this.createPlayerContainer();
        this.loadTrack();
    }
    
    createPlayerContainer() {
        // Get the parent container where we'll place the player
        const parentContainer = this.playerContainerRef.current;
        if (!parentContainer) {
            console.error('Player parent container not found');
            return false;
        }
        
        // Clear any existing player
        parentContainer.innerHTML = '';
        
        // Create fresh player container
        const playerElement = document.createElement('div');
        playerElement.id = 'spotify-player';
        playerElement.className = 'spotify-player-container';
        
        // Add to DOM
        parentContainer.appendChild(playerElement);
        
        return true;
    }

    loadTrack() {
        const { trackId } = this.state;
        if (!trackId.trim()) {
            this.setState({ errorMessage: 'Please enter a Spotify track ID' });
            return;
        }

        // Clean up existing controller if any
        if (this.spotifyController) {
            this.stopPlaybackTimer();
            this.spotifyController.destroy();
            this.spotifyController = null;
        }
        
        this.setState({
            playerVisible: true,
            trackInfo: { title: `Loading track: ${trackId}` },
            currentTime: 0,
            errorMessage: null,
            thresholdReached: false
        });

        try {
            // Get the element to embed the player - should be freshly created
            const element = document.getElementById('spotify-player');
            if (!element) {
                throw new Error('Player container not found');
            }
            
            // Ensure the API is loaded
            if (!this.spotifyApi) {
                throw new Error('Spotify Iframe API not loaded');
            }
            
            // Create controller with options
            const options = {
                uri: `spotify:track:${trackId}`,
                width: '100%',
                height: '152',
                theme: 'dark'
            };
            
            this.spotifyApi.createController(element, options, (controller) => {
                // Store controller for later use
                this.spotifyController = controller;
                
                // Set up event listeners
                controller.addListener('ready', () => {
                    console.log('Spotify player is ready');
                    this.startPlaybackTimer();
                    this.setState({ 
                        trackInfo: { title: `Now Playing: Track ID ${trackId}` }
                    });
                });
                
                controller.addListener('playback_update', (data) => {
                    if (data && data.data && typeof data.data.position === 'number') {
                        // Update with actual position from player
                        const position = data.data.position; // convert to ms
                        this.setState({ currentTime: position });
                        console.log(`Spoify player position: ${position}ms.`);
                        
                        // Check if threshold is reached
                        if (position >= this.state.stopThreshold && !this.state.thresholdReached) {
                            this.setState({ thresholdReached: true });
                            console.log(`Threshold reached (${this.state.stopThreshold}ms) at position ${position}ms. Stopping playback.`);
                            controller.pause()
                            // controller.pause().catch(err => {
                            //     console.error('Failed to pause at threshold:', err);
                            // });
                        }
                    }
                });
                
                controller.addListener('error', (error) => {
                    console.error('Spotify player error:', error);
                    this.setState({ 
                        errorMessage: `Error: ${error.message || 'Failed to load track'}` 
                    });
                });
            });
        } catch (error) {
            console.error('Error setting up Spotify player:', error);
            this.setState({
                errorMessage: `Error: ${error.message || 'Failed to set up player'}`,
                playerVisible: false
            });
        }
    }

    startPlaybackTimer() {
        this.stopPlaybackTimer();
        
        // Try to play the track
        if (this.spotifyController) {
            this.spotifyController.play()
        }
    }

    stopPlaybackTimer() {
        if (this.playbackTimer) {
            // clearInterval(this.playbackTimer);
            this.playbackTimer = null;
        }
    }

    formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    renderSpotifyHelp() {
        return (
            <div className="spotify-help">
                <p>How to find a Spotify Track ID:</p>
                <ol>
                    <li>Find a song on Spotify</li>
                    <li>Click "Share" and then "Copy Song Link"</li>
                    <li>The link will look like: https://open.spotify.com/track/<strong>1Bd5D0EjGwgp1GRqO4nJyp</strong>...</li>
                    <li>Copy the ID part (highlighted above) and paste it here</li>
                </ol>
            </div>
        );
    }

    renderTimecode() {
        const { currentTime } = this.state;
        return (
            <TextBox className="timecode-display">
                <div className="timecode-label">Current Time:</div>
                <div className="timecode-value">{this.formatTime(currentTime)}</div>
            </TextBox>
        );
    }

    render() {
        const { trackId, playerVisible, trackInfo, errorMessage, stopThreshold, thresholdReached } = this.state;
        
        return (
            <div className="spotify-ui-container">
                <form onSubmit={this.handleSubmit} className="track-id-form">
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="trackId">Spotify Track ID:</label>
                            <input 
                                id="trackId"
                                type="text" 
                                placeholder="Enter Spotify Track ID" 
                                value={trackId}
                                onChange={this.handleInputChange}
                                className="track-id-input"
                            />
                        </div>
                        
                        <div className="form-group">
                            <label htmlFor="threshold">Stop at (ms):</label>
                            <input 
                                id="threshold"
                                type="number" 
                                min="0"
                                step="1000"
                                value={stopThreshold}
                                onChange={this.handleThresholdChange}
                                className="threshold-input"
                            />
                        </div>
                    </div>
                    
                    <button 
                        type="submit" 
                        className="track-id-submit"
                        disabled={!this.state.playerReady}
                    >
                        {this.state.playerReady ? 'Load Track' : 'Loading Spotify...'}
                    </button>
                </form>
                
                {errorMessage && (
                    <div className="error-message">{errorMessage}</div>
                )}
                
                {!playerVisible && this.renderSpotifyHelp()}
                
                {/* Player container placeholder - will be populated dynamically */}
                <div 
                    ref={this.playerContainerRef}
                    className="player-container-wrapper"
                    style={{ display: playerVisible ? 'block' : 'none' }}
                ></div>
                
                {playerVisible && trackInfo && (
                    <>
                        <TextBox className="song-info">
                            <div className="song-title">{trackInfo.title}</div>
                            {thresholdReached && (
                                <div className="threshold-notice">
                                    Playback stopped at threshold ({this.formatTime(stopThreshold)})
                                </div>
                            )}
                        </TextBox>
                        {this.renderTimecode()}
                    </>
                )}
            </div>
        );
    }
}
