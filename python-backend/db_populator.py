import os
import json
import logging
import uuid
import pandas as pd
from tqdm import tqdm
from spotify import SpotifyDriver, SpotifyLyricsDriver

from database import db, Song, Category

logger = logging.getLogger(__name__)

import requests
class LrcLibDriver:
    def __init__(self):
        self.BASE_API_ADDRESS = "https://lrclib.net"
        self.SEARCH_API = "/api/get"        

    def get_lyrics(self, track_name, artist_name):
        url = f"{self.BASE_API_ADDRESS}{self.SEARCH_API}"
        headers = {}
        params = {
            "track_name": track_name,
            "artist_name": artist_name
        }

        rsp = requests.get(url, headers=headers, params=params)

        if rsp.status_code > 299:
            raise RuntimeError(f"Failed to search in lrclib: {rsp.json()}")
        
        syncedLyrics = rsp.json().get("syncedLyrics")
        if not syncedLyrics: return
        
        list_lyrics_raw = syncedLyrics.split("\n")
        list_lyrics = []
        for lyrics in list_lyrics_raw:
            if lyrics:
                startTimeMs, words = lyrics.split("] ", 1)
                minutes, seconds = startTimeMs[1:].split(":", 1)
                startTimeMs = (60 * float(minutes) + float(seconds)) * 1000
                list_lyrics.append((startTimeMs, words))
        df_lyrics = pd.DataFrame(list_lyrics, columns=["startTimeMs", "words"])

        return df_lyrics


