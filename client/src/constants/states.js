// Application states
export const STATES = {
  LOADING: 'loading',
  INTRO: 'intro',
  SONGLIST: 'songlist',
  CATEGORIES: 'categories',
  SONG: 'song'
};

// Lyrics states
export const LYRICS_STATES = {
  NONE: 'none',
  SUGGESTED: 'suggested',
  FROZEN: 'frozen',
  VALIDATE: 'validate',
  REVEAL: 'reveal',
  CONTINUE: 'continue'
};

// Sound configuration
export const SOUND_CONFIG = {
  intro: { volume: 1, path: '/generique.mp3', loop: false },
  bed: { volume: 0.5, path: '/waiting.mp3', loop: true },
  good: { volume: 1, path: '/win.mp3', loop: false },
  freeze: { volume: 1, path: '/freeze.mp3', loop: false },
  bad: { volume: 1, path: '/loose.mp3', loop: false },
  introBed: { volume: 0.3, path: '/intro_bed.mp3', loop: true }
};

// For backward compatibility - legacy constants
export const STATE_LYRICS_NONE = LYRICS_STATES.NONE;
export const STATE_LYRICS_SUGGESTED = LYRICS_STATES.SUGGESTED; 
export const STATE_LYRICS_FROZEN = LYRICS_STATES.FROZEN;
export const STATE_LYRICS_VALIDATE = LYRICS_STATES.VALIDATE;
export const STATE_LYRICS_REVEAL = LYRICS_STATES.REVEAL;
export const STATE_LYRICS_CONTINUE = LYRICS_STATES.CONTINUE;