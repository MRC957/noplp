import React, { useState } from "react";
import './PlaylistSelector.css';

const PlaylistSelector = ({ 
    currentPlaylist, 
    availablePlaylists, 
    onPlaylistChange,
    onSavePlaylist 
}) => {
    const [showSaveForm, setShowSaveForm] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState(currentPlaylist);

    const handleToggleSaveForm = () => {
        setShowSaveForm(!showSaveForm);
        setNewPlaylistName(currentPlaylist);
    };

    const handleNameChange = (e) => {
        setNewPlaylistName(e.target.value);
    };

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