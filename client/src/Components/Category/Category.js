/**
 * Category Component
 * 
 * Displays a category with its songs and provides controls for category management.
 * This component has two different display modes:
 * 1. Normal mode: Shows the category name, edit button, and all songs in the category
 * 2. Category selection mode: Shows a list of available categories to replace the current one
 * 
 * Each song within the category is rendered using the Song component.
 * 
 * @param {Object} props - Component props
 * @param {Object} props.category - The category object with name and ID
 * @param {Array} props.songs - Array of songs within this category
 * @param {boolean} props.isChanging - Whether the category is in selection mode
 * @param {Array} props.availableCategories - Array of categories that can replace the current one
 * @param {Object} props.songResults - Map of song IDs to their validation results (true/false)
 * @param {string|null} props.changingSongId - ID of the song currently being changed, if any
 * @param {Array} props.availableSongs - Array of songs that can replace a song being changed
 * @param {Function} props.onCategorySelect - Handler function called when the category is selected
 * @param {Function} props.onCategoryEdit - Handler function called when the edit button is clicked
 * @param {Function} props.onNewCategorySelect - Handler function called when a replacement category is selected
 * @param {Function} props.onSongSelect - Handler function called when a song is selected
 * @param {Function} props.onSongEdit - Handler function called when a song's edit button is clicked
 * @param {Function} props.onSongLyricsSelect - Handler function called when a song's lyrics button is clicked
 * @param {Function} props.onNewSongSelect - Handler function called when a replacement song is selected
 * @returns {JSX.Element} A category section with songs and controls
 */
import React from 'react';
import EditIcon from '../EditIcon/EditIcon';
import Song from '../Song/Song';
import './Category.css';

// Category component for displaying a category and its songs
const Category = ({ 
    category, 
    songs, 
    isChanging,
    availableCategories,
    songResults,
    changingSongId,
    availableSongs,
    onCategorySelect,
    onCategoryEdit,
    onNewCategorySelect,
    onSongSelect,
    onSongEdit,
    onSongLyricsSelect,
    onNewSongSelect
}) => {
    // If in changing mode, display the category selection interface
    if (isChanging) {
        return (
            <div className="category changing" key={`category-${category.id}`}>
                <div className="title">Select new category to replace "{category.name}":</div>
                <div className="category-selector">
                    {availableCategories.map(availableCategory => (
                        <button 
                            key={availableCategory.id}
                            onClick={() => onNewCategorySelect(availableCategory.id)}
                            className="category-option"
                        >
                            {availableCategory.name}
                        </button>
                    ))}
                </div>
            </div>
        );
    }
    
    return (
        <div className="category">
            <div className="category-header">
                {/* Main button to select the category */}
                <button 
                    className="title" 
                    onClick={() => onCategorySelect(category.id)}
                >
                    Go to "{category.name}"
                </button>
                {/* Button to edit the category */}
                <button 
                    className="edit-button"
                    onClick={() => onCategoryEdit(category.id)}
                    aria-label="Edit category"
                    title="Edit category"
                >
                    <EditIcon />
                </button>
            </div>
            {/* Container for all songs in this category */}
            <div className="songs">
                {songs.map(song => (
                    <Song
                        key={song.id}
                        song={song}
                        isSelected={songResults.hasOwnProperty(song.id) ? songResults[song.id] : null}
                        isChanging={changingSongId === song.id}
                        availableSongs={availableSongs}
                        onSelect={onSongSelect}
                        onEdit={() => onSongEdit(song.id, category.id)}
                        onSelectLyrics={onSongLyricsSelect}
                        onNewSongSelect={onNewSongSelect}
                    />
                ))}
            </div>
        </div>
    );
};

export default Category;