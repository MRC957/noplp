import React, { useState, useEffect, useRef } from "react";
import { getSocket } from "../hooks/socketManager";
import './ControllerComponent.css';

const ControllerComponent = () => {
    const [state, setState] = useState({
        playlist: {},
        ffaMode: false,
        perfMode: false,
        pickedSongs: [],
        pickedCategories: [],
        proposedLyrics: '',
        expectedWords: 0,
        trackId: '',
        songResults: {}
    });

    const proposedLyricsRef = useRef(null);
    const socket = useRef(null);

    // Initialize socket
    useEffect(() => {
        console.log('Getting shared socket connection from socketManager');
        socket.current = getSocket();

        // Listen for lyric validation results
        socket.current.on('lyrics-validation-result', (data) => {
            const { songId, isCorrect } = data;
            if (songId) {
                setState(prevState => ({
                    ...prevState,
                    songResults: {
                        ...prevState.songResults,
                        [songId]: isCorrect
                    }
                }));
                console.log(`Updated song result for ${songId}: ${isCorrect}`);
            }
        });

        // Listen for words_to_guess updates
        socket.current.on('lyrics-words-count', (data) => {
            if (data && typeof data.count === 'number') {
                setState(prevState => ({
                    ...prevState,
                    expectedWords: data.count
                }));
                console.log(`Updated expected words count to: ${data.count}`);
            }
        });

        // Load playlist
        fetch('http://localhost:4001/api/playlist')
            .then(response => response.json())
            .then((data) => {
                setState(prevState => ({
                    ...prevState,
                    playlist: data
                }));
            })
            .catch(error => {
                console.error('Error fetching playlist:', error);
            });

        // Cleanup function
        return () => {
            socket.current = null;
        };
    }, []);

    const handleReset = () => {
        console.log('Reseting');
        setState(prevState => ({
            ...prevState,
            ffaMode: false,
            pickedSongs: [],
            pickedCategories: [],
            trackId: '',
            songResults: {}
        }));
    };

    const handlePerfModeToggle = () => {
        setState(prevState => {
            const newPerfMode = !prevState.perfMode;
            socket.current.emit('set-perf-mode', newPerfMode);
            return {
                ...prevState,
                perfMode: newPerfMode
            };
        });
    };

    const handleFfaToggle = () => {
        setState(prevState => ({
            ...prevState,
            ffaMode: !prevState.ffaMode
        }));
        console.log('handle ffa mode', !state.ffaMode);
    };

    const handleToIntro = () => {
        socket.current.emit('show-intro');
    };

    const handleToCategories = () => {
        const categories = state.playlist.categories?.map(c => {
            return {
                ...c,
                picked: state.pickedCategories.indexOf(c.id) !== -1
            };
        }).sort() || [];
        console.log(categories);
        socket.current.emit('show-categories', categories);
    };

    const handleToSongList = (categoryId) => {
        console.log(categoryId);
        if (categoryId) {
            setState(prevState => ({
                ...prevState,
                pickedCategories: [...prevState.pickedCategories, categoryId]
            }));
        }

        const songs = state.playlist.songs?.filter(s => {
            return categoryId === undefined || s.category === categoryId;
        }).map(s => {
            return {
                picked: state.pickedSongs.indexOf(s.id) !== -1,
                title: s.title,
                artist: s.artist,
                year: s.year,
            };
        }).sort() || [];

        const categoryName = categoryId === undefined ? 'Toutes' : 
            state.playlist.categories?.find(c => c.id === categoryId)?.name || '';
        
        socket.current.emit('show-song-list', {
            name: categoryName,
            songs: songs
        });
    };

    const handleToSong = (id) => {
        setState(prevState => ({
            ...prevState,
            pickedSongs: [...prevState.pickedSongs, id]
        }));

        const song = state.playlist.songs?.find(song => song.id === id);
        if (!song) return;
        
        console.log('goto song', song);
        
        if (state.ffaMode) {
            song.guess_line = 9000;
            song.guess_timecode = '99:00.00';
        }
        
        // Add track_id to the song object if it's available
        if (state.trackId) {
            song.track_id = state.trackId;
        }
        
        socket.current.emit('goto-song', song);
        
        // Set initial expected words from the song data
        // The actual value may be updated later by the server
        setState(prevState => ({
            ...prevState,
            expectedWords: song.expected_words || 0
        }));
    };

    const handleTrackIdChange = (evt) => {
        setState(prevState => ({
            ...prevState,
            trackId: evt.target.value
        }));
    };

    const handleProposeLyrics = () => {
        const lyrics = state.proposedLyrics.trim();
        console.log('propose Lyrics', lyrics);
        socket.current.emit('propose-lyrics', lyrics);
    };
    
    const handleInput = (evt) => {
        setState(prevState => ({
            ...prevState,
            proposedLyrics: evt.target.value,
        }));
    };
    
    const handleLyricsFreeze = () => {
        if (proposedLyricsRef.current) {
            proposedLyricsRef.current.value = '';
        }
        socket.current.emit('freeze-lyrics');
    };

    const handleLyricsValidate = () => { 
        socket.current.emit('validate-lyrics');
    };

    const handleLyricsReveal = () => {
        socket.current.emit('reveal-lyrics');
    };

    const handleLyricsContinue = () => {
        socket.current.emit('continue-lyrics');
    };

    // Render logic
    const songList = state.playlist.songs || [];
    const categories = (state.playlist.categories || []).map(c => {
        return {
            ...c,
            songs: songList.filter(s => s.category === c.id),
        };
    });

    const categoriesElements = categories.map(cat => {
        const songsElements = cat.songs.map(song => {
            // Determine button class based on validation result
            let buttonClass = '';
            if (state.songResults.hasOwnProperty(song.id)) {
                buttonClass = state.songResults[song.id] ? 'success' : 'failure';
            }
            
            return (
                <button 
                    key={song.id} 
                    className={buttonClass}
                    onClick={() => handleToSong(song.id)}
                >
                    Go to "{song.title}"
                </button>
            );
        }); 
        return (
            <div className="category" key={`category-${cat.id}`}>
                <button className="title" key={cat.id} onClick={() => handleToSongList(cat.id)}>Go to "{cat.name}"</button>
                <div className="songs">
                    {songsElements}
                </div>
            </div>
        );
    });

    const canPropose = state.expectedWords > 0 && 
                       state.proposedLyrics.trim().replace(/'/g, ' ').split(/\s+/).filter(word => word.length > 0).length === state.expectedWords;

    return (
        <div className="controller">
            <div className="service">
                <button onClick={handleFfaToggle}>FFA {state.ffaMode? 'On' : 'Off'}</button>
                <button onClick={handlePerfModeToggle}>Perf {state.perfMode? 'On' : 'Off'}</button>
                <button className="warn" onClick={handleReset}> RESET </button>
            </div>
            <button onClick={handleToIntro}>To intro</button>
            <button onClick={handleToCategories}>To Categories</button>
            
            <div className="track-id-form">
                <div className="form-group">
                    <label htmlFor="trackId">Spotify Track ID:</label>
                    <input 
                        id="trackId"
                        type="text" 
                        placeholder="Enter Spotify Track ID" 
                        value={state.trackId}
                        onChange={handleTrackIdChange}
                        className="track-id-input"
                    />
                </div>
                <div className="helper-text">
                    This track ID will be sent with the next song
                </div>
            </div>
            
            <div className="lyrics-form">
                <input  
                    placeholder={`${state.expectedWords} mots attendu`} 
                    ref={proposedLyricsRef} 
                    onChange={handleInput} 
                />
                <div>
                    <button onClick={handleProposeLyrics} disabled={!canPropose}>Propose Lyrics</button>
                    <button onClick={handleLyricsFreeze} disabled={!canPropose}>Freeze</button>
                    <button onClick={handleLyricsValidate} disabled={!canPropose}>Validate</button>
                    <button onClick={handleLyricsReveal}>Reveal</button>
                    <button onClick={handleLyricsContinue}>Continue</button>
                </div>
            </div>
            {categoriesElements}
        </div>
    );
};

export default ControllerComponent;