class DatabasePopulator:
    def __init__(self, app=None):
        self.app = app
        self.spotify_driver = SpotifyDriver()
        self.lyrics_driver = LrcLibDriver()
        # self.lyrics_driver = SpotifyLyricsDriver()
    
    def import_playlists_from_json(self, force_update=False):
        """Import all playlists from JSON files into the database"""
        playlists_dir = os.path.join('client', 'public', 'playlists')
        
        if not os.path.exists(playlists_dir):
            logger.error(f"Playlists directory not found: {playlists_dir}")
            return False
        
        with self.app.app_context():
            # Process each playlist file
            for filename in os.listdir(playlists_dir):
                if filename.endswith('.json'):
                    logger.info(f"Processing playlist: {filename}")
                    playlist_path = os.path.join(playlists_dir, filename)
                    
                    try:
                        with open(playlist_path, 'r') as f:
                            playlist_data = json.load(f)
                        
                        # Import categories
                        categories = {}
                        for category_data in playlist_data.get('categories', []):
                            category = self._import_category(category_data, force_update)
                            categories[category.id] = category
                        
                        # Import songs
                        for song_data in playlist_data.get('songs', []):
                            self._import_song(song_data, categories, force_update)
                            
                    except Exception as e:
                        logger.exception(f"Error importing playlist {filename}: {str(e)}")
            
            db.session.commit()
            logger.info("Playlist import completed")
            return True
    
    def _import_category(self, category_data, force_update=False):
        """Import a single category into the database"""
        category_id = category_data.get('id')
        
        # Check if category already exists
        category = Category.query.get(category_id)
        
        if category and not force_update:
            return category
        
        if not category:
            # Create new category
            category = Category(
                id=category_id,
                name=category_data.get('name')
            )
            db.session.add(category)
        else:
            # Update existing category
            category.name = category_data.get('name')
        
        db.session.flush()
        return category
    
    def _import_song(self, song_data, categories, force_update=False):
        """Import a single song into the database"""
        track_id = song_data.get('track_id') or song_data.get('id')
        
        # Check if song already exists
        song = Song.query.get(track_id)
        
        if song and not force_update:
            # Update song-category relationships only
            if song_data.get('category') and song_data['category'] in categories:
                category = categories[song_data['category']]
                if category not in song.categories:
                    song.categories.append(category)
            return song
        
        # If song doesn't exist or we're forcing an update
        if not song:
            # Create new song
            song = Song(
                id=track_id,
                artist=song_data.get('artist'),
                title=song_data.get('title')
            )
            db.session.add(song)
        else:
            # Update existing song
            song.artist = song_data.get('artist', song.artist)
            song.title = song_data.get('title', song.title)
        
        # Add category relationship if specified
        if song_data.get('category') and song_data['category'] in categories:
            category = categories[song_data['category']]
            if category not in song.categories:
                song.categories.append(category)
        
        db.session.flush()
        return song
    
    def fetch_and_store_lyrics(self, song_id):
        """Fetch lyrics from Spotify and store them in the database"""
        with self.app.app_context():
            # Check if song exists
            song = Song.query.get(song_id)
            if not song:
                logger.error(f"Song not found with ID: {song_id}")
                return False
            
            # Check if song already has lyrics
            if song.lyrics:
                logger.info(f"Lyrics already exist for {song.title}, skipping")
                return True
            
            try:
                logger.info(f"Fetching lyrics for {song.title} (ID: {song_id})")
                df_lyrics = self.lyrics_driver.get_lyrics(song_id)
                
                if df_lyrics is None or df_lyrics.empty:
                    logger.warning(f"No lyrics found for {song.title}")
                    return False
                
                # Store lyrics directly in the song record
                song.lyrics = df_lyrics.to_dict(orient='records')
                
                db.session.commit()
                logger.info(f"Stored {len(df_lyrics)} lyrics for {song.title}")
                return True
                
            except Exception as e:
                db.session.rollback()
                logger.exception(f"Error fetching lyrics for {song_id}: {str(e)}")
                return False
    
    def fetch_all_lyrics(self):
        """Fetch lyrics for all songs in the database"""
        with self.app.app_context():
            songs = Song.query.all()
            
            # Create progress bar for lyrics fetching
            for song in tqdm(songs, desc="Fetching lyrics", unit="song"):
                try:
                    # Show which song is currently being processed
                    tqdm.write(f"Processing lyrics for: {song.title} by {song.artist}")
                    self.fetch_and_store_lyrics(song.id)
                except Exception as e:
                    logger.exception(f"Error fetching lyrics for {song.id}: {str(e)}")
    
    def search_and_add_song(self, track_name, artist, category_ids=None, track_id=None):
        """Search for a song on Spotify and add it to the database"""
        try:
            if track_id:
                search_result = self.spotify_driver.search_track(track_id)
            else:
                search_result = self.spotify_driver.search(track_name, artist)

            track_data = search_result.get('track')
            track_name = track_data.get('name')
            artist_name = track_data.get('artist')
            track_id = track_data.get('id')

            lyrics_df = self.lyrics_driver.get_lyrics(track_name, artist_name)
            
            if not track_data or lyrics_df is None or lyrics_df.empty:
                logger.error(f"No track or lyrics found for {track_name} by {artist}")
                return None
            
            with self.app.app_context():
                # Check if song already exists
                song = Song.query.get(track_id)
                is_new_song = song is None
                
                if not song:
                    # Create new song
                    song = Song(
                        id=track_id,
                        artist=track_data.get('artists', [{}])[0].get('name', artist),
                        title=track_data.get('name', track_name),
                        lyrics=lyrics_df.to_dict(orient='records')
                    )
                    db.session.add(song)
                    logger.info(f"Adding new song: {song.title} by {song.artist}")
                else:
                    # Update song data while preserving existing categories
                    logger.info(f"Song already exists: {song.title} by {song.artist}")
                    # Only update lyrics if they don't exist
                    if not song.lyrics:
                        song.lyrics = lyrics_df.to_dict(orient='records')
                        logger.info(f"Updated lyrics for existing song")
                
                # Add new categories if specified, without removing existing ones
                if category_ids:
                    if isinstance(category_ids, str):
                        category_ids = [category_ids]
                        
                    for cat_id in category_ids:
                        category = Category.query.get(cat_id)
                        if category and category not in song.categories:
                            song.categories.append(category)
                            logger.info(f"Added category '{category.name}' to song")
                
                db.session.commit()
                
                result = song.to_dict()
                result["already_exists"] = not is_new_song
                
                return result
                
        except Exception as e:
            logger.exception(f"Error adding song '{track_name}' by '{artist}': {str(e)}")
            return None
    
    def create_random_category(self, name):
        """Create a new random category"""
        with self.app.app_context():
            category_id = str(uuid.uuid4())
            category = Category(
                id=category_id,
                name=name
            )
            db.session.add(category)
            db.session.commit()
            return category.to_dict()
    
    def generate_random_playlist(self, num_categories=5, songs_per_category=2):
        """Generate a random playlist with random categories and songs"""
        with self.app.app_context():
            # Get random categories
            categories = Category.query.order_by(db.func.random()).limit(num_categories).all()
            
            if len(categories) < num_categories:
                logger.warning(f"Not enough categories in database, found {len(categories)}")
            
            playlist = {
                'name': 'Random Playlist',
                'categories': [],
                'songs': []
            }
            
            # Define difficulty levels for the random playlist
            difficulty_levels = {
                0: {'difficulty': 10, 'expected_words': 2},
                1: {'difficulty': 20, 'expected_words': 3},
                2: {'difficulty': 30, 'expected_words': 4},
                3: {'difficulty': 40, 'expected_words': 5},
                4: {'difficulty': 50, 'expected_words': 6}
            }
            
            # Add categories and their songs to the playlist
            for i, category in enumerate(categories):
                # Get difficulty level for this category position
                difficulty_level = difficulty_levels.get(i, {'difficulty': 10, 'expected_words': 2})
                
                category_dict = category.to_dict()
                # Add difficulty and expected_words for the game
                category_dict['difficulty'] = difficulty_level['difficulty']
                category_dict['expected_words'] = difficulty_level['expected_words']
                playlist['categories'].append(category_dict)
                
                # Get random songs for this category
                songs = Song.query.filter(
                    Song.categories.contains(category)
                ).order_by(db.func.random()).limit(songs_per_category).all()
                
                if len(songs) < songs_per_category:
                    logger.warning(f"Category {category.name} has fewer than {songs_per_category} songs")
                
                for song in songs:
                    song_dict = song.to_dict()
                    song_dict['category'] = category.id
                    song_dict['expected_words'] = difficulty_level['expected_words']
                    playlist['songs'].append(song_dict)
            
            return playlist
    
    def import_songs_from_csv_with_categories(self, csv_file):
        """Import songs from CSV file with enhanced categorization"""
        try:
            # Use the EnhancedSongCategorizer for this operation
            from categorize_songs import EnhancedSongCategorizer
            
            categorizer = EnhancedSongCategorizer()
            
            # Read songs from CSV
            songs = categorizer.read_song_list(csv_file)
            if not songs:
                logger.error("No songs found in CSV or error reading file")
                return False
                
            logger.info(f"Found {len(songs)} songs in CSV")
            
            # Process songs with categorization
            categorizer.process_songs(songs)
            logger.info("Songs have been imported with categories")
            
            # Optionally fetch lyrics
            if input("Do you want to fetch lyrics for the imported songs? (y/n): ").lower() == 'y':
                with self.app.app_context():
                    songs = Song.query.all()
                    categorizer.fetch_lyrics_for_songs(songs)
            
            return True
            
        except ImportError:
            logger.error("EnhancedSongCategorizer not found. Make sure categorize_songs.py is available.")
            return False
        except Exception as e:
            logger.exception(f"Error importing songs from CSV with categorization: {str(e)}")
            return False

