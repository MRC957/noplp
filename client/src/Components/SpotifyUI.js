import React from "react";
import TextBox from "./TextBox";
import SpotifyController from '../services/SpotifyController';

import "./Song.css";

export default class SpotifyUI extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            playerReady: false,
            trackId: '',
            playerVisible: false,
            trackInfo: null,
            currentTime: 0
        };
    }

    componentDidMount() {
        // We need to make sure the player div exists before initializing
        SpotifyController.initialize();
        SpotifyController.onReady(() => {
            this.setState({ playerReady: true });
        });
        SpotifyController.onError(() => {
            this.setState({ playerReady: false });
        });
        SpotifyController.onTimeUpdate((position) => {
            this.setState({ currentTime: position });
        });
    }

    componentWillUnmount() {
        SpotifyController.reset();
    }

    handleInputChange = (e) => {
        this.setState({ trackId: e.target.value });
    }

    handleSubmit = (e) => {
        e.preventDefault();
        this.loadTrack();
    }

    loadTrack() {
        const { trackId } = this.state;
        if (!trackId.trim()) {
            alert('Please enter a Spotify track ID');
            return;
        }

        // Clean up any existing track
        SpotifyController.reset();
        
        this.setState({
            playerReady: false,
            playerVisible: true,
            trackInfo: { title: `Loading track: ${trackId}` },
            currentTime: 0
        });

        // Load the track using the controller
        SpotifyController.loadUri(trackId)
            .then(() => {
                this.setState({ 
                    trackInfo: { title: `Track ID: ${trackId}` }
                });
            })
            .catch(error => {
                console.error('Error loading track:', error);
                alert('Failed to load track. Please check the track ID and try again.');
                this.setState({ 
                    playerReady: false,
                    playerVisible: false 
                });
            });
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

    // Helper function to format milliseconds as MM:SS
    formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
        const { trackId, playerVisible, trackInfo } = this.state;
        
        return (
            <div className="spotify-ui-container">
                <form onSubmit={this.handleSubmit} className="track-id-form">
                    <input 
                        type="text" 
                        placeholder="Enter Spotify Track ID" 
                        value={trackId}
                        onChange={this.handleInputChange}
                        className="track-id-input"
                    />
                    <button type="submit" className="track-id-submit">
                        Load Track
                    </button>
                </form>
                
                {!playerVisible && this.renderSpotifyHelp()}
                
                {/* Always render the player container, but hide it when not in use */}
                <div 
                    id="spotify-player" 
                    className="spotify-player-container" 
                    style={{ display: playerVisible ? 'block' : 'none' }}
                ></div>
                
                {playerVisible && (
                    <>
                        {trackInfo && (
                            <TextBox className="song-info">
                                <div className="song-title">{trackInfo.title}</div>
                            </TextBox>
                        )}
                        {this.renderTimecode()}
                    </>
                )}
            </div>
        );
    }
}
