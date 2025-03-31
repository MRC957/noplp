import React, { useState, useEffect } from 'react';
import DetailViewHeader from '../Common/DetailViewHeader';
import '../../DatabaseEditor.css';

/**
 * Component for displaying detailed information about a song
 */
const SongDetailsView = ({ 
  song, 
  onBack, 
  onAddToCategory, 
  onDelete,
  onRemoveFromCategory 
}) => {
  // Local state to track the current song with refreshed categories
  const [currentSong, setCurrentSong] = useState(song);
  // State to track categories being removed (for UI feedback)
  const [removingCategoryIds, setRemovingCategoryIds] = useState([]);
  // State to track if we're currently refreshing data
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Update local state when parent song prop changes
  useEffect(() => {
    setCurrentSong(song);
  }, [song]);
  
  // Handle category removal with optimistic UI update
  const handleRemoveCategory = async (songId, categoryId) => {
    // Add category to "removing" list for immediate visual feedback
    setRemovingCategoryIds(prev => [...prev, categoryId]);
    
    try {
      // Call the parent's remove function
      await onRemoveFromCategory(songId, categoryId);
      
      // Optimistically update the local song state
      setCurrentSong(prevSong => {
        if (!prevSong || !prevSong.categories) return prevSong;
        
        return {
          ...prevSong,
          categories: prevSong.categories.filter(cat => cat.id !== categoryId)
        };
      });
      
      // Remove from the "removing" list after successful removal
      setRemovingCategoryIds(prev => prev.filter(id => id !== categoryId));
    } catch (error) {
      console.error("Error removing category:", error);
      // Remove from the "removing" list if there was an error
      setRemovingCategoryIds(prev => prev.filter(id => id !== categoryId));
    }
  };
  
  const handleAddToCategory = () => {
    // Pass the current song to the add to category function
    onAddToCategory(currentSong);
  };
  
  
  const headerActions = [
    {
      label: 'Add to Category',
      onClick: handleAddToCategory,
      className: 'add-button'
    },
    {
      label: 'Delete Song',
      onClick: () => onDelete(song.id),
      className: 'delete-button',
      variant: 'danger'
    }
  ];

  return (
    <div className="details-view">
      <DetailViewHeader 
        onBack={onBack} 
        backText="Back to Songs"
        actions={headerActions} 
      />
      
      <h2>Song Details</h2>
      {currentSong ? (
        <div>
          <h3>{currentSong.title} by {currentSong.artist}</h3>
          <p>ID: {currentSong.id}</p>
          <div className="song-categories">
            <h3>Categories:</h3>
            {isRefreshing ? (
              <p>Refreshing categories...</p>
            ) : currentSong.categories?.length > 0 ? (
              <ul>
                {currentSong.categories
                  .filter(cat => !removingCategoryIds.includes(cat.id))
                  .map(cat => (
                    <li key={cat.id}>
                      {cat.name}
                      <button 
                        onClick={() => handleRemoveCategory(currentSong.id, cat.id)}
                        className="delete-button danger-button">
                        Remove
                      </button>
                    </li>
                  ))
                }
              </ul>
            ) : (
              <p>No categories assigned</p>
            )}
          </div>

          {currentSong.lyrics ? (
            <div className="song-lyrics">
              <h4>{currentSong.lyrics.length} lyric lines.</h4>
              <table className="lyrics-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Lyrics</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSong.lyrics.map((line, index) => {
                    // Check if line is an object with required properties
                    const isObject = typeof line === 'object' && line !== null;
                    
                    if (isObject && 'startTimeMs' in line && 'words' in line) {
                      // Format timestamp from milliseconds to mm:ss
                      const timeInSeconds = Math.floor(line.startTimeMs / 1000);
                      const minutes = Math.floor(timeInSeconds / 60);
                      const seconds = timeInSeconds % 60;
                      const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                      
                      return (
                        <tr key={index}>
                          <td>{formattedTime}</td>
                          <td>{line.words}</td>
                        </tr>
                      );
                    } else {
                      // Fallback for string format (try to parse or display as is)
                      const parts = typeof line === 'string' && line.includes(':') 
                        ? line.split(':') 
                        : ['--:--', line];
                      return (
                        <tr key={index}>
                          <td>{parts[0]}</td>
                          <td>{parts[1] || line}</td>
                        </tr>
                      );
                    }
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No lyrics available for this song.</p>
          )}
        </div>
      ) : (
        <p>Loading song details...</p>
      )}
    </div>
  );
};

export default SongDetailsView;