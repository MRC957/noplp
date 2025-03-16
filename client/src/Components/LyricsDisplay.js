import React from "react";
import TextBox from "./TextBox";
import "./Song.css";

// Import lyric state constants from the unified constants file
import {
  LYRICS_STATES,
  STATE_LYRICS_NONE,
  STATE_LYRICS_SUGGESTED,
  STATE_LYRICS_FROZEN,
  STATE_LYRICS_VALIDATE,
  STATE_LYRICS_REVEAL,
  STATE_LYRICS_CONTINUE
} from '../constants/states';

const LyricsDisplay = ({ 
  lyrics, 
  lyricsToGuess, 
  currentLyricIndex, 
  revealedLyrics,
  suggestedLyrics,
  isLoading,
  error,
  isPaused
}) => {
  
  // Display loading message while fetching lyrics
  if (isLoading) {
    return <TextBox className="lyrics-container"><div className="lyrics-loading">Loading lyrics...</div></TextBox>;
  }
  
  // Display error message if something went wrong
  if (error) {
    return <TextBox className="lyrics-container"><div className="lyrics-error">{error}</div></TextBox>;
  }
  
  // Display empty message if no lyrics are available
  if (!lyrics || lyrics.length === 0) {
    return <TextBox className="lyrics-container"><div className="lyrics-empty">No lyrics available</div></TextBox>;
  }
  
  // Find visible lyrics range for smooth scrolling effect
  // We show a window of lines before and after the current line
  const visibleWindow = 2;
  const startIdx = Math.max(0, currentLyricIndex - visibleWindow);
  const endIdx = Math.min(lyrics.length - 1, currentLyricIndex + visibleWindow);
  
  const visibleLyrics = [];
  for (let i = startIdx; i <= endIdx; i++) {
    const line = lyrics[i];
    if (!line) continue;
    
    // Check if this line has lyrics to guess
    const guessEntry = lyricsToGuess.find(g => g.startTimeMs === line.startTimeMs);
    
    // Determine if this is the active line that's currently being displayed/guessed
    const isActive = i === currentLyricIndex;
    
    visibleLyrics.push(
      <div 
        key={i} 
        className={`lyrics-line ${isActive ? 'active' : ''}`}
      >
        {processLyricLine(line, guessEntry, suggestedLyrics, isPaused, revealedLyrics, isActive)}
      </div>
    );
  }

  return (
    <TextBox className="lyrics-container">
      <h3 className="lyrics-header"></h3>
      <div className="lyrics-scroll-area">
        {visibleLyrics}
      </div>
    </TextBox>
  );
};

// Process and render a single line of lyrics with the appropriate styling
const processLyricLine = (line, guessEntry, suggestedLyrics, isPaused, revealedLyrics, isActive) => {
  // If no guess entry for this line, just show the regular lyrics
  if (!guessEntry) {
    return <span>{line.words}</span>;
  }
  
  // Get original words that need to be guessed
  const originalWords = guessEntry.words || '';
  // Extract text parts before and after the words to guess
  const beforeText = line.words.substring(0, line.words.indexOf(originalWords));
  const afterText = line.words.substring(line.words.indexOf(originalWords) + originalWords.length);
  
  // If this line is active and we're paused for guessing and we have suggested lyrics
  if (isActive && isPaused && suggestedLyrics && suggestedLyrics.state !== STATE_LYRICS_NONE) {
    // Handle different states of suggested lyrics
    switch (suggestedLyrics.state) {
      case STATE_LYRICS_SUGGESTED:
        // Show the user's suggested lyrics
        return (
          <>
            {beforeText}
            <span className="lyrics-word">
              {suggestedLyrics.content}
            </span>
            {afterText}
          </>
        );
      
      case STATE_LYRICS_FROZEN:
        // Show the suggested lyrics as frozen (user can't change them anymore)
        return (
          <>
            {beforeText}
            <span className="lyrics-word freeze">
              {suggestedLyrics.content}
            </span>
            {afterText}
          </>
        );
      
      case STATE_LYRICS_VALIDATE:
        // Compare suggested words with correct words for validation
        const suggestedWords = suggestedLyrics.content.split(/\s+/);
        const correctWords = originalWords.split(/\s+/);
        
        return (
          <>
            {beforeText}
            {suggestedWords.map((word, index) => {
              // Check if each word is correct (case insensitive comparison)
              const isCorrect = index < correctWords.length && 
                          word.toLowerCase() === correctWords[index].toLowerCase();
              return (
                <span key={index} className={`lyrics-word ${isCorrect ? 'good' : 'bad'}`}>
                  {word}{index < suggestedWords.length - 1 ? ' ' : ''}
                </span>
              );
            })}
            {afterText}
          </>
        );
      
      case STATE_LYRICS_REVEAL:
      case STATE_LYRICS_CONTINUE:
        // Show the correct lyrics after reveal/continue
        return (
          <>
            {beforeText}
            <span className="lyrics-word good">
              {originalWords}
            </span>
            {afterText}
          </>
        );
      
      default:
        break;
    }
  }

  // Check if this lyric has been revealed via continue state
  if (revealedLyrics.includes(line.startTimeMs)) {
    return (
      <>
        {beforeText}
        <span className="lyrics-word shown">
          {originalWords}
        </span>
        {afterText}
      </>
    );
  }
  
  // Default behavior - show placeholder for words to guess
  const wordCount = guessEntry.word_count || 1;
  const placeholder = '_ '.repeat(wordCount);
  
  // If we're at the current active line and paused, make sure to highlight the placeholder
  const placeholderClass = isActive && isPaused ? 'lyrics-word' : '';
  
  return (
    <>
      {beforeText}
      <span className={placeholderClass}>{placeholder}</span>
      {afterText}
    </>
  );
};

export default LyricsDisplay;