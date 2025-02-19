import React, { useState, useEffect } from "react";
import { useSocket } from '../hooks/useSocket';
import { useAudio } from '../hooks/useAudio';
import { STATES } from '../constants/states';
import Background from "./Background";
import Categories from "./Categories";
import Logo from "./Logo";
import Song, { STATE_LYRICS_FROZEN, STATE_LYRICS_NONE, STATE_LYRICS_VALIDATE, 
  STATE_LYRICS_SUGGESTED, STATE_LYRICS_REVEAL } from "./Song";
import SongList from "./SongList";

const COMPONENT_SOUNDS = {
  [STATES.INTRO]: 'intro',
  [STATES.SONGLIST]: 'bed',
  [STATES.CATEGORIES]: 'bed',
  [STATES.LOADING]: '',
  [STATES.SONG]: '',
};

const TerminalComponent = () => {
  const [state, setState] = useState({
    current: STATES.LOADING,
    suggestedLyrics: {
      content: '',
      state: STATE_LYRICS_NONE,
    },
    payload: {},
    backgroundType: '',
    perfMode: false,
  });

  const { socket } = useSocket();
  const { playSound } = useAudio();

  const handleFlashColor = (color) => {
    setState(prev => ({ ...prev, backgroundType: color }));
  };

  const switchTo = (action, payload = {}) => {
    setState(prev => {
      if (prev.current !== action) {
        const soundToPlay = COMPONENT_SOUNDS[action];
        if (soundToPlay) {
          playSound(soundToPlay);
        }
      }

      return {
        ...prev,
        payload,
        current: action,
        backgroundType: '',
        suggestedLyrics: {
          content: '',
          state: STATE_LYRICS_NONE,
        }
      };
    });
  };

  const handleSuggestedLyrics = (lyricsState, payload) => {
    if (state.current !== STATES.SONG) return;
    
    setState(prev => ({
      ...prev,
      suggestedLyrics: {
        content: lyricsState === STATE_LYRICS_SUGGESTED ? payload : prev.suggestedLyrics.content,
        state: lyricsState,
      },
    }));
  };

  useEffect(() => {
    if (!socket) return;

    socket.on('to-intro', () => {
      switchTo(STATES.INTRO);
    });

    socket.on('to-song-list', (data) => {
      switchTo(STATES.SONGLIST, data);
    });

    socket.on('to-song', (data) => {
      switchTo(STATES.SONG, data);
    });

    socket.on('to-categories', async (data) => {
      switchTo(STATES.CATEGORIES, data);
    });

    socket.on('show-suggested-lyrics', data => {
      handleSuggestedLyrics(STATE_LYRICS_SUGGESTED, data);
    });

    socket.on('freeze-lyrics', () => {
      handleSuggestedLyrics(STATE_LYRICS_FROZEN, '');
    });

    socket.on('validate-lyrics', () => {
      handleSuggestedLyrics(STATE_LYRICS_VALIDATE, '');
    });

    socket.on('reveal-lyrics', () => {
      handleSuggestedLyrics(STATE_LYRICS_REVEAL, '');
    });

    socket.on('set-perf-mode', data => {
      setState(prev => ({ ...prev, perfMode: data }));
    });

    return () => {
      socket.removeAllListeners();
    };
  }, [socket]);

  const renderContent = () => {
    switch (state.current) {
      case STATES.LOADING:
        return (
          <div className="waiting">
            <div>Attente de la régie</div>
            <div className="lds-ellipsis"><div></div><div></div><div></div><div></div></div>
          </div>
        );
      case STATES.INTRO:
        return <Logo />;
      case STATES.SONGLIST:
        return (
          <SongList 
            title={state.payload.name} 
            songs={state.payload.songs} 
          />
        );
      case STATES.SONG:
        return (
          <Song 
            colorFlash={handleFlashColor}
            song={state.payload}
            suggestedLyrics={state.suggestedLyrics}
            jukebox={playSound}
          />
        );
      case STATES.CATEGORIES:
        return (
          <Categories 
            categories={state.payload} 
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      {state.current !== STATES.LOADING && (
        <Background effect={state.backgroundType} perfMode={state.perfMode} />
      )}
      <div>
        {renderContent()}
      </div>
    </>
  );
};

export default TerminalComponent;
