const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const soundScriptPath = path.join(
  __dirname,
  '..',
  '..',
  'public',
  'scripts',
  'general',
  'sound',
  'sound.js'
);
const soundSource = fs.readFileSync(soundScriptPath, 'utf8');
const splashScreenSource = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    '..',
    'public',
    'scripts',
    'general',
    'splash-screen',
    'splash-screen.js'
  ),
  'utf8'
);

function createSoundContext(storedValues = {}, options = {}) {
  const values = new Map(Object.entries(storedValues));
  const audioElements = [];
  const debugEntries = [];
  const documentListeners = new Map();
  const pendingTimeouts = new Map();
  let nextTimeoutId = 1;

  class FakeAudio {
    constructor(src) {
      this.src = src;
      this.volume = 1;
      this.currentTime = 0;
      this.ended = false;
      this.playCount = 0;
      this.listeners = new Map();
      audioElements.push(this);
    }

    addEventListener(eventName, listener) {
      if (!this.listeners.has(eventName)) {
        this.listeners.set(eventName, new Set());
      }
      this.listeners.get(eventName).add(listener);
    }

    removeEventListener(eventName, listener) {
      this.listeners.get(eventName)?.delete(listener);
    }

    emit(eventName) {
      [...(this.listeners.get(eventName) || [])]
        .forEach((listener) => listener());
    }

    finish() {
      this.ended = true;
      this.emit('ended');
    }

    load() {}

    pause() {
      this.emit('pause');
    }

    play() {
      this.playCount += 1;
      return Promise.resolve();
    }
  }

  const document = {
    addEventListener(eventName, listener) {
      if (!documentListeners.has(eventName)) {
        documentListeners.set(eventName, []);
      }
      documentListeners.get(eventName).push(listener);
    }
  };
  const localStorage = {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    }
  };
  const window = {
    OEDebug: Object.fromEntries(
      ['debug', 'info', 'warn', 'error'].map((level) => [
        level,
        (category, message, data) => {
          debugEntries.push({ level, category, message, data });
        }
      ])
    ),
    dispatchEvent() {},
    clearTimeout(timeoutId) {
      pendingTimeouts.delete(timeoutId);
    },
    setTimeout(callback) {
      const timeoutId = nextTimeoutId++;
      if (options.deferTimeouts) {
        pendingTimeouts.set(timeoutId, callback);
      } else {
        callback();
      }
      return timeoutId;
    }
  };
  const context = {
    Audio: FakeAudio,
    CustomEvent: class CustomEvent {},
    document,
    localStorage,
    performance: { now: () => 1 },
    Promise,
    window
  };
  window.window = window;

  vm.runInNewContext(soundSource, context, { filename: soundScriptPath });

  return {
    audioElements,
    debugEntries,
    pendingTimeouts,
    values,
    window,
    dispatchDocumentEvent(eventName, event = {}) {
      documentListeners.get(eventName)?.forEach((listener) => listener(event));
    }
  };
}

function createControl({ classes = [], dataset = {}, attributes = {} } = {}) {
  const classNames = new Set(classes);

  return {
    classList: {
      contains(className) {
        return classNames.has(className);
      }
    },
    dataset,
    disabled: false,
    getAttribute(name) {
      return attributes[name] ?? null;
    },
    matches(selectorList) {
      return selectorList.split(',').some((rawSelector) => {
        const selector = rawSelector.trim();
        if (selector.startsWith('.')) return classNames.has(selector.slice(1));
        if (selector === '[role="tab"]') return attributes.role === 'tab';
        return false;
      });
    }
  };
}

function createClickEvent(control) {
  return {
    target: {
      closest() {
        return control;
      }
    }
  };
}

function getPlayCountForSource(audioElements, sourceSuffix) {
  return audioElements
    .filter((audio) => audio.src.endsWith(sourceSuffix))
    .reduce((total, audio) => total + audio.playCount, 0);
}

test('sound engine defaults a missing master-volume preference to full volume', () => {
  const { audioElements, values, window } = createSoundContext();

  assert.equal(values.has('settings-sound-volume'), false);
  assert.equal(window.OEAudio.getMasterVolume(), 1);
  assert.ok(audioElements.length > 0);
  assert.ok(audioElements.every((audio) => audio.volume === 1));
});

