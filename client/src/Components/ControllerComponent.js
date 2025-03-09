import React from "react";

import ClientComponent from "./ClientComponent";

import './ControllerComponent.css';

export default class ControllerComponent extends ClientComponent {
    constructor(props) { 
        super(props);
        this.state = {
            playlist: {},
            ffaMode: false,
            perfMode: false,
            pickedSongs: [],
            pickedCategories: [],
            proposedLyrics: '',
            expectedWords: 0,
            trackId: '',
            songResults: {} // Track validation results for each song
        };

        this.handleToIntro = this.handleToIntro.bind(this);
        this.handleToSongList = this.handleToSongList.bind(this);
        this.handleToSong = this.handleToSong.bind(this);
        this.handleToCategories = this.handleToCategories.bind(this);
        this.handleReset = this.handleReset.bind(this);
        this.handleFfaToggle = this.handleFfaToggle.bind(this);
        this.handleProposeLyrics = this.handleProposeLyrics.bind(this);
        this.handleInput = this.handleInput.bind(this);
        this.handleLyricsFreeze = this.handleLyricsFreeze.bind(this);
        this.handleLyricsValidate = this.handleLyricsValidate.bind(this);
        this.handleLyricsReveal = this.handleLyricsReveal.bind(this);
        this.handleLyricsContinue = this.handleLyricsContinue.bind(this);
        this.handlePerfModeToggle = this.handlePerfModeToggle.bind(this);
        this.handleTrackIdChange = this.handleTrackIdChange.bind(this);
    }

    componentDidMount() {
        super.componentDidMount();
        // load playlist
        const playlistCb = this.setPlaylist.bind(this);
        fetch('http://localhost:4001/api/playlist')
            .then(response => response.json())
            .then((data) => {
                playlistCb(data);
            })
            .catch(error => {
                console.error('Error fetching playlist:', error);
            });

        // Listen for lyric validation results
        this.socket.on('lyrics-validation-result', (data) => {
            const { songId, isCorrect } = data;
            if (songId) {
                this.setState(prevState => ({
                    ...prevState,
                    songResults: {
                        ...prevState.songResults,
                        [songId]: isCorrect
                    }
                }));
                console.log(`Updated song result for ${songId}: ${isCorrect}`);
            }
        });
    }

    setPlaylist(data) {
        this.setState({
            ...this.state,
            playlist: data
        });
    }

    handleReset() {
        console.log('Reseting');
        this.setState({
            ...this.state,
            ffaMode: false,
            pickedSongs: [],
            pickedCategories: [],
            trackId: '',
            songResults: {} // Reset song results on reset
        });
    }

    handlePerfModeToggle() {
        this.setState({
            ...this.state,
            perfMode: !this.state.perfMode
        });
        this.socket.emit('set-perf-mode', this.state.perfMode);
    }

    handleFfaToggle() {
        console.log('handle ffa mode', this.state.ffaMode);
        this.setState({
            ...this.state,
            ffaMode: !this.state.ffaMode
        });
    }

    handleToIntro() {
        this.socket.emit('show-intro');
    }

    handleToCategories() {
        const categories = this.state.playlist.categories.map(c => {
            return {
                ...c,
                picked: this.state.pickedCategories.indexOf(c.id) !== -1
            };
        }).sort();
        console.log(categories);
        this.socket.emit('show-categories', categories);
    }

    handleToSongList(categoryId) {
        console.log(categoryId);
        if (categoryId) {
            this.setState({
                ...this.state,
                pickedCategories: [...this.state.pickedCategories, categoryId]
            });
        }
        console.log(this.state)
        const songs = this.state.playlist.songs.filter(s => {
            return categoryId === undefined | s.category === categoryId;
        }).map(s => {
            console.log(s.id, this.state.pickedSongs, s.id in this.state.pickedSongs)
            return {
                picked: this.state.pickedSongs.indexOf(s.id) !== -1,
                title: s.title,
                artist: s.artist,
                year: s.year,
            }
        }).sort();
        console.log(songs)
        const categoryName = categoryId === undefined ? 'Toutes' : this.state.playlist.categories.find(c => c.id === categoryId).name;
        console.log(categoryId, categoryName)
        this.socket.emit('show-song-list', {
            name: categoryName,
            songs: songs
        });
    }

