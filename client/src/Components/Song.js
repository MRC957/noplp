import React from "react";
import TextBox from "./TextBox";

import "./Song.css";

export const STATE_LYRICS_NONE = 'none';
export const STATE_LYRICS_SUGGESTED = 'suggested';
export const STATE_LYRICS_FROZEN = 'frozen';
export const STATE_LYRICS_VALIDATE = ' validate';
export const STATE_LYRICS_REVEAL = 'reveal';

export default class Song extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            audioReady: false,
            lyricsReady: false,
            currentLine: -1,
            wordsClass: [],
        };
        this.spotifyPlayer = React.createRef();
        this.lyrics = [];
        this.guessTimecode = 0;
        this.musicBedTimeout = null;
        this.isFirstMount = true;
    }

    componentDidMount() {
        this.load();

        // window.onSpotifyIframeApiReady = (IFrameAPI) => {
        //     const element = document.getElementById('spotify-player');
        //     const options = {
        //         width: '100%',
        //         height: '100',
        //     };
        //     const callback = (EmbedController) => {
        //         this.spotifyController = EmbedController;
        //         EmbedController.addListener('playback_update', (e) => {
        //             if (e.data.position) {
        //                 this.handleLyricsTimecodeUpdate(e.data.position * 1000);
        //             }
        //         });
        //     };
        //     IFrameAPI.createController(element, options, callback);
        // };

        // // Load Spotify Embed SDK
        // const script = document.createElement('script');
        // script.src = 'https://open.spotify.com/embed-podcast/iframe-api/v1';
        // script.async = true;
        // document.body.appendChild(script);
    }

    componentDidUpdate(prevProps) {
        if (this.props.song.id !== prevProps.song.id) {
            // this.reset();
            this.load();
        }
        this.startPlaying();

        const suggestedLyrics = this.props.suggestedLyrics;
        if (suggestedLyrics.state !== prevProps.suggestedLyrics.state) {
            if (this.shouldShowSuggestedLyrics()) {
                const correctWords = this.lyrics[this.state.currentLine].content.split(' ');
                const lyrics = this.getLyricsToDisplay();
                const suggestedWords = lyrics.split(' ');
                
                const wordsClass = this.validateWords(
                    correctWords, 
                    suggestedWords, 
                    suggestedLyrics.state
                );
                
                const effect = this.determineEffect(wordsClass, correctWords.length);

                this.setState({ wordsClass });

                if (effect) {
                    this.props.colorFlash(effect);
                    this.props.jukebox(effect);
                }
            }
        }
    } 

    load() {
        this.reset();

        const parts = this.props.song.guess_timecode.split(':');
        this.guessTimecode = Math.floor((parseInt(parts[0]) * 60 + parseFloat(parts[1]))*1000);

        fetch(`http://localhost:4001/api/song/${this.props.song.id}`)
            .then(response => response.json())
            .then(data => {
                // Process lyrics
                this.lyrics = data.lyrics.map(item => ({
                    timecode: Math.floor(item.timecode),
                    content: item.content
                }));
                
                // Update Spotify player
                if (this.spotifyController) {
                    this.spotifyController.loadUri(data.track.uri);
                }
                
                this.setState({ lyricsReady: true, audioReady: true });
            })
            .catch(error => {
                console.error('Error loading song data:', error);
            });
    }

    reset() {
        if (this.isFirstMount) {
            this.props.jukebox('');
            this.isFirstMount = false;
        }

        if (this.spotifyController) {
            this.spotifyController.destroy();
        }
        this.lyrics = [];
        this.setState({
            audioReady: false,
            lyricsReady: false,
            currentLine: -1,
        });
    }

    handleLyricsTimecodeUpdate(timecode) {
        if (!this.spotifyController)
            return;

        const i = this.state.currentLine; 
        const nextCt = (i + 1 < this.lyrics.length) ? this.lyrics[i+1].timecode : Number.MAX_VALUE;

        if (timecode > nextCt) {
            this.setState({
                ...this.state,
                currentLine: i + 1,
            });
        }

        if (this.state.currentLine >= this.props.song.guess_line) {
            this.spotifyController.pause();
            const timeoutCb = () => {
                this.props.jukebox('bed');
            };
            this.musicBedTimeout = setTimeout(timeoutCb, 5000);
        }
    }

    startPlaying() {
        if (!this.state.audioReady || !this.state.lyricsReady) {
            return;
        }

        if (this.spotifyController) {
            this.spotifyController.play();
        }
    }

    render() {
        return (
            <>
                <div id="spotify-player"></div>
                {this.renderHeader()}
                {this.renderLyrics()}
            </>
        );
    }

    renderHeader() {
        return (
            <TextBox className="song-info">
                <div className="song-title">{this.props.song.title}</div>
                <div className="song-artist">{this.props.song.artist}</div>
            </TextBox>
        );
    }

    renderLyrics() {
        if (this.shouldShowSuggestedLyrics()) {
            return this.renderSuggestedLyrics();
        }
        return this.renderNormalLyrics();
    }

    shouldShowSuggestedLyrics() {
        const { suggestedLyrics, song } = this.props;
        return suggestedLyrics.state !== STATE_LYRICS_NONE && 
               song.guess_line === this.state.currentLine;
    }

    renderSuggestedLyrics() {
        const previousLine = this.lyrics[this.state.currentLine - 1].content;
        const lyrics = this.getLyricsToDisplay();
        const words = this.renderWords(lyrics);

        return (
            <div>
                <TextBox content={previousLine}></TextBox>
                <TextBox>{words}</TextBox>
            </div>
        );
    }

    getLyricsToDisplay() {
        const { suggestedLyrics } = this.props;
        return suggestedLyrics.state === STATE_LYRICS_REVEAL 
            ? this.lyrics[this.state.currentLine].content 
            : suggestedLyrics.content;
    }

    renderWords(lyrics) {
        return lyrics.split(' ').map((word, index) => (
            <span 
                className={`lyrics-word ${this.state.wordsClass[index]}`} 
                key={`word-${index}`}
            >
                {`${word} `}
            </span>
        ));
    }

    renderNormalLyrics() {
        const content = this.state.currentLine >= 0 
            ? this.lyrics[this.state.currentLine].content 
            : ' ';
        const hidden = this.props.song.guess_line === this.state.currentLine;

        return (
            <TextBox 
                content={content} 
                hidden={hidden} 
                className="song-lyrics" 
            />
        );
    }

    validateWords(correctWords, suggestedWords, state) {
        return suggestedWords.map((word, index) => {
            if (state === STATE_LYRICS_FROZEN) {
                return 'freeze';
            }
            if (state === STATE_LYRICS_VALIDATE) {
                return this.getWordValidationClass(word, correctWords[index]);
            }
            return '';
        });
    }

    getWordValidationClass(suggestedWord, correctWord) {
        if (!correctWord) return 'bad';
        return suggestedWord.toUpperCase() === correctWord.toUpperCase() 
            ? 'good' 
            : 'bad';
    }

    determineEffect(wordsClass, correctWordsLength) {
        const isFreeze = wordsClass.includes('freeze');
        const isBad = wordsClass.includes('bad');
        const isGood = wordsClass.filter(c => c === 'good').length === correctWordsLength;

        if (isFreeze) return 'freeze';
        if (isBad) return 'bad';
        if (isGood) return 'good';
        return '';
    }
}
