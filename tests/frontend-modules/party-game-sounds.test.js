const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const soundHelperPath = path.join(
  __dirname,
  '../../public/scripts/party-games/gamemode/online/general/party-game-sounds.js'
);
const soundHelperSource = fs.readFileSync(soundHelperPath, 'utf8');

function createSoundHelperContext() {
  let now = 100000;
  let nextTimeoutId = 1;
  const pendingTimeouts = new Map();
  const playedSounds = [];
  const playedSequences = [];
  let registeredDefinitions = null;
  const documentListeners = new Map();

  class FakeDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [now]));
    }

    static now() {
      return now;
    }
  }

  const document = {
    hidden: false,
    addEventListener(eventName, listener) {
      if (!documentListeners.has(eventName)) {
        documentListeners.set(eventName, []);
      }
      documentListeners.get(eventName).push(listener);
    }
  };
  const window = {
    OEAudio: {
      register(definitions) {
        registeredDefinitions = definitions;
        return Promise.resolve();
      },
      play(key) {
        playedSounds.push({ key, time: now });
        return Promise.resolve({ stop() {} });
      },
      playSequence(keys, options) {
        playedSequences.push({ keys, options });
        return Promise.resolve({ stop() {} });
      }
    },
    clearTimeout(timeoutId) {
      pendingTimeouts.delete(timeoutId);
    },
    setTimeout(callback, delay = 0) {
      const timeoutId = nextTimeoutId;
      nextTimeoutId += 1;
      pendingTimeouts.set(timeoutId, {
        callback,
        time: now + Math.max(0, Number(delay) || 0)
      });
      return timeoutId;
    }
  };
  window.window = window;

  const context = vm.createContext({
    Date: FakeDate,
    Promise,
    SetScriptLoaded() {},
    document,
    waitForFunction(name, callback) {
      if (typeof window[name] === 'function') callback();
    },
    window
  });
  vm.runInContext(soundHelperSource, context, {
    filename: soundHelperPath
  });

  function advanceTo(targetTime) {
    while (true) {
      const nextTimeout = [...pendingTimeouts.entries()]
        .filter(([, timeout]) => timeout.time <= targetTime)
        .sort((left, right) => left[1].time - right[1].time)[0];
      if (!nextTimeout) break;

      const [timeoutId, timeout] = nextTimeout;
      pendingTimeouts.delete(timeoutId);
      now = timeout.time;
      timeout.callback();
    }
    now = targetTime;
  }

  function setDocumentHidden(hidden) {
    document.hidden = hidden;
    documentListeners
      .get('visibilitychange')
      ?.forEach((listener) => listener());
  }

  return {
    advanceTo,
    getNow: () => now,
    pendingTimeouts,
    playedSounds,
    playedSequences,
    getRegisteredDefinitions: () => registeredDefinitions,
    setDocumentHidden,
    sounds: window.PartyGameSounds
  };
}

