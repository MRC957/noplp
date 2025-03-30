import React, { useState, useEffect, useRef } from "react";
import { getSocket, emitEvent, controllerSocket } from "../hooks/socketManager";
import PlaylistSelector from "./PlaylistSelector/PlaylistSelector";
import LyricsControls from "./LyricsControls/LyricsControls";
import LyricsSelector from "./LyricsSelector/LyricsSelector";
import Category from "./Category/Category";
import './ControllerComponent.css';

const ControllerComponent = () => {
    const [state, setState] = useState({
        playlist: {},
        perfMode: false,
        pickedSongs: [],
        pickedCategories: [],
        proposedLyrics: '',
        expectedWords: 0,
        trackId: '',
        songResults: {},
        availablePlaylists: [],
        currentPlaylist: 'playlist',
        newPlaylistName: '',
        showSavePlaylist: false,
        // New state variables for category and song selection
        changingCategoryId: null,
        changingSongId: null,
        availableCategories: [],
        availableSongs: [],
        // New state variables for lyrics selection
        currentSongId: null,
        allLyrics: [],
        lyricsToGuess: [],
        selectedLyricIndex: -1,
        showLyricsSelector: false,
        lyricsLoading: false
    });

    const proposedLyricsRef = useRef(null);
    const socket = useRef(null);

    // Initialize socket and fetch playlists
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

        // Fetch available playlists
        fetchPlaylists();

        // Cleanup function
        return () => {
            socket.current = null;
        };
    }, []);

    // Load playlist when currentPlaylist changes
    useEffect(() => {
        loadPlaylist(state.currentPlaylist);
    }, [state.currentPlaylist]);

    // Fetch available playlists from the server
    const fetchPlaylists = () => {
        fetch('http://localhost:4001/api/playlists')
            .then(response => response.json())
            .then((data) => {
                setState(prevState => ({
                    ...prevState,
                    availablePlaylists: data
                }));
                console.log('Available playlists:', data);
            })
            .catch(error => {
                console.error('Error fetching playlists:', error);
            });
    };

    // Load the selected playlist
    const loadPlaylist = (playlistName) => {
        fetch(`http://localhost:4001/api/playlist?name=${playlistName}`)
            .then(response => response.json())
            .then((data) => {
                setState(prevState => ({
                    ...prevState,
                    playlist: data
                }));
                console.log(`Loaded playlist: ${playlistName}`, data);
            })
            .catch(error => {
                console.error(`Error fetching playlist ${playlistName}:`, error);
            });
    };

    // Handle playlist change
    const handlePlaylistChange = (event) => {
        const selectedPlaylist = event.target.value;
        setState(prevState => ({
            ...prevState,
            currentPlaylist: selectedPlaylist,
            // Reset picked items when changing playlists
            pickedSongs: [],
            pickedCategories: [],
            songResults: {}
        }));
    };

    const handleReset = () => {
        console.log('Reseting');
        setState(prevState => ({
            ...prevState,
            pickedSongs: [],
            pickedCategories: [],
            trackId: '',
            songResults: {}
        }));
    };

    const handleToIntro = () => {
        controllerSocket.showIntro();
    };

    const handleToCategories = () => {
        const categories = state.playlist.categories?.map(c => {
            return {
                ...c,
                picked: state.pickedCategories.indexOf(c.id) !== -1
            };
        }).sort() || [];
        console.log(categories);
        controllerSocket.showCategories(categories);
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
        
        controllerSocket.showSongList({
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
        
        // Add track_id to the song object if it's available
        if (state.trackId) {
            song.track_id = state.trackId;
        }
        
        controllerSocket.gotoSong(song);
        
        // Set initial expected words from the song data
        // The actual value may be updated later by the server
        setState(prevState => ({
            ...prevState,
            expectedWords: song.expected_words || 0
        }));

        // Fetch lyrics for the song and send them to the TerminalComponent
        if (song.track_id) {
            fetchAndSendLyrics(song);
        }
    };

    // New function to fetch and send lyrics to the TerminalComponent
    const fetchAndSendLyrics = (song) => {
        const trackId = song.track_id;
        const wordCount = song.expected_words || 0;
        const specificLyricTime = song.selected_lyric_time;
        
        if (!trackId) return;
        
        // Inform the TerminalComponent that lyrics are loading
        controllerSocket.sendLyricsLoading();
        
        // Construct the URL with optional lyric_time parameter
        let url = `http://localhost:4001/api/getLyrics/${trackId}/${wordCount}`;
        if (specificLyricTime) {
            url += `?lyric_time=${specificLyricTime}`;
        }
        
        fetch(url)
            .then(response => {
                if (!response.ok) throw new Error(`Failed to fetch lyrics: ${response.status}`);
                return response.json();
            })
            .then(data => {
                console.log('Fetched lyrics for terminal:', data);
                // Send the lyrics data through the controllerSocket API
                controllerSocket.sendLyricsData(data);
            })
            .catch(error => {
                console.error('Error fetching lyrics:', error);
                controllerSocket.sendLyricsError(error.message);
            });
    };

    const handleProposeLyrics = (lyrics) => {
        console.log('propose Lyrics', lyrics);
        controllerSocket.proposeLyrics(lyrics);
    };
    
    const handleLyricsFreeze = () => {
        if (proposedLyricsRef.current) {
            proposedLyricsRef.current.value = '';
        }
        controllerSocket.freezeLyrics();
    };

    const handleLyricsValidate = () => { 
        controllerSocket.validateLyrics();
    };

    const handleLyricsReveal = () => {
        controllerSocket.revealLyrics();
    };

    const handleLyricsContinue = () => {
        controllerSocket.continueLyrics();
    };

    // Functions to handle category and song changes
    const fetchAllCategories = () => {
        fetch('http://localhost:4001/api/categories')
            .then(response => response.json())
            .then((data) => {
                setState(prevState => ({
                    ...prevState,
                    availableCategories: data
                }));
                console.log('Available categories:', data);
            })
            .catch(error => {
                console.error('Error fetching categories:', error);
            });
    };

    const fetchSongsForCategory = (categoryId) => {
        fetch(`http://localhost:4001/api/songs?category_id=${categoryId}`)
            .then(response => response.json())
            .then((data) => {
                setState(prevState => ({
                    ...prevState,
                    availableSongs: data
                }));
                console.log(`Songs for category ${categoryId}:`, data);
            })
            .catch(error => {
                console.error(`Error fetching songs for category ${categoryId}:`, error);
            });
    };

    const handleChangeCategory = (categoryId) => {
        // Fetch all available categories
        fetchAllCategories();
        
        setState(prevState => ({
            ...prevState,
            changingCategoryId: categoryId
        }));
    };

    const handleChangeSong = (songId, categoryId) => {
        // Fetch all available songs for this category
        fetchSongsForCategory(categoryId);
        
        setState(prevState => ({
            ...prevState,
            changingSongId: songId
        }));
    };

    const handleSelectNewCategory = (categoryId) => {
        // Update the playlist with the new category
        if (!categoryId || !state.changingCategoryId) return;
        
        // Find the old category that's being replaced
        const oldCategory = state.playlist.categories.find(c => c.id === state.changingCategoryId);
        if (!oldCategory) return;
        
        // Find the new category details
        const newCategory = state.availableCategories.find(c => c.id === categoryId);
        if (!newCategory) return;
        
        // Get 2 random songs from this category (if available)
        fetchSongsForCategory(categoryId);
        
        // Update the playlist with the new category and songs
        setTimeout(() => {
            // This timeout ensures that availableSongs has been populated
            const songsForNewCategory = state.availableSongs.slice(0, 2);
            
            // Create updated playlist
            const updatedPlaylist = {
                ...state.playlist,
                categories: state.playlist.categories.map(c => 
                    c.id === state.changingCategoryId ? 
                    { ...newCategory, difficulty: oldCategory.difficulty, expected_words: oldCategory.expected_words } : c
                )
            };
            
            // Update songs: remove old ones for this category and add new ones
            const songsWithoutOldCategory = state.playlist.songs.filter(s => 
                s.category !== state.changingCategoryId
            );
            
            const newSongs = songsForNewCategory.map(s => ({
                ...s,
                category: categoryId
            }));
            
            updatedPlaylist.songs = [...songsWithoutOldCategory, ...newSongs];
            
            // Update state
            setState(prevState => ({
                ...prevState,
                playlist: updatedPlaylist,
                changingCategoryId: null
            }));
            
            console.log('Updated playlist with new category:', updatedPlaylist);
        }, 500);
    };

    const handleSelectNewSong = (songId) => {
        if (!songId || !state.changingSongId) return;
        
        // Find the song being replaced
        const oldSong = state.playlist.songs.find(s => s.id === state.changingSongId);
        if (!oldSong) return;
        
        // Find the new song
        const newSong = state.availableSongs.find(s => s.id === songId);
        if (!newSong) return;
        
        // Update the playlist
        const updatedPlaylist = {
            ...state.playlist,
            songs: state.playlist.songs.map(s => 
                s.id === state.changingSongId ? 
                { ...newSong, category: oldSong.category } : s
            )
        };
        
        // Update state
        setState(prevState => ({
            ...prevState,
            playlist: updatedPlaylist,
            changingSongId: null
        }));
        
        console.log('Updated playlist with new song:', updatedPlaylist);
    };

    // Save current playlist with new name
    const handleSavePlaylist = (newPlaylistName) => {
        if (!newPlaylistName.trim()) {
            alert("Please enter a valid playlist name");
            return;
        }

        // Prepare the playlist data to save
        const playlistToSave = {
            ...state.playlist,
            name: newPlaylistName,
            id: newPlaylistName // Use name as ID as well
        };

        // Send to server to save
        fetch('http://localhost:4001/api/playlist/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(playlistToSave),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log('Playlist saved successfully:', data);
            
            // Update available playlists and select the newly saved one
            fetchPlaylists();
            
            setState(prevState => ({
                ...prevState,
                currentPlaylist: newPlaylistName,
                showSavePlaylist: false
            }));
        })
        .catch(error => {
            console.error('Error saving playlist:', error);
            alert("Failed to save playlist. Please try again.");
        });
    };

    // Lyrics management functions
    const fetchLyricsForSong = (songId, trackId) => {
        if (!trackId) return;
        
        setState(prevState => ({
            ...prevState,
            lyricsLoading: true,
            currentSongId: songId
        }));
        
        // Fetch lyrics from the backend without specifying words to guess
        // This will return all available lyrics for the track
        fetch(`http://localhost:4001/api/getLyrics/${trackId}/0`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch lyrics: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                setState(prevState => ({
                    ...prevState,
                    allLyrics: data.lyrics || [],
                    lyricsToGuess: data.lyricsToGuess || [],
                    lyricsLoading: false,
                    showLyricsSelector: true
                }));
                console.log('Fetched lyrics:', data);
            })
            .catch(error => {
                console.error('Error fetching lyrics:', error);
                setState(prevState => ({
                    ...prevState,
                    lyricsLoading: false
                }));
                alert(`Failed to load lyrics: ${error.message}`);
            });
    };

    const handleToggleLyricsSelector = (songId) => {
        const song = songList.find(s => s.id === songId);
        if (!song) return;
        
        // If already showing lyrics for this song, just toggle the visibility
        if (state.currentSongId === songId) {
            setState(prevState => ({
                ...prevState,
                showLyricsSelector: !prevState.showLyricsSelector
            }));
            return;
        }
        
        // Otherwise, fetch lyrics for the song
        fetchLyricsForSong(songId, song.track_id);
    };

    const handleSelectLyricToGuess = (index) => {
        if (index < 0 || index >= state.allLyrics.length) return;
        
        const selectedLyric = state.allLyrics[index];
        if (!selectedLyric) return;
        
        // Count words in this lyric
        const wordCount = selectedLyric.word_count;
        
        // Update the song in the playlist with the new expected_words count
        const updatedPlaylist = {
            ...state.playlist,
            songs: state.playlist.songs.map(s => 
                s.id === state.currentSongId ? 
                { 
                    ...s, 
                    expected_words: wordCount,
                    selected_lyric_index: index,
                    selected_lyric_time: selectedLyric.startTimeMs
                } : s
            )
        };
        
        // Update state
        setState(prevState => ({
            ...prevState,
            playlist: updatedPlaylist,
            selectedLyricIndex: index,
            expectedWords: wordCount
        }));
        
        console.log(`Selected lyric at index ${index} with ${wordCount} words:`, selectedLyric);
        
        // Notify the server of the updated word count
        if (state.currentSongId) {
            // Emit word count update
            emitEvent('lyrics-words-count', {
                songId: state.currentSongId,
                count: wordCount
            });
            
            // Also emit the new event with the selected lyric data
            // This will update the lyrics to guess without reloading the whole song
            emitEvent('update-lyrics-to-guess', {
                songId: state.currentSongId,
                lyricsToGuess: [selectedLyric],
                wordCount: wordCount
            });
        }
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
        return (
            <Category
                key={cat.id}
                category={cat}
                songs={cat.songs}
                isChanging={state.changingCategoryId === cat.id}
                availableCategories={state.availableCategories}
                songResults={state.songResults}
                changingSongId={state.changingSongId}
                availableSongs={state.availableSongs}
                onCategorySelect={handleToSongList}
                onCategoryEdit={handleChangeCategory}
                onNewCategorySelect={handleSelectNewCategory}
                onSongSelect={handleToSong}
                onSongEdit={handleChangeSong}
                onSongLyricsSelect={handleToggleLyricsSelector}
                onNewSongSelect={handleSelectNewSong}
            />
        );
    });

    return (
        <div className="controller">
            <div className="controller-header">
                <div className="service">
                    <PlaylistSelector 
                        currentPlaylist={state.currentPlaylist}
                        availablePlaylists={state.availablePlaylists}
                        onPlaylistChange={handlePlaylistChange}
                        onSavePlaylist={handleSavePlaylist}
                    />
                    <button onClick={handleToIntro}>To intro</button>
                    <button onClick={handleToCategories}>To Categories</button>
                    <button className="warn" onClick={handleReset}> RESET </button>
                </div>
                
                <LyricsControls 
                    expectedWords={state.expectedWords}
                    onProposeLyrics={handleProposeLyrics}
                    onFreeze={handleLyricsFreeze}
                    onValidate={handleLyricsValidate}
                    onReveal={handleLyricsReveal}
                    onContinue={handleLyricsContinue}
                />
                
                <LyricsSelector 
                    show={state.showLyricsSelector}
                    songId={state.currentSongId}
                    allLyrics={state.allLyrics}
                    selectedLyricIndex={state.selectedLyricIndex}
                    isLoading={state.lyricsLoading}
                    onLyricSelect={handleSelectLyricToGuess}
                    onClose={() => setState(prev => ({ ...prev, showLyricsSelector: false }))}
                />
            </div>
            
            <div className="scrollable-categories">
                {categoriesElements}
            </div>
        </div>
    );
};

export default ControllerComponent;
