import React, { useState, useEffect } from 'react';

const SongList = ({ 
  onLoadSongs, 
  onSelectSong, 
  onLoadCategories, 
  onAddCategory, 
  onRemoveCategory 
}) => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const fetchSongs = async () => {
      setLoading(true);
      try {
        const fetchedSongs = await onLoadSongs();
        setSongs(fetchedSongs);
      } catch (error) {
        console.error("Error fetching songs:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSongs();
  }, [onLoadSongs]);

  return (
    <div className="songs-view">
      <h2>Songs</h2>
      {loading ? (
        <p>Loading songs...</p>
      ) : (
        <ul className="selection-list">
          {songs.map(song => (
            <li key={song.id}>
              <div className="song-item">
                <span className="song-title">{song.title}</span>
                <span className="song-artist">by {song.artist}</span>
                {song.categories && (
                  <span className="song-categories">
                    Categories: {song.categories.length}
                  </span>
                )}
                <button 
                  className="view-button" 
                  onClick={() => onSelectSong(song.id)}
                >
                  View Details
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {songs.length === 0 && !loading && (
        <p className="no-items-message">No songs found. Add songs to get started.</p>
      )}
    </div>
  );
};

export default SongList;