    handleToSong(id) {
        this.setState({
            ...this.state,
            pickedSongs: [...this.state.pickedSongs, id]
        });
        console.log(this.state);
        const song = this.state.playlist.songs.find(song => song.id === id);
        console.log('goto song', song);
        
        if (this.state.ffaMode) {
            song.guess_line = 9000;
            song.guess_timecode = '99:00.00';
        }
        
        // Add track_id to the song object if it's available
        if (this.state.trackId) {
            song.track_id = this.state.trackId;
        }
        
        this.socket.emit('goto-song', song);
        this.setState({
            ...this.state,
            expectedWords: song.expected_words || 0
        })
    }

    handleTrackIdChange(evt) {
        this.setState({
            ...this.state,
            trackId: evt.target.value
        });
    }

    handleProposeLyrics() {
        const lyrics = this.state.proposedLyrics.trim();
        console.log(' propose Lyrics', lyrics);
        this.socket.emit('propose-lyrics', lyrics);
    }
    
    handleInput(evt) {
        this.setState({
            ...this.state,
            proposedLyrics: evt.target.value,
        });
    }
    
    handleLyricsFreeze() {
        this.proposedLyricsRef.value = '';
        this.socket.emit('freeze-lyrics');
    }

    handleLyricsValidate() { 
        this.socket.emit('validate-lyrics');
    }

    handleLyricsReveal() {
        this.socket.emit('reveal-lyrics');
    }

    handleLyricsContinue() {
        this.socket.emit('continue-lyrics');
    }

    render() {
        const songList = this.state.playlist.songs || [];
        const categories = (this.state.playlist.categories || []).map(c => {
            return {
                ...c,
                songs: songList.filter(s => s.category === c.id),
            }
        });

        const categoriesElements = categories.map(cat => {
            const songsElements = cat.songs.map(song => {
                // Determine button class based on validation result
                let buttonClass = '';
                if (this.state.songResults.hasOwnProperty(song.id)) {
                    buttonClass = this.state.songResults[song.id] ? 'success' : 'failure';
                }
                
                return (
                    <button 
                        key={song.id} 
                        className={buttonClass}
                        onClick={() => this.handleToSong(song.id)}
                    >
                        Go to "{song.title}"
                    </button>
                )
            }); 
            return (
                <div className="category" key={`category-${cat.id}`}>
                    <button className="title" key={cat.id} onClick={() => this.handleToSongList(cat.id)}>Go to "{cat.name}"</button>
                    <div className="songs">
                        {songsElements}
                    </div>
                </div>
            );
        });

        const canPropose = this.state.expectedWords > 0 && this.state.proposedLyrics.trim().split(' ').length === this.state.expectedWords;

        return (
            <div className="controller">
                <div className="service">
                    <button onClick={this.handleFfaToggle}>FFA {this.state.ffaMode? 'On' : 'Off'}</button>
                    <button onClick={this.handlePerfModeToggle}>Perf {this.state.perfMode? 'On' : 'Off'}</button>
                    <button className="warn" onClick={this.handleReset}> RESET </button>
                </div>
                <button onClick={this.handleToIntro}>To intro</button>
                <button onClick={this.handleToCategories}>To Categories</button>
                
                <div className="track-id-form">
                    <div className="form-group">
                        <label htmlFor="trackId">Spotify Track ID:</label>
                        <input 
                            id="trackId"
                            type="text" 
                            placeholder="Enter Spotify Track ID" 
                            value={this.state.trackId}
                            onChange={this.handleTrackIdChange}
                            className="track-id-input"
                        />
                    </div>
                    <div className="helper-text">
                        This track ID will be sent with the next song
                    </div>
                </div>
                
                <div className="lyrics-form">
                    <input  placeholder={`${this.state.expectedWords} mots attendu`} 
                            ref={el => this.proposedLyricsRef = el} 
                            onChange={this.handleInput} />
                    <div>
                        <button onClick={this.handleProposeLyrics} disabled={!canPropose}>Propose Lyrics</button>
                        <button onClick={this.handleLyricsFreeze} disabled={!canPropose}>Freeze</button>
                        <button onClick={this.handleLyricsValidate} disabled={!canPropose}>Validate</button>
                        <button onClick={this.handleLyricsReveal}>Reveal</button>
                        <button onClick={this.handleLyricsContinue}>Continue</button>
                    </div>
                </div>
                {categoriesElements}
            </div>
        )
    }
}
