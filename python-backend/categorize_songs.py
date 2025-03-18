#!/usr/bin/env python3
"""
Enhanced Song Categorization Script

This script:
1. Reads the song_list.csv file
2. Creates meaningful categories based on:
   - Artists
   - Decades/Era
   - Themes (love, dance, etc.)
   - Genres (rap, rock, variété, etc.)
3. Assigns songs to categories based on multiple criteria
4. Populates the database with categorized songs
"""

import os
import sys
import csv
import uuid
import re
import logging
import pandas as pd
from collections import defaultdict
from flask import Flask
from dotenv import load_dotenv

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import project modules
from database import init_db, db, Song, Category
from spotify import SpotifyDriver, SpotifyLyricsDriver

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize a Flask app for database operations
app = Flask(__name__)

# Configure SQLAlchemy
base_db_url = os.environ.get('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/karaoke')
app.config['SQLALCHEMY_DATABASE_URI'] = base_db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize database
init_db(app)

class EnhancedSongCategorizer:
    def __init__(self):
        self.spotify_driver = SpotifyDriver()
        # self.lyrics_driver = SpotifyLyricsDriver()
        
        # Define category types and their metadata
        self.category_types = {
            'era': {
                'difficulty': 30,
                'expected_words': 4
            },
            'genre': {
                'difficulty': 40,
                'expected_words': 5  
            },
            'theme': {
                'difficulty': 50,
                'expected_words': 6
            },
            'artist': {
                'difficulty': 35,
                'expected_words': 5
            }
        }
        
        # Define era categories
        self.era_categories = [
            {'name': 'Années 60-70', 'patterns': ['Jacques Brel', 'Charles Aznavour', 'Joe Dassin', 'Georges Brassens', 'Serge Gainsbourg', 'Michel Sardou', 'Johnny Hallyday']},
            {'name': 'Années 80', 'patterns': ['Indochine', 'Téléphone', 'Jean-Jacques Goldman', 'Daniel Balavoine', 'France Gall', 'Michel Berger', 'Desireless', 'Images']},
            {'name': 'Années 90-2000', 'patterns': ['Céline Dion', 'Florent Pagny', 'Pascal Obispo', 'Lara Fabian', 'Patrick Bruel', 'Mylène Farmer']},
            {'name': 'Années 2010+', 'patterns': ['Soprano', 'Angèle', 'Orelsan', 'Louane', 'Vianney', 'Maître Gims', 'Aya Nakamura']}
        ]
        
        # Define genre categories
        self.genre_categories = [
            {'name': 'Rap & Hip-Hop', 'patterns': ['rap', 'hip-hop', 'Booba', 'IAM', 'MC Solaar', 'Diam\'s', 'Orelsan', 'Soprano', 'Maître Gims', 'Aya Nakamura']},
            {'name': 'Chanson française', 'patterns': ['chanson', 'Jacques Brel', 'Charles Aznavour', 'Georges Brassens', 'Serge Gainsbourg', 'Jean Ferrat', 'Renaud']},
            {'name': 'Pop française', 'patterns': ['pop', 'Jenifer', 'Christophe Maé', 'Zazie', 'Jean-Jacques Goldman', 'France Gall', 'Michel Berger', 'Louane', 'M. Pokora']},
            {'name': 'Rock français', 'patterns': ['rock', 'Téléphone', 'Indochine', 'Louise Attaque', 'Noir Désir', '-M-', 'BB Brunes']}
        ]
        
        # Define theme categories by analyzing song titles
        self.theme_categories = [
            {'name': 'Chansons d\'amour', 'patterns': ['amour', 'aime', 'cœur', 'coeur', 'je t\'', 'aimer', 'love', 'amoureuse']},
            {'name': 'Voyage & Évasion', 'patterns': ['voyage', 'partir', 'route', 'chemin', 'loin', 'mer', 'soleil', 'île']},
            {'name': 'Fête & Danse', 'patterns': ['danse', 'danser', 'fête', 'nuit', 'folie', 'party', 'bouge', 'club']},
            {'name': 'Nostalgie & Souvenirs', 'patterns': ['souvenir', 'temps', 'hier', 'jadis', 'passé', 'mémoire', 'enfance', 'nostalgie']}
        ]
        
        # Define iconic artist categories
        self.iconic_artist_categories = [
            {'name': 'Goldman & Friends', 'patterns': ['Jean-Jacques Goldman', 'Céline Dion', 'Carole Fredericks']},
            {'name': 'Les grands poètes', 'patterns': ['Jacques Brel', 'Georges Brassens', 'Léo Ferré', 'Barbara', 'Serge Gainsbourg']},
            {'name': 'Électro-pop française', 'patterns': ['Angèle', 'Zazie', 'Stromae', 'Christine and the Queens']},
            {'name': 'La nouvelle scène rap', 'patterns': ['Orelsan', 'Lomepal', 'Nekfeu', 'Damso', 'Roméo Elvis']}
        ]
        
        # Define musical theme categories
        self.musical_categories = [
            {'name': 'Disney & films', 'patterns': ['Disney', 'film', 'cinéma', 'roi', 'Hakuna', 'Matata', 'reine']},
            {'name': 'Chansons engagées', 'patterns': ['politique', 'engagé', 'monde', 'liberté', 'social']}
        ]
        
        # Combine all category definitions
        self.all_category_definitions = []
        for cats, cat_type in [
            (self.era_categories, 'era'),
            (self.genre_categories, 'genre'),
            (self.theme_categories, 'theme'),
            (self.iconic_artist_categories, 'artist'),
            (self.musical_categories, 'theme')
        ]:
            for cat in cats:
                cat['type'] = cat_type
                cat['id'] = str(uuid.uuid4())
                cat['difficulty'] = self.category_types[cat_type]['difficulty']
                cat['expected_words'] = self.category_types[cat_type]['expected_words']
                self.all_category_definitions.append(cat)
        
        # Create a fallback category
        self.fallback_category = {
            'name': 'Variété diverse',
            'id': str(uuid.uuid4()),
            'type': 'other',
            'difficulty': 25,
            'expected_words': 3
        }

    def read_song_list(self, csv_file):
        """Read songs from CSV file"""
        songs = []
        
        try:
            with open(csv_file, 'r', encoding='utf-8') as file:
                csv_reader = csv.reader(file)
                for row in csv_reader:
                    if len(row) >= 2:
                        # Clean up artist and title (remove quotes and extra spaces)
                        artist = row[0].strip('"').strip()
                        title = row[1].strip('"').strip()
                        
                        songs.append({
                            'artist': artist,
                            'title': title,
                            # Store lower case versions for pattern matching
                            'artist_lower': artist.lower(),
                            'title_lower': title.lower()
                        })
            
            logger.info(f"Read {len(songs)} songs from {csv_file}")
            return songs
        except Exception as e:
            logger.error(f"Failed to read CSV file: {e}")
            return []

    def create_categories(self):
        """Create all defined categories in the database"""
        with app.app_context():
            # Create predefined categories and build a lookup dictionary
            category_objects = {}
            
            for cat_def in self.all_category_definitions:
                category = Category.query.filter_by(name=cat_def['name']).first()
                
                if not category:
                    category = Category(
                        id=cat_def['id'],
                        name=cat_def['name']
                    )
                    db.session.add(category)
                    logger.info(f"Created category: {cat_def['name']} ({cat_def['type']})")
                else:
                    logger.info(f"Category already exists: {cat_def['name']}")
                
                category_objects[cat_def['name']] = category
            
            # Create fallback category
            fallback = Category.query.filter_by(name=self.fallback_category['name']).first()
            if not fallback:
                fallback = Category(
                    id=self.fallback_category['id'],
                    name=self.fallback_category['name']
                )
                db.session.add(fallback)
                logger.info(f"Created fallback category: {self.fallback_category['name']}")
            
            category_objects[self.fallback_category['name']] = fallback
            
            db.session.commit()
            return category_objects

    def find_matching_categories(self, song):
        """Find all categories that match a song"""
        matches = []
        artist = song['artist']
        title = song['title']
        artist_lower = song['artist_lower']
        title_lower = song['title_lower']
        
        # Combined text for pattern matching
        combined_text = f"{artist_lower} {title_lower}"
        
        for cat_def in self.all_category_definitions:
            # Check if any of the patterns match
            for pattern in cat_def['patterns']:
                pattern_lower = pattern.lower()
                if (pattern_lower in artist_lower or 
                    pattern_lower in title_lower or 
                    pattern_lower in combined_text):
                    matches.append({
                        'name': cat_def['name'],
                        'id': cat_def['id'],
                        'type': cat_def['type'],
                        'matched_pattern': pattern,
                        'confidence': self._calculate_match_confidence(pattern_lower, combined_text)
                    })
                    # Don't add duplicates
                    break
        
        # If no categories matched, return fallback
        if not matches:
            return [{
                'name': self.fallback_category['name'],
                'id': self.fallback_category['id'],
                'type': self.fallback_category['type'],
                'matched_pattern': 'fallback',
                'confidence': 1.0
            }]
        
        # Sort matches by confidence (highest first)
        matches.sort(key=lambda x: x['confidence'], reverse=True)
        return matches

    def _calculate_match_confidence(self, pattern, text):
        """Calculate a confidence score for a pattern match"""
        # Simple calculation based on:
        # - How much of the text is covered by the pattern
        # - Number of occurrences
        pattern_len = len(pattern)
        text_len = len(text)
        occurrences = text.count(pattern)
        
        # Calculate confidence
        coverage = pattern_len / max(text_len, 1)
        confidence = coverage * (0.5 + (0.5 * min(occurrences, 3) / 3))
        return confidence

    def create_or_update_song_with_categories(self, song_data, categories_dict):
        """Create or update a song and assign it to matching categories"""
        # First, search for the song on Spotify to get track_id
        # search_query = f"{song_data['title']} {song_data['artist']}"
        
        try:
            search_results = self.spotify_driver.search_track(song_data['title'], song_data['artist'])
            if not search_results:
                logger.warning(f"No Spotify match found for: {song_data['title']} by {song_data['artist']}")
                return None
            
            # Use the first result
            # track = search_results['items'][0]
            track = search_results
            track_id = track['id']
            
            # Find matching categories
            matching_categories = self.find_matching_categories(song_data)
            
            # Select the top matches, prioritizing different types
            selected_categories = self._select_diverse_categories(matching_categories)
            
            # Check if song already exists
            song = Song.query.get(track_id)
            
            if not song:
                # Create new song
                release_year = None
                if 'album' in track and 'release_date' in track['album']:
                    release_date = track['album']['release_date']
                    if len(release_date) >= 4:
                        release_year = int(release_date[:4])
                
                song = Song(
                    id=track_id,
                    artist=song_data['artist'],
                    title=song_data['title'],
                    release_year=release_year
                )
                db.session.add(song)
                logger.info(f"Created new song: {song.title} by {song.artist}")
            else:
                logger.info(f"Song already exists: {song.title} by {song.artist}")
            
            # Add category relationships
            for cat_match in selected_categories:
                category = categories_dict.get(cat_match['name'])
                if category and category not in song.categories:
                    song.categories.append(category)
                    logger.info(f"Added song {song.title} to category {cat_match['name']} (matched: {cat_match['matched_pattern']})")
            
            return song
        
        except Exception as e:
            logger.exception(f"Error processing song {song_data['title']} by {song_data['artist']}: {str(e)}")
            return None

    def _select_diverse_categories(self, matches, max_categories=5):
        """Select a diverse set of categories based on type and confidence"""
        if not matches:
            return []
            
        # If we only have a few matches, use them all
        if len(matches) <= max_categories:
            return matches
            
        # Try to get diverse category types while maintaining high confidence
        selected = []
        types_seen = set()
        
        # First pass: Take highest confidence match per type
        for match in matches:
            if match['type'] not in types_seen and len(selected) < max_categories:
                selected.append(match)
                types_seen.add(match['type'])
        
        # Second pass: Fill remaining slots with highest confidence matches
        if len(selected) < max_categories:
            remaining = [m for m in matches if m not in selected]
            remaining.sort(key=lambda x: x['confidence'], reverse=True)
            selected.extend(remaining[:max_categories - len(selected)])
        
        return selected

    def process_songs(self, songs_list):
        """Process the songs and add them to the database with categories"""
        with app.app_context():
            categories = self.create_categories()
            
            # Process songs in batches
            batch_size = 10
            num_songs = len(songs_list)
            song_objects = []
            
            for i in range(0, num_songs, batch_size):
                batch = songs_list[i:min(i+batch_size, num_songs)]
                logger.info(f"Processing batch {i//batch_size + 1}/{(num_songs+batch_size-1)//batch_size}")
                
                for song_data in batch:
                    song = self.create_or_update_song_with_categories(song_data, categories)
                    if song:
                        song_objects.append(song)
                
                # Commit after each batch
                try:
                    db.session.commit()
                except Exception as e:
                    db.session.rollback()
                    logger.error(f"Error committing batch: {str(e)}")
            
            logger.info(f"Finished processing {len(song_objects)} songs")
            return song_objects

    def fetch_lyrics_for_songs(self, songs):
        """Fetch and store lyrics for processed songs"""
        success_count = 0
        failure_count = 0
        
        with app.app_context():
            for song in songs:
                try:
                    logger.info(f"Fetching lyrics for {song.title} by {song.artist}")
                    lyrics_df = self.lyrics_driver.get_lyrics(song.id)
                    
                    if lyrics_df is not None and not lyrics_df.empty:
                        # Store lyrics directly in the song record
                        song.lyrics = lyrics_df.to_dict(orient='records')
                        db.session.commit()
                        logger.info(f"Stored lyrics for {song.title}")
                        success_count += 1
                    else:
                        logger.warning(f"No lyrics found for {song.title}")
                        failure_count += 1
                        
                except Exception as e:
                    logger.error(f"Error fetching lyrics for {song.title}: {str(e)}")
                    failure_count += 1
                    
        return {
            "success": success_count,
            "failures": failure_count
        }

    def analyze_lyrics_themes(self):
        """Analyze lyrics to refine theme categories (must be run after lyrics are fetched)"""
        # This would be implemented to analyze lyrics content for themes
        # For simplicity, not fully implementing this in this version
        pass

    def generate_playlist_json(self, output_file):
        """Generate a playlist JSON for the frontend"""
        with app.app_context():
            playlist = {
                "name": "Categorized Playlist",
                "categories": [],
                "songs": []
            }
            
            # Add all categories with their difficulty levels
            for cat_def in self.all_category_definitions:
                category = Category.query.get(cat_def['id'])
                if category:
                    playlist["categories"].append({
                        "id": cat_def['id'],
                        "name": cat_def['name'],
                        "difficulty": cat_def['difficulty'],
                        "expected_words": cat_def['expected_words']
                    })
            
            # Add the fallback category
            fb_cat = Category.query.get(self.fallback_category['id'])
            if fb_cat:
                playlist["categories"].append({
                    "id": self.fallback_category['id'],
                    "name": self.fallback_category['name'],
                    "difficulty": self.fallback_category['difficulty'],
                    "expected_words": self.fallback_category['expected_words']
                })
            
            # Add songs with their categories
            songs = Song.query.all()
            for song in songs:
                if song.categories:
                    # Use the first category for the song in the playlist
                    cat = song.categories[0]
                    
                    # Find category definition to get difficulty and expected words
                    cat_def = next((c for c in self.all_category_definitions 
                                   if c['id'] == cat.id), self.fallback_category)
                    
                    playlist["songs"].append({
                        "id": song.id,
                        "track_id": song.id,
                        "category": cat.id,
                        "artist": song.artist,
                        "title": song.title,
                        "release_year": song.release_year,
                        "expected_words": cat_def.get('expected_words', 4)
                    })
            
            # Write to file
            try:
                with open(output_file, 'w', encoding='utf-8') as f:
                    import json
                    json.dump(playlist, f, ensure_ascii=False, indent=4)
                logger.info(f"Playlist written to {output_file}")
            except Exception as e:
                logger.error(f"Failed to write playlist: {e}")
    
    def generate_category_statistics(self):
        """Generate statistics on category distribution"""
        with app.app_context():
            categories = Category.query.all()
            stats = []
            
            for category in categories:
                song_count = len(category.songs)
                cat_def = next((c for c in self.all_category_definitions if c['id'] == category.id), 
                              self.fallback_category if category.name == self.fallback_category['name'] else None)
                
                cat_type = cat_def['type'] if cat_def else 'unknown'
                
                stats.append({
                    'id': category.id,
                    'name': category.name,
                    'type': cat_type,
                    'song_count': song_count
                })
            
            # Sort by song count
            stats.sort(key=lambda x: x['song_count'], reverse=True)
            
            # Print statistics
            print("\nCategory Statistics:")
            print("=" * 60)
            print(f"{'Category Name':<30} {'Type':<10} {'Song Count':<10}")
            print("-" * 60)
            
            for stat in stats:
                print(f"{stat['name']:<30} {stat['type']:<10} {stat['song_count']:<10}")
                
            print("=" * 60)
            
            # Group by type
            type_counts = defaultdict(int)
            for stat in stats:
                type_counts[stat['type']] += stat['song_count']
            
            print("\nSongs by Category Type:")
            for cat_type, count in sorted(type_counts.items(), key=lambda x: x[1], reverse=True):
                print(f"{cat_type:<15}: {count}")
                
            return stats

