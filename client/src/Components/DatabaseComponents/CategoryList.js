import React, { useState, useEffect } from 'react';
import './CategoryList.css';

const CategoryList = ({ 
  onLoadCategories, 
  onSelectCategory, 
  onLoadSongs, 
  onAddSong, 
  onRemoveSong,
  onAddSongs,
  onDeleteCategory
}) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  
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

  const handleExpandCategory = async (categoryId) => {
    // Toggle expanded state
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const handleAddSongs = async (categoryId) => {
    // Load all songs first to ensure they're available for filtering
    await onLoadSongs();
    // Call the parent's handler to open the add songs panel
    if (onAddSongs) {
      onAddSongs(categoryId);
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

  const handleDeleteCategory = async (categoryId, event) => {
    // Stop propagation to prevent the view details action from triggering
    event.stopPropagation();
    try {
      await onDeleteCategory(categoryId);
      // Categories will be refreshed by the parent component after successful deletion
    } catch (error) {
      console.error("Error deleting category:", error);
    }
  };

  return (
    <div className="categories-view">
      <h2>Categories</h2>
      {loading ? (
        <p>Loading categories...</p>
      ) : (
        <div className="categories-list">
          {categories.map(category => (
            <div key={category.id} className="category-card">
              <div className="category-header">
                <h3 onClick={() => handleExpandCategory(category.id)} className="category-title">
                  {category.name} 
                  <span className="song-count">
                    ({category.songs ? category.songs.length : 0} songs)
                  </span>
                  <span className="expand-icon">
                    {expandedCategories[category.id] ? '▼' : '►'}
                  </span>
                </h3>
                <div className="category-actions">
                  <button className="view-button" onClick={() => onSelectCategory(category.id)}>
                    View Details
                  </button>
                  <button className="add-button" onClick={() => handleAddSongs(category.id)}>
                    Add Songs
                  </button>
                </div>
              </div>
              
              {expandedCategories[category.id] && (
                <div className="category-songs">
                  {category.songs && category.songs.length > 0 ? (
                    <ul className="song-list">
                      {category.songs.map(song => (
                        <li key={song.id} className="song-item">
                          <div className="db-song-info">
                            <span className="db-song-title">{song.title}</span>
                            <span className="db-song-artist">by {song.artist}</span>
                          </div>
                          <button 
                            className="remove-button"
                            onClick={() => handleRemoveSong(song.id, category.id)}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="no-songs-message">No songs in this category</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {categories.length === 0 && !loading && (
        <p className="no-items-message">No categories found. Create some categories to get started.</p>
      )}
    </div>
  );
};

export default CategoryList;