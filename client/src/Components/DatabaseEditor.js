import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './DatabaseEditor.css';

// Import detailed view components
import SongDetailsView from './DatabaseComponents/DetailViews/SongDetailsView';
import CategoryDetailsView from './DatabaseComponents/DetailViews/CategoryDetailsView';

// Import selection view components
import AddSongsToCategory from './DatabaseComponents/SelectionViews/AddSongsToCategory';
import AddCategoriesToSong from './DatabaseComponents/SelectionViews/AddCategoriesToSong';

// Import traditional components
import SongList from './DatabaseComponents/SongList';
import CategoryList from './DatabaseComponents/CategoryList';
import AddSongForm from './DatabaseComponents/AddSongForm';
import AddCategoryForm from './DatabaseComponents/AddCategoryForm';
import DatabaseStats from './DatabaseComponents/DatabaseStats';

// Define view states
const VIEW = {
  DASHBOARD: 'dashboard',
  SONGS_LIST: 'songs',
  SONG_DETAILS: 'song-details',
  CATEGORIES_LIST: 'categories',
  CATEGORY_DETAILS: 'category-details',
  ADD_SONGS_TO_CATEGORY: 'add-songs-to-category',
  ADD_CATEGORIES_TO_SONG: 'add-category-to-song',
  ADD_SONG_FORM: 'add-song',
  ADD_CATEGORY_FORM: 'add-category'
};

// Set up axios with the backend URL
axios.defaults.baseURL = 'http://localhost:4001';

