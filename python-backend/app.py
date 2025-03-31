from flask import Flask, send_from_directory, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
import os
import json
import pandas as pd
import uuid
from spotify import SpotifyDriver, SpotifyLyricsDriver
from database import init_db, db, Song, Category
from db_populator import DatabasePopulator
from song_populator import LrcLibDriver
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})
app.config['SECRET_KEY'] = 'secret!'

# Configure the SQLAlchemy part of the app
# Add options to set search_path to karaoke schema
base_db_url = os.environ.get(
    'DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/karaoke'
)
app.config['SQLALCHEMY_DATABASE_URI'] = f"{base_db_url}?options=-c%20search_path=karaoke,public"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize database
init_db(app)

socketio = SocketIO(app, cors_allowed_origins="*", ping_timeout=30, ping_interval=5, async_mode='eventlet')

sockets = []

# Initialize database populator
db_populator = DatabasePopulator(app)

# Function to initialize database (will be called in a different way now)
def initialize_database():
    """Initialize database by importing data from JSON files"""
    try:
        # Check if the database is empty
        with app.app_context():
            if Song.query.count() == 0 and Category.query.count() == 0:
                logger.info("Database is empty, importing data...")
                db_populator.import_playlists_from_json()
                logger.info("Database import completed")
    except Exception as e:
        logger.exception(f"Error initializing database: {str(e)}")

# A route that will trigger database initialization on first visit
@app.route('/api/init-db', methods=['GET'])
def init_db_route():
    initialize_database()
    return jsonify({"message": "Database initialization triggered"}), 200

