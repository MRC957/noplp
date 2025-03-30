import React from 'react';
import EditIcon from '../EditIcon/EditIcon';
import './Song.css';

// Song component for displaying a song within a category
const Song = ({ 
    song, 
    isSelected,
    isChanging,
    availableSongs,
    onSelect,
    onEdit,
    onSelectLyrics,
    onNewSongSelect
}) => {
    if (isChanging) {
        return (
            <div className="song-selector" key={song.id}>
                <div className="select-prompt">Select a new song:</div>
                <div className="song-options">
                    {availableSongs.map(availableSong => (
                        <button 
                            key={availableSong.id}
                            onClick={() => onNewSongSelect(availableSong.id)}
                            className="song-option"
                        >
                            {availableSong.title} - {availableSong.artist}
                        </button>
                    ))}
                </div>
            </div>
        );
    }
    
    // Determine button class based on validation result
    let buttonClass = 'song-button';
    if (isSelected !== null) {
        buttonClass += isSelected ? ' success' : ' failure';
    }
    
    return (
        <div className="song-container">
            <button 
                className={buttonClass}
                onClick={() => onSelect(song.id)}
            >
                Go to "{song.title}"
            </button>
            <div className="song-actions">
                <button 
                    className="edit-button"
                    onClick={() => onEdit(song.id)}
                    aria-label="Edit song"
                    title="Edit song"
                >
                    <EditIcon />
                </button>
                <button
                    className="lyrics-selector-button"
                    onClick={() => onSelectLyrics(song.id)}
                    aria-label="Select lyrics"
                    title="Select lyrics to guess"
                >
                    Lyrics
                </button>
            </div>
        </div>
    );
};

export default Song;