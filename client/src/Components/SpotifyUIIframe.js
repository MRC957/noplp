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
            lyrics: [],
            currentLyricIndex: -1,
            lyricsLoading: false,
            lyricsError: null,
            lyricsToGuess: [], 
            wordsToGuess: 1,
            guessedWords: {},
            pausedForGuessing: false,
            pauseOffset: 500
        };
        
        this.spotifyApi = null;
        this.spotifyController = null;
        this.playerContainerRef = React.createRef();
    }

    componentDidMount() {
        this.loadSpotifyIframeApi();
    }

    componentWillUnmount() {
        if (this.spotifyController) {
            this.spotifyController.destroy();
        }
    }

    loadSpotifyIframeApi() {
        if (window.onSpotifyIframeApiReady) return;

        window.onSpotifyIframeApiReady = (IFrameAPI) => {
            console.log('Spotify Iframe API is ready');
            this.spotifyApi = IFrameAPI;
            this.setState({ playerReady: true });
        };

        const script = document.createElement('script');
        script.src = 'https://open.spotify.com/embed/iframe-api/v1';
        script.async = true;
        document.body.appendChild(script);
    }

    handleInputChange = (e) => {
        this.setState({ trackId: e.target.value });
    }

    handleSubmit = (e) => {
        e.preventDefault();
        this.createPlayerContainer();
        this.loadTrack();
    }
    
    createPlayerContainer() {
        const parentContainer = this.playerContainerRef.current;
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
    }

    loadTrack() {
        const { trackId, wordsToGuess } = this.state;
        if (!trackId.trim()) {
            this.setState({ errorMessage: 'Please enter a Spotify track ID' });
            return;
        }

        if (this.spotifyController) {
            this.spotifyController.destroy();
            this.spotifyController = null;
        }
        
        this.setState({
            playerVisible: true,
            trackInfo: { title: `Loading track: ${trackId}` },
            currentTime: 0,
            errorMessage: null,
            lyrics: [],
            currentLyricIndex: -1,
            lyricsLoading: true,
            lyricsError: null,
            pausedForGuessing: false
        });

        this.fetchLyrics(trackId, wordsToGuess);
        this.createSpotifyPlayer(trackId);
    }
    
    createSpotifyPlayer(trackId) {
        try {
            const element = document.getElementById('spotify-player');
            if (!element) throw new Error('Player container not found');
            if (!this.spotifyApi) throw new Error('Spotify Iframe API not loaded');
            
            const options = {
                uri: `spotify:track:${trackId}`,
                width: '100%',
                height: '152',
                theme: 'dark'
            };
            
            this.spotifyApi.createController(element, options, (controller) => {
                this.spotifyController = controller;
                
                controller.addListener('ready', () => {
                    console.log('Spotify player is ready');
                    controller.play();
                    this.setState({ trackInfo: { title: `Now Playing: Track ID ${trackId}` } });
                });
                
                controller.addListener('playback_update', (data) => {
                    if (data?.data?.position !== undefined) {
                        const position = data.data.position
                        this.setState({ currentTime: position });
                        this.updateCurrentLyricAndCheckPause(position, controller);
                    }
                });
                
                controller.addListener('error', (error) => {
                    console.error('Spotify player error:', error);
                    this.setState({ errorMessage: `Error: ${error.message || 'Failed to load track'}` });
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

    fetchLyrics(trackId, wordsToGuess) {
        fetch(`http://localhost:4001/api/getLyrics/${trackId}/${wordsToGuess}`)
            .then(response => {
                if (!response.ok) throw new Error(`Failed to fetch lyrics: ${response.status}`);
                return response.json();
            })
            .then(data => {
                this.setState({ 
                    lyricsToGuess: data.lyricsToGuess || [], 
                    lyrics: data.lyrics || [], 
                    lyricsLoading: false 
                });
            })
            .catch(error => {
                console.error('Error fetching lyrics:', error);
                this.setState({ 
                    lyricsError: `Failed to load lyrics: ${error.message}`,
                    lyricsLoading: false 
                });
            });
    }

    updateCurrentLyricAndCheckPause(currentTime, controller) {
        const { lyrics, lyricsToGuess, currentLyricIndex, pausedForGuessing, pauseOffset } = this.state;
        if (!lyrics || lyrics.length === 0) return;

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
            const stateUpdate = { currentLyricIndex: newIndex };
            if (currentLyricIndex !== -1) stateUpdate.pausedForGuessing = false;
            this.setState(stateUpdate);
        }

        // Check for upcoming guessable lyrics to pause for
        if (!pausedForGuessing && controller) {
            for (let i = 0; i < lyrics.length; i++) {
                const timeUntilLyric = lyrics[i].startTimeMs - currentTime;
                
                if (timeUntilLyric > 0 && timeUntilLyric <= pauseOffset) {
                    if (lyricsToGuess.some(g => g.startTimeMs === lyrics[i].startTimeMs)) {
                        console.log(`Pausing before lyric with words to guess`);
                        controller.pause();
                        this.setState({ pausedForGuessing: true, currentLyricIndex: i });
                        break;
                    }
                }
            }
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
        return (
            <TextBox className="timecode-display">
                <div className="timecode-label">Current Time:</div>
                <div className="timecode-value">{this.formatTime(this.state.currentTime)}</div>
            </TextBox>
        );
    }

    renderLyrics() {
        const { lyrics, lyricsToGuess, currentLyricIndex, lyricsLoading, lyricsError } = this.state;

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
            let displayText = this.processLyricLine(line, guessEntry);
            
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
                <h3 className="lyrics-header">Lyrics</h3>
                <div className="lyrics-scroll-area">
                    {visibleLyrics}
                </div>
            </TextBox>
        );
    }
    
    processLyricLine(line, guessEntry) {
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
    }

    render() {
        const { trackId, playerVisible, trackInfo, errorMessage, pausedForGuessing } = this.state;
        
        return (
            <div className="spotify-ui-container">
                <form onSubmit={this.handleSubmit} className="track-id-form">
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
                    
                    <button 
                        type="submit" 
                        className="track-id-submit"
                        disabled={!this.state.playerReady}
                    >
                        {this.state.playerReady ? 'Load Track' : 'Loading Spotify...'}
                    </button>
                </form>
                
                {errorMessage && <div className="error-message">{errorMessage}</div>}
                {!playerVisible && this.renderSpotifyHelp()}
                
                <div 
                    ref={this.playerContainerRef}
                    className="player-container-wrapper"
                    style={{ display: playerVisible ? 'block' : 'none' }}
                />
                
                {playerVisible && trackInfo && (
                    <>
                        <TextBox className="song-info">
                            <div className="song-title">{trackInfo.title}</div>
                            {pausedForGuessing && (
                                <div className="guess-notice">
                                    Playback paused: Fill in the missing words!
                                </div>
                            )}
                        </TextBox>
                        {this.renderTimecode()}
                        {this.renderLyrics()}
                    </>
                )}
            </div>
        );
    }
}