test('sound engine preloads the social copy-link cue', () => {
  const { audioElements } = createSoundContext();

  assert.ok(
    audioElements.some((audio) =>
      audio.src.endsWith('/sounds/social/copy-link.wav')
    )
  );
});

test('sound engine preloads the social chat received cue', () => {
  const { audioElements } = createSoundContext();

  assert.ok(
    audioElements.some((audio) =>
      audio.src.endsWith('/sounds/social/chat-message-received.wav')
    )
  );
});

test('sound engine preloads the gamemode settings kick cue', () => {
  const { audioElements } = createSoundContext();

  assert.ok(
    audioElements.some((audio) =>
      audio.src.endsWith('/sounds/gamemode-settings/kick.wav')
    )
  );
});

test('sound engine preloads the account authentication cues', () => {
  const { audioElements } = createSoundContext();

  [
    '/sounds/account/auth/account-created.wav',
    '/sounds/account/auth/email-sent.wav'
  ].forEach((source) => {
    assert.ok(audioElements.some((audio) => audio.src.endsWith(source)));
  });
});

test('sound engine repairs a persisted zero master volume', () => {
  const { values, window } = createSoundContext({
    'settings-sound-volume': '0'
  });

  assert.equal(window.OEAudio.getMasterVolume(), 1);
  assert.equal(values.get('settings-sound-volume'), '1');
});

test('page-load splash plays the matching exit sound', () => {
  assert.match(splashScreenSource, /function playSplashScreenExitSound/);
  assert.match(splashScreenSource, /direction === 'up' \? 'splashScreenUp' : 'splashScreenDown'/);
  assert.match(splashScreenSource, /playSplashScreenExitSound\(exitDirection\)/);
});

test('ordinary buttons are silent by default', async () => {
  const { audioElements, dispatchDocumentEvent } = createSoundContext();
  const control = createControl();

  dispatchDocumentEvent('pointerdown');
  await Promise.resolve();
  const playsBeforeClick = audioElements.reduce(
    (total, audio) => total + audio.playCount,
    0
  );

  dispatchDocumentEvent('click', createClickEvent(control));
  await Promise.resolve();

  assert.equal(
    audioElements.reduce((total, audio) => total + audio.playCount, 0),
    playsBeforeClick
  );
});

test('selection controls play their semantic sound', async () => {
  const { audioElements, dispatchDocumentEvent } = createSoundContext();
  const control = createControl({ classes: ['settings-tab'] });

  dispatchDocumentEvent('pointerdown');
  await Promise.resolve();
  dispatchDocumentEvent('click', createClickEvent(control));
  await Promise.resolve();

  assert.equal(
    getPlayCountForSource(
      audioElements,
      '/sounds/ui/buttons/selections/select.wav'
    ),
    1
  );
});

test('game option controls play select only when choosing a new option', async () => {
  const { audioElements, dispatchDocumentEvent } = createSoundContext();
  const option = createControl({ classes: ['sound-option'] });
  const selectedOption = createControl({
    classes: ['sound-option', 'active']
  });

  dispatchDocumentEvent('pointerdown');
  await Promise.resolve();
  dispatchDocumentEvent('click', createClickEvent(option));
  dispatchDocumentEvent('click', createClickEvent(selectedOption));
  await Promise.resolve();

  assert.equal(
    getPlayCountForSource(
      audioElements,
      '/sounds/ui/buttons/selections/select.wav'
    ),
    1
  );
});

test('game menu confirmation controls play confirm instead of select', async () => {
  const { audioElements, dispatchDocumentEvent } = createSoundContext();
  const control = createControl({
    classes: ['select-button', 'sound-confirm']
  });

  dispatchDocumentEvent('pointerdown');
  await Promise.resolve();
  dispatchDocumentEvent('click', createClickEvent(control));
  await Promise.resolve();

  assert.equal(
    getPlayCountForSource(
      audioElements,
      '/sounds/ui/buttons/actions/confirm.wav'
    ),
    1
  );
  assert.equal(
    getPlayCountForSource(
      audioElements,
      '/sounds/ui/buttons/selections/select.wav'
    ),
    0
  );
});

