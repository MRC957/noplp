/**
 * Lyrics utility functions for handling lyric comparisons and validations
 */

/**
 * Cleans text for comparison by:
 * - Converting to lowercase
 * - Replacing special characters with spaces
 * - Removing extra whitespace
 * 
 * @param {string} text - The text to clean
 * @returns {string} Cleaned text for comparison
 */
export const cleanTextForComparison = (text) => {
    if (!text) return '';
    return text.toLowerCase()
        .replace(/[^\p{L}\p{N}\s']|_/gu, ' ')  // Keep letters (including accented), numbers, spaces, apostrophes
        .replace(/\s+/g, ' ')         // Replace multiple spaces with single space
        .trim();                       // Remove leading/trailing whitespace
};

/**
 * Compare suggested lyrics with the correct lyrics
 * Returns both overall correctness and word-by-word comparison
 * 
 * @param {string} suggestedText - The lyrics suggested by the user
 * @param {string} correctText - The correct lyrics to guess
 * @returns {Object} Result with isCorrect flag and wordResults array
 */
export const compareLyrics = (suggestedText, correctText) => {
  // Clean both texts for comparison
  const cleanSuggested = cleanTextForComparison(suggestedText);
  const cleanCorrect = cleanTextForComparison(correctText);
  
  // Split into words for word-by-word comparison
  const suggestedWords = cleanSuggested.split(/\s+/).filter(w => w.length > 0);
  const correctWords = cleanCorrect.split(/\s+/).filter(w => w.length > 0);
  
  // Check exact match for overall correctness
  const isExactMatch = cleanSuggested === cleanCorrect;
  
  // Perform word-by-word comparison
  const wordResults = correctWords.map((correctWord, index) => {
    const suggestedWord = index < suggestedWords.length ? suggestedWords[index] : null;
    const isCorrect = suggestedWord && (suggestedWord.toLowerCase() === correctWord.toLowerCase());
    
    return {
      correct: correctWord,
      suggested: suggestedWord || '',
      isCorrect
    };
  });
  
  return {
    isCorrect: isExactMatch,
    wordResults
  };
};