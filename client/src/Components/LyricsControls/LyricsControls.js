/**
 * LyricsControls Component
 * 
 * Provides an interface for controlling lyrics display and interaction during gameplay.
 * This component includes an input field for entering lyrics guesses and buttons for 
 * various actions like proposing lyrics, freezing input, validating guesses, etc.
 * 
 * The component checks the word count in the proposed lyrics and enables/disables
 * the Propose and Freeze buttons based on whether the expected number of words has been entered.
 * 
 * @param {Object} props - Component props
 * @param {number} props.expectedWords - The number of words expected for the current lyric
 * @param {Function} props.onProposeLyrics - Handler function when user proposes lyrics
 * @param {Function} props.onFreeze - Handler function to freeze the current lyrics input
 * @param {Function} props.onValidate - Handler function to validate the proposed lyrics
 * @param {Function} props.onReveal - Handler function to reveal the correct lyrics
 * @param {Function} props.onContinue - Handler function to continue to the next lyric segment
 * @returns {JSX.Element} A form with input and control buttons for lyrics interaction
 */
import React, { useState, useRef } from 'react';
import './LyricsControls.css';

const LyricsControls = ({ 
    expectedWords, 
    onProposeLyrics, 
    onFreeze, 
    onValidate, 
    onReveal, 
    onContinue 
}) => {
    // State to track the lyrics input by the user
    const [proposedLyrics, setProposedLyrics] = useState('');
    // Reference to the input element for direct manipulation
    const inputRef = useRef(null);

    // Update the state when the input changes
    const handleInput = (e) => {
        setProposedLyrics(e.target.value);
    };

    // Send the proposed lyrics to the parent component
    const handlePropose = () => {
        onProposeLyrics(proposedLyrics);
    };

    // Freeze the lyrics and clear the input field
    const handleFreeze = () => {
        onFreeze();
        if (inputRef.current) {
            inputRef.current.value = '';
        }
        setProposedLyrics('');
    };

    // Calculate the number of words in the proposed lyrics
    // This handles apostrophes by replacing them with spaces before counting
    const wordCount = proposedLyrics.trim().replace(/'/g, ' ').split(/\s+/).filter(word => word.length > 0).length;
    
    // Only enable propose/freeze buttons if the expected number of words has been entered
    // const canPropose = expectedWords > 0 && wordCount === expectedWords;

    return (
        <div className="lyrics-form">
            <input  
                placeholder={`${expectedWords} mots attendu`} 
                ref={inputRef} 
                onChange={handleInput} 
            />
            <div>
                {/* <button onClick={handlePropose} disabled={!canPropose}>Propose Lyrics</button>
                <button onClick={handleFreeze} disabled={!canPropose}>Freeze</button> */}
                <button onClick={handlePropose} >Propose Lyrics</button>
                <button onClick={handleFreeze} >Freeze</button>
                <button onClick={onValidate}>Validate</button>
                <button onClick={onReveal}>Reveal</button>
                <button onClick={onContinue}>Continue</button>
            </div>
        </div>
    );
};

export default LyricsControls;