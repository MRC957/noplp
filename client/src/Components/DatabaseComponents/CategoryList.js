import React, { useState, useEffect, memo, useCallback } from 'react';
import './DatabaseList.css';
import './CategoryList.css';

// Extract SongItem component for better organization
const SongItem = memo(({ song, categoryId, onRemoveSong }) => {
  return (
    <li className="song-item db-subitem">
      <div className="db-song-info db-subitem-info">
        <span className="db-song-title db-subitem-title">{song.title}</span>
        <span className="db-song-artist db-subitem-subtitle">by {song.artist}</span>
      </div>
      <button 
        className="db-remove-button"
        onClick={() => onRemoveSong(song.id, categoryId)}
      >
        Remove
      </button>
    </li>
  );
});

// Extract CategoryItem as a separate component for better organization
// Wrap with memo to prevent unnecessary re-renders
const CategoryItem = memo(({ 
  category, 
  isExpanded, 
  onExpand, 
  onSelect, 
  onAddSongs, 
  onRemoveSong 
}) => {
  return (
    <div className="category-card db-item-card">
      <div className="category-header db-item-header">
        <h3 onClick={() => onExpand(category.id)} className="category-title db-item-title">
          {category.name} 
          <span className="song-count db-item-count">
            ({category.songs ? category.songs.length : 0} songs)
          </span>
          <span className="db-expand-icon">
            {isExpanded ? '▼' : '►'}
          </span>
        </h3>
        <div className="category-actions db-item-actions">
          <button className="view-button db-view-button" onClick={() => onSelect(category.id)}>
            View Details
          </button>
          <button className="add-button db-add-button" onClick={() => onAddSongs(category)}>
            Add Songs
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="category-songs db-item-details">
          {category.songs && category.songs.length > 0 ? (
            <ul className="song-list db-sublist">
              {category.songs.map(song => (
                <SongItem 
                  key={song.id}
                  song={song}
                  categoryId={category.id}
                  onRemoveSong={onRemoveSong}
                />
              ))}
            </ul>
          ) : (
            <p className="db-no-items-message">No songs in this category</p>
          )}
        </div>
      )}
    </div>
  );
});

const CategoryList = ({ 
  onLoadCategories,  
  onSelectCategory,
  onRemoveSong,
  onAddSongs,
}) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch categories on component mount
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

  // Memoize handlers to prevent unnecessary re-renders of child components
  const handleExpandCategory = useCallback((categoryId) => {
    // Toggle expanded state
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  }, []);

  const handleRemoveSong = useCallback(async (songId, categoryId) => {
    try {
      await onRemoveSong(songId, categoryId);
      // Refresh categories after removing song
      const updatedCategories = await onLoadCategories();
      setCategories(updatedCategories);
    } catch (error) {
      console.error("Error removing song from category:", error);
    }
  }, [onRemoveSong, onLoadCategories]);

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
              <CategoryItem
                key={category.id}
                category={category}
                isExpanded={expandedCategories[category.id]}
                onExpand={handleExpandCategory}
                onSelect={onSelectCategory}
                onAddSongs={onAddSongs}
                onRemoveSong={handleRemoveSong}
              />
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
    </div>
  );
};

export default CategoryList;