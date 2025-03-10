import React from 'react';
import TextBox from './TextBox';
import './Song.css';

const SongHeader = ({ title, artist }) => {
  if (!title) return null;

  return (
    <TextBox className="song-info">
      <div className="song-title">{title}</div>
      {artist && <div className="song-artist">{artist}</div>}
    </TextBox>
  );
};

export default SongHeader;