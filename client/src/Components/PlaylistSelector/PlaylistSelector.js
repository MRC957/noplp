/**
 * PlaylistSelector Component
 * 
 * Provides an interface for selecting and saving playlists.
 * This component displays a dropdown list of available playlists and 
 * provides functionality to save the current playlist with a new name.
 * 
 * @param {Object} props - Component props
 * @param {string} props.currentPlaylist - The currently selected playlist name/ID
 * @param {Array} props.availablePlaylists - Array of playlist objects to display in the dropdown
 * @param {Function} props.onPlaylistChange - Handler function called when user selects a different playlist
 * @param {Function} props.onSavePlaylist - Handler function called when user saves the playlist with a new name
 * @returns {JSX.Element} A form with playlist selection dropdown and save functionality
 */
import React, { useState } from "react";
import './PlaylistSelector.css';

const PlaylistSelector = ({ 
    currentPlaylist, 
    availablePlaylists, 
    onPlaylistChange,
    onSavePlaylist 
}) => {
    // State to control whether the save form is displayed
    const [showSaveForm, setShowSaveForm] = useState(false);
    // State to track the new playlist name input
    const [newPlaylistName, setNewPlaylistName] = useState(currentPlaylist);

    // Toggle the visibility of the save form
    const handleToggleSaveForm = () => {
        setShowSaveForm(!showSaveForm);
        setNewPlaylistName(currentPlaylist);
    };

    // Update state when the new playlist name input changes
    const handleNameChange = (e) => {
        setNewPlaylistName(e.target.value);
    };

    // Save the playlist with the new name
    const handleSave = () => {
        if (newPlaylistName.trim()) {
            onSavePlaylist(newPlaylistName);
            setShowSaveForm(false);
        } else {
            alert("Please enter a valid playlist name");
        }
    };

    return (
        <>
            <div className="playlist-selector">
                <label htmlFor="playlist-select">Playlist: </label>
                <select 
                    id="playlist-select"
                    value={currentPlaylist} 
                    onChange={onPlaylistChange}
                >
                    {availablePlaylists.map(playlist => (
                        <option key={playlist.id} value={playlist.id}>
                            {playlist.name}
                        </option>
                    ))}
                </select>
            </div>
            <button onClick={handleToggleSaveForm}>
                {showSaveForm ? 'Cancel' : 'Save Playlist As'}
            </button>

            {/* Conditional rendering of the save form */}
            {showSaveForm && (
                <div className="save-playlist-form">
                    <div className="form-group">
                        <label htmlFor="newPlaylistName">New Playlist Name:</label>
                        <input 
                            id="newPlaylistName"
                            type="text" 
                            placeholder="Enter new playlist name" 
                            value={newPlaylistName}
                            onChange={handleNameChange}
                            className="playlist-name-input"
                        />
                        <button 
                            onClick={handleSave} 
                            disabled={!newPlaylistName.trim()} 
                            className="save-playlist-button"
                        >
                            Save
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default PlaylistSelector;