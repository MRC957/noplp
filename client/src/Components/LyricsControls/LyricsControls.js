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
    const [proposedLyrics, setProposedLyrics] = useState('');
    const inputRef = useRef(null);

    const handleInput = (e) => {
        setProposedLyrics(e.target.value);
    };

    const handlePropose = () => {
        onProposeLyrics(proposedLyrics);
    };

    const handleFreeze = () => {
        onFreeze();
        if (inputRef.current) {
            inputRef.current.value = '';
        }
        setProposedLyrics('');
    };

    // Check if proposal meets word count requirement
    const wordCount = proposedLyrics.trim().replace(/'/g, ' ').split(/\s+/).filter(word => word.length > 0).length;
    const canPropose = expectedWords > 0 && wordCount === expectedWords;

    return (
        <div className="lyrics-form">
            <input  
                placeholder={`${expectedWords} mots attendu`} 
                ref={inputRef} 
                onChange={handleInput} 
            />
            <div>
                <button onClick={handlePropose} disabled={!canPropose}>Propose Lyrics</button>
                <button onClick={handleFreeze} disabled={!canPropose}>Freeze</button>
                <button onClick={onValidate}>Validate</button>
                <button onClick={onReveal}>Reveal</button>
                <button onClick={onContinue}>Continue</button>
            </div>
        </div>
    );
};

export default LyricsControls;