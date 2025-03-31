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
  const [selectedSongIds, setSelectedSongIds] = useState([]);

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
      const response = await axios.get('/api/database/songs-with-categories');
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

  const addSongToCategory = async (songIds, categoryId) => {
    try {
      // If songIds is not an array, convert it to an array for backward compatibility
      const songIdsArray = Array.isArray(songIds) ? songIds : [songIds];
      
      await axios.post(`/api/database/categories/${categoryId}/songs`, {
        song_ids: songIdsArray
      });
      
      // Refresh data
      if (selectedCategory) {
        loadCategoryDetails(categoryId);
      }
      if (selectedSong) {
        loadSongDetails(selectedSong.id);
      }
      fetchStats();
      return true;
    } catch (err) {
      setError('Failed to associate songs with category');
      console.error(err);
      return false;
    }
  };

  // Function to add multiple categories to a song
  const addCategoriesToSong = async (songId, categoryIds) => {
    try {
      await axios.post(`/api/database/songs/${songId}/categories`, {
        category_ids: categoryIds
      });
      // Refresh data
      if (selectedSong) {
        loadSongDetails(songId);
      }
      fetchStats();
      return true;
    } catch (err) {
      setError('Failed to associate categories with song');
      console.error(err);
      return false;
    }
  };

  // Original function kept for backward compatibility
  const addCategoryToSong = async (songId, categoryId) => {
    return addCategoriesToSong(songId, [categoryId]);
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
        await fetchCategories();        return true;
      }
      return false;
    } catch (err) {
      setError('Failed to delete category');
      console.error(err);
      return false;
    }
  };