const DatabaseEditor = () => {
  // Core state
  const [view, setView] = useState(VIEW.DASHBOARD);
  const [songs, setSongs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedSong, setSelectedSong] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({});

  // Fetch initial data
  useEffect(() => {
    fetchStats();
  }, []);

//   // Filter available songs based on search query
//   const filteredSongs = songs.filter(song => {
//     // Filter by search query (title or artist)
//     if (searchQuery) {
//       const query = searchQuery.toLowerCase();
//       const matchesTitle = song.title.toLowerCase().includes(query);
//       const matchesArtist = song.artist.toLowerCase().includes(query);
//       if (!matchesTitle && !matchesArtist) return false;
//     }
    
//     // Filter out songs already in the selected category
//     if (view === VIEW.ADD_SONGS_TO_CATEGORY && selectedCategory) {
//       return !selectedCategory.songs?.some(catSong => catSong.id === song.id);
//     }
//     return true;
//   });

  // API Calls
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

  const fetchSongs = useCallback(async () => {
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
}, []);

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

  // Data loading functions
  const loadSongDetails = async (songId) => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/database/songs/${songId}`);
      setSelectedSong(response.data);
      setView(VIEW.SONG_DETAILS);
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
      setView(VIEW.CATEGORY_DETAILS);
    } catch (err) {
      setError(`Failed to load category details for ID: ${categoryId}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Association management functions
  const addSongToCategory = async (songIds, categoryId) => {
    try {
      // If songIds is not an array, convert it to an array for backward compatibility
      const songIdsArray = Array.isArray(songIds) ? songIds : [songIds];
      
      await axios.post(`/api/database/categories/${categoryId}/songs`, {
        song_ids: songIdsArray
      });
      
      // Refresh data
    //   if (selectedCategory) {
    //     loadCategoryDetails(categoryId);
    //   }
    //   if (selectedSong) {
    //     loadSongDetails(selectedSong.id);
    //   }
      fetchStats();
      return true;
    } catch (err) {
      setError('Failed to associate songs with category');
      console.error(err);
      return false;
    }
  };

  const addCategoriesToSong = async (songId, categoryIds) => {
    try {

      const categoryIdsArray = Array.isArray(categoryIds) ? categoryIds : [categoryIds];

      await axios.post(`/api/database/songs/${songId}/categories`, {
        category_ids: categoryIdsArray
      });
    //   // Refresh data
    //   if (selectedSong) {
    //     loadSongDetails(songId);
    //   }
      fetchStats();
      return true;
    } catch (err) {
      setError('Failed to associate categories with song');
      console.error(err);
      return false;
    }
  };

  const removeSongFromCategory = async (songId, categoryId) => {
    try {
      await axios.delete(`/api/database/songs/${songId}/categories/${categoryId}`);
      // Refresh data
    //   if (selectedCategory) {
    //     loadCategoryDetails(categoryId);
    //   }
    //   if (selectedSong) {
    //     loadSongDetails(songId);
    //   }
      fetchStats();
      return true;
    } catch (err) {
      setError('Failed to remove association');
      console.error(err);
      return false;
    }
  };

  // Item deletion functions
  const deleteCategory = async (categoryId) => {
    try {
      if (window.confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
        await axios.delete(`/api/database/categories/${categoryId}`);
        // Refresh data
        fetchStats();
        setView(VIEW.CATEGORIES_LIST);
        fetchCategories().then();
        return true;
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
        setView(VIEW.SONGS_LIST);
        fetchSongs().then();
        return true;
      }
      return false;
    } catch (err) {
      setError('Failed to delete song');
      console.error(err);
      return false;
    }
  };

  // Category renaming function
  const renameCategory = async (categoryId, newName) => {
    try {
      const response = await axios.put(`/api/database/categories/${categoryId}`, {
        name: newName
      });
      
      // Refresh data after successful update
      fetchStats();
      
      // Return the updated category
      return response.data.category;
    } catch (err) {
      setError(`Failed to rename category: ${err.response?.data?.error || err.message}`);
      console.error(err);
      return null;
    }
  };

  // Navigation handlers
  const handleBackToSongsList = () => {
    setView(VIEW.SONGS_LIST);
  };

  const handleBackToCategoriesList = () => {
    setView(VIEW.CATEGORIES_LIST);
  };

  const handleShowAddSongsToCategory = (category) => {
    if (category.name && category.id) {
        setSelectedCategory(category)
    }
    if (songs.length === 0) {
        fetchSongs().then()
    }
    setView(VIEW.ADD_SONGS_TO_CATEGORY)
  };

  const handleShowAddCategoriesToSong = (song) => {
    if (song.name && song.id) {
        setSelectedSong(song)
    }
    if (categories.length === 0) {
        fetchCategories().then()
    }
    setView(VIEW.ADD_CATEGORIES_TO_SONG)
  };

  // Form success handlers
  const handleAddSongSuccess = async (songData, addToCategories = false, goToSongList = false) => {
    // Refresh stats to reflect the new song
    await fetchStats();
    
    if (addToCategories) {
      setSelectedSong(songData);
      await fetchCategories();
      setView(VIEW.ADD_CATEGORIES_TO_SONG);
    } 
    else if (goToSongList) {
      await fetchSongs();
      setView(VIEW.SONGS_LIST);
    }
    else {
      setView(VIEW.ADD_SONG_FORM);
    }
  };

  const handleAddCategorySuccess = async () => {
    await fetchStats();
    await fetchCategories();
    // setView(VIEW.CATEGORIES_LIST);
  };

  const renderView = () => {
    switch (view) {
      case VIEW.SONGS_LIST:
        return (
          <SongList 
            onLoadSongs={fetchSongs} 
            onSelectSong={loadSongDetails}
            onRemoveCategory={removeSongFromCategory}
            onAddCategory={handleShowAddCategoriesToSong}
          />
        );
      
      case VIEW.CATEGORIES_LIST:
        return (
          <CategoryList 
            onLoadCategories={fetchCategories} 
            onSelectCategory={loadCategoryDetails}
            onRemoveSong={removeSongFromCategory}
            onAddSongs={handleShowAddSongsToCategory}
          />
        );
      
      case VIEW.SONG_DETAILS:
        return (
          <SongDetailsView 
            song={selectedSong}
            onBack={handleBackToSongsList}
            onAddToCategory={handleShowAddCategoriesToSong}
            onDelete={() => deleteSong(selectedSong.id)}
            onRemoveFromCategory={removeSongFromCategory}
          />
        );
      
      case VIEW.CATEGORY_DETAILS:
        return (
          <CategoryDetailsView 
            category={selectedCategory}
            onBack={handleBackToCategoriesList}
            onAddSongs={handleShowAddSongsToCategory}
            onDelete={() => deleteCategory(selectedCategory.id)}
            onRemoveSong={removeSongFromCategory}
            onRename={renameCategory}
          />
        );
        
      case VIEW.ADD_CATEGORIES_TO_SONG:
        return (
          <AddCategoriesToSong 
            categories={categories}
            song={selectedSong}
            onBack={handleBackToSongsList}
            onAddCategories={(songId, categoryIds) => addCategoriesToSong(songId, categoryIds)}
          />
        );
        
      case VIEW.ADD_SONGS_TO_CATEGORY:
        return (
          <AddSongsToCategory 
            songs={songs}
            category={selectedCategory}
            onBack={handleBackToCategoriesList}
            onAddSongs={(songIds, categoryId) => addSongToCategory(songIds, categoryId)}
          />
        );
        
      case VIEW.ADD_SONG_FORM:
        return (
          <AddSongForm 
            onSuccess={handleAddSongSuccess} 
            onCancel={() => setView(VIEW.DASHBOARD)} 
          />
        );
        
      case VIEW.ADD_CATEGORY_FORM:
        return (
          <AddCategoryForm 
            onSuccess={handleAddCategorySuccess} 
            onCancel={() => setView(VIEW.DASHBOARD)} 
          />
        );
        
      default:
        return (
          <DatabaseStats 
            stats={stats} 
            onRefresh={fetchStats} 
          />
        );
    }
  };

  return (
    <div className="database-editor">
      <h1>Karaoke Database Editor</h1>
      
      {error && (
        <div className="error-message">
          {error} <button onClick={() => setError(null)}>Clear</button>
        </div>
      )}
      
      <div className="nav-buttons">
        <button onClick={() => setView(VIEW.DASHBOARD)}>Dashboard</button>
        <button onClick={() => { fetchSongs().then(() => setView(VIEW.SONGS_LIST)) }}>Songs</button>
        <button onClick={() => { fetchCategories().then(() => setView(VIEW.CATEGORIES_LIST)) }}>Categories</button>
        <button onClick={() => setView(VIEW.ADD_SONG_FORM)}>Add New Song</button>
        <button onClick={() => setView(VIEW.ADD_CATEGORY_FORM)}>Add New Category</button>
      </div>
      
      {loading && <div className="loading">Loading...</div>}
      
      <div className="view-container">
        {renderView()}
      </div>
    </div>
  );
};

export default DatabaseEditor;