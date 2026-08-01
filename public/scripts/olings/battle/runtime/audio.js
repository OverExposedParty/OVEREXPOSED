(function () {
  const defaultAttackSoundDefinitions = Object.freeze({
    olingAttackHitNormal: {
      src: '/sounds/olings/battles/attacks/hit-normal/default.wav',
      group: 'ui',
      volume: 1,
      preload: true,
      cooldown: 40,
      maxInstances: 4,
      lane: 'independent'
    },
    olingAttackHitCrit: {
      src: '/sounds/olings/battles/attacks/hit-crit/crit-hit.wav',
      group: 'ui',
      volume: 1,
      preload: true,
      cooldown: 40,
      maxInstances: 4,
      lane: 'independent'
    },
    olingAttackMiss: {
      src: '/sounds/olings/battles/attacks/miss/default.wav',
      group: 'ui',
      volume: 1,
      preload: true,
      cooldown: 40,
      maxInstances: 4,
      lane: 'independent'
    },
    olingAttackStun: {
      src: '/sounds/olings/battles/attacks/stun/default.wav',
      group: 'ui',
      volume: 1,
      preload: true,
      cooldown: 40,
      maxInstances: 4,
      lane: 'independent'
    }
  });
  const defaultAttackSoundSources = Object.fromEntries(
    Object.entries(defaultAttackSoundDefinitions).map(([key, definition]) => [
      key,
      definition.src
    ])
  );

  function registerOlingBattleSounds() {
    if (!window.OEAudio?.register) return;

    window.OEAudio.register(defaultAttackSoundDefinitions).catch((error) => {
      console.error('Failed to register Oling battle attack sounds:', error);
    });
  }

  function getAttackSoundKey(result) {
    const normalizedResult = String(result || '')
      .trim()
      .toLowerCase();

    if (normalizedResult === 'critical hit') return 'olingAttackHitCrit';
    if (normalizedResult === 'hit') return 'olingAttackHitNormal';
    if (normalizedResult === 'miss') return 'olingAttackMiss';
    if (normalizedResult === 'stun') return 'olingAttackStun';
    return null;
  }

  function areFallbackSoundsEnabled() {
    try {
      return localStorage.getItem('settings-sound') !== 'false';
    } catch (_error) {
      return true;
    }
  }

  function playOlingBattleAttackSound(result) {
    const soundKey = getAttackSoundKey(result);
    if (!soundKey) return;
    window.debugLog?.('[Oling battle audio] playing attack sound', {
      result,
      soundKey
    });

    if (typeof window.playSoundEffect === 'function') {
      Promise.resolve(window.playSoundEffect(soundKey)).catch((error) => {
        console.error('Failed to play Oling battle attack sound:', error);
      });
      return;
    }

    if (!areFallbackSoundsEnabled()) return;

    const src = defaultAttackSoundSources[soundKey];
    if (!src) return;
    if (/jsdom/i.test(navigator.userAgent || '')) return;

    const audio = new Audio(src);
    audio.volume = defaultAttackSoundDefinitions[soundKey].volume;
    try {
      const playPromise = audio.play();
      if (playPromise?.catch) {
        playPromise.catch((error) => {
          console.error('Failed to play Oling battle attack sound:', error);
        });
      }
    } catch (error) {
      console.error('Failed to play Oling battle attack sound:', error);
    }
  }

  function createOlingBattleAudio() {
    return {
      playOlingBattleAttackSound,
      registerOlingBattleSounds
    };
  }

  window.createOlingBattleAudio = createOlingBattleAudio;
})();
