import React from 'react';
import './LyricsSelector.css';

const LyricsSelector = ({ 
    show, 
    songId,
    allLyrics,
    selectedLyricIndex,
    isLoading,
    onLyricSelect,
    onClose
}) => {
    if (!show) return null;

    return (
        <div className="lyrics-selector-panel">
            <div className="lyrics-selector-header">
                <h3>
                    Select Lyrics to Guess
                    {isLoading && <span className="loading-indicator"> Loading...</span>}
                </h3>
                <button 
                    onClick={onClose}
                    className="close-button"
                >
                    ✕
                </button>
            </div>
            
            {isLoading ? (
                <div className="lyrics-loading">Loading lyrics...</div>
            ) : allLyrics.length === 0 ? (
                <div className="lyrics-empty">No lyrics available for this song</div>
            ) : (
                <div className="lyrics-list">
                    {allLyrics.map((lyric, index) => {
                        // Format the time for display
                        const timeInSeconds = Math.floor(lyric.startTimeMs / 1000);
                        const minutes = Math.floor(timeInSeconds / 60);
                        const seconds = timeInSeconds % 60;
                        const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                        
                        // Count words in this lyric
                        const wordCount = lyric.word_count;
                        
                        // Check if this is the currently selected lyric
                        const isSelected = index === selectedLyricIndex;
                        
                        return (
                            <div 
                                key={`lyric-${index}`}
                                className={`lyric-item ${isSelected ? 'selected' : ''}`}
                                onClick={() => onLyricSelect(index)}
                            >
                                <div className="lyric-time">{formattedTime}</div>
                                <div className="lyric-content">{lyric.words}</div>
                                <div className="lyric-word-count">({wordCount} words)</div>
                            </div>
                        );
                    })}
                </div>
            )}
            
            <div className="lyrics-selector-footer">
                <button 
                    onClick={onClose}
                    className="finish-button"
                >
                    Done
                </button>
            </div>
        </div>
    );
};

export default LyricsSelector;