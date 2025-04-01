#!/usr/bin/env python3
"""
Song Populator Script

This script provides functionality to:
1. Search for songs on Spotify and add them to the database
2. Fetch lyrics for songs and store them in the database
3. Filter out English songs to maintain a French-only collection
"""

import os
import sys
import json
import logging
import argparse
import pandas as pd
from flask import Flask
from dotenv import load_dotenv
from tqdm import tqdm  # Add tqdm for progress bars
import re
from langdetect import detect, LangDetectException

# Add parent directory to path so we can import from sibling modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import project modules
from spotify import SpotifyDriver
from database import init_db
from db_populator import DatabasePopulator

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize a minimal Flask app for database operations
app = Flask(__name__)

# Configure the SQLAlchemy part of the app
base_db_url = os.environ.get(
    'DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/karaoke'
)
app.config['SQLALCHEMY_DATABASE_URI'] = f"{base_db_url}?options=-c%20search_path=karaoke,public"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize database
init_db(app)


class EnglishSongDetector:
    """Class for detecting if a song is in English based on title/artist/lyrics"""
    
    def __init__(self):
        self.french_artists = self._load_french_artists()
        self.english_patterns = [
            r'\b(the|and|of|in|on|at|to|for|with|by|as|from|about)\b',
            r'\b(my|your|his|her|our|their|its)\b',
            r'\b(is|are|was|were|be|been|being|am)\b',
            r'\b(this|that|these|those)\b',
            r'\b(never|gonna|give|you|up)\b'  # The famous Rick roll pattern :)
        ]
    
    def _load_french_artists(self):
        """Load a list of known French artists"""
        return [
            'jacques brel', 'edith piaf', 'renaud', 'michel sardou',
            'stromae', 'zaz', 'indochine', 'johnny hallyday',
            'mylene farmer', 'serge gainsbourg', 'charles aznavour',
            'maitre gims', 'francis cabrel', 'alain souchon',
            'barbara', 'patricia kaas', 'christophe mae', 'dalida',
            'julien clerc', 'joe dassin', 'michel berger', 'jean-jacques goldman',
            'daniel balavoine', 'claude françois', 'france gall',
            'michel polnareff', 'laurent voulzy', 'pascal obispo',
            'louane', 'kendji girac', 'florent pagny', 'patrick bruel'
        ]
    
    def is_likely_english(self, title, artist, lyrics=None):
        """
        Determine if a song is likely in English based on title, artist, and optionally lyrics
        
        Returns:
            tuple: (is_english, confidence, reason)
        """
        # Convert inputs to lowercase for case-insensitive comparison
        title = title.lower() if title else ''
        artist = artist.lower() if artist else ''
        
        # Check if the artist is in our list of French artists
        if any(french_artist in artist for french_artist in self.french_artists):
            return False, 0.8, "Artist is known to be French"
        
        # Check for English patterns in title
        english_pattern_matches = 0
        for pattern in self.english_patterns:
            if re.search(pattern, title):
                english_pattern_matches += 1
        
        if english_pattern_matches >= 2:
            return True, 0.7, f"Title contains {english_pattern_matches} English patterns"
        
        # Try language detection on title
        try:
            title_lang = detect(title)
            if title_lang == 'en':
                return True, 0.85, "Title detected as English"
            elif title_lang == 'fr':
                return False, 0.85, "Title detected as French"
        except LangDetectException:
            pass  # Title may be too short for reliable detection
        
        # If lyrics are available, use them for detection
        if lyrics:
            lyrics_text = ""
            if isinstance(lyrics, list):
                # Handle lyrics in JSON format
                for line in lyrics:
                    if isinstance(line, dict) and 'words' in line:
                        lyrics_text += line['words'] + " "
            elif isinstance(lyrics, str):
                lyrics_text = lyrics
            
            if lyrics_text:
                try:
                    lyrics_lang = detect(lyrics_text[:1000])  # Use first 1000 chars for efficiency
                    if lyrics_lang == 'en':
                        return True, 0.95, "Lyrics detected as English"
                    elif lyrics_lang == 'fr':
                        return False, 0.95, "Lyrics detected as French"
                except LangDetectException:
                    pass
        
        # Default to keeping the song if we're not sure
        return False, 0.5, "No strong indicators found, defaulting to French"


