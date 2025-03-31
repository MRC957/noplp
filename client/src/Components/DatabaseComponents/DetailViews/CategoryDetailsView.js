import React, { useState, useEffect } from 'react';
import DetailViewHeader from '../Common/DetailViewHeader';
import '../../DatabaseEditor.css';

/**
 * Component for displaying detailed information about a category
 */
const CategoryDetailsView = ({ 
  category, 
  onBack, 
  onAddSongs, 
  onDelete, 
  onRemoveSong 
}) => {
  // Local state to track the current category with refreshed songs
  const [currentCategory, setCurrentCategory] = useState(category);
  // State to track songs being removed (for UI feedback)
  const [removingSongIds, setRemovingSongIds] = useState([]);
  // State to track if we're currently refreshing data
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Update local state when parent category prop changes
  useEffect(() => {
    setCurrentCategory(category);
  }, [category]);
  
  // Handle song removal with optimistic UI update and refresh
  const handleRemoveSong = async (songId, categoryId) => {
    // Add song to "removing" list for immediate visual feedback
    setRemovingSongIds(prev => [...prev, songId]);
    
    try {
      // Call the parent's remove function
      await onRemoveSong(songId, categoryId);
      
      // Optimistically update the local category state
      setCurrentCategory(prevCategory => {
        if (!prevCategory || !prevCategory.songs) return prevCategory;
        
        return {
          ...prevCategory,
          songs: prevCategory.songs.filter(song => song.id !== songId)
        };
      });
      
      // Remove from the "removing" list after successful removal
      setRemovingSongIds(prev => prev.filter(id => id !== songId));
    } catch (error) {
      console.error("Error removing song:", error);
      // Remove from the "removing" list if there was an error
      setRemovingSongIds(prev => prev.filter(id => id !== songId));
    }
  };
  
  const handleAddSongs = () => {
    // Pass the current category to the add songs function
    onAddSongs(currentCategory);
  };
  
  const headerActions = [
    {
      label: 'Add Songs',
      onClick: handleAddSongs,
      className: 'add-button'
    },
    {
      label: 'Delete Category',
      onClick: () => onDelete(category.id),
      className: 'delete-button',
      variant: 'danger'
    }
  ];

  return (
    <div className="details-view">
      <DetailViewHeader 
        onBack={onBack} 
        backText="Back to Categories"
        actions={headerActions} 
      />
      
      <h2>Category Details</h2>
      {currentCategory ? (
        <div>
          <h3>{currentCategory.name}</h3>
          <p>ID: {currentCategory.id}</p>
          <div className="category-songs">
            <h3>Songs in this Category:</h3>
            {isRefreshing ? (
              <p>Refreshing songs...</p>
            ) : currentCategory.songs?.length > 0 ? (
              <ul>
                {currentCategory.songs
                  .filter(song => !removingSongIds.includes(song.id))
                  .map(song => (
                    <li key={song.id}>
                      {song.title} by {song.artist}
                      <button 
                        onClick={() => handleRemoveSong(song.id, currentCategory.id)}
                        className="delete-button danger-button">
                        Remove
                      </button>
                    </li>
                  ))
                }
              </ul>
            ) : (
              <p>No songs in this category</p>
            )}
          </div>
        </div>
      ) : (
        <p>Loading category details...</p>
      )}
    </div>
  );
};

export default CategoryDetailsView;