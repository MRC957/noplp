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
                <button 
                    className="title" 
                    onClick={() => onCategorySelect(category.id)}
                >
                    Go to "{category.name}"
                </button>
                <button 
                    className="edit-button"
                    onClick={() => onCategoryEdit(category.id)}
                    aria-label="Edit category"
                    title="Edit category"
                >
                    <EditIcon />
                </button>
            </div>
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