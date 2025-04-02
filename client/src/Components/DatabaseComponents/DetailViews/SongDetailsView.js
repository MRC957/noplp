import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
  // State for lyrics editing
  const [isEditingLyrics, setIsEditingLyrics] = useState(false);
  const [editedLyrics, setEditedLyrics] = useState([]);
  const [savingLyrics, setSavingLyrics] = useState(false);
  const [lyricsMessage, setLyricsMessage] = useState(null);
  
  // Update local state when parent song prop changes
  useEffect(() => {
    setCurrentSong(song);
    // Reset lyrics editing state when song changes
    setIsEditingLyrics(false);
    setEditedLyrics([]);
    setLyricsMessage(null);
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
  
  // Refresh song data manually if needed
  const refreshSong = () => {
    if (!song || !song.id || isRefreshing) return;
    
    setIsRefreshing(true);
    // This will simulate a removal and re-fetch of data
    // which will trigger the useEffect when song prop changes
    const dummyCategoryId = 'refresh-trigger';
    onRemoveFromCategory(song.id, dummyCategoryId)
      .finally(() => {
        setIsRefreshing(false);
      });
  };

  // Handle initiating lyrics editing
  const handleStartEditLyrics = () => {
    if (currentSong && currentSong.lyrics) {
      setEditedLyrics([...currentSong.lyrics]);
      setIsEditingLyrics(true);
      setLyricsMessage(null);
    }
  };

  // Handle editing a specific lyric line
  const handleLyricLineChange = (index, field, value) => {
    setEditedLyrics(prevLyrics => {
      const updatedLyrics = [...prevLyrics];
      updatedLyrics[index] = { 
        ...updatedLyrics[index], 
        [field]: field === 'startTimeMs' ? parseInt(value, 10) || 0 : value 
      };
      return updatedLyrics;
    });
  };

  // Handle saving edited lyrics
  const handleSaveLyrics = async () => {
    if (!currentSong || !currentSong.id) return;
    
    try {
      setSavingLyrics(true);
      setLyricsMessage(null);
      
      // Make API call to update lyrics
      await axios.put(`/api/database/songs/${currentSong.id}/lyrics`, {
        lyrics: editedLyrics
      });
      
      // Update local song state with the new lyrics
      setCurrentSong(prev => ({
        ...prev,
        lyrics: [...editedLyrics]
      }));
      
      // Exit edit mode
      setIsEditingLyrics(false);
      setLyricsMessage({
        type: 'success',
        text: 'Lyrics updated successfully!'
      });
      
    } catch (error) {
      console.error('Error saving lyrics:', error);
      setLyricsMessage({
        type: 'error',
        text: `Failed to update lyrics: ${error.response?.data?.error || error.message}`
      });
    } finally {
      setSavingLyrics(false);
    }
  };

  // Handle canceling lyrics edit
  const handleCancelEditLyrics = () => {
    setIsEditingLyrics(false);
    setEditedLyrics([]);
    setLyricsMessage(null);
  };

  // Add a new empty lyric line
  const handleAddLyricLine = () => {
    const newLine = {
      startTimeMs: editedLyrics.length > 0 
        ? editedLyrics[editedLyrics.length - 1].startTimeMs + 5000 // 5 seconds after the last line
        : 0,
      words: ""
    };
    setEditedLyrics(prev => [...prev, newLine]);
  };

  // Remove a lyric line
  const handleRemoveLyricLine = (index) => {
    setEditedLyrics(prev => prev.filter((_, i) => i !== index));
  };
  
  // Format milliseconds to MM:SS.mmm format for time input
  const formatTime = (timeInMs) => {
    const totalSeconds = Math.floor(timeInMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = timeInMs % 1000;
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

  // Parse MM:SS.mmm format to milliseconds
  const parseTime = (formattedTime) => {
    try {
      // Handle different time formats (MM:SS.mmm, MM:SS, or raw seconds)
      let minutes = 0;
      let seconds = 0;
      let milliseconds = 0;
      
      if (formattedTime.includes(':')) {
        const [minPart, secPart] = formattedTime.split(':');
        minutes = parseInt(minPart, 10);
        
        if (secPart.includes('.')) {
          const [sec, ms] = secPart.split('.');
          seconds = parseInt(sec, 10);
          milliseconds = parseInt(ms, 10);
        } else {
          seconds = parseInt(secPart, 10);
        }
      } else {
        // Treat as raw seconds
        seconds = parseInt(formattedTime, 10);
      }
      
      return (minutes * 60 * 1000) + (seconds * 1000) + milliseconds;
    } catch (err) {
      return 0;
    }
  };
  
  const headerActions = [
    {
      label: 'Add to Category',
      onClick: handleAddToCategory,
      className: 'add-button'
    },
    {
      label: 'Refresh',
      onClick: refreshSong,
      className: 'refresh-button',
      disabled: isRefreshing
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
      
      <h1>Song Details</h1>
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

          <div className="section-separator">
            <hr />
          </div>

          <div className="song-lyrics">
            <div className="lyrics-actions">
              {!isEditingLyrics && (
                <button 
                  onClick={handleStartEditLyrics}
                  className="edit-lyrics-button"
                  disabled={isRefreshing || !currentSong.lyrics}
                >
                  Edit Lyrics
                </button>
              )}
            </div>
            
            {lyricsMessage && (
              <div className={`lyrics-message ${lyricsMessage.type}`}>
                {lyricsMessage.text}
              </div>
            )}
            
            {isEditingLyrics ? (
              <div className="lyrics-editor">
                <div className="lyrics-editor-controls">
                  <button 
                    onClick={handleAddLyricLine}
                    className="add-button"
                  >
                    Add Line
                  </button>
                  <button 
                    onClick={handleSaveLyrics}
                    className="save-button"
                    disabled={savingLyrics}
                  >
                    {savingLyrics ? 'Saving...' : 'Save Lyrics'}
                  </button>
                  <button 
                    onClick={handleCancelEditLyrics}
                    className="cancel-button"
                    disabled={savingLyrics}
                  >
                    Cancel
                  </button>
                </div>
                
                {editedLyrics.length === 0 ? (
                  <p>No lyrics to edit. Add a line to get started.</p>
                ) : (
                  <table className="lyrics-editor-table">
                    <thead>
                      <tr>
                        <th>Time (MM:SS.mmm)</th>
                        <th>Lyrics</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editedLyrics.map((line, index) => (
                        <tr key={index}>
                          <td>
                            <input
                              type="text"
                              value={formatTime(line.startTimeMs)}
                              onChange={(e) => handleLyricLineChange(
                                index, 
                                'startTimeMs', 
                                parseTime(e.target.value)
                              )}
                              className="time-input"
                            />
                          </td>
                          <td>
                            <textarea
                              value={line.words}
                              onChange={(e) => handleLyricLineChange(
                                index,
                                'words',
                                e.target.value
                              )}
                              className="lyrics-textarea"
                            />
                          </td>
                          <td>
                            <button
                              onClick={() => handleRemoveLyricLine(index)}
                              className="remove-line-button"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ) : currentSong.lyrics ? (
              <>
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
              </>
            ) : (
              <p>No lyrics available for this song.</p>
            )}
          </div>
        </div>
      ) : (
        <p>Loading song details...</p>
      )}
    </div>
  );
};

export default SongDetailsView;