# Serve static files
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    try:
        if path != "" and os.path.exists(os.path.join('public', path)):
            return send_from_directory('public', path)
        return send_from_directory('public', 'index.html')
    except Exception as e:
        logger.exception(f"Error serving static files: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Add endpoint to list available playlists
@app.route('/api/playlists', methods=['GET'])
def get_playlists():
    try:
        # First check if database needs initialization
        initialize_database()
        
        # First, check for playlists in the database directory
        playlists_dir = os.path.join('client', 'public', 'playlists')
        playlists = []
        
        # List all JSON files in the playlists directory
        for filename in os.listdir(playlists_dir):
            if filename.endswith('.json'):
                playlist_name = os.path.splitext(filename)[0]
                playlists.append({
                    'id': playlist_name,
                    'name': playlist_name.replace('_', ' ').title()
                })
        
        # Add a "Random Playlist" option
        playlists.append({
            'id': 'random',
            'name': 'Random Playlist'
        })
                
        return jsonify(playlists)
    except Exception as e:
        logger.exception(f"Error getting playlists: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Modified route to serve playlist by name
@app.route('/api/playlist', methods=['GET'])
def get_playlist():
    try:
        # Get playlist name from query parameter, default to 'playlist'
        playlist_name = request.args.get('name', 'playlist')
        
        # Handle request for a random playlist
        if (playlist_name == 'random'):
            num_categories = int(request.args.get('categories', '5'))
            songs_per_category = int(request.args.get('songs_per_category', '2'))
            
            # Generate random playlist
            playlist = db_populator.generate_random_playlist(
                num_categories=num_categories, 
                songs_per_category=songs_per_category
            )
            
            return jsonify(playlist)
        
        # Otherwise, load playlist from JSON file
        playlist_path = os.path.join('client', 'public', 'playlists', f'{playlist_name}.json')
        
        # If the specific playlist doesn't exist, fall back to the default
        if not os.path.exists(playlist_path):
            playlist_path = os.path.join('client', 'public', 'playlists', 'playlist.json')
            
        # Read the playlist JSON file
        with open(playlist_path, 'r', encoding='utf-8') as f:
            playlist = json.load(f)
            
        for cat in playlist['categories']:
            for song in playlist['songs']:
                if song["category"] == cat["id"]:
                    song["expected_words"] = cat["expected_words"]

        return jsonify(playlist)
    except Exception as e:
        logger.exception(f"Error getting playlist: {str(e)}")
        return jsonify({"error": str(e)}), 500

# New endpoint to get all categories from the database
@app.route('/api/categories', methods=['GET'])
def get_all_categories():
    try:
        # First check if database needs initialization
        initialize_database()
        
        with app.app_context():
            categories = Category.query.all()
            categories_data = [category.to_dict() for category in categories]
            return jsonify(categories_data)
    except Exception as e:
        logger.exception(f"Error getting categories: {str(e)}")
        return jsonify({"error": str(e)}), 500

# New endpoint to get songs for a specific category
@app.route('/api/songs', methods=['GET'])
def get_songs():
    try:
        # Get category ID from query parameter, if provided
        category_id = request.args.get('category_id')
        
        with app.app_context():
            if category_id:
                # Get category
                category = Category.query.get(category_id)
                if not category:
                    return jsonify({"error": f"Category with ID {category_id} not found"}), 404
                
                # Get songs for the category
                songs = category.songs
            else:
                # Get all songs if no category specified
                songs = Song.query.all()
                
            songs_data = [song.to_dict() for song in songs]
            return jsonify(songs_data)
    except Exception as e:
        logger.exception(f"Error getting songs: {str(e)}")
        return jsonify({"error": str(e)}), 500

DEFAULT_WORDS_TO_GUESS = 5
MAX_RECURSION_DEPTH = 5  # Add a limit to prevent infinite recursion

@app.route('/api/getLyrics/<track_id>/<words_to_guess>', methods=['GET'])
def get_lyrics(track_id, words_to_guess=5):
    """Return lyrics for a given track_id as a list of couples (timecodeMs, content)"""
    try:
        try: 
            words_to_guess = int(words_to_guess)
        except ValueError:
            words_to_guess = DEFAULT_WORDS_TO_GUESS
            
        # Get optional parameter for specific lyric start time
        specific_lyric_time = request.args.get('lyric_time')
        if specific_lyric_time:
            try:
                specific_lyric_time = int(specific_lyric_time)
            except ValueError:
                specific_lyric_time = None
            
        list_lyrics = {}
        
        # Try to get lyrics from database first
        with app.app_context():
            song = Song.query.get(track_id)
            
            if not song:
                raise ValueError(f"Song with ID {track_id} not found")
            
            if not song.lyrics:
                raise ValueError(f"No lyrics found for song with ID {track_id}")

            # Convert to DataFrame for compatibility with the rest of the code
            df_lyrics = pd.DataFrame(song.lyrics, columns=['startTimeMs', 'words'])
            
            if not df_lyrics.empty:
                df_lyrics['word_count'] = count_words(df_lyrics['words'])
                list_lyrics["lyrics"] = df_lyrics.to_dict(orient='records')
                # list_lyrics["lyrics"] = song.lyrics
                
                # If lyrics_time is provided, use that specific lyric
                if specific_lyric_time is not None:
                    list_lyrics["lyricsToGuess"], list_lyrics["words_to_guess"] = extract_specific_lyric(
                        df_lyrics, 
                        specific_lyric_time
                    )
                    list_lyrics["lyricsToGuess"] = list_lyrics["lyricsToGuess"].to_dict(orient='records')
                # If words_to_guess is 0, don't select any lyrics (used for lyrics browser)
                elif words_to_guess == 0:
                    list_lyrics["lyricsToGuess"] = []
                    list_lyrics["words_to_guess"] = 0
                # Otherwise use safer version with recursion depth limit
                else:
                    try:
                        list_lyrics["lyricsToGuess"], list_lyrics["words_to_guess"] = extract_lyric_to_guess(
                            df_lyrics, 
                            words_to_guess=int(words_to_guess),
                            recursion_depth=0
                        )
                        list_lyrics["lyricsToGuess"] = list_lyrics["lyricsToGuess"].to_dict(orient='records')
                    except Exception as e:
                        logger.error(f"Error extracting lyrics to guess: {str(e)}")
                        # Fallback to first line if extraction fails
                        list_lyrics["lyricsToGuess"] = df_lyrics.iloc[:1].to_dict(orient='records')
                        list_lyrics["words_to_guess"] = 1
                
                return jsonify(list_lyrics)
        
        # # Fall back to fetching from Spotify API if not in database
        # df_lyrics = SpotifyLyricsDriver().get_lyrics(track_id)
        
        # if df_lyrics is None or df_lyrics.empty:
        #     return jsonify({"error": "No lyrics found for this track"}), 404
            
        # list_lyrics["lyrics"] = df_lyrics.to_dict(orient='records')
        
        # # If lyrics_time is provided, use that specific lyric
        # if specific_lyric_time is not None:
        #     list_lyrics["lyricsToGuess"], list_lyrics["words_to_guess"] = extract_specific_lyric(
        #         df_lyrics, 
        #         specific_lyric_time
        #     )
        #     list_lyrics["lyricsToGuess"] = list_lyrics["lyricsToGuess"].to_dict(orient='records')
        # # If words_to_guess is 0, don't select any lyrics (used for lyrics browser)
        # elif words_to_guess == 0:
        #     list_lyrics["lyricsToGuess"] = []
        #     list_lyrics["words_to_guess"] = 0
        #     
        # # Otherwise use safer version with recursion depth limit
        # else:
        #     try:
        #         list_lyrics["lyricsToGuess"], list_lyrics["words_to_guess"] = extract_lyric_to_guess(
        #             df_lyrics, 
        #             words_to_guess=int(words_to_guess),
        #             recursion_depth=0
        #         )
        #         list_lyrics["lyricsToGuess"] = list_lyrics["lyricsToGuess"].to_dict(orient='records')
        #     except Exception as e:
        #         logger.error(f"Error extracting lyrics to guess: {str(e)}")
        #         # Fallback to first line if extraction fails
        #         list_lyrics["lyricsToGuess"] = df_lyrics.iloc[:1].to_dict(orient='records')
        #         list_lyrics["words_to_guess"] = 1
        #     
        # return jsonify(list_lyrics)
    except Exception as e:
        logger.exception(f"Error getting lyrics for {track_id}: {str(e)}")
        return jsonify({"error": str(e)}), 500

def count_words(s_words):
    """Count the number of words in each line separated by a space " " or a " ' " """
    return s_words.apply(lambda x: len(x.replace("'", " ").replace("-", " ").split()))

def extract_specific_lyric(df, lyric_time):
    """Extract a specific lyric line by its start time"""
    # Find the nearest lyric to the given time
    df_filtered = df[df['startTimeMs'] == lyric_time]
    
    # If no exact match, find the closest one
    if df_filtered.empty:
        # Find the closest timestamp by absolute difference
        closest_idx = (df['startTimeMs'] - lyric_time).abs().idxmin()
        df_filtered = df.iloc[[closest_idx]]
    
    # Count the words in the selected lyric
    if 'word_count' not in df_filtered.columns:
        df_filtered['word_count'] = count_words(df_filtered['words'])
        
    # Get the actual word count
    words_to_guess = int(df_filtered['word_count'].iloc[0])
    
    return df_filtered, words_to_guess

def extract_lyric_to_guess(df, words_to_guess=5, recursion_depth=0):
    """Extract the lyrics to guess from the lyrics dataframe with recursion depth limit"""
    # Add a safeguard against infinite recursion
    if recursion_depth >= MAX_RECURSION_DEPTH:
        logger.warning(f"Reached max recursion depth {MAX_RECURSION_DEPTH}, using fallback lyrics")
        # Return any available line as a fallback
        return df.iloc[:1], 1
        
    # Count the number of words in each line separated by a space " " or a " ' "
    df['word_count'] = count_words(df['words'])

    # Choose a random row where word_count is greater than 'nb_missing_lyrics after the 10 first lyrics
    min_song_duration = 20000 # Guess after min 20 seconds
    df_reduced = df[df["startTimeMs"] > min_song_duration]
    guess_candidates = df_reduced[df_reduced['word_count'] == words_to_guess]

    # Add condition to discard when MORE than words_to_guess
    if guess_candidates.empty:
        if words_to_guess == 1:
            # If we can't find even one word, just use the first line
            return df.iloc[:1], 1
        return extract_lyric_to_guess(df, words_to_guess-1, recursion_depth+1)
    else:
        return guess_candidates.sample(1), words_to_guess

# New endpoint for database management
@app.route('/api/database/import', methods=['POST'])
def import_database():
    try:
        force_update = request.json.get('force_update', False)
        result = db_populator.import_playlists_from_json(force_update=force_update)
        
        if result:
            return jsonify({"message": "Database import completed successfully"}), 200
        else:
            return jsonify({"error": "Database import failed"}), 500
    except Exception as e:
        logger.exception(f"Error importing database: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/database/fetch_lyrics', methods=['POST'])
def fetch_lyrics():
    try:
        track_id = request.json.get('track_id')
        
        if track_id:
            result = db_populator.fetch_and_store_lyrics(track_id)
        else:
            result = db_populator.fetch_all_lyrics()
            
        if result:
            return jsonify({"message": "Lyrics fetched successfully"}), 200
        else:
            return jsonify({"error": "Failed to fetch lyrics"}), 500
    except Exception as e:
        logger.exception(f"Error fetching lyrics: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/database/add_song', methods=['POST'])
def add_song():
    try:
        data = request.json
        track_name = data.get('track_name')
        artist = data.get('artist')
        category_ids = data.get('category_ids', [])
        
        if not track_name or not artist:
            return jsonify({"error": "Track name and artist are required"}), 400
        
        result = db_populator.search_and_add_song(track_name, artist, category_ids)
        
        if result:
            return jsonify(result), 200
        else:
            return jsonify({"error": "Failed to add song"}), 500
    except Exception as e:
        logger.exception(f"Error adding song: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/database/categories', methods=['POST'])
def create_category():
    try:
        data = request.json
        if not data or not data.get('name'):
            return jsonify({"error": "Category name is required"}), 400
            
        with app.app_context():
            # Generate a unique ID for the category
            category_id = str(uuid.uuid4())
            
            # Create the new category
            category = Category(
                id=category_id,
                name=data['name']
            )
            
            db.session.add(category)
            db.session.commit()
            
            return jsonify(category.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        logger.exception(f"Error creating category: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/database/stats', methods=['GET'])
def get_database_stats():
    try:
        with app.app_context():
            song_count = Song.query.count()
            category_count = Category.query.count()
            lyrics_count = sum(1 for song in Song.query.all() if song.lyrics)
            
            # Get count of songs per category
            categories = Category.query.all()
            # Sort categories by number of songs in descending order
            categories.sort(key=lambda c: len(c.songs), reverse=True)
            category_stats = []
            
            for category in categories:
                category_stats.append({
                    'id': category.id,
                    'name': category.name,
                    'song_count': len(category.songs)
                })
            
            return jsonify({
                'totalSongs': song_count,
                'totalCategories': category_count,
                'songsWithLyrics': lyrics_count,
                'categories': category_stats
            }), 200
    except Exception as e:
        logger.exception(f"Error getting database stats: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/database/categories/<category_id>', methods=['GET'])
def get_category_details(category_id):
    try:
        with app.app_context():
            # Find the category by ID
            category = Category.query.get(category_id)
            
            if not category:
                return jsonify({"error": f"Category with ID {category_id} not found"}), 404
                
            # Return category details including its songs
            return jsonify(category.to_dict(include_songs=True)), 200
    except Exception as e:
        logger.exception(f"Error getting category details: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/database/songs/<song_id>', methods=['GET'])
def get_song_details(song_id):
    try:
        with app.app_context():
            # Find the song by ID
            song = Song.query.get(song_id)
            
            if not song:
                return jsonify({"error": f"Song with ID {song_id} not found"}), 404
                
            # Return song details including its categories
            return jsonify(song.to_dict(include_categories_full=True)), 200
    except Exception as e:
        logger.exception(f"Error getting song details: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/database/categories/<category_id>/songs', methods=['POST'])
def add_songs_to_category(category_id):
    try:
        data = request.json
        if not data or 'song_ids' not in data:
            return jsonify({"error": "Song IDs are required"}), 400
            
        song_ids = data['song_ids']
        
        with app.app_context():
            # Find the category
            category = Category.query.get(category_id)
            
            if not category:
                return jsonify({"error": f"Category with ID {category_id} not found"}), 404
                
            # Find and associate the songs
            songs_added = []
            for song_id in song_ids:
                song = Song.query.get(song_id)
                if song:
                    # Check if association already exists
                    if song not in category.songs:
                        category.songs.append(song)
                        songs_added.append(song.to_dict())
            
            # Commit the changes
            db.session.commit()
            
            return jsonify({
                "message": f"Added {len(songs_added)} songs to category '{category.name}'",
                "category": category.to_dict(),
                "songs_added": songs_added
            }), 200
    except Exception as e:
        db.session.rollback()
        logger.exception(f"Error adding songs to category: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/database/songs/<song_id>/categories', methods=['POST'])
def add_categories_to_song(song_id):
    try:
        data = request.json
        if not data or 'category_ids' not in data:
            return jsonify({"error": "Category IDs are required"}), 400
            
        category_ids = data['category_ids']
        
        with app.app_context():
            # Find the song
            song = Song.query.get(song_id)
            
            if not song:
                return jsonify({"error": f"Song with ID {song_id} not found"}), 404
                
            # Find and associate the categories
            categories_added = []
            for category_id in category_ids:
                category = Category.query.get(category_id)
                if category:
                    # Check if association already exists
                    if category not in song.categories:
                        song.categories.append(category)
                        categories_added.append(category.to_dict())
            
            # Commit the changes
            db.session.commit()
            
            return jsonify({
                "message": f"Added {len(categories_added)} categories to song '{song.title}'",
                "song": song.to_dict(),
                "categories_added": categories_added
            }), 200
    except Exception as e:
        db.session.rollback()
        logger.exception(f"Error adding categories to song: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/database/songs/<song_id>/categories/<category_id>', methods=['DELETE'])
def remove_song_from_category(song_id, category_id):
    try:
        with app.app_context():
            # Find the song and category
            song = Song.query.get(song_id)
            category = Category.query.get(category_id)
            
            if not song:
                return jsonify({"error": f"Song with ID {song_id} not found"}), 404
                
            if not category:
                return jsonify({"error": f"Category with ID {category_id} not found"}), 404
                
            # Check if the association exists
            if category in song.categories:
                # Remove the association
                song.categories.remove(category)
                db.session.commit()
                
                return jsonify({
                    "message": f"Removed song '{song.title}' from category '{category.name}'",
                    "song": song.to_dict(),
                    "category": category.to_dict()
                }), 200
            else:
                return jsonify({"error": f"Song is not associated with this category"}), 400
    except Exception as e:
        db.session.rollback()
        logger.exception(f"Error removing song from category: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Add endpoint to delete a category
@app.route('/api/database/categories/<category_id>', methods=['DELETE'])
def delete_category(category_id):
    try:
        with app.app_context():
            # Find the category
            category = Category.query.get(category_id)
            
            if not category:
                return jsonify({"error": f"Category with ID {category_id} not found"}), 404
                
            # Remove associations with songs but keep the songs
            category.songs = []
                
            # Delete the category
            db.session.delete(category)
            db.session.commit()
            
            return jsonify({"message": f"Category '{category.name}' deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        logger.exception(f"Error deleting category: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Add endpoint to get all categories with their songs
@app.route('/api/database/categories-with-songs', methods=['GET'])
def get_categories_with_songs():
    try:
        # First check if database needs initialization
        initialize_database()
        
        with app.app_context():
            categories = Category.query.all()
            categories_data = [category.to_dict(include_songs=True) for category in categories]
            return jsonify(categories_data)
    except Exception as e:
        logger.exception(f"Error getting categories with songs: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Add endpoint to get all categories with their songs
@app.route('/api/database/songs-with-categories', methods=['GET'])
def get_songs_with_categories():
    try:
        # First check if database needs initialization
        initialize_database()
        
        with app.app_context():
            songs = Song.query.all()
            songs_data = [song.to_dict(include_categories_full=True) for song in songs]
            return jsonify(songs_data)
    except Exception as e:
        logger.exception(f"Error getting songs with categories: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Add endpoint to save a playlist
@app.route('/api/playlist/save', methods=['POST'])
def save_playlist():
    try:
        # Get playlist data from request body
        playlist_data = request.json
        
        if not playlist_data:
            return jsonify({"error": "No playlist data provided"}), 400
        
        # Validate required fields
        if 'name' not in playlist_data:
            return jsonify({"error": "Playlist name is required"}), 400
        
        # Ensure playlist has categories and songs
        elif 'categories' not in playlist_data or not playlist_data['categories']:
            return jsonify({"error": "Playlist must have categories"}), 400
        
        elif 'songs' not in playlist_data or not playlist_data['songs']:
            return jsonify({"error": "Playlist must have songs"}), 400
        
        else:
            playlist_data.pop("id")
            # Keep only necessary song data
            filtered_songs = []
            for song in playlist_data['songs']:
                filtered_song = {k: song[k] for k in ["id", "track_id", "category", "artist", "title"] if k in song}
                filtered_songs.append(filtered_song)
            playlist_data['songs'] = filtered_songs

        # Sanitize the playlist name for use as a filename
        playlist_name = playlist_data['name'].replace(' ', '_').lower()
        
        # Create playlists directory if it doesn't exist
        playlists_dir = os.path.join('client', 'public', 'playlists')
        os.makedirs(playlists_dir, exist_ok=True)
        
        # Save the playlist to a JSON file
        playlist_path = os.path.join(playlists_dir, f'{playlist_name}.json')
        
        with open(playlist_path, 'w', encoding='utf-8') as f:
            json.dump(playlist_data, f, ensure_ascii=False, indent=2)
        
        logger.info(f"Playlist '{playlist_name}' saved successfully to {playlist_path}")
        
        return jsonify({
            "message": f"Playlist '{playlist_name}' saved successfully",
            "id": playlist_name,
            "name": playlist_data['name']
        }), 200
        
    except Exception as e:
        logger.exception(f"Error saving playlist: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Add new route for improved lyrics management
@app.route('/api/lyrics-management', methods=['POST'])
def manage_lyrics():
    """
    Enhanced endpoint for centralized lyrics management.
    This supports various operations including:
    - Fetching lyrics for a song
    - Selecting specific lyrics to guess
    - Updating lyrics data for a song
    """
    try:
        data = request.json
        operation = data.get('operation')
        
        if operation == 'fetch':
            # Similar to getLyrics but with more flexibility
            track_id = data.get('track_id')
            words_to_guess = data.get('words_to_guess', 5)
            specific_lyric_time = data.get('specific_lyric_time')
            
            if not track_id:
                return jsonify({"error": "track_id is required"}), 400
                
            return get_lyrics_internal(track_id, words_to_guess, specific_lyric_time)
            
        elif operation == 'select':
            # Select a specific lyric for guessing
            track_id = data.get('track_id')
            lyric_time = data.get('lyric_time')
            song_id = data.get('song_id')
            
            if not track_id or not lyric_time:
                return jsonify({"error": "track_id and lyric_time are required"}), 400
                
            # Get the lyrics for this track
            lyrics_data = get_lyrics_internal(track_id, 0)
            if 'error' in lyrics_data:
                return jsonify(lyrics_data), 404
                
            # Find the specific lyric
            all_lyrics = lyrics_data.get('lyrics', [])
            selected_lyric = None
            
            for lyric in all_lyrics:
                if lyric['startTimeMs'] == lyric_time:
                    selected_lyric = lyric
                    break
                    
            if not selected_lyric:
                return jsonify({"error": f"No lyric found at time {lyric_time}"}), 404
                
            # Count words in this lyric
            word_count = len(selected_lyric['words'].replace("'", " ").split())
            
            return jsonify({
                "selected_lyric": selected_lyric,
                "word_count": word_count,
                "song_id": song_id,
                "track_id": track_id
            })
            
        elif operation == 'update':
            # Update lyrics for a song (e.g., save selected lyric to guess)
            song_id = data.get('song_id')
            track_id = data.get('track_id')
            lyric_time = data.get('lyric_time')
            word_count = data.get('word_count')
            
            if not song_id or not track_id or not lyric_time:
                return jsonify({"error": "song_id, track_id, and lyric_time are required"}), 400
                
            # In a real implementation, we would update the database here
            # For now, just return success
            return jsonify({
                "message": "Lyrics updated successfully",
                "song_id": song_id,
                "track_id": track_id,
                "lyric_time": lyric_time,
                "word_count": word_count
            })
            
        else:
            return jsonify({"error": f"Unknown operation: {operation}"}), 400
            
    except Exception as e:
        logger.exception(f"Error managing lyrics: {str(e)}")
        return jsonify({"error": str(e)}), 500

def get_lyrics_internal(track_id, words_to_guess=5, specific_lyric_time=None):
    """Internal function to get lyrics, used by both the GET endpoint and the POST endpoint"""
    try:
        try: 
            words_to_guess = int(words_to_guess)
        except ValueError:
            words_to_guess = DEFAULT_WORDS_TO_GUESS
            
        # Convert specific_lyric_time to int if provided
        if specific_lyric_time:
            try:
                specific_lyric_time = int(specific_lyric_time)
            except ValueError:
                specific_lyric_time = None
            
        list_lyrics = {}
        
        # Try to get lyrics from database first
        with app.app_context():
            song = Song.query.get(track_id)
            
            if song and song.lyrics:
                # Convert to DataFrame for compatibility with the rest of the code
                df_lyrics = pd.DataFrame(song.lyrics, columns=['startTimeMs', 'words'])
                
                if not df_lyrics.empty:
                    list_lyrics["lyrics"] = song.lyrics
                    
                    # If lyrics_time is provided, use that specific lyric
                    if specific_lyric_time is not None:
                        list_lyrics["lyricsToGuess"], list_lyrics["words_to_guess"] = extract_specific_lyric(
                            df_lyrics, 
                            specific_lyric_time
                        )
                        list_lyrics["lyricsToGuess"] = list_lyrics["lyricsToGuess"].to_dict(orient='records')
                    # If words_to_guess is 0, don't select any lyrics (used for lyrics browser)
                    elif words_to_guess == 0:
                        list_lyrics["lyricsToGuess"] = []
                        list_lyrics["words_to_guess"] = 0
                    # Otherwise use safer version with recursion depth limit
                    else:
                        try:
                            list_lyrics["lyricsToGuess"], list_lyrics["words_to_guess"] = extract_lyric_to_guess(
                                df_lyrics, 
                                words_to_guess=int(words_to_guess),
                                recursion_depth=0
                            )
                            list_lyrics["lyricsToGuess"] = list_lyrics["lyricsToGuess"].to_dict(orient='records')
                        except Exception as e:
                            logger.error(f"Error extracting lyrics to guess: {str(e)}")
                            # Fallback to first line if extraction fails
                            list_lyrics["lyricsToGuess"] = df_lyrics.iloc[:1].to_dict(orient='records')
                            list_lyrics["words_to_guess"] = 1
                    
                    return list_lyrics
        
        # Fall back to fetching from Spotify API if not in database
        df_lyrics = SpotifyLyricsDriver().get_lyrics(track_id)
        
        if df_lyrics is None or df_lyrics.empty:
            return {"error": "No lyrics found for this track"}
            
        list_lyrics["lyrics"] = df_lyrics.to_dict(orient='records')
        
        # If lyrics_time is provided, use that specific lyric
        if specific_lyric_time is not None:
            list_lyrics["lyricsToGuess"], list_lyrics["words_to_guess"] = extract_specific_lyric(
                df_lyrics, 
                specific_lyric_time
            )
            list_lyrics["lyricsToGuess"] = list_lyrics["lyricsToGuess"].to_dict(orient='records')
        # If words_to_guess is 0, don't select any lyrics (used for lyrics browser)
        elif words_to_guess == 0:
            list_lyrics["lyricsToGuess"] = []
            list_lyrics["words_to_guess"] = 0
        # Otherwise use safer version with recursion depth limit
        else:
            try:
                list_lyrics["lyricsToGuess"], list_lyrics["words_to_guess"] = extract_lyric_to_guess(
                    df_lyrics, 
                    words_to_guess=int(words_to_guess),
                    recursion_depth=0
                )
                list_lyrics["lyricsToGuess"] = list_lyrics["lyricsToGuess"].to_dict(orient='records')
            except Exception as e:
                logger.error(f"Error extracting lyrics to guess: {str(e)}")
                # Fallback to first line if extraction fails
                list_lyrics["lyricsToGuess"] = df_lyrics.iloc[:1].to_dict(orient='records')
                list_lyrics["words_to_guess"] = 1
            
        return list_lyrics
    except Exception as e:
        logger.exception(f"Error getting lyrics for {track_id}: {str(e)}")
        return {"error": str(e)}

# Socket.IO error handling decorator
def handle_socket_errors(f):
    def wrapped(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Exception as e:
            logger.exception(f"Socket error in {f.__name__}: {str(e)}")
            # Don't re-raise the exception to prevent GeneratorExit
    return wrapped

@socketio.on('connect')
@handle_socket_errors
def handle_connect(auth=None):
    sockets.append(request.sid)
    join_room('karaoke')
    logger.info(f"Client connected: {request.sid}, total connections: {len(sockets)}")

@socketio.on('disconnect')
@handle_socket_errors
def handle_disconnect():
    leave_room('karaoke')
    if request.sid in sockets:
        sockets.remove(request.sid)
    logger.info(f"Client disconnected: {request.sid}, remaining connections: {len(sockets)}")

@socketio.on('show-intro')
@handle_socket_errors
def handle_show_intro():
    emit('to-intro', room='karaoke', skip_sid=request.sid)

@socketio.on('show-categories')
@handle_socket_errors
def handle_show_categories(args):
    emit('to-categories', args, room='karaoke', skip_sid=request.sid)

@socketio.on('show-song-list')
@handle_socket_errors
def handle_show_song_list(args):
    emit('to-song-list', args, room='karaoke', skip_sid=request.sid)

@socketio.on('goto-song')
@handle_socket_errors
def handle_goto_song(args):
    emit('to-song', args, room='karaoke', skip_sid=request.sid)

@socketio.on('play-song')
@handle_socket_errors
def handle_play_song():
    emit('play', room='karaoke', skip_sid=request.sid)

@socketio.on('propose-lyrics')
@handle_socket_errors
def handle_propose_lyrics(args):
    emit('show-suggested-lyrics', args, room='karaoke', skip_sid=request.sid)

@socketio.on('validate-lyrics')
@handle_socket_errors
def handle_validate_lyrics():
    emit('validate-lyrics', room='karaoke', skip_sid=request.sid)

@socketio.on('freeze-lyrics')
@handle_socket_errors
def handle_freeze_lyrics():
    emit('freeze-lyrics', room='karaoke', skip_sid=request.sid)

@socketio.on('reveal-lyrics')
@handle_socket_errors
def handle_reveal_lyrics():
    emit('reveal-lyrics', room='karaoke', skip_sid=request.sid)

@socketio.on('continue-lyrics')
@handle_socket_errors
def handle_continue_lyrics():
    emit('continue-lyrics', room='karaoke', skip_sid=request.sid)

@socketio.on('lyrics-validation-result')
@handle_socket_errors
def handle_lyrics_validation_result(data):
    emit('lyrics-validation-result', data, room='karaoke', include_self=False)

@socketio.on('lyrics-words-count')
@handle_socket_errors
def handle_lyrics_words_count(data):
    emit('lyrics-words-count', data, room='karaoke', include_self=False)

@socketio.on('update-lyrics-to-guess')
@handle_socket_errors
def handle_update_lyrics_to_guess(data):
    # Forward the updated lyrics data to all clients in the room
    emit('lyrics-to-guess-updated', data, room='karaoke', skip_sid=request.sid)

@socketio.on('set-perf-mode')
@handle_socket_errors
def handle_set_perf_mode(args):
    emit('set-perf-mode', args, room='karaoke', skip_sid=request.sid)

@socketio.on('lyrics-data')
@handle_socket_errors
def handle_lyrics_data(data):
    emit('lyrics-data', data, room='karaoke', skip_sid=request.sid)

@socketio.on('lyrics-loading')
@handle_socket_errors
def handle_lyrics_loading():
    emit('lyrics-loading', room='karaoke', skip_sid=request.sid)

@socketio.on('lyrics-error')
@handle_socket_errors
def handle_lyrics_error(error):
    emit('lyrics-error', error, room='karaoke', skip_sid=request.sid)

@app.route('/api/spotify/auth', methods=['GET'])
def get_spotify_auth():
    try:
        spotify = SpotifyDriver()
        auth_url = spotify.get_auth_url()
        return jsonify({"url": auth_url})
    except Exception as e:
        logger.exception(f"Error getting Spotify auth URL: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/spotify/token', methods=['POST'])
def get_spotify_token():
    try:
        code = request.json.get('code')
        spotify = SpotifyDriver()
        token_info = spotify.get_user_token(code)
        return jsonify(token_info)
    except Exception as e:
        logger.exception(f"Error getting Spotify token: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.errorhandler(Exception)
def handle_exception(e):
    logger.exception(f"Unhandled exception: {str(e)}")
    return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Initialize the database before running the app
    with app.app_context():
        initialize_database()
    
    port = int(os.environ.get('REACT_APP_WEBSOCKET_SERVER', '4001').split(':')[-1])
    logger.info(f"Starting server on port {port}")
    socketio.run(app, host='0.0.0.0', port=port, debug=True)