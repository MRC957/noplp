#!/usr/bin/env python3
"""
Song Populator Script

This script provides functionality to:
1. Search for songs on Spotify and add them to the database
2. Fetch lyrics for songs and store them in the database
"""

import os
import sys
import json
import logging
import argparse
import pandas as pd
from flask import Flask
from dotenv import load_dotenv

# Add parent directory to path so we can import from sibling modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import project modules
from spotify import SpotifyDriver, SpotifyLyricsDriver
from database import init_db, db, Song, Category

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
        
        list_lyrics_raw = rsp.json().get("syncedLyrics").split("\n")
        list_lyrics = []
        for lyrics in list_lyrics_raw:
            if lyrics:
                startTimeMs, words = lyrics.split("] ", 1)
                minutes, seconds = startTimeMs[1:].split(":", 1)
                startTimeMs = (60 * float(minutes) + float(seconds)) * 1000
                list_lyrics.append((startTimeMs, words))
        df_lyrics = pd.DataFrame(list_lyrics, columns=["startTimeMs", "words"])

        return df_lyrics


class SongPopulator:
    def __init__(self):
        """Initialize the SongPopulator with Spotify drivers"""
        self.spotify_driver = SpotifyDriver()
        # self.lyrics_driver = SpotifyLyricsDriver()
        self.lyrics_driver = LrcLibDriver()

    def add_song_to_db(self, artist, title):
        """
        Search for a song on Spotify and add it to the database
        
        Args:
            artist: The artist name
            title: The song title
            
        Returns:
            dict: Song information if successful, None if failed
        """
        try:
            logger.info(f"Searching for: {title} by {artist}")
            
            # Search for the song on Spotify
            song_data = self.spotify_driver.search_track(title, artist)
            
            if not song_data:
                logger.error(f"No results found for '{title}' by '{artist}'")
                return None
                
            # Check if song already exists in database
            with app.app_context():
                existing_song = Song.query.get(song_data['id'])
                if existing_song:
                    logger.info(f"Song already exists in database: {title} by {artist} (ID: {song_data['id']})")
                    return {
                        'id': existing_song.id,
                        'title': existing_song.title,
                        'artist': existing_song.artist,
                        # 'track_id': existing_song.track_id,
                        'already_exists': True
                    }
            
            # Create new song record
            with app.app_context():
                
                
                df_lyrics = self.lyrics_driver.get_lyrics(song_data['name'], song_data['artists'][0]["name"])
                list_lyrics = df_lyrics.to_dict(orient='records')
                

                new_song = Song(
                    id=song_data['id'],
                    title=song_data['name'],
                    artist=song_data['artists'][0]['name'],
                    lyrics=list_lyrics
                    # track_id=song_data['id'],
                    # image_url=song_data.get('album', {}).get('images', [{}])[0].get('url', ''),
                    # preview_url=song_data.get('preview_url', '')
                )
                
                db.session.add(new_song)
                db.session.commit()
                
                logger.info(f"Added song to database: {new_song.title} by {new_song.artist} (ID: {new_song.id})")
                
                return {
                    'id': new_song.id,
                    'title': new_song.title,
                    'artist': new_song.artist,
                    # 'track_id': new_song.track_id,
                    'already_exists': False
                }
                
        except Exception as e:
            logger.exception(f"Error adding song to database: {str(e)}")
            return None

    def fetch_and_store_lyrics(self, track_id):
        """
        Fetch lyrics for a track from Spotify and store them in the database
        
        Args:
            track_id: The Spotify track ID
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            logger.info(f"Fetching lyrics for track ID: {track_id}")
            
            # Check if the song exists in our database
            with app.app_context():
                song = Song.query.get(track_id)
                
                if not song:
                    logger.error(f"Song with track ID {track_id} not found in database")
                    return False
                
                # Skip if lyrics already exist
                if song.lyrics:
                    logger.info(f"Lyrics already exist for track ID: {track_id}")
                    return True
            
            # Fetch lyrics from Spotify
            df_lyrics = self.lyrics_driver.get_lyrics(track_id)
            
            if df_lyrics is None or df_lyrics.empty:
                logger.error(f"No lyrics found for track ID: {track_id}")
                return False
            
            # Convert to list of dictionaries for JSON serialization
            lyrics_data = df_lyrics.to_dict(orient='records')
            
            # Store lyrics in database
            with app.app_context():
                song.lyrics = lyrics_data
                db.session.commit()
                
                logger.info(f"Stored lyrics for track ID: {track_id}")
                return True
                
        except Exception as e:
            logger.exception(f"Error fetching and storing lyrics: {str(e)}")
            return False

    def fetch_all_missing_lyrics(self):
        """
        Fetch lyrics for all songs in the database that don't have lyrics yet
        
        Returns:
            dict: Summary of the operation
        """
        success_count = 0
        failure_count = 0
        
        try:
            with app.app_context():
                # Get all songs without lyrics
                songs_without_lyrics = Song.query.filter(Song.lyrics == None).all()
                
                total_songs = len(songs_without_lyrics)
                logger.info(f"Found {total_songs} songs without lyrics")
                
                for i, song in enumerate(songs_without_lyrics, 1):
                    logger.info(f"Processing {i}/{total_songs}: {song.title} by {song.artist}")
                    
                    if self.fetch_and_store_lyrics(song.track_id):
                        success_count += 1
                    else:
                        failure_count += 1
                
            return {
                'total_processed': total_songs,
                'success_count': success_count,
                'failure_count': failure_count
            }
            
        except Exception as e:
            logger.exception(f"Error fetching all missing lyrics: {str(e)}")
            return {
                'total_processed': success_count + failure_count,
                'success_count': success_count,
                'failure_count': failure_count + 1,
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
    
    # Fetch lyrics command
    fetch_parser = subparsers.add_parser('fetch-lyrics', help='Fetch lyrics for a song')
    fetch_parser.add_argument('-i', '--track-id', help='Spotify track ID')
    fetch_parser.add_argument('--all', action='store_true', help='Fetch lyrics for all songs without lyrics')
    
    args = parser.parse_args()
    
    populator = SongPopulator()
    
    if args.command == 'add-song':
        result = populator.add_song_to_db(args.artist, args.title)
        if result:
            if result.get('already_exists'):
                print(f"Song already exists: {result['title']} by {result['artist']} (ID: {result['id']})")
            else:
                print(f"Added song: {result['title']} by {result['artist']} (ID: {result['id']})")
        else:
            print(f"Failed to add song: {args.title} by {args.artist}")
            
    elif args.command == 'fetch-lyrics':
        if args.track_id:
            success = populator.fetch_and_store_lyrics(args.track_id)
            if success:
                print(f"Successfully fetched and stored lyrics for track ID: {args.track_id}")
            else:
                print(f"Failed to fetch or store lyrics for track ID: {args.track_id}")
        elif args.all:
            result = populator.fetch_all_missing_lyrics()
            print(f"Processed {result['total_processed']} songs:")
            print(f"  - {result['success_count']} succeeded")
            print(f"  - {result['failure_count']} failed")
        else:
            print("Error: Either --track-id or --all must be specified")
    else:
        parser.print_help()

if __name__ == "__main__":
    main()