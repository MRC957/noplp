import React, { useState, useEffect } from 'react';
import './DatabaseList.css';
import './SongList.css';

const SongList = ({ 
  onLoadSongs, 
  onSelectSong, 
  onDeleteSongs,
  onRemoveCategory,
  onAddCategory
}) => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedSongs, setExpandedSongs] = useState({});
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSongIds, setSelectedSongIds] = useState([]);
  const [deletingSongIds, setDeletingSongIds] = useState([]);
  
  // Fetch songs on component mount
  useEffect(() => {
    let isMounted = true;
    const fetchSongs = async () => {
      setLoading(true);
      try {
        const fetchedSongs = await onLoadSongs();
        // Only set songs if component is still mounted and we got a valid array
        if (isMounted) {
          if (Array.isArray(fetchedSongs)) {
            setSongs(fetchedSongs);
          } else {
            console.error("Invalid songs data received:", fetchedSongs);
            setSongs([]);
          }
        }
      } catch (error) {
        if (isMounted) {
          console.error("Error fetching songs:", error);
          setSongs([]); // Ensure songs is set to empty array on error
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    fetchSongs();

    // Cleanup function to prevent state updates after component unmount
    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array - only run on mount



  // Filter songs based on search query
  const filteredSongs = songs.filter(song => {
    if (!songSearchQuery) return true;
    
    const query = songSearchQuery.toLowerCase();
    const matchesTitle = song.title.toLowerCase().includes(query);
    const matchesArtist = song.artist.toLowerCase().includes(query);
    
    return matchesTitle || matchesArtist;
  });

  const handleExpandSong = (songId) => {
    // Toggle expanded state
    setExpandedSongs(prev => ({
      ...prev,
      [songId]: !prev[songId]
    }));
  };

  const handleRemoveCategory = async (songId, categoryId) => {
    try {
      await onRemoveCategory(songId, categoryId);
      // Refresh songs after removing category
      const updatedSongs = await onLoadSongs();
      setSongs(updatedSongs);
    } catch (error) {
      console.error("Error removing category from song:", error);
    }
  };

  // Handle song selection toggle
  const handleSelectSong = (songId) => {
    setSelectedSongIds(prev => {
      // If song is already selected, remove it, otherwise add it
      if (prev.includes(songId)) {
        return prev.filter(id => id !== songId);
      } else {
        return [...prev, songId];
      }
    });
  };

  // Toggle selection mode
  const handleToggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      // Clear selections when exiting selection mode
      setSelectedSongIds([]);
    }
  };

  // Select all songs
  const handleSelectAll = () => {
    if (filteredSongs.length > 0) {
      const visibleSongIds = filteredSongs
        .filter(song => !deletingSongIds.includes(song.id))
        .map(song => song.id);
      
      // If all songs are already selected, deselect all
      if (visibleSongIds.length === selectedSongIds.length) {
        setSelectedSongIds([]);
      } else {
        setSelectedSongIds(visibleSongIds);
      }
    }
  };

  // Delete multiple songs
  const handleDeleteSelectedSongs = async () => {
    if (selectedSongIds.length === 0) return;
    
    // Confirm before deleting multiple songs
    if (!window.confirm(`Are you sure you want to delete ${selectedSongIds.length} song(s)? This action cannot be undone.`)) {
      return;
    }
    
    // Add all selected songs to "deleting" list for immediate visual feedback
    setDeletingSongIds(prev => [...prev, ...selectedSongIds]);
    
    try {
      // Use the onDeleteSongs prop provided by DatabaseEditor instead of making direct API calls
      await onDeleteSongs(selectedSongIds);
      
      // Refresh songs after deletion
      const updatedSongs = await onLoadSongs();
      setSongs(updatedSongs);
      
      // Clear selection state
      setSelectedSongIds([]);
      setIsSelectionMode(false);
    } catch (error) {
      console.error("Error deleting songs:", error);
    } finally {
      // Remove from the "deleting" list
      setDeletingSongIds(prev => prev.filter(id => !selectedSongIds.includes(id)));
    }
  };

  return (
    <div className="songs-view db-list-view">
      <h2>
        Songs
      </h2>
      <div className="db-list-header">
        <span className="selection-controls">
          <button 
            onClick={handleToggleSelectionMode} 
            // className={`selection-mode-button ${isSelectionMode ? 'active' : ''}`}
            className={`delete-button ${isSelectionMode ? 'active' : ''}`}
          >
            {isSelectionMode ? 'Exit Selection' : 'Delete Multiple Songs'}
          </button>
          
          {isSelectionMode && (
            <span>
              <button 
                onClick={handleSelectAll}
                className="select-all-button"
              >
                {selectedSongIds.length === filteredSongs.length ? 'Deselect All' : 'Select All'}
              </button>
              <button 
                onClick={handleDeleteSelectedSongs}
                disabled={selectedSongIds.length === 0}
                className="danger-button"
              >
                Delete Selected ({selectedSongIds.length})
              </button>
            </span>
          )}
        </span>
      </div>
      
      {/* Add song search box */}
      <div className="db-search-container">
        <input
          type="text"
          placeholder="Search songs by title or artist..."
          value={songSearchQuery}
          onChange={(e) => setSongSearchQuery(e.target.value)}
          className="db-search-input"
        />
        {songSearchQuery && (
          <button 
            className="db-clear-search-button"
            onClick={() => setSongSearchQuery('')}
          >
            ×
          </button>
        )}
      </div>
      
      {loading ? (
        <p>Loading songs...</p>
      ) : (
        <div className="songs-list db-items-list">
          {filteredSongs.length > 0 ? (
            filteredSongs
              .filter(song => !deletingSongIds.includes(song.id))
              .map(song => (
                <div key={song.id} className={`song-card db-item-card ${selectedSongIds.includes(song.id) ? 'selected' : ''}`}>
                  <div className="song-header db-item-header">
                    <h3 
                      onClick={() => isSelectionMode ? handleSelectSong(song.id) : handleExpandSong(song.id)} 
                      className="song-title db-item-title"
                    >
                      {isSelectionMode && (
                        <input
                          type="checkbox"
                          checked={selectedSongIds.includes(song.id)}
                          onChange={() => handleSelectSong(song.id)}
                          onClick={e => e.stopPropagation()}
                          className="selection-checkbox"
                        />
                      )}
                      {song.title}
                      <span className="artist-name db-item-subtitle">
                        by {song.artist}
                      </span>
                      <span className="categories-count db-item-count">
                        ({song.categories ? song.categories.length : 0} categories)
                      </span>
                      <span className="db-expand-icon">
                        {expandedSongs[song.id] ? '▼' : '►'}
                      </span>
                    </h3>
                    <div className="song-actions db-item-actions">
                      <button 
                        className="db-add-button"
                        onClick={() => onAddCategory(song)}
                      >
                        Add Categories
                      </button>
                      <button 
                        className="db-view-button" 
                        onClick={() => onSelectSong(song.id)}
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                  
                  {expandedSongs[song.id] && (
                    <div className="song-details db-item-details">
                      {song.categories && song.categories.length > 0 ? (
                        <div className="song-categories-list">
                          <h4>Categories:</h4>
                          <ul className="categories-list db-sublist">
                            {song.categories.map(category => (
                              <li key={category.id} className="category-item db-subitem">
                                {category.name}
                                <button 
                                  className="db-remove-button"
                                  onClick={() => handleRemoveCategory(song.id, category.id)}
                                >
                                  Remove
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="db-no-items-message">No categories assigned to this song</p>
                      )}
                    </div>
                  )}
                </div>
              ))
          ) : (
            <p className="db-no-items-message">
              {songSearchQuery 
                ? `No songs found matching "${songSearchQuery}"`
                : "No songs found. Add songs to get started."}
            </p>
          )}
        </div>
      )}

    </div>
  );
};

export default SongList;