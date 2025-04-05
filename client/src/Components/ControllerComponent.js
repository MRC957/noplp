/**
 * ControllerComponent
 * 
 * This is the main administrative interface for the karaoke application.
 * It serves as the control panel for the game host to:
 * - Select and manage playlists
 * - Navigate between intro, categories, and song screens
 * - Control the lyrics guessing game (propose, freeze, validate, reveal)
 * - Change categories and songs dynamically
 * - Save custom playlists
 * - Select specific lyrics for guessing
 * 
 * The component communicates with both the server API and the display
 * screens through socket connections to control the game flow.
 * 
 * @returns {JSX.Element} The controller interface
 */
import React, { useState, useEffect, useRef } from "react";
import { getSocket, emitEvent, controllerSocket } from "../hooks/socketManager";
import PlaylistSelector from "./PlaylistSelector/PlaylistSelector";
import LyricsControls from "./LyricsControls/LyricsControls";
import LyricsSelector from "./LyricsSelector/LyricsSelector";
import Category from "./Category/Category";
import './ControllerComponent.css';

const ControllerComponent = () => {
    // Main application state
    const [state, setState] = useState({
        playlist: {},             // Current playlist data
        perfMode: false,          // Performance mode flag
        pickedSongs: [],          // Songs that have been selected/played
        pickedCategories: [],     // Categories that have been selected
        proposedLyrics: '',       // Current lyrics suggestion
        expectedWords: 0,         // Expected word count for current lyric
        trackId: '',              // Current Spotify track ID
        songResults: {},          // Results of lyric guesses by song ID
        availablePlaylists: [],   // List of available playlists
        currentPlaylist: 'playlist', // Currently selected playlist
        newPlaylistName: '',      // Name for saving playlist
        showSavePlaylist: false,  // Whether to show save playlist UI
        
        // Category and song selection state
        changingCategoryId: null, // ID of category being changed
        changingSongId: null,     // ID of song being changed
        availableCategories: [],  // List of all available categories
        availableSongs: [],       // List of songs available for selection
        
        // Lyrics selection state
        currentSongId: null,      // Current song for lyric selection
        allLyrics: [],            // All lyrics for current song
        lyricsToGuess: [],        // Lyrics marked for guessing
        selectedLyricIndex: -1,   // Index of selected lyric
        showLyricsSelector: false, // Whether to show lyrics selector
        lyricsLoading: false      // Whether lyrics are loading
    });

    // Refs for DOM elements and socket connection
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

    /**
     * Fetch available playlists from the server
     * Updates the availablePlaylists state with the list of playlists
     */
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

    /**
     * Load a specific playlist from the server
     * 
     * @param {string} playlistName - The name of the playlist to load
     */
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

    /**
     * Handle playlist selection change
     * 
     * @param {Object} event - The change event from the dropdown
     */
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

    /**
     * Reset the game state
     * Clears picked songs, categories, and results
     */
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

    /**
     * Navigate to the intro screen
     * Uses the controllerSocket to change the display
     */
    const handleToIntro = () => {
        controllerSocket.showIntro();
    };

    /**
     * Navigate to the categories screen
     * Prepares category data and uses controllerSocket to update the display
     */
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

    /**
     * Navigate to the song list screen
     * Optionally marks a category as picked and filters songs by category
     * 
     * @param {string} categoryId - The ID of the selected category, undefined for all songs
     */
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

    /**
     * Navigate to the song screen and start playing a specific song
     * Marks the song as picked and fetches its lyrics
     * 
     * @param {string} id - The ID of the selected song
     */
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

    /**
     * Fetch lyrics for a song and send them to the TerminalComponent
     * Handles loading state and error handling
     * 
     * @param {Object} song - The song object containing track_id
     */
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

    /**
     * Handle lyrics proposal from the controller
     * Sends the proposed lyrics to the TerminalComponent
     * 
     * @param {string} lyrics - The lyrics proposed by the host
     */
    const handleProposeLyrics = (lyrics) => {
        console.log('propose Lyrics', lyrics);
        controllerSocket.proposeLyrics(lyrics);
    };
    
    /**
     * Freeze the currently proposed lyrics
     * Clears the input field and sends freeze command to TerminalComponent
     */
    const handleLyricsFreeze = () => {
        if (proposedLyricsRef.current) {
            proposedLyricsRef.current.value = '';
        }
        controllerSocket.freezeLyrics();
    };

    /**
     * Validate the currently frozen lyrics
     * Sends validation command to TerminalComponent
     */
    const handleLyricsValidate = () => { 
        controllerSocket.validateLyrics();
    };

    /**
     * Reveal the correct lyrics
     * Sends reveal command to TerminalComponent
     */
    const handleLyricsReveal = () => {
        controllerSocket.revealLyrics();
    };

    /**
     * Continue playback after lyric guessing
     * Sends continue command to TerminalComponent
     */
    const handleLyricsContinue = () => {
        controllerSocket.continueLyrics();
    };

    /**
     * Fetch all available categories from the server
     * Updates the availableCategories state
     */
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

    /**
     * Fetch all songs for a specific category
     * Updates the availableSongs state
     * 
     * @param {string} categoryId - The ID of the category to fetch songs for
     */
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

    /**
     * Handle category change request
     * Fetches available categories and sets the changingCategoryId
     * 
     * @param {string} categoryId - The ID of the category to change
     */
    const handleChangeCategory = (categoryId) => {
        // Fetch all available categories
        fetchAllCategories();
        
        setState(prevState => ({
            ...prevState,
            changingCategoryId: categoryId
        }));
    };

    /**
     * Handle song change request
     * Fetches available songs for the category and sets the changingSongId
     * 
     * @param {string} songId - The ID of the song to change
     * @param {string} categoryId - The ID of the category the song belongs to
     */
    const handleChangeSong = (songId, categoryId) => {
        // Fetch all available songs for this category
        fetchSongsForCategory(categoryId);
        
        setState(prevState => ({
            ...prevState,
            changingSongId: songId
        }));
    };

    /**
     * Handle selection of a new category
     * Updates the playlist with the new category and its songs
     * 
     * @param {string} categoryId - The ID of the newly selected category
     */
    const handleSelectNewCategory = (categoryId) => {
        // Update the playlist with the new category
        if (!categoryId || !state.changingCategoryId) return;
        
        // Find the old category that's being replaced
        const oldCategory = state.playlist.categories.find(c => c.id === state.changingCategoryId);
        if (!oldCategory) return;
        
        // Find the new category details
        const newCategory = state.availableCategories.find(c => c.id === categoryId);
        if (!newCategory) return;
        
        // Show loading indication
        setState(prevState => ({
            ...prevState,
            loadingCategoryChange: true
        }));
        
        // Fetch songs for the new category directly from the API
        fetch(`http://localhost:4001/api/songs?category_id=${categoryId}`)
            .then(response => response.json())
            .then((songsData) => {
                // Take up to 2 songs from the category (or all if less than 2)
                const songsForNewCategory = songsData.slice(0, Math.min(2, songsData.length));
                
                if (songsForNewCategory.length === 0) {
                    console.warn(`No songs available for category ${newCategory.name}`);
                }
                
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
                    changingCategoryId: null,
                    loadingCategoryChange: false
                }));
                
                console.log('Updated playlist with new category:', updatedPlaylist);
            })
            .catch(error => {
                console.error(`Error fetching songs for category ${categoryId}:`, error);
                setState(prevState => ({
                    ...prevState,
                    changingCategoryId: null,
                    loadingCategoryChange: false
                }));
            });
    };

    /**
     * Handle selection of a new song
     * Updates the playlist with the new song
     * 
     * @param {string} songId - The ID of the newly selected song
     */
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

    /**
     * Save the current playlist with a new name
     * 
     * @param {string} newPlaylistName - The name to save the playlist as
     */
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

    /**
     * Fetch lyrics for a specific song
     * Updates the allLyrics state and shows the lyrics selector
     * 
     * @param {string} songId - The ID of the song to fetch lyrics for
     * @param {string} trackId - The Spotify track ID
     */
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

    /**
     * Toggle the lyrics selector for a song
     * Either shows/hides the selector or fetches new lyrics
     * 
     * @param {string} songId - The ID of the song to toggle lyrics for
     */
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

    /**
     * Handle selection of a specific lyric to use for guessing
     * Updates the song in the playlist with the new lyric information
     * 
     * @param {number} index - The index of the selected lyric in allLyrics
     */
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

    // Prepare data for rendering
    const songList = state.playlist.songs || [];
    const categories = (state.playlist.categories || []).map(c => {
        return {
            ...c,
            songs: songList.filter(s => s.category === c.id),
        };
    });

    // Create category components with their songs
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
