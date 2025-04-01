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
from tqdm import tqdm  # Add tqdm for progress bars

# Add parent directory to path so we can import from sibling modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import project modules
from spotify import SpotifyDriver
from database import init_db
from db_populator import DatabasePopulator

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.ERROR,
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



class SongPopulator:
    def __init__(self):
        """Initialize the SongPopulator with Spotify drivers"""
        self.spotify_driver = SpotifyDriver()
        self.db_populator = DatabasePopulator(app)  # Pass the Flask app instance

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
                    'failed': 0
                }
            
            total_tracks = len(tracks)
            added_count = 0
            exists_count = 0
            failed_count = 0
            
            # Create progress bar for track processing
            with tqdm(total=total_tracks, desc="Processing tracks", unit="track") as pbar:
                for track in tracks:
                    artist_name = track['artists'][0]['name']
                    track_name = track['name']
                    
                    try:
                        pbar.set_description(f"Processing: {track_name[:20]} - {artist_name[:20]}...")
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
                'failed': failed_count
            }
            
        except Exception as e:
            logger.exception(f"Error adding songs by theme: {str(e)}")
            return {
                'total': 0,
                'added': 0,
                'already_exists': 0,
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

    elif args.command == 'search-theme':
        results = populator.search_theme(args.query, args.limit)
        if results:
            print(f"Found {len(results)} playlists for theme: '{args.query}'")
            # Display playlists first
            # for playlist in results:
            #     print(f"{playlist['index']}. {playlist['name']}")
            #     print(f"   ID: {playlist['id']}")
            #     print(f"   Owner: {playlist['owner']}")
            #     print(f"   Tracks: {playlist['tracks_count']}")
            #     print()
            
            # Process playlists with progress bar
            with tqdm(total=len(results), desc="Processing playlists", unit="playlist") as pbar:
                for playlist in results:                
                    pbar.update(1)
                    if "rap" in playlist['name'].lower():
                        print(f"Skipping playlist: {playlist['name']} (contains 'rap')")
                        continue

                    pbar.set_description(f"Processing: {playlist['name']}...")

                    # print(f"\nProcessing playlist: {playlist['name']}")
                    result = populator.add_songs_by_theme(playlist['id'], args.limit)
                    print(f"Processed {result['total']} tracks:")
                    print(f"  - {result['added']} added")
                    print(f"  - {result['already_exists']} already existed")
                    print(f"  - {result['failed']} failed")
        else:
            print(f"No playlists found for theme: '{args.query}'")
    else:
        parser.print_help()

if __name__ == "__main__":
    main()