test('adjustment buttons distinguish increases from decreases', async () => {
  const { audioElements, dispatchDocumentEvent } = createSoundContext();
  const increase = createControl({ classes: ['count-btn', 'increment'] });
  const decrease = createControl({ classes: ['count-btn', 'decrement'] });

  dispatchDocumentEvent('pointerdown');
  await Promise.resolve();
  dispatchDocumentEvent('click', createClickEvent(increase));
  dispatchDocumentEvent('click', createClickEvent(decrease));
  await Promise.resolve();

  assert.equal(
    getPlayCountForSource(
      audioElements,
      '/sounds/ui/buttons/adjustments/increase.wav'
    ),
    1
  );
  assert.equal(
    getPlayCountForSource(
      audioElements,
      '/sounds/ui/buttons/adjustments/decrease.wav'
    ),
    1
  );
});

test('calendar controls distinguish previous from next navigation', async () => {
  const { audioElements, dispatchDocumentEvent } = createSoundContext();
  const previous = createControl({
    classes: ['oe-panel-calendar-nav-button'],
    attributes: { 'aria-label': 'Previous month' }
  });
  const next = createControl({
    classes: ['oe-panel-calendar-nav-button'],
    attributes: { 'aria-label': 'Next month' }
  });

  dispatchDocumentEvent('pointerdown');
  await Promise.resolve();
  dispatchDocumentEvent('click', createClickEvent(previous));
  dispatchDocumentEvent('click', createClickEvent(next));
  await Promise.resolve();

  assert.equal(
    getPlayCountForSource(
      audioElements,
      '/sounds/ui/buttons/navigation/previous.wav'
    ),
    1
  );
  assert.equal(
    getPlayCountForSource(
      audioElements,
      '/sounds/ui/buttons/navigation/next.wav'
    ),
    1
  );
});

test('selected tabs and data-sound none controls stay silent', async () => {
  const { audioElements, dispatchDocumentEvent } = createSoundContext();
  const activeTab = createControl({ classes: ['settings-tab', 'active'] });
  const mutedChoice = createControl({
    classes: ['select-button'],
    dataset: { sound: 'none' }
  });

  dispatchDocumentEvent('pointerdown');
  await Promise.resolve();
  dispatchDocumentEvent('click', createClickEvent(activeTab));
  dispatchDocumentEvent('click', createClickEvent(mutedChoice));
  await Promise.resolve();

  assert.equal(
    getPlayCountForSource(
      audioElements,
      '/sounds/ui/buttons/selections/select.wav'
    ),
    0
  );
});

test('data-sound-intent opts any button-like control into semantic feedback', async () => {
  const { audioElements, dispatchDocumentEvent } = createSoundContext();
  const control = createControl({ dataset: { soundIntent: 'success' } });

  dispatchDocumentEvent('pointerdown');
  await Promise.resolve();
  dispatchDocumentEvent('click', createClickEvent(control));
  await Promise.resolve();

  assert.equal(
    getPlayCountForSource(
      audioElements,
      '/sounds/ui/buttons/actions/success.wav'
    ),
    1
  );
});

test('foreground priorities drop timer sounds and keep only the latest phase cue', async () => {
  const { audioElements, window } = createSoundContext({}, {
    deferTimeouts: true
  });
  await window.OEAudio.register({
    testVoice: {
      src: '/voice.wav',
      priority: 'voice',
      interruptible: false
    },
    testTimer: {
      src: '/timer.wav',
      priority: 'timerWarning',
      conflictPolicy: 'drop'
    },
    testPhaseOld: {
      src: '/phase-old.wav',
      priority: 'phase',
      conflictPolicy: 'queue-latest'
    },
    testPhaseNew: {
      src: '/phase-new.wav',
      priority: 'phase',
      conflictPolicy: 'queue-latest'
    }
  });

  const voicePlayback = await window.OEAudio.play('testVoice', {
    ignoreInteraction: true
  });
  assert.ok(voicePlayback);
  assert.equal(
    await window.OEAudio.play('testTimer', { ignoreInteraction: true }),
    null
  );

  const oldPhasePromise = window.OEAudio.play('testPhaseOld', {
    ignoreInteraction: true
  });
  const newPhasePromise = window.OEAudio.play('testPhaseNew', {
    ignoreInteraction: true
  });

  assert.equal(await oldPhasePromise, null);
  assert.equal(window.OEAudio.getLaneState().queuedKey, 'testPhaseNew');
  assert.equal(
    getPlayCountForSource(audioElements, '/timer.wav'),
    0
  );

  voicePlayback.source.finish();
  const newPhasePlayback = await newPhasePromise;
  assert.ok(newPhasePlayback);
  assert.equal(
    getPlayCountForSource(audioElements, '/phase-old.wav'),
    0
  );
  assert.equal(
    getPlayCountForSource(audioElements, '/phase-new.wav'),
    1
  );
});

