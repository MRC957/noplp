import React, { useState } from 'react';
import axios from 'axios';
import './AddSongForm.css';

const AddSongForm = ({ onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    track_id: ''
  });
  const [addMethod, setAddMethod] = useState('search'); // 'search' or 'track_id'
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [addedSong, setAddedSong] = useState(null); // Store the successfully added song
  const [songAlreadyExists, setSongAlreadyExists] = useState(false); // Flag for existing songs

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleMethodChange = (method) => {
    setAddMethod(method);
    setError(null);
    setStatusMessage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setStatusMessage(null);
    setSongAlreadyExists(false);

    try {
      let response;
      
      if (addMethod === 'track_id') {
        // Method 1: Add song by Spotify track ID
        if (!formData.track_id.trim()) {
          throw new Error('Spotify Track ID is required');
        }
        
        // First check if the track exists and has lyrics
        setStatusMessage("Checking if track exists and has available lyrics...");
        
        response = await axios.post('/api/database/add_song', {
          track_id: formData.track_id
        });
      } else {
        // Method 2: Add song by artist and title
        if (!formData.title.trim() || !formData.artist.trim()) {
          throw new Error('Title and artist are both required');
        }
        
        setStatusMessage("Searching for song on Spotify and checking for lyrics...");
        
        response = await axios.post('/api/database/add_song', {
          track_name: formData.title,
          artist: formData.artist
        });
      }
      
      setSubmitting(false);
      if (response.data) {
        // Check if the song already existed
        if (response.data.already_exists) {
          setSongAlreadyExists(true);
          setStatusMessage(`"${response.data.title}" by ${response.data.artist} already exists in the database. Any existing category associations have been preserved.`);
        } else {
          setStatusMessage(`Successfully added "${response.data.title}" by ${response.data.artist}`);
        }
        setAddedSong(response.data);
      }
    } catch (err) {
      setSubmitting(false);
      setStatusMessage(null);
      setError(err.response?.data?.error || err.message || 'Failed to add song. Please try again.');
      console.error(err);
    }
  };

  // When the user clicks to continue to add categories
  const handleContinueToCategories = () => {
    if (addedSong) {
      onSuccess(addedSong, true); // Pass true to indicate we want to add categories
    }
  };

  // When the user clicks to skip category assignment
  const handleSkipCategories = () => {
    if (addedSong) {
      onSuccess(addedSong, false, true); // Pass true as third parameter to go to song list
    }
  };

  // Reset form to add another song
  const handleAddAnother = () => {
    setFormData({
      title: '',
      artist: '',
      track_id: ''
    });
    setAddedSong(null);
    setStatusMessage(null);
    setError(null);
    setSongAlreadyExists(false);
  };

  // If a song has been successfully added, show the success screen with options
  if (addedSong) {
    return (
      <div className="add-form">
        <h2>{songAlreadyExists ? 'Song Already Exists' : 'Song Added Successfully!'}</h2>
        <div className={songAlreadyExists ? "info-message" : "success-message"}>
          <p>"{addedSong.title}" by {addedSong.artist} {songAlreadyExists ? 'is already in the database.' : 'has been added to the database.'}</p>
          {songAlreadyExists && <p>Any existing category associations have been preserved.</p>}
          <p>What would you like to do next?</p>
        </div>
        <div className="form-actions">
          <button onClick={handleContinueToCategories} className="primary-button">
            {songAlreadyExists ? 'Manage Categories' : 'Add to Categories'}
          </button>
          <button onClick={handleAddAnother} className="secondary-button">
            Add Another Song
          </button>
          <button onClick={handleSkipCategories} className="tertiary-button">
            Go to Song List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="add-form">
      <h2>Add New Song</h2>
      
      <div className="method-selector">
        <div className="method-options">
          <button 
            type="button" 
            className={`method-button ${addMethod === 'search' ? 'active' : ''}`}
            onClick={() => handleMethodChange('search')}
          >
            Search by Artist & Title
          </button>
          <button 
            type="button" 
            className={`method-button ${addMethod === 'track_id' ? 'active' : ''}`}
            onClick={() => handleMethodChange('track_id')}
          >
            Add by Track ID
          </button>
        </div>
      </div>
      
      {statusMessage && <div className="status-message">{statusMessage}</div>}
      {error && <div className="error-message">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        {addMethod === 'search' ? (
          <>
            <div className="form-group">
              <label htmlFor="artist">Artist</label>
              <input
                type="text"
                id="artist"
                name="artist"
                value={formData.artist}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="title">Title</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
              />
            </div>
          </>
        ) : (
          <div className="form-group">
            <label htmlFor="track_id">Spotify Track ID</label>
            <input
              type="text"
              id="track_id"
              name="track_id"
              value={formData.track_id}
              onChange={handleChange}
              placeholder="e.g. 7wBGD8HGW91tnIlOTxrWN2"
              required
            />
            <div className="help-text">
              The ID can be found in a Spotify track URL: 
              https://open.spotify.com/track/<strong>7wBGD8HGW91tnIlOTxrWN2</strong>
            </div>
          </div>
        )}
        
        <div className="form-actions">
          <button type="submit" disabled={submitting}>
            {submitting ? 'Adding...' : 'Add Song'}
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddSongForm;