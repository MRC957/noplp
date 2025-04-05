/**
 * LyricsSelector Component
 * 
 * A panel that allows users to manually select specific lyrics to use for guessing.
 * This component displays a list of available lyrics for a song, showing the timestamp,
 * content, and word count for each lyric. The user can click on a lyric to select it.
 * 
 * The component is conditionally rendered based on the "show" prop and displays a 
 * loading indicator when lyrics are being fetched.
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.show - Controls whether the selector panel is visible
 * @param {string} props.songId - ID of the current song
 * @param {Array} props.allLyrics - Array of all available lyrics for the song
 * @param {number} props.selectedLyricIndex - Index of the currently selected lyric
 * @param {boolean} props.isLoading - Whether lyrics are currently being loaded
 * @param {Function} props.onLyricSelect - Handler function called when a lyric is selected
 * @param {Function} props.onClose - Handler function called when the panel is closed
 * @returns {JSX.Element|null} A panel with selectable lyrics or null if not shown
 */
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
    // Don't render anything if the panel shouldn't be shown
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
            
            {/* Show appropriate content based on loading state and available lyrics */}
            {isLoading ? (
                <div className="lyrics-loading">Loading lyrics...</div>
            ) : allLyrics.length === 0 ? (
                <div className="lyrics-empty">No lyrics available for this song</div>
            ) : (
                <div className="lyrics-list">
                    {allLyrics.map((lyric, index) => {
                        // Format the time for display (convert from milliseconds to mm:ss format)
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