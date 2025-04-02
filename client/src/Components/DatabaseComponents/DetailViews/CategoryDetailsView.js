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
  onRemoveSong,
  onRemoveSongs,
  onRename
}) => {
  // Local state to track the current category with refreshed songs
  const [currentCategory, setCurrentCategory] = useState(category);
  // State to track songs being removed (for UI feedback)
  const [removingSongIds, setRemovingSongIds] = useState([]);
  // State to track if we're currently refreshing data
  const [isRefreshing, setIsRefreshing] = useState(false);
  // State for category rename functionality
  const [isRenaming, setIsRenaming] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [renameError, setRenameError] = useState('');
  // State for multi-selection
  const [selectedSongIds, setSelectedSongIds] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  // Update local state when parent category prop changes
  useEffect(() => {
    setCurrentCategory(category);
    setNewCategoryName(category?.name || '');
    // Reset selection when category changes
    setSelectedSongIds([]);
    setIsSelectionMode(false);
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

  // Handle multiple songs removal
  const handleRemoveSelectedSongs = async () => {
    if (selectedSongIds.length === 0) return;
    
    // Confirm before removing multiple songs
    if (!window.confirm(`Remove ${selectedSongIds.length} song(s) from this category?`)) {
      return;
    }
    
    // Add all selected songs to "removing" list for immediate visual feedback
    setRemovingSongIds(prev => [...prev, ...selectedSongIds]);
    
    try {
      // Call the parent's bulk remove function
      await onRemoveSongs(selectedSongIds, currentCategory.id);
      
      // Optimistically update the local category state
      setCurrentCategory(prevCategory => {
        if (!prevCategory || !prevCategory.songs) return prevCategory;
        
        return {
          ...prevCategory,
          songs: prevCategory.songs.filter(song => !selectedSongIds.includes(song.id))
        };
      });
      
      // Clear selections after successful removal
      setSelectedSongIds([]);
      // Exit selection mode
      setIsSelectionMode(false);
      
    } catch (error) {
      console.error("Error removing selected songs:", error);
    } finally {
      // Remove from the "removing" list
      setRemovingSongIds(prev => prev.filter(id => !selectedSongIds.includes(id)));
    }
  };
  
  const handleAddSongs = () => {
    // Pass the current category to the add songs function
    onAddSongs(currentCategory);
  };

  const handleStartRename = () => {
    setIsRenaming(true);
    setNewCategoryName(currentCategory.name);
    setRenameError('');
  };

  const handleCancelRename = () => {
    setIsRenaming(false);
    setRenameError('');
  };

  const handleSubmitRename = async () => {
    if (!newCategoryName.trim()) {
      setRenameError('Category name cannot be empty');
      return;
    }

    try {
      const updatedCategory = await onRename(currentCategory.id, newCategoryName);
      if (updatedCategory) {
        // Update local state with the new name
        setCurrentCategory({
          ...currentCategory,
          name: updatedCategory.name
        });
        setIsRenaming(false);
      }
    } catch (error) {
      setRenameError('Failed to rename category');
      console.error('Rename error:', error);
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
    if (currentCategory?.songs) {
      const allSongIds = currentCategory.songs
        .filter(song => !removingSongIds.includes(song.id))
        .map(song => song.id);
      
      // If all songs are already selected, deselect all
      if (allSongIds.length === selectedSongIds.length) {
        setSelectedSongIds([]);
      } else {
        setSelectedSongIds(allSongIds);
      }
    }
  };
  
  const headerActions = [
    {
      label: 'Add Songs',
      onClick: handleAddSongs,
      className: 'add-button'
    },
    {
      label: isSelectionMode ? 'Cancel Selection' : 'Remove multiple Songs',
      onClick: handleToggleSelectionMode,
      className: isSelectionMode ? 'cancel-button' : 'delete-button'
    },
    {
      label: 'Rename Category',
      onClick: handleStartRename,
      className: 'edit-button'
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
          {isRenaming ? (
            <div className="rename-form">
              <h3>Rename Category</h3>
              {renameError && <p className="error-message">{renameError}</p>}
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="form-input"
                placeholder="New category name"
                autoFocus
              />
              <div className="form-actions">
                <button onClick={handleSubmitRename} className="save-button">
                  Save
                </button>
                <button onClick={handleCancelRename} className="cancel-button">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <h3>{currentCategory.name}</h3>
          )}
          <p>ID: {currentCategory.id}</p>
          <div className="category-songs">
            <h3>
              Songs in this Category:
              {isSelectionMode && (
                <span className="selection-actions">
                  <button onClick={handleSelectAll} className="select-all-button">
                    {selectedSongIds.length === currentCategory.songs?.filter(song => !removingSongIds.includes(song.id)).length 
                      ? 'Deselect All' 
                      : 'Select All'}
                  </button>
                  <button 
                    onClick={handleRemoveSelectedSongs} 
                    disabled={selectedSongIds.length === 0}
                    className="danger-button">
                    Remove Selected ({selectedSongIds.length})
                  </button>
                </span>
              )}
            </h3>
            {isRefreshing ? (
              <p>Refreshing songs...</p>
            ) : currentCategory.songs?.length > 0 ? (
              <ul className={isSelectionMode ? 'selection-mode' : ''}>
                {currentCategory.songs
                  .filter(song => !removingSongIds.includes(song.id))
                  .map(song => (
                    <li key={song.id} className={selectedSongIds.includes(song.id) ? 'selected' : ''}>
                      {isSelectionMode && (
                        <input
                          type="checkbox"
                          checked={selectedSongIds.includes(song.id)}
                          onChange={() => handleSelectSong(song.id)}
                        />
                      )}
                      <span className="song-title">{song.title} by {song.artist}</span>
                      {!isSelectionMode && (
                        <button 
                          onClick={() => handleRemoveSong(song.id, currentCategory.id)}
                          className="delete-button danger-button">
                          Remove
                        </button>
                      )}
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