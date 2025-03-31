import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './DatabaseList.css';
import './CategoryList.css';

const CategoryList = ({ 
  onLoadCategories, 
  onSelectCategory, 
  onLoadSongs, 
  onRemoveSong,
  onAddSongs,
}) => {
  const [categories, setCategories] = useState([]);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddSongsPanel, setShowAddSongsPanel] = useState(false);
  const [selectedCategoryForSongs, setSelectedCategoryForSongs] = useState(null);
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [selectedSongs, setSelectedSongs] = useState([]);
  
  useEffect(() => {
    let isMounted = true;
    const fetchCategories = async () => {
      setLoading(true);
      try {
        const fetchedCategories = await onLoadCategories();
        // Only set categories if component is still mounted and we got a valid array
        if (isMounted) {
          if (Array.isArray(fetchedCategories)) {
            setCategories(fetchedCategories);
          } else {
            console.error("Invalid categories data received:", fetchedCategories);
            setCategories([]);
          }
        }
      } catch (error) {
        if (isMounted) {
          console.error("Error fetching categories:", error);
          setCategories([]); // Ensure categories is set to empty array on error
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    fetchCategories();

    // Cleanup function to prevent state updates after component unmount
    return () => {
      isMounted = false;
    };
  }, [onLoadCategories]);

  // Filter categories based on search query
  const filteredCategories = categories.filter(category => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return category.name.toLowerCase().includes(query);
  });

  const handleExpandCategory = async (categoryId) => {
    // Toggle expanded state
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const handleAddSongs = async (categoryId) => {
    // Reset selected songs when opening the panel
    setSelectedSongs([]);
    
    // Load all songs first to ensure they're available for filtering
    const fetchedSongs = await onLoadSongs();
    setSongs(fetchedSongs || []);
    
    // Set the selected category for songs
    setSelectedCategoryForSongs(categoryId);
    
    // Show the add songs panel
    setShowAddSongsPanel(true);
    
    // Legacy support for parent handler if provided
    if (onAddSongs) {
      onAddSongs(categoryId);
    }
  };

  // Filter songs based on search query and exclude songs already in the category
  const filteredSongs = songs.filter(song => {
    // Filter by search query
    if (songSearchQuery) {
      const query = songSearchQuery.toLowerCase();
      const matchesTitle = song.title.toLowerCase().includes(query);
      const matchesArtist = song.artist.toLowerCase().includes(query);
      if (!matchesTitle && !matchesArtist) return false;
    }
    
    // Filter out songs already assigned to the category
    if (selectedCategoryForSongs) {
      const category = categories.find(c => c.id === selectedCategoryForSongs);
      if (category && category.songs) {
        return !category.songs.some(categorySong => categorySong.id === song.id);
      }
    }
    return true;
  });

  const handleSongSelection = (songId) => {
    setSelectedSongs(prev => {
      if (prev.includes(songId)) {
        // Remove if already selected
        return prev.filter(id => id !== songId);
      } else {
        // Add if not selected
        return [...prev, songId];
      }
    });
  };

  const handleAddSelectedSongs = async () => {
    if (selectedSongs.length === 0 || !selectedCategoryForSongs) return;
    
    try {
      // Use axios to add multiple songs to a category
      await axios.post(`/api/database/categories/${selectedCategoryForSongs}/songs`, {
        song_ids: selectedSongs
      });
      
      // Refresh categories after adding songs
      const updatedCategories = await onLoadCategories();
      setCategories(updatedCategories);
      
      // Close the panel and reset selected songs
      setShowAddSongsPanel(false);
      setSelectedSongs([]);
      
    } catch (error) {
      console.error("Error adding songs to category:", error);
    }
  };

  const handleRemoveSong = async (songId, categoryId) => {
    try {
      await onRemoveSong(songId, categoryId);
      // Refresh categories after removing song
      const updatedCategories = await onLoadCategories();
      setCategories(updatedCategories);
    } catch (error) {
      console.error("Error removing song from category:", error);
    }
  };

  return (
    <div className="categories-view db-list-view">
      <h2>Categories</h2>
      
      {/* Add category search box */}
      <div className="db-search-container">
        <input
          type="text"
          placeholder="Search categories by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="db-search-input"
        />
        {searchQuery && (
          <button 
            className="db-clear-search-button"
            onClick={() => setSearchQuery('')}
          >
            ×
          </button>
        )}
      </div>
      
      {loading ? (
        <p>Loading categories...</p>
      ) : (
        <div className="categories-list db-items-list">
          {filteredCategories.length > 0 ? (
            filteredCategories.map(category => (
              <div key={category.id} className="category-card db-item-card">
                <div className="category-header db-item-header">
                  <h3 onClick={() => handleExpandCategory(category.id)} className="category-title db-item-title">
                    {category.name} 
                    <span className="song-count db-item-count">
                      ({category.songs ? category.songs.length : 0} songs)
                    </span>
                    <span className="db-expand-icon">
                      {expandedCategories[category.id] ? '▼' : '►'}
                    </span>
                  </h3>
                  <div className="category-actions db-item-actions">
                    <button className="view-button db-view-button" onClick={() => onSelectCategory(category.id)}>
                      View Details
                    </button>
                    <button className="add-button db-add-button" onClick={() => handleAddSongs(category.id)}>
                      Add Songs
                    </button>
                  </div>
                </div>
                
                {expandedCategories[category.id] && (
                  <div className="category-songs db-item-details">
                    {category.songs && category.songs.length > 0 ? (
                      <ul className="song-list db-sublist">
                        {category.songs.map(song => (
                          <li key={song.id} className="song-item db-subitem">
                            <div className="db-song-info db-subitem-info">
                              <span className="db-song-title db-subitem-title">{song.title}</span>
                              <span className="db-song-artist db-subitem-subtitle">by {song.artist}</span>
                            </div>
                            <button 
                              className="db-remove-button"
                              onClick={() => handleRemoveSong(song.id, category.id)}
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="db-no-items-message">No songs in this category</p>
                    )}
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="db-no-items-message">
              {searchQuery 
                ? `No categories found matching "${searchQuery}"`
                : "No categories found. Create some categories to get started."
              }
            </p>
          )}
        </div>
      )}

      {/* Add Songs Panel */}
      {showAddSongsPanel && selectedCategoryForSongs && (
        <div className="add-songs-panel db-add-panel">
          <div className="db-panel-header">
            <h3>Add Songs to Category</h3>
            <button className="db-close-button" onClick={() => setShowAddSongsPanel(false)}>×</button>
          </div>
          <div className="db-search-bar">
            <input 
              type="text" 
              placeholder="Search songs by title or artist..." 
              id="song-search"
              value={songSearchQuery}
              onChange={(e) => setSongSearchQuery(e.target.value)}
            />
          </div>
          <div className="db-selection-actions">
                  <button 
                    className="db-add-selected-button"
                    onClick={handleAddSelectedSongs}
                    disabled={selectedSongs.length === 0}
                  >
                    Add Selected Songs ({selectedSongs.length})
                  </button>
                </div>             
          <div className="db-available-items">
            {filteredSongs.length > 0 ? (
              <>
           
                <ul id="available-songs-list" className="db-selection-list">
                  {filteredSongs.map(song => (
                    <li key={song.id} className="db-selection-item">
                      <div className="db-checkbox">
                        <input
                          type="checkbox"
                          id={`song-${song.id}`}
                          checked={selectedSongs.includes(song.id)}
                          onChange={() => handleSongSelection(song.id)}
                        />
                        <label htmlFor={`song-${song.id}`}>
                          <span className="db-subitem-title">{song.title}</span>
                          <span className="db-subitem-subtitle"> by {song.artist}</span>
                        </label>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : songSearchQuery ? (
              <p className="db-no-items-available">No matching songs found</p>
            ) : (
              <p className="db-no-items-available">No songs available to add</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryList;