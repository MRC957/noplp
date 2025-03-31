import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './DatabaseEditor.css';
import SongList from './DatabaseComponents/SongList';
import CategoryList from './DatabaseComponents/CategoryList';
import AddSongForm from './DatabaseComponents/AddSongForm';
import AddCategoryForm from './DatabaseComponents/AddCategoryForm';
import DatabaseStats from './DatabaseComponents/DatabaseStats';

// Set up axios with the backend URL
axios.defaults.baseURL = 'http://localhost:4001';

const DatabaseEditor = () => {
  const [view, setView] = useState('dashboard');
  const [songs, setSongs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedSong, setSelectedSong] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({});
  const [showAddSongPanel, setShowAddSongPanel] = useState(false);
  const [selectedCategoryForSongs, setSelectedCategoryForSongs] = useState(null);
  const [searchQuery, setSearchQuery] = useState(''); // New state for search query

  // Fetch initial data
  useEffect(() => {
    fetchStats();
  }, []);

  // Filter available songs based on search query
  const filteredSongs = songs.filter(song => {
    // Filter by search query (title or artist)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = song.title.toLowerCase().includes(query);
      const matchesArtist = song.artist.toLowerCase().includes(query);
      if (!matchesTitle && !matchesArtist) return false;
    }
    
    // Filter out songs already in the selected category
    if (selectedCategoryForSongs) {
      const category = categories.find(cat => cat.id === selectedCategoryForSongs);
      if (category && category.songs) {
        return !category.songs.some(catSong => catSong.id === song.id);
      }
    }
    return true;
  });

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/database/stats');
      setStats(response.data);
    } catch (err) {
      setError('Failed to load database statistics');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSongs = async (categoryId = null) => {
    setLoading(true);
    try {
      let url = '/api/songs';
      const response = await axios.get(url);
      setSongs(response.data);
      return response.data;
    } catch (err) {
      setError('Failed to load songs');
      console.error(err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/database/categories-with-songs');
      setCategories(response.data);
      return response.data;
    } catch (err) {
      setError('Failed to load categories');
      console.error(err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSongDetails = async (songId) => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/database/songs/${songId}`);
      setSelectedSong(response.data);
      setView('song-details');
    } catch (err) {
      setError(`Failed to load song details for ID: ${songId}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadCategoryDetails = async (categoryId) => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/database/categories/${categoryId}`);
      setSelectedCategory(response.data);
      setView('category-details');
    } catch (err) {
      setError(`Failed to load category details for ID: ${categoryId}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addSongToCategory = async (songId, categoryId) => {
    try {
      await axios.post(`/api/database/categories/${categoryId}/songs`, {
        song_ids: [songId]
      });
      // Refresh data
      if (selectedCategory) {
        loadCategoryDetails(categoryId);
      }
      if (selectedSong) {
        loadSongDetails(songId);
      }
      fetchStats();
      return true;
    } catch (err) {
      setError('Failed to associate song with category');
      console.error(err);
      return false;
    }
  };

  const addCategoryToSong = async (songId, categoryId) => {
    try {
      await axios.post(`/api/database/songs/${songId}/categories`, {
        category_ids: [categoryId]
      });
      // Refresh data
      if (selectedSong) {
        loadSongDetails(songId);
      }
      if (selectedCategory) {
        loadCategoryDetails(categoryId);
      }
      fetchStats();
      return true;
    } catch (err) {
      setError('Failed to associate category with song');
      console.error(err);
      return false;
    }
  };

  const removeSongFromCategory = async (songId, categoryId) => {
    try {
      await axios.delete(`/api/database/songs/${songId}/categories/${categoryId}`);
      // Refresh data
      if (selectedCategory) {
        loadCategoryDetails(categoryId);
      }
      if (selectedSong) {
        loadSongDetails(songId);
      }
      fetchStats();
      return true;
    } catch (err) {
      setError('Failed to remove association');
      console.error(err);
      return false;
    }
  };

  const deleteCategory = async (categoryId) => {
    try {
      if (window.confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
        await axios.delete(`/api/database/categories/${categoryId}`);
        // Refresh data
        fetchStats();
        setView('categories');
        await fetchCategories(); // Refresh the categories list
        return true;
      }
      return false;
    } catch (err) {
      setError('Failed to delete category');
      console.error(err);
      return false;
    }
  };

  const handleAddSongSuccess = () => {
    fetchStats();
    setView('dashboard');
  };

  const handleAddCategorySuccess = () => {
    fetchStats();
    setView('dashboard');
  };

  const handleAddSongs = async (categoryId) => {
    // Load all songs to populate the songs list
    await fetchSongs();
    // Set the selected category for songs
    setSelectedCategoryForSongs(categoryId);
    // Show the add songs panel
    setShowAddSongPanel(true);
  };

  const renderView = () => {
    switch (view) {
      case 'songs':
        return (
          <SongList 
            onLoadSongs={fetchSongs} 
            onSelectSong={loadSongDetails}
            onLoadCategories={fetchCategories}
            onAddCategory={addCategoryToSong}
            onRemoveCategory={removeSongFromCategory}
          />
        );
      case 'categories':
        return (
          <CategoryList 
            onLoadCategories={fetchCategories} 
            onSelectCategory={loadCategoryDetails}
            onLoadSongs={fetchSongs}
            onAddSong={addSongToCategory}
            onRemoveSong={removeSongFromCategory}
            onAddSongs={handleAddSongs}
            onDeleteCategory={deleteCategory} // Pass deleteCategory function
          />
        );
      case 'song-details':
        return (
          <div className="details-view">
            <h2>Song Details</h2>
            {selectedSong ? (
              <div>
                <h3>{selectedSong.title} by {selectedSong.artist}</h3>
                <p>ID: {selectedSong.id}</p>
                <div className="song-categories">
                  <h4>Categories:</h4>
                  {selectedSong.categories?.length > 0 ? (
                    <ul>
                      {selectedSong.categories.map(cat => (
                        <li key={cat.id}>
                          {cat.name}
                          <button onClick={() => removeSongFromCategory(selectedSong.id, cat.id)}>
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No categories assigned</p>
                  )}
                </div>
                <button onClick={() => fetchCategories().then(cats => {
                  setView('add-category-to-song');
                })}>Add to Category</button>
                {selectedSong.lyrics ? (
                  <div>
                    <h4>Lyrics Available</h4>
                    <p>This song has {selectedSong.lyrics.length} lyric lines.</p>
                  </div>
                ) : (
                  <p>No lyrics available for this song.</p>
                )}
              </div>
            ) : (
              <p>Loading song details...</p>
            )}
            <button onClick={() => setView('songs')}>Back to Songs</button>
          </div>
        );
      case 'category-details':
        return (
          <div className="details-view">
            <div className="details-header">
              <button 
              onClick={() => setView('categories')}
              className="back-button">
                Back to Categories
              </button>
              <button 
                onClick={() => handleAddSongs(selectedCategory.id)} 
                className="add-button">
                Add Songs
              </button>
              <button 
                onClick={() => deleteCategory(selectedCategory.id)}
                className="delete-button danger-button">
                Delete Category
              </button>  
            </div>          
            <h2>Category Details</h2>
            {selectedCategory ? (
              <div>
                <h3>{selectedCategory.name}</h3>
                <p>ID: {selectedCategory.id}</p>
                <div className="category-songs">
                  <h4>Songs:</h4>
                  {selectedCategory.songs?.length > 0 ? (
                    <ul>
                      {selectedCategory.songs.map(song => (
                        <li key={song.id}>
                          <div className="db-song-info">
                            <span className="db-song-title">{song.title}</span>
                            <span className="db-song-artist">by {song.artist}</span>
                          </div>
                          <button 
                            onClick={() => removeSongFromCategory(song.id, selectedCategory.id)}
                            className="delete-button danger-button">
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No songs in this category</p>
                  )}
                </div>
              </div>
            ) : (
              <p>Loading category details...</p>
            )}
          </div>
        );
      case 'add-category-to-song':
        return (
          <div className="selection-view">
            <h2>Add {selectedSong?.title} to Categories</h2>
            <ul className="selection-list">
              {categories.map(category => {
                // Check if category already contains the song
                const hasSong = selectedSong?.categories?.some(c => c.id === category.id);
                return !hasSong ? (
                  <li key={category.id}>
                    {category.name}
                    <button onClick={() => {
                      addCategoryToSong(selectedSong.id, category.id)
                        .then(() => loadSongDetails(selectedSong.id));
                    }}>
                      Add
                    </button>
                  </li>
                ) : null;
              })}
            </ul>
            <button onClick={() => loadSongDetails(selectedSong.id)}>Back</button>
          </div>
        );
      case 'add-song':
        return <AddSongForm onSuccess={handleAddSongSuccess} onCancel={() => setView('dashboard')} />;
      case 'add-category':
        return <AddCategoryForm onSuccess={handleAddCategorySuccess} onCancel={() => setView('dashboard')} />;
      default:
        return <DatabaseStats stats={stats} onRefresh={fetchStats} />;
    }
  };

  return (
    <div className="database-editor">
      <h1>Karaoke Database Editor</h1>
      
      {error && <div className="error-message">{error} <button onClick={() => setError(null)}>Clear</button></div>}
      
      <div className="nav-buttons">
        <button onClick={() => setView('dashboard')}>Dashboard</button>
        <button onClick={() => setView('songs')}>Songs</button>
        <button onClick={() => setView('categories')}>Categories</button>
        <button onClick={() => setView('add-song')}>Add New Song</button>
        <button onClick={() => setView('add-category')}>Add New Category</button>
      </div>
      
      {loading && <div className="loading">Loading...</div>}
      
      <div className="view-container">
        {renderView()}
      </div>
      
      {showAddSongPanel && selectedCategoryForSongs && (
        <div className="add-songs-panel">
          <div className="panel-header">
            <h3>Add Songs to Category</h3>
            <button className="close-button" onClick={() => setShowAddSongPanel(false)}>×</button>
          </div>
          <div className="search-bar">
            <input 
              type="text" 
              placeholder="Search songs by title or artist..." 
              id="song-search"
              onChange={(e) => {
                // We'll handle the search in real-time here
                setSearchQuery(e.target.value);
              }}
            />
          </div>
          <div className="available-songs">
            {filteredSongs.length > 0 ? (
              <>
                <ul id="available-songs-list" className="selection-list">
                  {filteredSongs.map(song => (
                    <li key={song.id} className="available-song-item">
                      <div className="db-song-info">
                        <span className="db-song-title">{song.title}</span>
                        <span className="db-song-artist">by {song.artist}</span>
                      </div>
                      <button 
                        className="add-button"
                        onClick={async () => {
                          const success = await addSongToCategory(song.id, selectedCategoryForSongs);
                          if (success) {
                            // Refresh the songs list by getting the updated category
                            if (view === 'category-details' && selectedCategory) {
                              loadCategoryDetails(selectedCategory.id);
                            } else {
                              fetchCategories();
                            }
                          }
                        }}
                      >
                        Add
                      </button>
                    </li>
                  ))}
                </ul>
                <p id="no-songs-message" className="no-songs-available" style={{ display: 'none' }}>
                  No matching songs found
                </p>
              </>
            ) : (
              <p className="no-songs-available">Loading songs...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseEditor;