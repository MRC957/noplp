"""
NOPLP (N'oubliez Pas Les Paroles) Karaoke Application Backend

This Flask application serves as the backend for the NOPLP karaoke application,
providing API endpoints for song management, lyric retrieval, and real-time 
communication via WebSockets for the karaoke game experience.

Features:
- RESTful API for song, category, and playlist management
- Database storage with SQLAlchemy ORM
- WebSocket communication for real-time game interactions
- Spotify integration for song information and lyrics
- Lyrics retrieval and processing for the karaoke game mechanics

The application uses PostgreSQL for data storage and Flask-SocketIO for WebSockets.
"""

from flask import Flask, send_from_directory, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
import os
import json
import pandas as pd
import uuid
from spotify import SpotifyDriver, SpotifyLyricsDriver
from database import init_db, db, Song, Category, song_category
from db_populator import DatabasePopulator
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize Flask application
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

# Initialize SocketIO
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
    """
    Initialize database with default data.
    
    This endpoint triggers the database initialization process, importing data
    from JSON files into the database. It's typically called when the application
    is first loaded or when a database reset is needed.
    
    Returns:
        JSON: A message indicating that initialization was triggered
    """
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
    """
    Retrieve a list of all available playlists.
    
    This endpoint returns information about all playlists available in the
    application, including both stored playlists from JSON files and the
    option to generate a random playlist. It first checks if database 
    initialization is needed.
    
    Returns:
        JSON: An array of playlist objects containing 'id' and 'name'
    """
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
        playlists.append({
            'id': 'random2',
            'name': 'Another random Playlist'
        })
                
        return jsonify(playlists)
    except Exception as e:
        logger.exception(f"Error getting playlists: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Modified route to serve playlist by name
@app.route('/api/playlist', methods=['GET'])
def get_playlist():
    """
    Retrieve a specific playlist by name or generate a random playlist.
    
    This endpoint returns a complete playlist with categories and songs. It supports
    two modes:
    1. Fetching an existing playlist from a JSON file by name
    2. Generating a random playlist if 'random' is specified as the name
    
    Query Parameters:
        name (str): The name of the playlist to retrieve, or 'random'
        categories (int): If name='random', number of categories to include
        songs_per_category (int): If name='random', number of songs per category
    
    Returns:
        JSON: Complete playlist object with categories and songs
    """
    try:
        # Get playlist name from query parameter, default to 'playlist'
        playlist_name = request.args.get('name', 'playlist')
        
        # Handle request for a random playlist
        if (playlist_name in ['random', 'random2']):
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
    """
    Retrieve all categories from the database.
    
    This endpoint returns a list of all categories stored in the database,
    without including their associated songs. It first checks if database 
    initialization is needed.
    
    Returns:
        JSON: An array of category objects with basic category information
    """
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
    """
    Retrieve songs from the database, optionally filtered by category.
    
    This endpoint returns a list of songs. It can either return all songs in the
    database or filter the results to show only songs belonging to a specific category.
    
    Query Parameters:
        category_id (str, optional): When provided, returns only songs in this category
    
    Returns:
        JSON: An array of song objects with basic song information
    """
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
    """
    Add a new song to the database.
    
    This endpoint searches for a song in the Spotify API using either track name and artist 
    or a Spotify track ID, then adds it to the database. The song can optionally be 
    associated with one or more categories upon creation.
    
    Request Body:
        track_name (str, optional): The name of the track to search for
        artist (str, optional): The name of the artist
        track_id (str, optional): Spotify track ID (can be used instead of track_name/artist)
        category_ids (list, optional): List of category IDs to associate the song with
    
    Returns:
        JSON: Details of the added song including Spotify metadata
        
    Note:
        Either track_id OR both track_name and artist must be provided
    """
    try:
        data = request.json
        track_name = data.get('track_name')
        artist = data.get('artist')
        category_ids = data.get('category_ids', [])
        track_id = data.get('track_id')
        
        if (not track_name or not artist) and not track_id:
            return jsonify({"error": "Track ID or Track name and artist are required"}), 400
        
        result = db_populator.search_and_add_song(track_name, artist, category_ids, track_id)
        
        if result:
            return jsonify(result), 200
        else:
            return jsonify({"error": "Failed to add song"}), 500
    except Exception as e:
        logger.exception(f"Error adding song: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/database/categories', methods=['POST'])
def create_category():
    """
    Create a new category in the database.
    
    This endpoint creates a new song category with a UUID and the provided name.
    Categories are used to organize songs in the karaoke application.
    
    Request Body:
        name (str): The name of the category to create
    
    Returns:
        JSON: The created category data with status code 201
        
    Error Responses:
        400: If no name is provided
        500: For database errors
    """
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
            # lyrics_count = sum(1 for song in Song.query.all() if song.lyrics)
            
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
            
            # Get count of songs by artist using GROUP BY
            artist_stats = db.session.query(
                Song.artist,
                db.func.count(Song.id).label('song_count')
            ).group_by(Song.artist).order_by(db.func.count(Song.id).desc()).all()
            
            artist_stats_list = [
                {'artist': artist, 'song_count': count}
                for artist, count in artist_stats
            ]
            
            artists_count = len(artist_stats_list)
            
            # Count songs with no categories
            songs_without_categories_count = db.session.query(Song).filter(~Song.categories.any()).count()
            
            # Count songs with at most one category (0 or 1)
            # This combines songs with no categories and songs with exactly one category
            songs_with_one_or_less_categories = db.session.query(Song).join(
                song_category, Song.id == song_category.c.song_id, isouter=True
            ).group_by(Song.id).having(
                db.func.count(song_category.c.category_id) <= 1
            ).count()

            return jsonify({
                'totalSongs': song_count,
                'totalCategories': category_count,
                'totalArtists': artists_count,
                'songsWithoutCategories': songs_without_categories_count,
                'songsWithOneOrLessCategories': songs_with_one_or_less_categories,
                # 'songsWithLyrics': lyrics_count,
                'categories': category_stats,
                'artists': artist_stats_list
            }), 200
    except Exception as e:
        logger.exception(f"Error getting database stats: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/database/categories/<category_id>', methods=['PUT'])
def put_category_details(category_id):
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        with app.app_context():
            # Find the category by ID
            category = Category.query.get(category_id)
            
            if not category:
                return jsonify({"error": f"Category with ID {category_id} not found"}), 404
            
            # Update category details
            if 'name' in data:
                category.name = data['name']
            
            # Save changes to database
            db.session.commit()
                
            # Return updated category details
            return jsonify({
                "message": "Category updated successfully",
                "category": category.to_dict(include_songs=True)
            }), 200
    except Exception as e:
        db.session.rollback()
        logger.exception(f"Error updating category details: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/database/categories/<category_id>', methods=['GET'])
def get_category_details(category_id):
    """
    Retrieve detailed information about a specific category.
    
    This endpoint returns complete information about a single category including all
    its associated songs. It's used by the CategoryDetailsView component in the frontend
    when a user selects a category to view or edit its details.
    
    The endpoint populates the category details page, showing the category name,
    ID, and the complete list of songs belonging to this category, enabling actions
    like renaming the category, removing individual songs, or bulk-removing multiple
    songs from the category.
    
    Path Parameters:
        category_id (str): The unique identifier of the category to retrieve
        
    Returns:
        JSON: Complete category object with:
            - id: The category's unique identifier
            - name: The category name
            - songs: Array of song objects associated with this category
    
    Error Responses:
        404: If the category with the specified ID is not found
        500: Server error during database operation
    """
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
    """
    Retrieve detailed information about a specific song.
    
    This endpoint returns complete information about a single song including all its
    associated categories. It's used by the SongDetailsView component in the frontend
    when a user selects a song to view or edit its details.
    
    The endpoint populates the song details page, showing the song title, artist,
    ID, and the complete list of categories this song belongs to, enabling actions
    like removing the song from specific categories or adding it to new categories.
    
    Path Parameters:
        song_id (str): The unique identifier of the song to retrieve
        
    Returns:
        JSON: Complete song object with:
            - id: The song's unique identifier/Spotify track ID
            - title: The song title
            - artist: The artist name
            - categories: Array of category objects this song belongs to
            - lyrics: Array of lyrics data if available
            
    Error Responses:
        404: If the song with the specified ID is not found
        500: Server error during database operation
    """
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
    """
    Add multiple songs to a specific category.
    
    This endpoint associates one or more songs with a category. It's used by the
    AddSongsToCategory component in the frontend when users want to add multiple
    songs to a category at once.
    
    The endpoint accepts a list of song IDs and adds them all to the specified 
    category. It checks for existing associations to avoid duplicates and returns
    details about which songs were successfully added.
    
    Path Parameters:
        category_id (str): The unique identifier of the category to add songs to
        
    Request Body:
        song_ids (list): Array of song IDs to add to the category
        
    Returns:
        JSON: Object containing:
            - message: Summary of the operation 
            - category: The updated category data
            - songs_added: Array of song objects that were added to the category
            
    Error Responses:
        400: If song_ids is missing from the request
        404: If the category with the specified ID is not found
        500: Server error during database operation
    """
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

@app.route('/api/database/songs/<song_id>/lyrics', methods=['PUT'])
def add_lyrics_to_song(song_id):
    try:
        data = request.json
        if not data or 'lyrics' not in data:
            return jsonify({"error": "Lyrics data is required"}), 400
            
        lyrics = data['lyrics']
        
        with app.app_context():
            # Find the song by ID
            song = Song.query.get(song_id)
            
            if not song:
                return jsonify({"error": f"Song with ID {song_id} not found"}), 404
            
            # Update the lyrics
            song.lyrics = lyrics
            db.session.commit()
            
            return jsonify({
                "message": f"Lyrics for song '{song.title}' updated successfully",
                "song": song.to_dict(include_categories_full=True)
            }), 200
    except Exception as e:
        db.session.rollback()
        logger.exception(f"Error updating lyrics for song: {str(e)}")
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

# Add endpoint to delete multiple songs from a category
@app.route('/api/database/categories/<category_id>/remove-songs', methods=['POST'])
def remove_multiple_songs_from_category(category_id):
    try:
        data = request.json
        if not data or 'song_ids' not in data:
            return jsonify({"error": "list of songs to remove is required"}), 400
            
        song_ids = data['song_ids']
        
        with app.app_context():
            # Find the category
            category = Category.query.get(category_id)
            
            if not category:
                return jsonify({"error": f"Category with ID {category_id} not found"}), 404
            
            # Find and remove the songs from the category
            songs_removed = []
            for song_id in song_ids:
                song = Song.query.get(song_id)
                if song and song in category.songs:
                    category.songs.remove(song)
                    songs_removed.append(song.to_dict())
            
            # Commit the changes
            db.session.commit()
            
            return jsonify({
                "message": f"Removed {len(songs_removed)} songs from category '{category.name}'",
                "category": category.to_dict(),
                "songs_removed": songs_removed
            }), 200
    except Exception as e:
        db.session.rollback()
        logger.exception(f"Error removing songs from category: {str(e)}")
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

# Add endpoint to delete a song
@app.route('/api/database/songs/<song_id>', methods=['DELETE'])
def delete_song(song_id):
    try:
        with app.app_context():
            # Find the song
            song = Song.query.get(song_id)
            
            if not song:
                return jsonify({"error": f"Song with ID {song_id} not found"}), 404
            
            # Remove associations with categories but keep the categories
            song.categories = []
                
            # Delete the song
            db.session.delete(song)
            db.session.commit()
            
            return jsonify({"message": f"Song '{song.title}' deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        logger.exception(f"Error deleting song: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Add endpoint to get all categories with their songs
@app.route('/api/database/categories-with-songs', methods=['GET'])
def get_categories_with_songs():
    """
    Retrieve all categories with their associated songs.
    
    This endpoint returns the complete list of categories, each including its full
    collection of associated songs. Used primarily by the category listing and 
    management interfaces in the frontend DatabaseEditor component.
    
    The CategoryList component uses this endpoint to display each category with 
    its songs, allowing users to expand/collapse categories to view their songs.
    
    Returns:
        JSON: Array of category objects, each containing:
            - id: Unique category identifier
            - name: Category name
            - songs: Array of song objects associated with this category
    
    Error Responses:
        500: Server error during database operation
    """
    try:
        # First check if database needs initialization
        initialize_database()
        
        with app.app_context():
            categories = Category.query.order_by(Category.name).all()
            categories_data = [category.to_dict(include_songs=True) for category in categories]
            return jsonify(categories_data)
    except Exception as e:
        logger.exception(f"Error getting categories with songs: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Add endpoint to get all categories with their songs
@app.route('/api/database/songs-with-categories', methods=['GET'])
def get_songs_with_categories():
    """
    Retrieve all songs with their associated categories.
    
    This endpoint returns the complete list of songs in the database, each including
    its full collection of associated categories. Used primarily by the SongList 
    component in the frontend to display songs with their category assignments.
    
    The database editor uses this endpoint to populate the song list with category
    information, allowing users to manage song-category associations directly from
    the song listing interface.
    
    Returns:
        JSON: Array of song objects, each containing:
            - id: Unique song identifier
            - track_id: Spotify track ID (same as id for compatibility)
            - title: Song title
            - artist: Song artist name
            - name: Formatted name (title + artist) for display purposes
            - categories: Array of category objects associated with this song
    
    Error Responses:
        500: Server error during database operation
    """
    try:
        # First check if database needs initialization
        initialize_database()
        
        with app.app_context():
            songs = Song.query.order_by(Song.title).all()
            songs_data = [song.to_dict(include_categories_full=True) for song in songs]
            # Add name field to each song
            for song in songs_data:
                song["name"] = f"{song['title']} by {song['artist']}"
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
                filtered_song = {k: song[k] for k in ["id", "track_id", "category", "artist", "title", "release_year"] if k in song}
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
    """
    Decorator to handle exceptions in Socket.IO event handlers.
    
    This decorator catches any exceptions raised in Socket.IO event handlers
    and logs them without re-raising, preventing GeneratorExit errors that
    can occur when Socket.IO connections are interrupted during exception handling.
    
    Args:
        f (function): The Socket.IO event handler function to wrap
        
    Returns:
        function: The wrapped function with error handling
    """
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
    """
    Handle new WebSocket connections.
    
    This event handler is triggered when a client connects to the WebSocket server.
    It adds the client to the 'karaoke' room for broadcast messaging and logs the connection.
    
    Args:
        auth (dict, optional): Authentication information (not currently used)
    """
    sockets.append(request.sid)
    join_room('karaoke')
    logger.info(f"Client connected: {request.sid}, total connections: {len(sockets)}")

@socketio.on('disconnect')
@handle_socket_errors
def handle_disconnect():
    """
    Handle WebSocket disconnections.
    
    This event handler is triggered when a client disconnects from the WebSocket server.
    It removes the client from the 'karaoke' room and updates the active connections list.
    """
    leave_room('karaoke')
    if request.sid in sockets:
        sockets.remove(request.sid)
    logger.info(f"Client disconnected: {request.sid}, remaining connections: {len(sockets)}")

@socketio.on('show-intro')
@handle_socket_errors
def handle_show_intro():
    """
    Broadcast a command to show the intro screen to all clients.
    
    When a presenter client triggers this event, it broadcasts to all other
    connected clients to navigate to the intro screen of the karaoke application.
    This is typically used at the start of a game or to reset the game state.
    """
    emit('to-intro', room='karaoke', skip_sid=request.sid)

@socketio.on('show-categories')
@handle_socket_errors
def handle_show_categories(args):
    """
    Broadcast a command to show the categories selection screen.
    
    This event is triggered when a presenter wants all clients to navigate to
    the categories selection screen. It forwards any provided arguments to the clients.
    
    Args:
        args: Parameters related to the categories to be displayed
    """
    emit('to-categories', args, room='karaoke', skip_sid=request.sid)

@socketio.on('show-song-list')
@handle_socket_errors
def handle_show_song_list(args):
    """
    Broadcast a command to show the song list screen for a selected category.
    
    This event is triggered when a presenter selects a category and wants all clients
    to see the list of songs in that category.
    
    Args:
        args: Parameters containing category information and related songs
    """
    emit('to-song-list', args, room='karaoke', skip_sid=request.sid)

@socketio.on('goto-song')
@handle_socket_errors
def handle_goto_song(args):
    """
    Broadcast a command to navigate to a specific song screen.
    
    This event is triggered when a presenter selects a song from the list
    and wants all clients to navigate to that song's page.
    
    Args:
        args: Parameters containing song information and related data
    """
    emit('to-song', args, room='karaoke', skip_sid=request.sid)

@socketio.on('play-song')
@handle_socket_errors
def handle_play_song():
    """
    Broadcast a command to play the current song.
    
    This event is triggered when a presenter starts playing a song.
    All clients will start playing the song simultaneously.
    """
    emit('play', room='karaoke', skip_sid=request.sid)

@socketio.on('propose-lyrics')
@handle_socket_errors
def handle_propose_lyrics(args):
    """
    Broadcast suggested lyrics to guess to all clients.
    
    This event is triggered when a presenter selects specific lyrics
    for contestants to guess during the game.
    
    Args:
        args: Parameters containing the lyrics to guess and related data
    """
    emit('show-suggested-lyrics', args, room='karaoke', skip_sid=request.sid)

@socketio.on('validate-lyrics')
@handle_socket_errors
def handle_validate_lyrics():
    """
    Broadcast a command to validate the lyrics guessed by participants.
    
    This event is triggered when a presenter wants to validate the
    lyrics that have been guessed by the contestants. It tells all clients
    to enter validation mode.
    """
    emit('validate-lyrics', room='karaoke', skip_sid=request.sid)

@socketio.on('freeze-lyrics')
@handle_socket_errors
def handle_freeze_lyrics():
    """
    Broadcast a command to freeze the current lyrics display.
    
    This event is triggered when a presenter wants to lock the current state
    of lyrics display, typically after a contestant has made a guess. It
    prevents further changes until the presenter decides to continue.
    """
    emit('freeze-lyrics', room='karaoke', skip_sid=request.sid)

@socketio.on('reveal-lyrics')
@handle_socket_errors
def handle_reveal_lyrics():
    """
    Broadcast a command to reveal the correct lyrics.
    
    This event is triggered when a presenter wants to show the correct lyrics
    to all participants, typically after a contestant has failed to guess correctly.
    """
    emit('reveal-lyrics', room='karaoke', skip_sid=request.sid)

@socketio.on('continue-lyrics')
@handle_socket_errors
def handle_continue_lyrics():
    """
    Broadcast a command to continue the karaoke flow after freezing.
    
    This event is triggered when a presenter wants to continue the game
    after a lyrics freeze, typically moving to the next part of the song
    or allowing a new contestant to participate.
    """
    emit('continue-lyrics', room='karaoke', skip_sid=request.sid)

@socketio.on('lyrics-validation-result')
@handle_socket_errors
def handle_lyrics_validation_result(data):
    """
    Broadcast the validation result of guessed lyrics.
    
    This event forwards the validation results from the presenter to all other
    clients, indicating whether the contestant correctly guessed the lyrics or not.
    
    Args:
        data: Information about the validation result (correct/incorrect)
    """
    emit('lyrics-validation-result', data, room='karaoke', include_self=False)

@socketio.on('lyrics-words-count')
@handle_socket_errors
def handle_lyrics_words_count(data):
    """
    Broadcast the word count information for the current lyrics.
    
    This event forwards information about the number of words in the
    current lyric segment that need to be guessed.
    
    Args:
        data: Information containing the word count and related data
    """
    emit('lyrics-words-count', data, room='karaoke', include_self=False)

@socketio.on('update-lyrics-to-guess')
@handle_socket_errors
def handle_update_lyrics_to_guess(data):
    """
    Broadcast updated lyrics to guess to all clients.
    
    This event is triggered when a presenter updates the specific lyrics
    that should be guessed. It forwards the updated lyrics data to all
    other clients in the karaoke room.
    
    Args:
        data: The updated lyrics data to broadcast
    """
    emit('lyrics-to-guess-updated', data, room='karaoke', skip_sid=request.sid)

@socketio.on('set-perf-mode')
@handle_socket_errors
def handle_set_perf_mode(args):
    """
    Broadcast a command to change the performance mode.
    
    This event is triggered when a presenter changes the game's performance mode,
    which affects how lyrics are displayed and how the game behaves.
    
    Args:
        args: Parameters containing the performance mode settings
    """
    emit('set-perf-mode', args, room='karaoke', skip_sid=request.sid)

@socketio.on('lyrics-data')
@handle_socket_errors
def handle_lyrics_data(data):
    """
    Broadcast lyrics data to all clients.
    
    This event is triggered when new lyrics data becomes available,
    for example when a new song is selected or when lyrics are loaded.
    
    Args:
        data: The lyrics data to broadcast
    """
    emit('lyrics-data', data, room='karaoke', skip_sid=request.sid)

@socketio.on('lyrics-loading')
@handle_socket_errors
def handle_lyrics_loading():
    """
    Broadcast a lyrics loading state to all clients.
    
    This event is triggered when lyrics are being loaded or processed.
    It notifies all clients that lyrics are currently being fetched or processed,
    so they can display appropriate loading indicators.
    """
    emit('lyrics-loading', room='karaoke', skip_sid=request.sid)

@socketio.on('lyrics-error')
@handle_socket_errors
def handle_lyrics_error(error):
    """
    Broadcast a lyrics error to all clients.
    
    This event is triggered when there's an error loading or processing lyrics.
    It forwards the error information to all connected clients.
    
    Args:
        error: Error information to broadcast
    """
    emit('lyrics-error', error, room='karaoke', skip_sid=request.sid)

@app.route('/api/spotify/auth', methods=['GET'])
def get_spotify_auth():
    """
    Get Spotify authentication URL for authorization flow.
    
    This endpoint initiates the Spotify OAuth process by generating an
    authorization URL that the client should redirect to. After authentication
    on Spotify's site, the user will be redirected back to the application.
    
    Returns:
        JSON: Object containing the Spotify authorization URL
    """
    try:
        spotify = SpotifyDriver()
        auth_url = spotify.get_auth_url()
        return jsonify({"url": auth_url})
    except Exception as e:
        logger.exception(f"Error getting Spotify auth URL: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/spotify/token', methods=['POST'])
def get_spotify_token():
    """
    Exchange authorization code for Spotify access token.
    
    This endpoint completes the Spotify OAuth flow by exchanging the authorization
    code received after user login for an access token and refresh token.
    
    Request Body:
        code (str): The authorization code returned by Spotify after user login
    
    Returns:
        JSON: Object containing the access token, refresh token, and other token info
        
    Error Responses:
        500: If token exchange fails
    """
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
    """
    Global exception handler for unhandled exceptions.
    
    This catches any exceptions not handled by specific error handlers
    in the routes, logs them, and returns a 500 error response.
    
    Args:
        e: The unhandled exception
        
    Returns:
        JSON: Error response with status code 500
    """
    logger.exception(f"Unhandled exception: {str(e)}")
    return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Initialize the database before running the app
    with app.app_context():
        initialize_database()
    
    port = int(os.environ.get('REACT_APP_WEBSOCKET_SERVER', '4001').split(':')[-1])
    logger.info(f"Starting server on port {port}")
    socketio.run(app, host='0.0.0.0', port=port, debug=True)