class SongPopulator:
    def __init__(self):
        """Initialize the SongPopulator with Spotify drivers"""
        self.spotify_driver = SpotifyDriver()
        self.db_populator = DatabasePopulator(app)  # Pass the Flask app instance
        self.english_detector = EnglishSongDetector()  # Initialize the English detector
        self.min_confidence = 0.7  # Minimum confidence to consider a song English

    def search_theme(self, theme_query, limit=10):
        """
        Search for playlists on Spotify based on a theme query
        
        Args:
            theme_query: The search query for the theme
            limit: Maximum number of playlists to return
            
        Returns:
            list: List of playlist information dictionaries
        """
        try:
            logger.info(f"Searching for playlists with theme: {theme_query}")
            
            # Search for playlists on Spotify
            playlists = self.spotify_driver.search_playlists(theme_query, limit)
            
            if not playlists:
                logger.error(f"No playlists found for theme: {theme_query}")
                return []
                
            # Format for display
            result = []
            for i, playlist in enumerate(tqdm(playlists, desc="Processing playlists", unit="playlist")):
                try:
                    if not playlist: continue
                    
                    result.append({
                        'index': i + 1,
                        'id': playlist['id'],
                        'name': playlist['name'],
                        'owner': playlist['owner']['display_name'],
                        'tracks_count': playlist['tracks']['total']
                    })
                except Exception as e:
                    logger.exception(f"Error processing playlist: {str(e)}")
                
            return result
                
        except Exception as e:
            logger.exception(f"Error searching for theme: {str(e)}")
            return []

    def add_songs_by_theme(self, playlist_id, max_songs=20):
        """
        Add songs from a Spotify playlist to the database
        
        Args:
            playlist_id: The Spotify playlist ID
            max_songs: Maximum number of songs to add (default: 20)
            
        Returns:
            dict: Summary of the operation
        """
        try:
            logger.info(f"Adding songs from playlist: {playlist_id}, max: {max_songs}")
            
            # Get tracks from the playlist
            tracks = self.spotify_driver.get_playlist_tracks(playlist_id, limit=max_songs)
            
            if not tracks:
                logger.error(f"No tracks found in playlist: {playlist_id}")
                return {
                    'total': 0,
                    'added': 0,
                    'already_exists': 0,
                    'skipped_english': 0,
                    'failed': 0
                }
            
            total_tracks = len(tracks)
            added_count = 0
            exists_count = 0
            failed_count = 0
            skipped_english_count = 0
            
            # Create progress bar for track processing
            with tqdm(total=total_tracks, desc="Processing tracks", unit="track") as pbar:
                for track in tracks:
                    artist_name = track['artists'][0]['name']
                    track_name = track['name']
                    
                    try:
                        pbar.set_description(f"Processing: {track_name[:20]} - {artist_name[:20]}...")
                        
                        # Check if the song is likely English before adding it
                        is_english, confidence, reason = self.english_detector.is_likely_english(track_name, artist_name)
                        
                        if is_english and confidence >= self.min_confidence:
                            skipped_english_count += 1
                            logger.info(f"Skipped English song: {track_name} by {artist_name} ({reason}, confidence: {confidence:.2f})")
                            pbar.update(1)
                            continue
                        
                        result = self.db_populator.search_and_add_song(track_name, artist_name)
                        
                        if result:
                            if result.get('already_exists'):
                                exists_count += 1
                                logger.info(f"Song already exists: {track_name} by {artist_name}")
                            else:
                                added_count += 1
                                logger.info(f"Added song: {track_name} by {artist_name}")
                        else:
                            failed_count += 1
                            logger.error(f"Failed to add song: {track_name} by {artist_name}")
                            
                    except Exception as e:
                        failed_count += 1
                        logger.exception(f"Error processing track: {str(e)}")
                    finally:
                        pbar.update(1)
            
            return {
                'total': total_tracks,
                'added': added_count,
                'already_exists': exists_count,
                'skipped_english': skipped_english_count,
                'failed': failed_count
            }
            
        except Exception as e:
            logger.exception(f"Error adding songs by theme: {str(e)}")
            return {
                'total': 0,
                'added': 0,
                'already_exists': 0,
                'skipped_english': 0,
                'failed': 1,
                'error': str(e)
            }


def main():
    """Main entry point for the script"""
    parser = argparse.ArgumentParser(description='Database population utilities for NOPLP')
    
    # Create subparsers for different commands
    subparsers = parser.add_subparsers(dest='command', help='Command to execute')
    
    # Add song command
    add_parser = subparsers.add_parser('add-song', help='Add a song to the database')
    add_parser.add_argument('-a', '--artist', required=True, help='Artist name')
    add_parser.add_argument('-t', '--title', required=True, help='Song title')

    # Add theme command
    theme_parser = subparsers.add_parser('search-theme', help='Search for a theme/playlist on Spotify')
    theme_parser.add_argument('-q', '--query', required=True, help='Search query for theme (e.g., "karaoke 2024")')
    theme_parser.add_argument('-l', '--limit', type=int, default=10, help='Maximum number of results to show')
    theme_parser.add_argument('--english-threshold', type=float, default=0.7,
                             help='Confidence threshold for English detection (0.0-1.0)')

    args = parser.parse_args()
    
    populator = SongPopulator()
    
    if args.command == 'add-song':
        # Check if the song is English before adding
        is_english, confidence, reason = populator.english_detector.is_likely_english(args.title, args.artist)
        if is_english and confidence >= populator.min_confidence:
            print(f"Skipping English song: {args.title} by {args.artist} ({reason}, confidence: {confidence:.2f})")
            return
            
        result = populator.db_populator.search_and_add_song(args.title, args.artist)
        if result:
            if result.get('already_exists'):
                print(f"Song already exists: {result['title']} by {result['artist']} (ID: {result['id']})")
            else:
                print(f"Added song: {result['title']} by {result['artist']} (ID: {result['id']})")
        else:
            print(f"Failed to add song: {args.title} by {args.artist}")

    elif args.command == 'search-theme':
        # Set English detection threshold if provided
        if hasattr(args, 'english_threshold'):
            populator.min_confidence = args.english_threshold
            
        results = populator.search_theme(args.query, args.limit)
        if results:
            print(f"Found {len(results)} playlists for theme: '{args.query}'")
            
            # Process playlists with progress bar
            with tqdm(total=len(results), desc="Processing playlists", unit="playlist") as pbar:
                for playlist in results:                
                    pbar.update(1)
                    if "rap" in playlist['name'].lower():
                        print(f"Skipping playlist: {playlist['name']} (contains 'rap')")
                        continue

                    pbar.set_description(f"Processing: {playlist['name']}...")

                    result = populator.add_songs_by_theme(playlist['id'], args.limit)
                    print(f"Processed {result['total']} tracks:")
                    print(f"  - {result['added']} added")
                    print(f"  - {result['already_exists']} already existed")
                    print(f"  - {result['skipped_english']} skipped (English)")
                    print(f"  - {result['failed']} failed")
        else:
            print(f"No playlists found for theme: '{args.query}'")
    else:
        parser.print_help()

if __name__ == "__main__":
    main()