test('sound sequences reserve their lane until every item has ended', async () => {
  const { audioElements, window } = createSoundContext({}, {
    deferTimeouts: true
  });
  await window.OEAudio.register({
    testConfirmation: {
      src: '/confirmation.wav',
      priority: 'confirmation'
    },
    testSpokenCue: {
      src: '/spoken.wav',
      priority: 'voice',
      interruptible: false
    },
    testResults: {
      src: '/results.wav',
      priority: 'phase',
      conflictPolicy: 'queue-latest'
    }
  });

  const sequencePromise = window.OEAudio.playSequence(
    ['testConfirmation', 'testSpokenCue'],
    { ignoreInteraction: true }
  );
  await new Promise((resolve) => setImmediate(resolve));
  const confirmationAudio = audioElements.find((audio) =>
    audio.src.endsWith('/confirmation.wav') && audio.playCount === 1
  );
  assert.ok(confirmationAudio);

  const resultsPromise = window.OEAudio.play('testResults', {
    ignoreInteraction: true
  });
  confirmationAudio.finish();
  await new Promise((resolve) => setImmediate(resolve));

  const spokenAudio = audioElements.find((audio) =>
    audio.src.endsWith('/spoken.wav') && audio.playCount === 1
  );
  assert.ok(spokenAudio);
  assert.equal(getPlayCountForSource(audioElements, '/results.wav'), 0);

  spokenAudio.finish();
  await sequencePromise;
  const resultsPlayback = await resultsPromise;
  assert.ok(resultsPlayback);
  assert.equal(getPlayCountForSource(audioElements, '/results.wav'), 1);
});

test('critical sounds interrupt locked sequences and clear obsolete queued audio', async () => {
  const { audioElements, window } = createSoundContext({}, {
    deferTimeouts: true
  });
  await window.OEAudio.register({
    testSequenceStart: {
      src: '/sequence-start.wav',
      priority: 'confirmation'
    },
    testSequenceVoice: {
      src: '/sequence-voice.wav',
      priority: 'voice',
      interruptible: false
    },
    testQueuedPhase: {
      src: '/queued-phase.wav',
      priority: 'phase',
      conflictPolicy: 'queue-latest'
    },
    testCritical: {
      src: '/critical.wav',
      priority: 'critical',
      forceInterrupt: true,
      clearQueue: true,
      interruptible: false
    }
  });

  const sequencePromise = window.OEAudio.playSequence(
    ['testSequenceStart', 'testSequenceVoice'],
    { ignoreInteraction: true }
  );
  await new Promise((resolve) => setImmediate(resolve));
  const queuedPhasePromise = window.OEAudio.play('testQueuedPhase', {
    ignoreInteraction: true
  });

  const criticalPlayback = await window.OEAudio.play('testCritical', {
    ignoreInteraction: true
  });

  assert.ok(criticalPlayback);
  assert.equal(await sequencePromise, null);
  assert.equal(await queuedPhasePromise, null);
  assert.equal(window.OEAudio.getLaneState().activeKey, 'testCritical');
  assert.equal(getPlayCountForSource(audioElements, '/queued-phase.wav'), 0);
});