def main():
    """Main function to run the script"""
    if len(sys.argv) < 2:
        print("Usage: python categorize_songs.py <command> [options]")
        print("Commands:")
        print("  categorize <csv_file> - Categorize songs from CSV and add to database")
        print("  fetch-lyrics - Fetch lyrics for songs in the database")
        print("  generate-playlist <output_file> - Generate a playlist JSON")
        print("  show-stats - Show statistics about categories")
        return
    
    categorizer = EnhancedSongCategorizer()
    command = sys.argv[1]
    
    if command == "categorize":
        csv_file = sys.argv[2] if len(sys.argv) > 2 else "song_list.csv"
        songs = categorizer.read_song_list(csv_file)
        processed_songs = categorizer.process_songs(songs)
        
        # Optionally fetch lyrics too
        if len(sys.argv) > 3 and sys.argv[3] == "--with-lyrics":
            print("Fetching lyrics for processed songs...")
            categorizer.fetch_lyrics_for_songs(processed_songs)
    
    elif command == "fetch-lyrics":
        with app.app_context():
            songs = Song.query.all()
            results = categorizer.fetch_lyrics_for_songs(songs)
            print(f"Lyrics fetch complete: {results['success']} successful, {results['failures']} failed")
    
    elif command == "generate-playlist":
        output_file = sys.argv[2] if len(sys.argv) > 2 else "../client/public/playlists/enhanced_categories.json"
        categorizer.generate_playlist_json(output_file)
    
    elif command == "show-stats":
        categorizer.generate_category_statistics()
    
    else:
        print(f"Unknown command: {command}")

if __name__ == "__main__":
    main()
