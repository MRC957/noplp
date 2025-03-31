from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Column, Integer, String, ForeignKey, Text, Table, Float, DateTime, JSON, MetaData
from sqlalchemy.orm import relationship
import datetime
import logging

# Create a custom MetaData with the schema specified
metadata = MetaData(schema='karaoke')
db = SQLAlchemy(metadata=metadata)

# Association table for the many-to-many relationship between songs and categories
song_category = Table('song_category', db.Model.metadata,
    Column('song_id', String(255), ForeignKey('karaoke.songs.id'), primary_key=True),
    Column('category_id', String(255), ForeignKey('karaoke.categories.id'), primary_key=True)
)

class Song(db.Model):
    __tablename__ = 'songs'
    __table_args__ = {'schema': 'karaoke'}
    
    id = Column(String(255), primary_key=True)  # Spotify track_id
    artist = Column(String(255), nullable=False)
    title = Column(String(255), nullable=False)
    lyrics = Column(JSON, nullable=True)  # Store lyrics as JSON array of {startTimeMs, words}
    release_year = Column(Integer, nullable=True)  # Add this line to store release year
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    categories = relationship('Category', secondary=song_category, back_populates='songs')
    
    def __repr__(self):
        return f"<Song {self.title} by {self.artist}>"
    
    def to_dict(self):
        return {
            'id': self.id,
            'track_id': self.id,  # For backward compatibility
            'artist': self.artist,
            'title': self.title,
            'release_year': self.release_year,
            'categories': [category.id for category in self.categories],
            'lyrics': self.lyrics or []
        }

class Category(db.Model):
    __tablename__ = 'categories'
    __table_args__ = {'schema': 'karaoke'}
    
    id = Column(String(255), primary_key=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    songs = relationship('Song', secondary=song_category, back_populates='categories')
    
    def __repr__(self):
        return f"<Category {self.name}>"
    
    def to_dict(self, include_songs=False):
        result = {
            'id': self.id,
            'name': self.name
        }
        
        if include_songs:
            result['songs'] = [song.to_dict() for song in self.songs]
            
        return result

def init_db(app):
    """Initialize the database with the Flask app"""
    db.init_app(app)
    
    # Create all tables if they don't exist
    with app.app_context():
        # Ensure the schema exists
        # db.session.execute('CREATE SCHEMA IF NOT EXISTS karaoke')
        # db.session.commit()
        
        # Create tables
        db.create_all()
        logging.info("Database tables created in 'karaoke' schema")