test('party game sounds register when OEAudio is already available', () => {
  const { getRegisteredDefinitions } = createSoundHelperContext();
  const definitions = getRegisteredDefinitions();

  assert.ok(definitions);
  assert.equal(
    definitions.partyGameRoundStart.src,
    '/sounds/party-games/shared/round-start.wav'
  );
  assert.equal(
    definitions.partyGameTimerTick.src,
    '/sounds/party-games/shared/timer/tick.wav'
  );
  assert.equal(
    definitions.partyGameActionConfirmed.src,
    '/sounds/party-games/shared/action-confirmed.wav'
  );
  assert.equal(
    definitions.partyGamePlayerPassed.src,
    '/sounds/party-games/paranoia/player-passed.wav'
  );
  assert.equal(
    definitions.partyGamePlayerSelect.src,
    '/sounds/party-games/shared/player-select.wav'
  );
  assert.equal(
    definitions.partyGameChoiceMenuOpen.src,
    '/sounds/party-games/shared/choice-menu-open.wav'
  );
  assert.equal(
    definitions.partyGameWaitingForPlayersOpen.src,
    '/sounds/party-games/shared/waiting-for-players/open.wav'
  );
  assert.equal(
    definitions.partyGamePlayerConfirmed.src,
    '/sounds/party-games/shared/waiting-for-players/player-confirmed.wav'
  );
  assert.equal(
    definitions.partyGamePunishmentReveal.src,
    '/sounds/party-games/shared/punishment-reveal.wav'
  );
  assert.equal(
    definitions.partyGameTruthSelected.src,
    '/sounds/party-games/truth-or-dare/truth.wav'
  );
  assert.equal(
    definitions.partyGameDareSelected.src,
    '/sounds/party-games/truth-or-dare/dare.wav'
  );
  assert.equal(
    definitions.partyGameImposterFound.src,
    '/sounds/party-games/imposter/imposter-found.wav'
  );
  assert.equal(
    definitions.partyGameImposterWins.src,
    '/sounds/party-games/imposter/imposter-wins.wav'
  );
  assert.equal(definitions.partyGameTimerTick.priority, 'timerWarning');
  assert.equal(definitions.partyGameTimerTick.conflictPolicy, 'drop');
  assert.equal(definitions.partyGameTruthSelected.priority, 'voice');
  assert.equal(definitions.partyGameTruthSelected.interruptible, false);
  assert.equal(definitions.partyGameActionConfirmed.interruptible, false);
  assert.equal(definitions.partyGameGameComplete.priority, 'critical');
  assert.equal(definitions.partyGameGameComplete.forceInterrupt, true);
  assert.equal(
    definitions.partyGameGameOver.src,
    '/sounds/party-games/shared/game-over.wav'
  );
  assert.equal(definitions.partyGameGameOver.priority, 'critical');
  assert.equal(definitions.partyGameGameOver.forceInterrupt, true);
});

test('action confirmed resolves to its shared audio key', async () => {
  const { playedSounds, sounds } = createSoundHelperContext();

  await sounds.play('actionConfirmed');

  assert.deepEqual(playedSounds, [{
    key: 'partyGameActionConfirmed',
    time: 100000
  }]);
});

test('player passed resolves to its Paranoia audio key', async () => {
  const { playedSounds, sounds } = createSoundHelperContext();

  await sounds.play('playerPassed');

  assert.deepEqual(playedSounds, [{
    key: 'partyGamePlayerPassed',
    time: 100000
  }]);
});

test('player select resolves to its shared audio key', async () => {
  const { playedSounds, sounds } = createSoundHelperContext();

  await sounds.play('playerSelect');

  assert.deepEqual(playedSounds, [{
    key: 'partyGamePlayerSelect',
    time: 100000
  }]);
});

test('choice menu open resolves to its shared audio key', async () => {
  const { playedSounds, sounds } = createSoundHelperContext();

  await sounds.play('choiceMenuOpen');

  assert.deepEqual(playedSounds, [{
    key: 'partyGameChoiceMenuOpen',
    time: 100000
  }]);
});

test('non-player choice menus opt into the shared choice-menu sound', () => {
  const templateDirectory = path.join(
    __dirname,
    '../../public/html-templates/online/party-games/selected-user-containers'
  );
  const expectations = [
    ['would-you-rather-template.html', 'select-option-container'],
    ['never-have-i-ever-template.html', 'select-option-container'],
    ['truth-or-dare-template.html', 'select-question-type-container']
  ];

  expectations.forEach(([templateName, containerId]) => {
    const template = fs.readFileSync(
      path.join(templateDirectory, templateName),
      'utf8'
    );

    assert.match(
      template,
      new RegExp(
        `id="${containerId}"[^>]*data-container-open-sound="partyGameChoiceMenuOpen"`
      )
    );
  });
});