const deleteSong = async (songId) => {
    try {
        if (window.confirm('Are you sure you want to delete this song? This action cannot be undone.')) {
            await axios.delete(`/api/database/songs/${songId}`);
            // Refresh data
            fetchStats();
            setView('songs');
            await fetchSongs();            return true;
        }
        return false;
    } catch (err) {
        setError('Failed to delete song');
        console.error(err);
        return false;
    }
};

  const handleAddSongSuccess = async (songData, addToCategories = false, goToSongList = false) => {
    // Refresh stats to reflect the new song
    await fetchStats();
    
    // If the user wants to add the song to categories
    if (addToCategories) {
      // Set the selected song and load categories
      setSelectedSong(songData);
      await fetchCategories();
      setView('add-category-to-song');
    } 
    // If the user wants to go to song list
    else if (goToSongList) {
      await fetchSongs();
      setView('songs');
    }
    // Otherwise stay on add song view
    else {
      setView('add-song');
    }
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

  const handleSongSelection = (songId) => {
    setSelectedSongIds(prev => 
      prev.includes(songId) 
        ? prev.filter(id => id !== songId)
        : [...prev, songId]
    );
  };

  // Handle adding multiple selected songs to a category
  const handleAddSelectedSongs = async () => {
    if (selectedSongIds.length === 0 || !selectedCategoryForSongs) return;
    
    const success = await addSongToCategory(selectedSongIds, selectedCategoryForSongs);
    if (success) {
      // Clear selection after successful addition
      setSelectedSongIds([]);
      // Refresh the songs list by getting the updated category
      if (view === 'category-details' && selectedCategory) {
        loadCategoryDetails(selectedCategory.id);
      } else {
        fetchCategories();
      }
    }
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
            onRemoveSong={removeSongFromCategory}
            onAddSongs={handleAddSongs}
          />
        );
      case 'song-details':
        return (
          <div className="details-view">
            <div className="details-header">
              <button 
              onClick={() => setView('songs')}
              className="back-button">
            Back to Songs
              </button>
              <button onClick={() => fetchCategories().then(cats => {
                setView('add-category-to-song');
              })}
            className="add-button">
            Add to Category
            </button>
              <button 
            onClick={() => deleteSong(selectedSong.id)}
            className="delete-button danger-button">
            Delete Song
              </button>  
            </div>               
            <h2>Song Details</h2>
            {selectedSong ? (
              <div>
            <h3>{selectedSong.title} by {selectedSong.artist}</h3>
            <p>ID: {selectedSong.id}</p>
            <div className="song-categories">
              <h3>Categories:</h3>
              {selectedSong.categories?.length > 0 ? (
            <ul>
              {selectedSong.categories.map(cat => (
            <li key={cat.id}>
              {cat.name}
              <button 
              onClick={() => removeSongFromCategory(selectedSong.id, cat.id)}
              className="delete-button danger-button">
                Remove
              </button>
            </li>
              ))}
            </ul>
              ) : (
            <p>No categories assigned</p>
              )}
            </div>

            {selectedSong.lyrics ? (
              <div className="song-lyrics">
            <h4>{selectedSong.lyrics.length} lyric lines.</h4>
            <table className="lyrics-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Lyrics</th>
                </tr>
              </thead>
              <tbody>
                {selectedSong.lyrics.map((line, index) => {
                  // Check if line is an object with required properties
                  const isObject = typeof line === 'object' && line !== null;
                  
                  if (isObject && 'startTimeMs' in line && 'words' in line) {
                    // Format timestamp from milliseconds to mm:ss
                    const timeInSeconds = Math.floor(line.startTimeMs / 1000);
                    const minutes = Math.floor(timeInSeconds / 60);
                    const seconds = timeInSeconds % 60;
                    const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                    
                return (
                  <tr key={index}>
                    <td>{formattedTime}</td>
                    <td>{line.words}</td>
                  </tr>
                );
                  } else {
                // Fallback for string format (try to parse or display as is)
                const parts = typeof line === 'string' && line.includes(':') 
                  ? line.split(':') 
                  : ['--:--', line];
                return (
                  <tr key={index}>
                    <td>{parts[0]}</td>
                    <td>{parts[1] || line}</td>
                  </tr>
                );
                  }
                })}
              </tbody>
            </table>
              </div>
            ) : (
              <p>No lyrics available for this song.</p>
            )}
              </div>
            ) : (
              <p>Loading song details...</p>
            )}
            
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
                onClick={() => fetchSongs().then(songs => {
                  setView('add-songs-to-category');
                })}
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
                  <h3>Songs in this Category:</h3>
                  {selectedCategory.songs?.length > 0 ? (
                    <ul>
                      {selectedCategory.songs.map(song => (
                        <li key={song.id}>
                          {song.title} by {song.artist}
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

      case 'add-category-to-song': {
        // Use a functional component approach for this view
        const AddCategoriesToSongView = () => {
          const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
          
          const handleCategorySelection = (categoryId) => {
            setSelectedCategoryIds(prev => 
              prev.includes(categoryId) 
                ? prev.filter(id => id !== categoryId)
                : [...prev, categoryId]
            );
          };
          
          const handleAddSelectedCategories = () => {
            if (selectedCategoryIds.length > 0) {
              addCategoriesToSong(selectedSong.id, selectedCategoryIds)
                .then(() => {
                  loadSongDetails(selectedSong.id);
                  setSelectedCategoryIds([]);
                });
            }
          };
          
          return (
            <div className="selection-view">
              <h2>Add {selectedSong?.title} to Categories</h2>
              <div className="category-selection-container">
                <ul className="selection-list">
                  {categories.map(category => {
                    // Check if category already contains the song
                    const hasSong = selectedSong?.categories?.some(c => c.id === category.id);
                    return !hasSong ? (
                      <li key={category.id} className="category-selection-item">
                        <div className="category-checkbox">
                          <input
                            type="checkbox"
                            id={`sel-category-${category.id}`}
                            checked={selectedCategoryIds.includes(category.id)}
                            onChange={() => handleCategorySelection(category.id)}
                          />
                          <label htmlFor={`sel-category-${category.id}`}>
                            {category.name}
                          </label>
                        </div>
                      </li>
                    ) : null;
                  })}
                </ul>
                
                <div className="selection-actions">
                  <button 
                    className="add-selected-button"
                    onClick={handleAddSelectedCategories}
                    disabled={selectedCategoryIds.length === 0}
                  >
                    Add Selected Categories ({selectedCategoryIds.length})
                  </button>
                  <button 
                    className="cancel-button"
                    onClick={() => {
                      loadSongDetails(selectedSong.id);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          );
        };
        
        return <AddCategoriesToSongView />;
      }
      case 'add-songs-to-category': {
        // Add Songs to Category component
        const AddSongsToCategoryView = () => {
          const [selectedSongIds, setSelectedSongIds] = useState([]);
          
          const handleSongSelection = (songId) => {
            setSelectedSongIds(prev => 
              prev.includes(songId) 
                ? prev.filter(id => id !== songId)
                : [...prev, songId]
            );
          };
          
          const handleAddSelectedSongs = () => {
            if (selectedSongIds.length > 0) {
              addSongToCategory(selectedSongIds, selectedCategory.id)
                .then(() => {
                  loadCategoryDetails(selectedCategory.id);
                  setSelectedSongIds([]);
                });
            }
          };
          
          // Filter songs to show only those not already in the category
          const availableSongs = songs.filter(song => 
            !selectedCategory.songs?.some(catSong => catSong.id === song.id)
          );
          
          return (
            <div className="selection-view">
              <h2>Add Songs to {selectedCategory?.name}</h2>
              <div className="song-selection-container">
                {availableSongs.length === 0 ? (
                  <p>All available songs are already in this category.</p>
                ) : (
                  <>
                    <ul className="selection-list">
                      {availableSongs.map(song => (
                        <li key={song.id} className="song-selection-item">
                          <div className="song-checkbox">
                            <input
                              type="checkbox"
                              id={`sel-song-${song.id}`}
                              checked={selectedSongIds.includes(song.id)}
                              onChange={() => handleSongSelection(song.id)}
                            />
                            <label htmlFor={`sel-song-${song.id}`}>
                              {song.title} by {song.artist}
                            </label>
                          </div>
                        </li>
                      ))}
                    </ul>
                    
                    <div className="selection-actions">
                      <button 
                        className="add-selected-button"
                        onClick={handleAddSelectedSongs}
                        disabled={selectedSongIds.length === 0}
                      >
                        Add Selected Songs ({selectedSongIds.length})
                      </button>
                      <button 
                        className="cancel-button"
                        onClick={() => {
                          loadCategoryDetails(selectedCategory.id);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        };
        
        return <AddSongsToCategoryView />;
      }
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
      
    </div>
  );
};

export default DatabaseEditor;