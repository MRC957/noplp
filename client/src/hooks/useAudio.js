import { useRef, useCallback, useEffect } from 'react';
import { SOUND_CONFIG } from '../constants/states';

// Create a stable container for audio elements
const audioContainer = document.createElement('div');
audioContainer.style.display = 'none';
document.body.appendChild(audioContainer);

// Create refs outside the hook
const createSoundRefs = () => {
  const refs = {};
  Object.entries(SOUND_CONFIG).forEach(([key, config]) => {
    const audio = new Audio();
    audio.src = config.path;
    audio.loop = config.loop;
    audio.preload = 'auto';
    audioContainer.appendChild(audio);
    
    refs[key] = {
      ref: { current: audio },
      ...config,
    };
  });
  return refs;
};

const soundRefs = createSoundRefs();

export const useAudio = () => {
  // Track current playing sound
  const currentSound = useRef(null);

  const stopCurrentSound = useCallback(() => {
    if (currentSound.current) {
      const audio = soundRefs[currentSound.current]?.ref.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      currentSound.current = null;
    }
  }, []);

  const playSound = useCallback((sound) => {
    if (!sound) {
      stopCurrentSound();
      return;
    }

    // If same sound is already playing, do nothing
    if (currentSound.current === sound) {
      return;
    }

    // Stop current sound immediately
    stopCurrentSound();

    // Play new sound
    const audioRef = soundRefs[sound]?.ref.current;
    if (audioRef) {
      audioRef.volume = soundRefs[sound].volume;
      audioRef.loop = soundRefs[sound].loop;
      audioRef.currentTime = 0;
      audioRef.play().catch(error => {
        console.error(`Error playing ${sound}:`, error);
      });
      currentSound.current = sound;
    }
  }, [stopCurrentSound]);

  // No need for AudioElements component anymore
  return { playSound };

  // Clean up on app unmount (if needed)
  useEffect(() => {
    return () => {
      // Only do this when the app truly unmounts
      Object.values(soundRefs).forEach(({ ref }) => {
        if (ref.current) {
          ref.current.pause();
          ref.current.remove();
        }
      });
      audioContainer.remove();
    };
  }, []);
}; 