(function initialisePartyGameSounds() {
  const MAX_REMEMBERED_EVENTS = 100;
  const TIMER_WARNING_START_MS = 10000;
  const TIMER_WARNING_MEDIUM_MS = 5000;
  const TIMER_WARNING_FAST_MS = 3000;
  const TIMER_WARNING_INTERVALS = Object.freeze({
    slow: 800,
    medium: 500,
    fast: 250
  });
  const soundKeys = Object.freeze({
    gameStart: 'partyGameGameStart',
    roundStart: 'partyGameRoundStart',
    yourTurn: 'partyGameYourTurn',
    resultsReveal: 'partyGameResultsReveal',
    punishmentStart: 'partyGamePunishmentStart',
    punishmentReveal: 'partyGamePunishmentReveal',
    playerPassed: 'partyGamePlayerPassed',
    playerSelect: 'partyGamePlayerSelect',
    choiceMenuOpen: 'partyGameChoiceMenuOpen',
    waitingForPlayersOpen: 'partyGameWaitingForPlayersOpen',
    playerConfirmed: 'partyGamePlayerConfirmed',
    actionConfirmed: 'partyGameActionConfirmed',
    truthSelected: 'partyGameTruthSelected',
    dareSelected: 'partyGameDareSelected',
    imposterFound: 'partyGameImposterFound',
    imposterWins: 'partyGameImposterWins',
    timerTick: 'partyGameTimerTick',
    timerTock: 'partyGameTimerTock',
    timerExpired: 'partyGameTimerExpired',
    gameComplete: 'partyGameGameComplete',
    gameOver: 'partyGameGameOver',
    wheelSpin: 'partyGameWheelSpin'
  });
  const soundDefinitions = Object.freeze({
    partyGameGameStart: {
      src: '/sounds/party-games/shared/game-start.wav',
      group: 'party-games',
      preload: true,
      cooldown: 500,
      maxInstances: 1,
      priority: 'phase',
      conflictPolicy: 'queue-latest'
    },
    partyGameRoundStart: {
      src: '/sounds/party-games/shared/round-start.wav',
      group: 'party-games',
      preload: true,
      cooldown: 500,
      maxInstances: 1,
      priority: 'phase',
      conflictPolicy: 'queue-latest'
    },
    partyGameYourTurn: {
      src: '/sounds/party-games/shared/your-turn.wav',
      group: 'party-games',
      preload: true,
      cooldown: 500,
      maxInstances: 1,
      priority: 'phase',
      conflictPolicy: 'queue-latest'
    },
    partyGameResultsReveal: {
      src: '/sounds/party-games/shared/results-reveal.wav',
      group: 'party-games',
      preload: true,
      cooldown: 500,
      maxInstances: 1,
      priority: 'phase',
      conflictPolicy: 'queue-latest'
    },
    partyGamePunishmentStart: {
      src: '/sounds/party-games/shared/punishment-start.wav',
      group: 'party-games',
      preload: true,
      cooldown: 500,
      maxInstances: 1,
      priority: 'phase',
      conflictPolicy: 'queue-latest'
    },
    partyGamePunishmentReveal: {
      src: '/sounds/party-games/shared/punishment-reveal.wav',
      group: 'party-games',
      preload: true,
      cooldown: 500,
      maxInstances: 1,
      priority: 'phase',
      conflictPolicy: 'queue-latest'
    },
    partyGamePlayerPassed: {
      src: '/sounds/party-games/paranoia/player-passed.wav',
      group: 'party-games',
      preload: true,
      cooldown: 500,
      maxInstances: 1,
      priority: 'phase',
      conflictPolicy: 'queue-latest'
    },
    partyGamePlayerSelect: {
      src: '/sounds/party-games/shared/player-select.wav',
      group: 'party-games',
      preload: true,
      cooldown: 150,
      maxInstances: 1,
      priority: 'phase',
      conflictPolicy: 'interrupt'
    },
    partyGameChoiceMenuOpen: {
      src: '/sounds/party-games/shared/choice-menu-open.wav',
      group: 'party-games',
      preload: true,
      cooldown: 150,
      maxInstances: 1,
      priority: 'phase',
      conflictPolicy: 'interrupt'
    },
    partyGameWaitingForPlayersOpen: {
      src: '/sounds/party-games/shared/waiting-for-players/open.wav',
      group: 'party-games',
      preload: true,
      cooldown: 150,
      maxInstances: 1,
      priority: 'phase',
      conflictPolicy: 'interrupt'
    },
    partyGamePlayerConfirmed: {
      src: '/sounds/party-games/shared/waiting-for-players/player-confirmed.wav',
      group: 'party-games',
      preload: true,
      cooldown: 150,
      maxInstances: 1,
      priority: 'confirmation',
      conflictPolicy: 'interrupt'
    },
    partyGameActionConfirmed: {
      src: '/sounds/party-games/shared/action-confirmed.wav',
      group: 'party-games',
      preload: true,
      cooldown: 150,
      maxInstances: 1,
      priority: 'confirmation',
      conflictPolicy: 'interrupt',
      interruptible: false
    },
    partyGameTruthSelected: {
      src: '/sounds/party-games/truth-or-dare/truth.wav',
      group: 'party-games',
      preload: true,
      cooldown: 500,
      maxInstances: 1,
      priority: 'voice',
      conflictPolicy: 'queue-latest',
      interruptible: false
    },
    partyGameDareSelected: {
      src: '/sounds/party-games/truth-or-dare/dare.wav',
      group: 'party-games',
      preload: true,
      cooldown: 500,
      maxInstances: 1,
      priority: 'voice',
      conflictPolicy: 'queue-latest',
      interruptible: false
    },
    partyGameImposterFound: {
      src: '/sounds/party-games/imposter/imposter-found.wav',
      group: 'party-games',
      preload: true,
      cooldown: 500,
      maxInstances: 1,
      priority: 'phase',
      conflictPolicy: 'interrupt'
    },
    partyGameImposterWins: {
      src: '/sounds/party-games/imposter/imposter-wins.wav',
      group: 'party-games',
      preload: true,
      cooldown: 500,
      maxInstances: 1,
      priority: 'phase',
      conflictPolicy: 'interrupt'
    },
    partyGameTimerTick: {
      src: '/sounds/party-games/shared/timer/tick.wav',
      group: 'party-games',
      preload: true,
      cooldown: 40,
      maxInstances: 1,
      priority: 'timerWarning',
      conflictPolicy: 'drop'
    },
    partyGameTimerTock: {
      src: '/sounds/party-games/shared/timer/tock.wav',
      group: 'party-games',
      preload: true,
      cooldown: 40,
      maxInstances: 1,
      priority: 'timerWarning',
      conflictPolicy: 'drop'
    },
    partyGameTimerExpired: {
      src: '/sounds/party-games/shared/timer/expired.wav',
      group: 'party-games',
      preload: true,
      cooldown: 500,
      maxInstances: 1,
      priority: 'timerExpired',
      conflictPolicy: 'interrupt'
    },
    partyGameGameComplete: {
      src: '/sounds/party-games/shared/game-complete.wav',
      group: 'party-games',
      preload: true,
      cooldown: 1000,
      maxInstances: 1,
      priority: 'critical',
      conflictPolicy: 'interrupt',
      interruptible: false,
      forceInterrupt: true,
      clearQueue: true
    },
    partyGameGameOver: {
      src: '/sounds/party-games/shared/game-over.wav',
      group: 'party-games',
      preload: true,
      cooldown: 1000,
      maxInstances: 1,
      priority: 'critical',
      conflictPolicy: 'interrupt',
      interruptible: false,
      forceInterrupt: true,
      clearQueue: true
    },
    partyGameWheelSpin: {
      src: '/sounds/party-games/shared/wheel-spin.wav',
      group: 'party-games',
      maxInstances: 1,
      priority: 'normal',
      conflictPolicy: 'queue-latest'
    }
  });
  const activeLoops = new Map();
  const playedEventIds = new Set();
  const playedEventQueue = [];
  let activeTimerWarning = null;

  function resolveSoundKey(eventName) {
    return soundKeys[eventName] || eventName;
  }

  function rememberEvent(eventName, eventId) {
    const key = `${eventName}:${eventId}`;
    if (playedEventIds.has(key)) return false;

    playedEventIds.add(key);
    playedEventQueue.push(key);

    if (playedEventQueue.length > MAX_REMEMBERED_EVENTS) {
      playedEventIds.delete(playedEventQueue.shift());
    }

    return true;
  }

  function play(eventName, options = {}) {
    if (!eventName || typeof window.OEAudio?.play !== 'function') {
      return Promise.resolve(null);
    }

    const { eventId: _eventId, soundKey, ...audioOptions } = options;
    return window.OEAudio.play(
      soundKey || resolveSoundKey(eventName),
      audioOptions
    );
  }

  function playOnce(eventName, options = {}) {
    const { eventId, ...audioOptions } = options;
    if (eventId === undefined || eventId === null || eventId === '') {
      return eventName === 'gameComplete'
        ? playGameOverSequence(audioOptions)
        : play(eventName, audioOptions);
    }

    if (!rememberEvent(eventName, String(eventId))) {
      return Promise.resolve(null);
    }

    return eventName === 'gameComplete'
      ? playGameOverSequence(audioOptions)
      : play(eventName, audioOptions);
  }

  function playSequence(eventNames, options = {}) {
    if (
      !Array.isArray(eventNames) ||
      eventNames.length === 0 ||
      typeof window.OEAudio?.playSequence !== 'function'
    ) {
      return Promise.resolve(null);
    }

    const soundSequence = eventNames.map((eventName) =>
      resolveSoundKey(eventName)
    );
    return window.OEAudio.playSequence(soundSequence, options);
  }

  function playGameOverSequence(options = {}) {
    return playSequence(['gameComplete', 'gameOver'], {
      priority: 'critical',
      conflictPolicy: 'interrupt',
      interruptible: false,
      forceInterrupt: true,
      clearQueue: true,
      ...options
    });
  }

  async function playLoop(eventName, options = {}) {
    stop(eventName);

    const playback = await play(eventName, {
      ...options,
      loop: true,
      maxInstances: 1
    });

    if (playback) {
      activeLoops.set(eventName, playback);
    }

    return playback;
  }

  function stop(eventName) {
    const playback = activeLoops.get(eventName);
    if (!playback) return;

    playback.stop?.();
    activeLoops.delete(eventName);
  }

  function getDeadlineMs(deadline) {
    if (deadline instanceof Date) {
      const dateValue = deadline.getTime();
      return Number.isFinite(dateValue) ? dateValue : null;
    }
    if (typeof deadline === 'number') {
      return Number.isFinite(deadline) ? deadline : null;
    }

    const parsedDeadline = new Date(deadline).getTime();
    return Number.isFinite(parsedDeadline) ? parsedDeadline : null;
  }

  function getTimerWarningInterval(remainingMs) {
    if (remainingMs < TIMER_WARNING_FAST_MS) {
      return TIMER_WARNING_INTERVALS.fast;
    }
    if (remainingMs <= TIMER_WARNING_MEDIUM_MS) {
      return TIMER_WARNING_INTERVALS.medium;
    }
    return TIMER_WARNING_INTERVALS.slow;
  }

  function isPageHidden() {
    return typeof document !== 'undefined' && document.hidden === true;
  }

  function clearTimerWarningTimeout(timer = activeTimerWarning) {
    if (!timer || timer.timeoutId === null) return;

    window.clearTimeout(timer.timeoutId);
    timer.timeoutId = null;
  }

  function stopTimerWarning() {
    if (!activeTimerWarning) return false;

    clearTimerWarningTimeout(activeTimerWarning);
    activeTimerWarning = null;
    return true;
  }

  function scheduleTimerWarning(timer, delayMs) {
    if (activeTimerWarning !== timer || isPageHidden()) return;

    clearTimerWarningTimeout(timer);
    timer.timeoutId = window.setTimeout(
      () => runTimerWarning(timer),
      Math.max(0, delayMs)
    );
  }

  function runTimerWarning(timer) {
    if (activeTimerWarning !== timer) return;

    timer.timeoutId = null;
    const remainingMs = timer.deadlineMs - Date.now();

    if (remainingMs <= 0) {
      const expiredEventId = `${timer.timerId}:expired`;
      const shouldPlayExpiredSound = timer.playExpiredSound !== false;
      stopTimerWarning();
      if (!shouldPlayExpiredSound) return;

      Promise.resolve(
        playOnce('timerExpired', { eventId: expiredEventId })
      ).catch(() => {});
      return;
    }

    if (isPageHidden()) return;

    if (remainingMs > TIMER_WARNING_START_MS) {
      scheduleTimerWarning(timer, remainingMs - TIMER_WARNING_START_MS);
      return;
    }

    Promise.resolve(play(timer.nextEventName)).catch(() => {});
    timer.nextEventName = timer.nextEventName === 'timerTick'
      ? 'timerTock'
      : 'timerTick';

    scheduleTimerWarning(
      timer,
      Math.min(getTimerWarningInterval(remainingMs), remainingMs)
    );
  }

  function startTimerWarning({ deadline, timerId, playExpiredSound = true } = {}) {
    const deadlineMs = getDeadlineMs(deadline);
    const remainingMs = deadlineMs === null ? 0 : deadlineMs - Date.now();

    if (deadlineMs === null || remainingMs <= 0) {
      stopTimerWarning();
      return false;
    }

    const resolvedTimerId = String(timerId ?? deadlineMs);
    if (
      activeTimerWarning?.timerId === resolvedTimerId &&
      activeTimerWarning.deadlineMs === deadlineMs
    ) {
      if (activeTimerWarning.timeoutId === null && !isPageHidden()) {
        scheduleTimerWarning(
          activeTimerWarning,
          Math.max(0, remainingMs - TIMER_WARNING_START_MS)
        );
      }
      return true;
    }

    stopTimerWarning();
    activeTimerWarning = {
      deadlineMs,
      timerId: resolvedTimerId,
      playExpiredSound,
      nextEventName: 'timerTick',
      timeoutId: null
    };

    scheduleTimerWarning(
      activeTimerWarning,
      Math.max(0, remainingMs - TIMER_WARNING_START_MS)
    );
    return true;
  }

  function handleTimerVisibilityChange() {
    const timer = activeTimerWarning;
    if (!timer) return;

    clearTimerWarningTimeout(timer);
    if (isPageHidden()) return;

    const remainingMs = timer.deadlineMs - Date.now();
    if (remainingMs <= 0) {
      stopTimerWarning();
      return;
    }

    scheduleTimerWarning(
      timer,
      Math.max(0, remainingMs - TIMER_WARNING_START_MS)
    );
  }

  function handleStateChange(previousState, nextState, options = {}) {
    if (options.initialise === true || !previousState || !nextState) {
      return Promise.resolve(null);
    }

    const previousPhase = previousState.phase ?? null;
    const nextPhase = nextState.phase ?? null;
    if (!nextPhase || previousPhase === nextPhase) {
      return Promise.resolve(null);
    }

    const eventName = options.phaseSounds?.[nextPhase];
    if (!eventName) return Promise.resolve(null);

    const eventId = options.eventId ?? `${nextPhase}:${nextState.roundNumber ?? ''}`;
    return playOnce(eventName, { eventId });
  }

  function reset() {
    stopTimerWarning();
    activeLoops.forEach((playback) => playback.stop?.());
    activeLoops.clear();
    playedEventIds.clear();
    playedEventQueue.length = 0;
  }

  window.PartyGameSounds = Object.freeze({
    play,
    playOnce,
    playSequence,
    playLoop,
    stop,
    startTimerWarning,
    stopTimerWarning,
    handleStateChange,
    reset
  });

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleTimerVisibilityChange);
  }

  if (typeof window.OEAudio?.register === 'function') {
    window.OEAudio.register(soundDefinitions);
  } else if (typeof waitForFunction === 'function') {
    waitForFunction('playSoundEffect', () => {
      window.OEAudio.register(soundDefinitions);
    });
  }

  if (typeof SetScriptLoaded === 'function') {
    SetScriptLoaded('/scripts/party-games/gamemode/online/general/party-game-sounds.js');
  }
})();
