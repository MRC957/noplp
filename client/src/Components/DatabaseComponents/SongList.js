import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './DatabaseList.css';
import './SongList.css';

const SongList = ({ 
  onLoadSongs, 
  onSelectSong, 
  onLoadCategories, 
  onAddCategory, 
  onRemoveCategory 
}) => {
  const [songs, setSongs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedSongs, setExpandedSongs] = useState({});
  const [showAddCategoryPanel, setShowAddCategoryPanel] = useState(false);
  const [selectedSongForCategories, setSelectedSongForCategories] = useState(null);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  
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

  // Filter categories based on search query
  const filteredCategories = categories.filter(category => {
    // Filter by search query
    if (categorySearchQuery) {
      const query = categorySearchQuery.toLowerCase();
      if (!category.name.toLowerCase().includes(query)) return false;
    }
    
    // Filter out categories already assigned to the song
    if (selectedSongForCategories) {
      const song = songs.find(s => s.id === selectedSongForCategories);
      if (song && song.categories) {
        return !song.categories.some(songCat => songCat.id === category.id);
      }
    }
    return true;
  });

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

  const handleAddCategories = async (songId) => {
    // Reset selected categories when opening the panel
    setSelectedCategories([]);
    
    // Load all categories first to ensure they're available for filtering
    const fetchedCategories = await onLoadCategories();
    setCategories(fetchedCategories || []);
    // Set the selected song for categories
    setSelectedSongForCategories(songId);
    // Show the add categories panel
    setShowAddCategoryPanel(true);
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

  const handleCategorySelection = (categoryId) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        // Remove if already selected
        return prev.filter(id => id !== categoryId);
      } else {
        // Add if not selected
        return [...prev, categoryId];
      }
    });
  };

  const handleAddSelectedCategories = async () => {
    if (selectedCategories.length === 0 || !selectedSongForCategories) return;
    
    try {
      // Use axios instead of fetch
      await axios.post(`/api/database/songs/${selectedSongForCategories}/categories`, {
        category_ids: selectedCategories
      });
      
      // Refresh songs after adding categories
      const updatedSongs = await onLoadSongs();
      setSongs(updatedSongs);
      
      // Close the panel and reset selected categories
      setShowAddCategoryPanel(false);
      setSelectedCategories([]);
      
    } catch (error) {
      console.error("Error adding categories to song:", error);
    }
  };

  return (
    <div className="songs-view db-list-view">
      <h2>Songs</h2>
      
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
            filteredSongs.map(song => (
              <div key={song.id} className="song-card db-item-card">
                <div className="song-header db-item-header">
                  <h3 onClick={() => handleExpandSong(song.id)} className="song-title db-item-title">
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
                      onClick={() => handleAddCategories(song.id)}
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

      {showAddCategoryPanel && selectedSongForCategories && (
        <div className="add-categories-panel db-add-panel">
          <div className="panel-header db-panel-header">
            <h3>Add Categories to Song</h3>
            <button className="close-button db-close-button" onClick={() => setShowAddCategoryPanel(false)}>×</button>
          </div>
          <div className="search-bar db-search-bar">
            <input 
              type="text" 
              placeholder="Search categories by name..." 
              id="category-search"
              value={categorySearchQuery}
              onChange={(e) => setCategorySearchQuery(e.target.value)}
            />
          </div>
          <div className="categories-actions db-selection-actions">
                  <button 
                    className="add-selected-button db-add-selected-button"
                    onClick={handleAddSelectedCategories}
                    disabled={selectedCategories.length === 0}
                  >
                    Add Selected Categories ({selectedCategories.length})
                  </button>
                </div>            
          <div className="available-categories db-available-items">
            {filteredCategories.length > 0 ? (
              <>
            
                <ul id="available-categories-list" className="selection-list db-selection-list">
                  {filteredCategories.map(category => (
                    <li key={category.id} className="available-category-item db-selection-item">
                      <div className="category-checkbox db-checkbox">
                        <input
                          type="checkbox"
                          id={`category-${category.id}`}
                          checked={selectedCategories.includes(category.id)}
                          onChange={() => handleCategorySelection(category.id)}
                        />
                        <label htmlFor={`category-${category.id}`} className="db-category-name">
                          {category.name}
                        </label>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : categorySearchQuery ? (
              <p className="db-no-items-available">No matching categories found</p>
            ) : (
              <p className="db-no-items-available">Loading categories...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SongList;