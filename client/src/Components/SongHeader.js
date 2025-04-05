/**
 * SongHeader Component
 * 
 * Displays the title, artist, and year of a song in a styled text box.
 * This component is used at the top of the Song view to show the currently
 * playing song's information.
 * 
 * The component returns null if no title is provided.
 * 
 * @param {Object} props - Component props
 * @param {string} props.title - The title of the song
 * @param {string} props.artist - The artist who performed the song
 * @param {string} props.year - The year the song was released
 * @returns {JSX.Element|null} A text box with song information or null if no title
 */
import React from 'react';
import TextBox from './TextBox';
import './Song.css';

const SongHeader = ({ title, artist, year }) => {
  // Don't render anything if there's no title
  if (!title) return null;

  return (
    <TextBox className="song-info">
      <div className="song-title">{title}</div>
      <div className="song-year">({year})</div>
      {artist && <div className="song-artist">{artist}</div>}
    </TextBox>
  );
};

export default SongHeader;