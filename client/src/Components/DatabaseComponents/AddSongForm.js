import React, { useState } from 'react';
import axios from 'axios';

const AddSongForm = ({ onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    year: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await axios.post('/api/database/songs', formData);
      setSubmitting(false);
      if (response.data) {
        onSuccess(response.data);
      }
    } catch (err) {
      setSubmitting(false);
      setError('Failed to add song. Please try again.');
      console.error(err);
    }
  };

  return (
    <div className="add-form">
      <h2>Add New Song</h2>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
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
          <label htmlFor="year">Year</label>
          <input
            type="text"
            id="year"
            name="year"
            value={formData.year}
            onChange={handleChange}
          />
        </div>
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