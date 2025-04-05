/**
 * Song Component
 * 
 * Displays a single song within a category with controls for selecting, editing,
 * and choosing lyrics. This component has two different display modes:
 * 1. Normal mode: Shows a button with the song title and action buttons
 * 2. Song selection mode: Shows a list of available songs to replace the current one
 * 
 * The component will display different styling based on whether the song has been
 * selected (success) or failed validation (failure).
 * 
 * @param {Object} props - Component props
 * @param {Object} props.song - The song object with title, artist and ID
 * @param {boolean|null} props.isSelected - Whether the song is selected (true), failed (false), or neither (null)
 * @param {boolean} props.isChanging - Whether the song is in song selection mode
 * @param {Array} props.availableSongs - Array of songs that can replace the current song
 * @param {Function} props.onSelect - Handler function called when the song is selected
 * @param {Function} props.onEdit - Handler function called when the edit button is clicked
 * @param {Function} props.onSelectLyrics - Handler function called when the lyrics button is clicked
 * @param {Function} props.onNewSongSelect - Handler function called when a replacement song is selected
 * @returns {JSX.Element} A song button with controls or song selection interface
 */
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
    // If in changing mode, display the song selection interface
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
        // Add success or failure class based on the isSelected value
        buttonClass += isSelected ? ' success' : ' failure';
    }
    
    return (
        <div className="song-container">
            {/* Main button to select the song */}
            <button 
                className={buttonClass}
                onClick={() => onSelect(song.id)}
            >
                Go to "{song.title}"
            </button>
            <div className="song-actions">
                {/* Button to edit the song */}
                <button 
                    className="edit-button"
                    onClick={() => onEdit(song.id)}
                    aria-label="Edit song"
                    title="Edit song"
                >
                    <EditIcon />
                </button>
                {/* Button to select lyrics for the song */}
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