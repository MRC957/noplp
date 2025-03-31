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
          <h3>Songs with Lyrics</h3>
          <div className="db-stat-value">{stats.songsWithLyrics || 0}</div>
        </div>
      </div>
      
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
    </div>
  );
};

export default DatabaseStats;