test('background and foreground lanes can play independently', async () => {
  const { audioElements, window } = createSoundContext({}, {
    deferTimeouts: true
  });
  await window.OEAudio.register({
    testForeground: {
      src: '/foreground.wav',
      lane: 'foreground',
      priority: 'voice',
      interruptible: false
    },
    testBackground: {
      src: '/background.wav',
      lane: 'background',
      priority: 'background',
      interruptible: true
    }
  });

  const foregroundPlayback = await window.OEAudio.play('testForeground', {
    ignoreInteraction: true
  });
  const backgroundPlayback = await window.OEAudio.play('testBackground', {
    ignoreInteraction: true
  });

  assert.ok(foregroundPlayback);
  assert.ok(backgroundPlayback);
  assert.equal(getPlayCountForSource(audioElements, '/foreground.wav'), 1);
  assert.equal(getPlayCountForSource(audioElements, '/background.wav'), 1);
  assert.equal(window.OEAudio.getLaneState('foreground').activeKey, 'testForeground');
  assert.equal(window.OEAudio.getLaneState('background').activeKey, 'testBackground');
});

test('every direct playback skip has a machine-readable reason', async () => {
  const { debugEntries, window } = createSoundContext({
    'settings-sound': 'false'
  });

  assert.equal(await window.OEAudio.play('uiSelect'), null);
  const disabledSkip = debugEntries.find(
    (entry) =>
      entry.category === 'audio.playback' &&
      entry.data?.event === 'skipped' &&
      entry.data?.key === 'uiSelect'
  );

  assert.equal(disabledSkip.data.reason, 'sound_disabled');
});

test('lane conflict skips identify the dropped request reason', async () => {
  const { debugEntries, window } = createSoundContext({}, {
    deferTimeouts: true
  });
  await window.OEAudio.register({
    locked: {
      src: '/locked.wav',
      priority: 'voice',
      interruptible: false
    },
    dropped: {
      src: '/dropped.wav',
      priority: 'timerWarning',
      conflictPolicy: 'drop'
    }
  });

  await window.OEAudio.play('locked', { ignoreInteraction: true });
  assert.equal(
    await window.OEAudio.play('dropped', { ignoreInteraction: true }),
    null
  );

  const droppedSkip = debugEntries.find(
    (entry) =>
      entry.category === 'audio.playback' &&
      entry.data?.event === 'skipped' &&
      entry.data?.key === 'dropped'
  );
  assert.equal(droppedSkip.data.reason, 'lane_conflict_drop');
  assert.equal(typeof droppedSkip.data.requestId, 'number');
});

test('audio settings and registration use structured categories', async () => {
  const { debugEntries, window } = createSoundContext();
  await window.OEAudio.register({
    diagnosticSound: { src: '/diagnostic.wav' }
  });
  window.OEAudio.setMasterVolume(0.4, { persist: false });

  assert.ok(
    debugEntries.some(
      (entry) =>
        entry.category === 'audio' &&
        entry.data?.event === 'registered'
    )
  );
  assert.ok(
    debugEntries.some(
      (entry) =>
        entry.category === 'audio.settings' &&
        entry.data?.event === 'master_volume_changed'
    )
  );
});

test('playback failures report an error and a skip reason without throwing', async () => {
  const { audioElements, debugEntries, window } = createSoundContext();
  const selectAudio = audioElements.find((audio) =>
    audio.src.endsWith('/sounds/ui/buttons/selections/select.wav')
  );
  selectAudio.play = () => Promise.reject(new Error('media rejected'));

  assert.equal(
    await window.OEAudio.play('uiSelect', { ignoreInteraction: true }),
    null
  );
  assert.ok(
    debugEntries.some(
      (entry) =>
        entry.category === 'audio.errors' &&
        entry.data?.event === 'play_failed'
    )
  );
  assert.ok(
    debugEntries.some(
      (entry) =>
        entry.category === 'audio.playback' &&
        entry.data?.event === 'skipped' &&
        entry.data?.reason === 'play_rejected'
    )
  );
});

test('natural playback completion is logged once and removes tracking listeners', async () => {
  const { debugEntries, window } = createSoundContext();
  const playback = await window.OEAudio.play('uiSelect', {
    cooldown: 0,
    ignoreInteraction: true
  });

  assert.ok(playback);
  playback.source.finish();
  playback.source.pause();

  const endedEntries = debugEntries.filter(
    (entry) =>
      entry.category === 'audio.playback' &&
      entry.data?.event === 'ended' &&
      entry.data?.key === 'uiSelect'
  );
  assert.equal(endedEntries.length, 1);
  assert.equal(playback.source.listeners.get('ended')?.size ?? 0, 0);
  assert.equal(playback.source.listeners.get('pause')?.size ?? 0, 0);
});
