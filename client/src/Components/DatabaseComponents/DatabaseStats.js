import React from 'react';
import './DatabaseStats.css';

const DatabaseStats = ({ stats, onRefresh }) => {
  return (
    <div className="db-stats-container">
      <h2>Database Statistics</h2>
      <button onClick={onRefresh} className="db-refresh-button">
        Refresh Stats
      </button>
      
      <div className="db-stats-grid">
        <div className="db-stat-card">
          <h3>Total Songs</h3>
          <div className="db-stat-value">{stats.totalSongs || 0}</div>
        </div>
        
        <div className="db-stat-card">
          <h3>Total Categories</h3>
          <div className="db-stat-value">{stats.totalCategories || 0}</div>
        </div>
        
        <div className="db-stat-card">
          <h3>Total artists</h3>
          <div className="db-stat-value">{stats.totalArtists || 0}</div>
        </div>
        
        <div className="db-stat-card">
          <h3>Uncategorized Songs</h3>
          <div className="db-stat-value">{stats.songsWithoutCategories || 0}</div>
        </div>
        
        <div className="db-stat-card">
          <h3>Songs with ≤1 Category</h3>
          <div className="db-stat-value">{stats.songsWithOneOrLessCategories || 0}</div>
        </div>
      </div>
      
      {/* Songs per Category Section */}
      {stats.categories && (
        <div className="db-category-stats">
          <h3>Songs per Category</h3>
          <div className="db-category-list">
            {stats.categories.map(cat => (
              <div key={cat.id} className="db-category-stat-item">
                <span>{cat.name}</span>
                <span>{cat.song_count} songs</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Songs by Artist Section */}
      {stats.artists && (
        <div className="db-artist-stats">
          <h3>Songs by Artist</h3>
          <div className="db-artist-list">
            {stats.artists.map((artist, index) => (
              <div key={index} className="db-artist-stat-item">
                <span>{artist.artist}</span>
                <span>{artist.song_count} songs</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseStats;