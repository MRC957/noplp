import React, { useState } from 'react';
import AddPanel from '../Common/AddPanel';
import '../../DatabaseEditor.css';

/**
 * Component for adding songs to a category
 */
const AddSongsToCategory = ({ 
  songs, 
  category, 
  onBack, 
  onAddSongs
}) => {
  const [selectedSongIds, setSelectedSongIds] = useState([]);

  const handleSongSelection = (songId) => {
    setSelectedSongIds(prev => 
      prev.includes(songId) 
        ? prev.filter(id => id !== songId)
        : [...prev, songId]
    );
  };

  const handleAddSelectedSongs = () => {
    if (selectedSongIds.length > 0) {
      onAddSongs(selectedSongIds, category.id);
      setSelectedSongIds([]);  // Clear selection after adding
    }
  };

  return (
    <AddPanel
      items={songs}
      selectedIds={selectedSongIds}
      onSelectItem={handleSongSelection}
      onAddSelected={handleAddSelectedSongs}
      onClose={onBack}
      title={`Add Songs to ${category ? category.name : 'Category'}`}
      searchPlaceholder="Search by title or artist..."
      emptyMessage="No songs available to add"
    />
  );
};

export default AddSongsToCategory;