import React, { useState } from 'react';
import AddPanel from '../Common/AddPanel';
import '../../DatabaseEditor.css';

/**
 * Component for adding categories to a song
 */
const AddCategoriesToSong = ({ 
  categories, 
  song, 
  onBack, 
  onAddCategories 
}) => {
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);

  const handleCategorySelection = (categoryId) => {
    setSelectedCategoryIds(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleAddSelectedCategories = () => {
    if (selectedCategoryIds.length > 0) {
      onAddCategories(song.id, selectedCategoryIds);
      setSelectedCategoryIds([]);  // Clear selection after adding
    }
  };


  return (
    <AddPanel
      items={categories}
      selectedIds={selectedCategoryIds}
      onSelectItem={handleCategorySelection}
      onAddSelected={handleAddSelectedCategories}
      onClose={onBack}
      title={`Add Categories to ${song ? song.title : 'Song'}`}
      searchPlaceholder="Search categories..."
      emptyMessage="No categories available to add"
    />
  );
};

export default AddCategoriesToSong;