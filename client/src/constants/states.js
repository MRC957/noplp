export const STATES = {
  LOADING: 'loading',
  INTRO: 'intro',
  SONGLIST: 'songlist',
  CATEGORIES: 'categories',
  SONG: 'song'
};

export const SOUND_CONFIG = {
  intro: { volume: 1, path: '/generique.mp3', loop: false },
  bed: { volume: 0.5, path: '/waiting.mp3', loop: true },
  good: { volume: 1, path: '/win.mp3', loop: false },
  freeze: { volume: 1, path: '/freeze.mp3', loop: false },
  bad: { volume: 1, path: '/loose.mp3', loop: false },
  introBed: { volume: 0.3, path: '/intro_bed.mp3', loop: true }
}; 