test('waiting-for-players sounds resolve to their shared audio keys', async () => {
  const { playedSounds, sounds } = createSoundHelperContext();

  await sounds.play('waitingForPlayersOpen');
  await sounds.play('playerConfirmed');

  assert.deepEqual(playedSounds, [
    { key: 'partyGameWaitingForPlayersOpen', time: 100000 },
    { key: 'partyGamePlayerConfirmed', time: 100000 }
  ]);
});

test('waiting-for-players container opts into its dedicated open sound', () => {
  const templatePath = path.join(
    __dirname,
    '../../public/html-templates/online/party-games/' +
      'selected-user-containers/party-games-template.html'
  );
  const template = fs.readFileSync(templatePath, 'utf8');

  assert.match(
    template,
    /id="waiting-for-players-container"[^>]*data-container-open-sound="partyGameWaitingForPlayersOpen"/
  );
});

test('online player-picking menus opt into the player select open sound', () => {
  const templateDirectory = path.join(
    __dirname,
    '../../public/html-templates/online/party-games/selected-user-containers'
  );
  const sharedTemplate = fs.readFileSync(
    path.join(templateDirectory, 'general/player-selection-template.html'),
    'utf8'
  );
  const mafiaTemplate = fs.readFileSync(
    path.join(templateDirectory, 'mafia-template.html'),
    'utf8'
  );

  assert.match(
    sharedTemplate,
    /id="select-user-container"[^>]*data-container-open-sound="partyGamePlayerSelect"/
  );
  [
    'select-user-day-phase-container',
    'select-user-night-phase-container',
    'select-civilian-watch-container'
  ].forEach((containerId) => {
    assert.match(
      mafiaTemplate,
      new RegExp(
        `id="${containerId}"[^>]*data-container-open-sound="partyGamePlayerSelect"`
      )
    );
  });
});

test('punishment reveal resolves to its shared audio key', async () => {
  const { playedSounds, sounds } = createSoundHelperContext();

  await sounds.play('punishmentReveal');

  assert.deepEqual(playedSounds, [{
    key: 'partyGamePunishmentReveal',
    time: 100000
  }]);
});

test('Truth or Dare voice cues resolve to their mode-specific audio keys', async () => {
  const { playedSounds, sounds } = createSoundHelperContext();

  await sounds.play('truthSelected');
  await sounds.play('dareSelected');

  assert.deepEqual(playedSounds, [
    { key: 'partyGameTruthSelected', time: 100000 },
    { key: 'partyGameDareSelected', time: 100000 }
  ]);
});

test('Imposter outcome cues resolve to their mode-specific audio keys', async () => {
  const { playedSounds, sounds } = createSoundHelperContext();

  await sounds.play('imposterFound');
  await sounds.play('imposterWins');

  assert.deepEqual(playedSounds, [
    { key: 'partyGameImposterFound', time: 100000 },
    { key: 'partyGameImposterWins', time: 100000 }
  ]);
});

test('party game sequences resolve event names before using the universal engine', async () => {
  const { playedSequences, sounds } = createSoundHelperContext();

  await sounds.playSequence(['actionConfirmed', 'truthSelected'], {
    priority: 'voice'
  });

  assert.deepEqual(JSON.parse(JSON.stringify(playedSequences)), [{
    keys: ['partyGameActionConfirmed', 'partyGameTruthSelected'],
    options: { priority: 'voice' }
  }]);
});

test('game complete events play the completion sound followed by the game-over voice', async () => {
  const { playedSequences, sounds } = createSoundHelperContext();

  await sounds.playOnce('gameComplete', { eventId: 'game-over-1' });
  await sounds.playOnce('gameComplete', { eventId: 'game-over-1' });

  assert.deepEqual(JSON.parse(JSON.stringify(playedSequences)), [{
    keys: ['partyGameGameComplete', 'partyGameGameOver'],
    options: {
      priority: 'critical',
      conflictPolicy: 'interrupt',
      interruptible: false,
      forceInterrupt: true,
      clearQueue: true
    }
  }]);
});