def populate_db_command(app):
    """CLI command to populate database"""
    populator = DatabasePopulator(app)
    populator.import_playlists_from_json()
    populator.fetch_all_lyrics()
    
if __name__ == "__main__":
    # This allows running the script directly for importing data
    import sys
    from flask import Flask
    from dotenv import load_dotenv
    
    load_dotenv()
    
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
        'DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/karaoke'
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    from database import init_db
    init_db(app)
    
    populator = DatabasePopulator(app)
    
    # Check command line arguments for actions
    if len(sys.argv) > 1:
        action = sys.argv[1]
        if action == 'import_playlists':
            force = len(sys.argv) > 2 and sys.argv[2] == '--force'
            populator.import_playlists_from_json(force_update=force)
        elif action == 'fetch_lyrics':
            if len(sys.argv) > 2:
                populator.fetch_and_store_lyrics(sys.argv[2])
            else:
                populator.fetch_all_lyrics()
        elif action == 'add_song' and len(sys.argv) > 3:
            track_name = sys.argv[2]
            artist = sys.argv[3]
            category_ids = sys.argv[4] if len(sys.argv) > 4 else None
            populator.search_and_add_song(track_name, artist, category_ids)
        elif action == 'import_csv_with_categories' and len(sys.argv) > 2:
            csv_file = sys.argv[2]
            populator.import_songs_from_csv_with_categories(csv_file)
    else:
        # Default action
        populator.import_playlists_from_json()
        populator.fetch_all_lyrics()