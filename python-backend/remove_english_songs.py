#!/usr/bin/env python3
"""
Remove English Songs Script

This script detects and removes English songs from the database to keep only French content.
It uses language detection on song titles and lyrics to identify English songs.
"""

import os
import sys
import json
import logging
import argparse
from tqdm import tqdm
from flask import Flask
from dotenv import load_dotenv
from langdetect import detect, LangDetectException
import re

# Set up logging
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize a minimal Flask app for database operations
app = Flask(__name__)

# Configure the SQLAlchemy part of the app
base_db_url = os.environ.get(
    'DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/karaoke'
)
app.config['SQLALCHEMY_DATABASE_URI'] = f"{base_db_url}?options=-c%20search_path=karaoke,public"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize database
from database import init_db, db, Song, Category
init_db(app)


class EnglishSongRemover:
    def __init__(self):
        """Initialize the language detector"""
        self.french_artists = self._load_french_artists()
        self.english_patterns = [
            r'\b(the|and|of|in|on|at|to|for|with|by|as|from|about)\b',
            r'\b(my|your|his|her|our|their|its)\b',
            r'\b(is|are|was|were|be|been|being|am)\b',
            r'\b(this|that|these|those)\b',
            r'\b(never|gonna|give|you|up)\b'  # The famous Rick roll pattern :)
        ]
    
    def _load_french_artists(self):
        """Load a list of known French artists from a file or define them manually"""
        # For now, we'll define a small list of French artists
        # This could be expanded or loaded from a file
        return [
            'jacques brel', 'edith piaf', 'renaud', 'michel sardou',
            'stromae', 'zaz', 'indochine', 'johnny hallyday',
            'mylene farmer', 'serge gainsbourg', 'charles aznavour',
            'maitre gims', 'francis cabrel', 'alain souchon',
            'barbara', 'patricia kaas', 'christophe mae'
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
            # Extract just the words from lyrics (which may be in a specific format)
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
        
        # If we've made it this far without a determination, make a guess based on available info
        # Default to keeping the song if we're not sure (assume French)
        return False, 0.5, "No strong indicators found, defaulting to French"
    
    def get_all_songs(self):
        """Get all songs from the database"""
        with app.app_context():
            return Song.query.all()
    
    def identify_english_songs(self, fast_mode=False):
        """
        Identify which songs are likely in English
        
        Args:
            fast_mode: If True, use only title/artist for detection (faster but less accurate)
            
        Returns:
            list: List of (song, confidence, reason) tuples for detected English songs
        """
        songs = self.get_all_songs()
        logger.info(f"Analyzing {len(songs)} songs for language detection")
        
        english_songs = []
        
        for song in tqdm(songs, desc="Detecting English songs"):
            lyrics = None if fast_mode else song.lyrics
            is_english, confidence, reason = self.is_likely_english(song.title, song.artist, lyrics)
            
            if is_english:
                english_songs.append((song, confidence, reason))
        
        return english_songs
    
    def remove_english_songs(self, dry_run=True, min_confidence=0.7, fast_mode=False):
        """
        Remove English songs from the database
        
        Args:
            dry_run: If True, only report what would be removed without actually removing
            min_confidence: Minimum confidence level to remove a song (0.0-1.0)
            fast_mode: If True, use only title/artist for detection (faster but less accurate)
            
        Returns:
            list: List of removed song IDs
        """
        english_songs = self.identify_english_songs(fast_mode)
        
        if not english_songs:
            logger.info("No English songs detected")
            return []
        
        logger.info(f"Found {len(english_songs)} likely English songs")
        
        # Filter by confidence threshold
        to_remove = [s for s, conf, reason in english_songs if conf >= min_confidence]
        
        logger.info(f"{len(to_remove)} songs exceed the confidence threshold of {min_confidence}")
        
        if dry_run:
            logger.info("DRY RUN: The following songs would be removed:")
            for song in to_remove:
                logger.info(f"- {song.title} by {song.artist} (ID: {song.id})")
            return [s.id for s in to_remove]
        
        # Actually remove the songs
        with app.app_context():
            removed_ids = []
            
            for song in tqdm(to_remove, desc="Removing English songs"):
                try:
                    # Remove the song from any categories first
                    song.categories = []
                    
                    # Then remove the song itself
                    db.session.delete(song)
                    removed_ids.append(song.id)
                    
                    logger.info(f"Removed song: {song.title} by {song.artist} (ID: {song.id})")
                except Exception as e:
                    logger.error(f"Error removing song {song.id}: {str(e)}")
            
            # Commit the changes
            db.session.commit()
            
            logger.info(f"Successfully removed {len(removed_ids)} English songs")
            return removed_ids
    
    def export_english_songs(self, output_file):
        """
        Export the list of English songs to a JSON file for review
        
        Args:
            output_file: Path to the output JSON file
            
        Returns:
            int: Number of songs exported
        """
        english_songs = self.identify_english_songs()
        
        if not english_songs:
            logger.info("No English songs detected")
            return 0
        
        export_data = []
        for song, confidence, reason in english_songs:
            export_data.append({
                'id': song.id,
                'title': song.title,
                'artist': song.artist,
                'confidence': confidence,
                'reason': reason
            })
        
        # Sort by confidence (highest first)
        export_data.sort(key=lambda x: x['confidence'], reverse=True)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Exported {len(export_data)} English songs to {output_file}")
        return len(export_data)
    
    def remove_specific_songs(self, song_ids):
        """
        Remove specific songs by their IDs
        
        Args:
            song_ids: List of song IDs to remove
            
        Returns:
            int: Number of songs removed
        """
        if not song_ids:
            logger.info("No song IDs provided")
            return 0
        
        with app.app_context():
            removed_count = 0
            
            for song_id in tqdm(song_ids, desc="Removing songs"):
                try:
                    song = Song.query.get(song_id)
                    if song:
                        # Remove the song from any categories first
                        song.categories = []
                        
                        # Then remove the song itself
                        db.session.delete(song)
                        removed_count += 1
                        
                        logger.info(f"Removed song: {song.title} by {song.artist} (ID: {song.id})")
                    else:
                        logger.warning(f"Song with ID {song_id} not found")
                except Exception as e:
                    logger.error(f"Error removing song {song_id}: {str(e)}")
            
            # Commit the changes
            db.session.commit()
            
            logger.info(f"Successfully removed {removed_count} songs")
            return removed_count


def main():
    """Main entry point for the script"""
    parser = argparse.ArgumentParser(description='Detect and remove English songs from the database')
    
    parser.add_argument('--action', choices=['detect', 'remove', 'export'], default='detect',
                        help='Action to perform: detect (default), remove, or export English songs')
    parser.add_argument('--dry-run', action='store_true',
                        help='For remove action: only report what would be removed without actually removing')
    parser.add_argument('--confidence', type=float, default=0.7,
                        help='Minimum confidence level for English detection (0.0-1.0)')
    parser.add_argument('--fast', action='store_true',
                        help='Use fast detection mode (title/artist only, no lyrics)')
    parser.add_argument('--output', type=str, default='english_songs.json',
                        help='Output file for export action')
    parser.add_argument('--remove-from-file', type=str,
                        help='Remove songs listed in the specified JSON file')
    
    args = parser.parse_args()
    
    remover = EnglishSongRemover()
    
    if args.action == 'detect':
        english_songs = remover.identify_english_songs(args.fast)
        print(f"Detected {len(english_songs)} likely English songs:")
        
        # Sort by confidence
        english_songs.sort(key=lambda x: x[1], reverse=True)
        
        for song, confidence, reason in english_songs:
            print(f"- {song.title} by {song.artist} (Confidence: {confidence:.2f}, Reason: {reason})")
    
    elif args.action == 'remove':
        if args.remove_from_file:
            try:
                with open(args.remove_from_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                song_ids = [item['id'] for item in data]
                count = remover.remove_specific_songs(song_ids)
                print(f"Removed {count} songs from the file {args.remove_from_file}")
            except Exception as e:
                print(f"Error removing songs from file: {str(e)}")

        else:
            removed_ids = remover.remove_english_songs(
                dry_run=args.dry_run,
                min_confidence=args.confidence,
                fast_mode=args.fast
            )
            if args.dry_run:
                print(f"DRY RUN: Would remove {len(removed_ids)} English songs")
            else:
                print(f"Removed {len(removed_ids)} English songs from the database")
    
    elif args.action == 'export':
        count = remover.export_english_songs(args.output)
        print(f"Exported {count} likely English songs to {args.output}")
    


if __name__ == "__main__":
    main()