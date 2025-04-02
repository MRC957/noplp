from database import db, Song, Category
import os
import sys
import json
import logging
import argparse
from flask import Flask
from dotenv import load_dotenv
from groq import Groq
from tqdm import tqdm
import re
import random
from uuid import uuid4

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
from database import init_db
init_db(app)


class SongCategorizer:
    def __init__(self):
        """Initialize the SongCategorizer with Groq AI API client"""
        self.client = Groq(
            api_key=os.getenv('GROQ_API_KEY'),
        )
        # self.model = "llama-3.3-70b-versatile"  # Using the most capable model
        # self.model = "llama-3.1-8b-instant"  # Using the most capable model
        self.model = "deepseek-r1-distill-llama-70b"  # Using the most capable model
        # Track newly created categories during the session
        self.new_categories = []
    
    def get_all_songs(self):
        """Get all songs from the database"""
        with app.app_context():
            return Song.query.all()
    
    def get_all_categories(self):
        """Get all existing categories from the database"""
        with app.app_context():
            return Category.query.all()
    
    
    def get_song_details(self, song):
        """Extract relevant details from a song for categorization"""
        return {
            'id': song.id,
            'artist': song.artist,
            'title': song.title,
            'lyrics' : " ".join([lyric.get("words") for lyric in song.lyrics])[:800] if song.lyrics else "",
            # 'release_year': song.release_year,
            # 'has_lyrics': bool(song.lyrics)
        }
    
    def format_existing_categories(self, categories):
        """Format categories for the AI prompt"""
        return [{'category_id': cat.id, 'category_name': cat.name} for cat in categories]
    
    def process_songs_batch(self, batch, all_categories):
        """Process a batch of songs using Groq AI including existing categories"""
        logger.info(f"Processing a batch of {len(batch)} songs")
        
        # Extract song details from batch
        batch_details = [self.get_song_details(song) for song in batch]
        
        # Get all existing categories
        # all_categories = self.get_all_categories()
        
        # Format categories for the AI prompt
        # existing_categories = self.format_existing_categories(all_categories)
        
        # Add newly created categories to the list
        if self.new_categories:
            # Remove duplicates
            existing_category_ids = {cat['category_id'] for cat in all_categories}
            for cat in self.new_categories:
                if cat['category_id'] not in existing_category_ids:
                    all_categories.append(cat)
        
        # Get categories from AI, passing existing categories
        categories = self.get_categories_from_ai(batch_details, all_categories)
        
        return categories, all_categories
    
    def get_categories_from_ai(self, songs_data, existing_categories=None):
        """Use Groq AI to generate categories for songs, with option to reuse existing categories"""
        
        # Prepare the prompt for the AI - Updated to include existing categories
        prompt = f"""Tu es un expert en musique française et en karaoké. Analyse ces chansons et crée ou réutilise des catégories pertinentes en français.
        
Chansons à catégoriser:
{json.dumps(songs_data)}

"""
        # Add existing categories to the prompt if available
        if existing_categories and len(existing_categories) > 0:
            prompt += f"""
Catégories existantes que tu peux réutiliser:
{json.dumps(existing_categories)}
"""

        prompt += f"""
    Pour chaque chanson, tu dois:
    1. Soit créer une nouvelle catégorie avec un nom court et mémorable en français (1-3 mots)
    2. Soit réutiliser une catégorie existante qui convient parfaitement

    Directives importantes:
    - Crée 2-3 nouvelles catégories SEULEMENT SI NÉCESSAIRE - privilégie la réutilisation des catégories existantes
    - Les catégories doivent être basées sur le genre, l'époque, l'ambiance, le thème, le tempo ou d'autres caractéristiques musicales
    - Une chanson peut appartenir à plusieurs catégories
    - Il n'est PAS nécessaire d'inclure toutes les chansons dans des catégories
    - La qualité des associations est plus importante que la quantité

    Retourne UNIQUEMENT un tableau JSON avec la structure suivante:
    [
      {{
        "category_name": "Nom de la catégorie",
        "category_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", 
        "song_ids": ["song_id1", "song_id2", ...],
        "is_new": false
      }},
      ...
    ]

    Pour les catégories existantes, utilise EXACTEMENT le même category_id et category_name que fourni, et mets is_new à false.
    Pour les nouvelles catégories, génère un UUID4 comme category_id (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx), et mets is_new à true.
    """
        
        try:
            # Call the Groq AI API
            response = self.client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "Tu es un expert en catégorisation musicale pour une application de karaoké française."},
                    {"role": "user", "content": prompt}
                ],
                model=self.model,
            )
            
            # Extract and parse the JSON response
            ai_response = response.choices[0].message.content
            
            # Find JSON data in the response
            json_match = re.search(r'\[.*\]', ai_response, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
                try:
                    categories_data = json.loads(json_str)
                    
                    # Track newly created categories for future iterations
                    for category in categories_data:
                        if category.get('is_new', False):
                            self.new_categories.append({
                                'category_id': category['category_id'],
                                'category_name': category['category_name']
                            })
                    
                    return categories_data
                except json.JSONDecodeError as e:
                    logger.error(f"Error decoding AI response JSON: {e}")
                    logger.error(f"Raw response: {ai_response}")
            else:
                logger.error(f"No valid JSON found in the AI response: {ai_response}")
            
            return []
            
        except Exception as e:
            logger.exception(f"Error getting categories from AI: {str(e)}")
            return []
    
    def save_categories_to_db(self, categories_data):
        """Save categories and their song associations to the database"""
        with app.app_context():
            categories_created = 0
            categories_reused = 0
            associations_created = 0
            
            for category_info in categories_data:
                # Check if this is a new or existing category
                category_id = category_info.get('category_id')
                
                # Check if category already exists in database
                category = Category.query.get(category_id)
                
                if not category:
                    # Create new category
                    category = Category(
                        id=category_id,
                        name=category_info['category_name']
                    )
                    db.session.add(category)
                    categories_created += 1
                else:
                    # Reusing existing category
                    categories_reused += 1
                
                # Add song associations
                song_ids = category_info.get('song_ids', [])
                for song_id in song_ids:
                    song = Song.query.get(song_id)
                    if song and category not in song.categories:
                        song.categories.append(category)
                        associations_created += 1
                
            # Commit changes
            db.session.commit()
            
            return {
                'categories_created': categories_created,
                'categories_reused': categories_reused,
                'associations_created': associations_created
            }
    
    def generate_random_categories(self, count=5):
        """Generate random thematic categories and assign songs to them"""
        with app.app_context():
            songs = self.get_all_songs()
            
            if not songs:
                logger.error("No songs found in the database")
                return
            
            # Example themes for random categories - Updated with French categories
            themes = [
                "Années 80", "Années 90", "Chansons d'Amour", "Tubes Français", 
                "Classiques Français", "Ballades Romantiques", "Hits Dansants", 
                "Chansons à Reprendre", "Titres d'Un Mot", "Artistes Femmes", 
                "Artistes Hommes", "Duos Célèbres", "Chansons sur l'Amour", 
                "Chansons sur la Vie", "Chansons Joyeuses", "Chansons Nostalgiques",
                "Énergie Pure", "Ambiance Douce", "Hits d'Été", "Ballades d'Hiver"
            ]
            
            random.shuffle(themes)
            selected_themes = themes[:count]
            
            categories_data = []
            for theme in selected_themes:
                # Randomly assign 3-10 songs to each category
                num_songs = random.randint(3, min(10, len(songs)))
                selected_songs = random.sample(songs, num_songs)
                
                categories_data.append({
                    "category_name": theme,
                    "category_id": str(uuid4()),
                    "song_ids": [song.id for song in selected_songs],
                    "is_new": True
                })
            
            return self.save_categories_to_db(categories_data)
    
    def categorize_by_release_year(self):
        """Categorize songs based on their release year, grouping them by decades"""
        with app.app_context():
            songs = self.get_all_songs()
            decades_songs = {}
            songs_without_year = []
            
            # Group songs by decade
            for song in songs:
                if song.release_year:
                    # Calculate the decade (1980, 1990, etc.)
                    decade = (song.release_year // 10) * 10
                    if decade not in decades_songs:
                        decades_songs[decade] = []
                    decades_songs[decade].append(song)
                else:
                    songs_without_year.append(song)
            
            # Create categories data for saving to DB
            categories_data = []
            
            # Create category for each decade with songs
            for decade, decade_songs in decades_songs.items():
                category_name = f"Années {decade}"
                logger.info(f"Creating category '{category_name}' with {len(decade_songs)} songs")
                
                # Check if the category already exists
                category = None
                with app.app_context():
                    category = Category.query.filter_by(name=category_name).first()
                
                # If category exists, use its ID; otherwise create a new UUID
                category_id = category.id if category else str(uuid4())
                
                categories_data.append({
                    "category_name": category_name,
                    "category_id": category_id,
                    "song_ids": [song.id for song in decade_songs],
                    "is_new": category is None
                })
            
            logger.info(f"Found {len(songs_without_year)} songs without release year")
            
            # Save all decade categories
            result = self.save_categories_to_db(categories_data)
            
            # Add additional stats
            result['total_songs'] = len(songs)
            result['songs_with_year'] = len(songs) - len(songs_without_year)
            result['songs_without_year'] = len(songs_without_year)
            result['decades'] = list(decades_songs.keys())
            
            return result
    
    def categorize_by_artist(self, min_songs=9):
        """Categorize songs based on their artist, creating categories for prolific artists
        
        Args:
            min_songs: Minimum number of songs an artist must have to get their own category
            
        Returns:
            dict: Results of the categorization operation
        """
        with app.app_context():
            songs = self.get_all_songs()
            
            # Group songs by artist
            artists_songs = {}
            for song in songs:
                if song.artist not in artists_songs:
                    artists_songs[song.artist] = []
                artists_songs[song.artist].append(song)
            
            # Filter for artists with at least min_songs
            qualified_artists = {
                artist: artist_songs 
                for artist, artist_songs in artists_songs.items() 
                if len(artist_songs) >= min_songs
            }
            
            if not qualified_artists:
                logger.info(f"No artists found with {min_songs}+ songs")
                return {
                    'total_songs': len(songs),
                    'artists_with_categories': 0,
                    'songs_categorized': 0,
                    'categories_created': 0,
                    'categories_reused': 0,
                    'associations_created': 0
                }
            
            logger.info(f"Found {len(qualified_artists)} artists with {min_songs}+ songs")
            
            # Create categories data for saving to DB
            categories_data = []
            
            # Create category for each artist with enough songs
            for artist, artist_songs in qualified_artists.items():
                category_name = f"{artist}"
                logger.info(f"Creating category '{category_name}' with {len(artist_songs)} songs")
                
                # Check if the category already exists
                category = None
                with app.app_context():
                    category = Category.query.filter_by(name=category_name).first()
                
                # If category exists, use its ID; otherwise create a new UUID
                category_id = category.id if category else str(uuid4())
                
                categories_data.append({
                    "category_name": category_name,
                    "category_id": category_id,
                    "song_ids": [song.id for song in artist_songs],
                    "is_new": category is None
                })
            
            # Save all artist categories
            result = self.save_categories_to_db(categories_data)
            
            # Add additional stats
            result['total_songs'] = len(songs)
            result['artists_with_categories'] = len(qualified_artists)
            result['songs_categorized'] = sum(len(songs) for songs in qualified_artists.values())
            
            return result
    
    def run_categorization(self, mode="ai", batch_size=10, random_categories=5, num_iterations=3, min_songs_per_artist=9):
        """Main method to run the categorization process"""
        if mode == "ai":
            # Get all songs instead of just uncategorized ones
            songs = self.get_all_songs()
            if not songs:
                logger.info("No songs found in the database")
                return
                
            logger.info(f"Found {len(songs)} total songs in the database")
            
            # Get initial existing categories
            existing_categories = self.get_all_categories()
            existing_categories = self.format_existing_categories(existing_categories)
            logger.info(f"Found {len(existing_categories)} existing categories")
            
            # Run multiple iterations with random batches
            # for i in range(num_iterations):
            for _ in tqdm(range(num_iterations), desc="AI iterations"):            
                
                # Get random batches
                random_batch = random.sample(songs, batch_size)
                
                # Process the batch with awareness of existing categories
                categories_data, existing_categories = self.process_songs_batch(random_batch, existing_categories)
                
                if categories_data:
                    
                    # Save after each iteration to make new categories available for next iterations
                    result = self.save_categories_to_db(categories_data)
                    logger.info(f"Iteration completed.")
                    logger.info(f"New categories created: {result['categories_created']}")
                    logger.info(f"Categories reused: {result['categories_reused']}")
                    logger.info(f"Song associations created: {result['associations_created']}")

            # Final summary
            logger.info(f"Categorization completed with {len(self.new_categories)} new categories created")
            for cat in self.new_categories:
                logger.info(f"- {cat['category_name']} ({cat['category_id']})")
                
        elif mode == "random":
            result = self.generate_random_categories(random_categories)
            logger.info(f"Random categorization completed: {result}")
        elif mode == "release_year":
            result = self.categorize_by_release_year()
            logger.info(f"Release year categorization completed.")
            logger.info(f"Songs processed: {result['total_songs']}")
            logger.info(f"Songs with release year: {result['songs_with_year']}")
            logger.info(f"Songs without release year: {result['songs_without_year']}")
            logger.info(f"Decades found: {', '.join(str(d) for d in sorted(result['decades']))}")
            logger.info(f"Categories created: {result['categories_created']}")
            logger.info(f"Categories reused: {result['categories_reused']}")
            logger.info(f"Song associations created: {result['associations_created']}")
        elif mode == "by_artist":
            result = self.categorize_by_artist(min_songs=min_songs_per_artist)
            logger.info(f"Artist categorization completed.")
            logger.info(f"Songs processed: {result['total_songs']}")
            logger.info(f"Artists with their own category: {result['artists_with_categories']}")
            logger.info(f"Songs added to artist categories: {result['songs_categorized']}")
            logger.info(f"Categories created: {result['categories_created']}")
            logger.info(f"Categories reused: {result['categories_reused']}")
            logger.info(f"Song associations created: {result['associations_created']}")
        else:
            logger.error(f"Unknown categorization mode: {mode}")


def main():
    """Main entry point for the script"""
    parser = argparse.ArgumentParser(description='AI-powered song categorization for NOPLP')
    
    parser.add_argument('--mode', choices=['ai', 'random', 'release_year', 'by_artist'], default='ai',
                       help='Categorization mode: "ai" uses Groq AI, "random" creates random categories, "release_year" groups by decade, "by_artist" groups by artist')
    parser.add_argument('--batch-size', type=int, default=10,
                       help='Number of songs to categorize in each AI batch')
    parser.add_argument('--random-categories', type=int, default=5,
                       help='Number of random categories to generate (only for random mode)')
    parser.add_argument('--iterations', type=int, default=3,
                       help='Number of iterations to run with different random batches')
    parser.add_argument('--min-songs', type=int, default=9,
                       help='Minimum number of songs an artist must have to get their own category (only for by_artist mode)')
    
    args = parser.parse_args()
    
    categorizer = SongCategorizer()
    categorizer.run_categorization(
        args.mode, 
        args.batch_size, 
        args.random_categories,
        args.iterations,
        args.min_songs
    )


if __name__ == "__main__":
    main()