test('timer warning alternates sounds and accelerates toward its deadline', () => {
  const { advanceTo, getNow, playedSounds, sounds } = createSoundHelperContext();
  const startedAt = getNow();

  assert.equal(
    sounds.startTimerWarning({
      deadline: startedAt + 10000,
      timerId: 'round-1'
    }),
    true
  );

  advanceTo(startedAt + 10000);

  const warningSounds = playedSounds.slice(0, -1);
  warningSounds.forEach((sound, index) => {
    assert.equal(
      sound.key,
      index % 2 === 0 ? 'partyGameTimerTick' : 'partyGameTimerTock'
    );
  });
  assert.deepEqual(
    warningSounds.slice(0, 3).map((sound) => sound.time - startedAt),
    [0, 800, 1600]
  );
  assert.ok(
    warningSounds.some((sound, index) =>
      index > 0 && sound.time - warningSounds[index - 1].time === 500
    )
  );
  assert.ok(
    warningSounds.some((sound, index) =>
      index > 0 && sound.time - warningSounds[index - 1].time === 250
    )
  );
  assert.deepEqual(playedSounds.at(-1), {
    key: 'partyGameTimerExpired',
    time: startedAt + 10000
  });
});

test('timer warning can suppress the final expired sound', () => {
  const { advanceTo, getNow, playedSounds, sounds } = createSoundHelperContext();
  const startedAt = getNow();

  assert.equal(
    sounds.startTimerWarning({
      deadline: startedAt + 10000,
      timerId: 'prompt-heist',
      playExpiredSound: false
    }),
    true
  );

  advanceTo(startedAt + 10000);

  assert.ok(playedSounds.length > 0);
  assert.equal(
    playedSounds.some((sound) => sound.key === 'partyGameTimerExpired'),
    false
  );
});

test('starting the same timer twice does not restart its sequence', () => {
  const { advanceTo, getNow, pendingTimeouts, playedSounds, sounds } =
    createSoundHelperContext();
  const deadline = getNow() + 10000;

  sounds.startTimerWarning({ deadline, timerId: 'round-2' });
  sounds.startTimerWarning({ deadline, timerId: 'round-2' });

  assert.equal(pendingTimeouts.size, 1);
  advanceTo(getNow());
  assert.deepEqual(playedSounds.map((sound) => sound.key), [
    'partyGameTimerTick'
  ]);
});

test('stopping a timer warning cancels pending playback', () => {
  const { advanceTo, getNow, playedSounds, sounds } = createSoundHelperContext();
  const startedAt = getNow();

  sounds.startTimerWarning({
    deadline: startedAt + 10000,
    timerId: 'round-3'
  });
  assert.equal(sounds.stopTimerWarning(), true);

  advanceTo(startedAt + 12000);
  assert.deepEqual(playedSounds, []);
});

test('timer warning rejects invalid and expired deadlines', () => {
  const { getNow, pendingTimeouts, playedSounds, sounds } =
    createSoundHelperContext();

  assert.equal(
    sounds.startTimerWarning({ deadline: Number.NaN, timerId: 'invalid' }),
    false
  );
  assert.equal(
    sounds.startTimerWarning({ deadline: getNow(), timerId: 'expired' }),
    false
  );
  assert.equal(pendingTimeouts.size, 0);
  assert.deepEqual(playedSounds, []);
});

test('timer warning does not replay missed sounds after a hidden deadline', () => {
  const {
    advanceTo,
    getNow,
    pendingTimeouts,
    playedSounds,
    setDocumentHidden,
    sounds
  } = createSoundHelperContext();
  const startedAt = getNow();

  sounds.startTimerWarning({
    deadline: startedAt + 10000,
    timerId: 'round-4'
  });
  setDocumentHidden(true);
  assert.equal(pendingTimeouts.size, 0);

  advanceTo(startedAt + 12000);
  setDocumentHidden(false);

  assert.deepEqual(playedSounds, []);
  assert.equal(sounds.stopTimerWarning(), false);
});
