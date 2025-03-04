import React from "react";
import TextBox from "./TextBox";
import SpotifyController from '../services/SpotifyController';

import "./Song.css";

export const STATE_LYRICS_NONE = 'none';
export const STATE_LYRICS_SUGGESTED = 'suggested';
export const STATE_LYRICS_FROZEN = 'frozen';
export const STATE_LYRICS_VALIDATE = 'validate';
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
        this.lyrics = [];
        this.guessTimecode = 0;
        this.musicBedTimeout = null;
    }

    componentDidMount() {
        this.setupSpotifyListeners();
        SpotifyController.initialize().then(() => {
            this.load();
        });
    }

    componentWillUnmount() {
        this.cleanup();
    }

    componentDidUpdate(prevProps) {
        // Handle song change
        if (this.props.song.id !== prevProps.song.id) {
            this.load();
        }

        // Handle lyrics state changes
        if (this.props.suggestedLyrics.state !== prevProps.suggestedLyrics.state) {
            this.handleLyricsStateChange();
        }

        // Start playing when both audio and lyrics are ready
        if ((!prevProps.audioReady || !prevProps.lyricsReady) &&
            this.state.audioReady && this.state.lyricsReady) {
            this.startPlaying();
        }
    }

    setupSpotifyListeners() {
        SpotifyController.onReady(() => {
            this.setState({ audioReady: true });
        });

        SpotifyController.onPosition((position) => {
            this.handleLyricsTimecodeUpdate(position);
        });

        SpotifyController.onError(() => {
            this.setState({ audioReady: false });
        });
    }

    cleanup() {
        if (this.musicBedTimeout) {
            clearTimeout(this.musicBedTimeout);
            this.musicBedTimeout = null;
        }
        SpotifyController.reset();
    }

    load() {
        this.cleanup();
        this.setState({
            audioReady: false,
            lyricsReady: false,
            currentLine: -1,
            wordsClass: [],
        });

        const parts = this.props.song.guess_timecode.split(':');
        this.guessTimecode = Math.floor((parseInt(parts[0]) * 60 + parseFloat(parts[1])) * 1000);

        fetch(`http://localhost:4001/api/song/${this.props.song.id}`)
            .then(response => response.json())
            .then(data => {
                this.lyrics = data.lyrics.map(item => ({
                    timecode: Math.floor(item.timecode),
                    content: item.content
                }));
                
                SpotifyController.loadUri(data.track.uri)
                    .then(() => {
                        this.setState({ lyricsReady: true });
                    })
                    .catch(error => {
                        console.error('Error loading track:', error);
                        this.setState({ audioReady: false });
                    });
            })
            .catch(error => {
                console.error('Error loading song data:', error);
            });
    }

    handleLyricsTimecodeUpdate(timecode) {
        if (!SpotifyController.controller)
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
            SpotifyController.pause();
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

        SpotifyController.play()
            .catch(error => {
                console.error('Error playing track:', error);
                this.setState({ audioReady: false });
            });
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

    handleLyricsStateChange() {
        const suggestedLyrics = this.props.suggestedLyrics;
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
