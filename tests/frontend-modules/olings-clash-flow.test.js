const assert = require('node:assert/strict');
const test = require('node:test');

const createOlingClashFlow = require('../../public/scripts/olings/clash/game/flow');
const createOlingClashResolution = require('../../public/scripts/olings/clash/game/resolution');
const createOlingClashState = require('../../public/scripts/olings/clash/game/state');

function createOling(id, heartUnits = 6) {
  return {
    effects: [],
    health: {
      shieldCount: 0,
      heartUnits,
      maxHeartUnits: 6,
      overgrowthUnits: 0
    },
    id,
    moves: { attack: 'ATTACK', guard: 'GUARD', skill: 'SKILL' },
    name: id.toUpperCase(),
    parts: {}
  };
}

function createScheduler() {
  const tasks = [];
  const cancelled = new Set();
  let nextId = 0;
  let currentTime = 0;

  return {
    advanceBy(milliseconds) {
      currentTime += milliseconds;
    },
    clearTimeout(id) {
      cancelled.add(id);
    },
    now() {
      return currentTime;
    },
    runNext() {
      while (tasks.length > 0) {
        const task = tasks.shift();
        if (cancelled.has(task.id)) continue;
        currentTime += task.delay;
        task.callback();
        return task.delay;
      }
      return null;
    },
    setTimeout(callback, delay) {
      nextId += 1;
      tasks.push({ callback, delay, id: nextId });
      return nextId;
    }
  };
}

test('Clash flow remains frozen until a paused tutorial resumes it', () => {
  const stateModel = createOlingClashState({
    teams: {
      local: [createOling('local-active'), createOling('local-bench')],
      opponent: [createOling('opponent-active')]
    }
  });
  const scheduler = createScheduler();
  const phases = [];
  const flow = createOlingClashFlow({
    clearTimeout: scheduler.clearTimeout,
    hooks: {
      onPhase({ paused, phase, phaseEndsAt }) {
        phases.push({ paused, phase, phaseEndsAt });
      }
    },
    opponent: {
      chooseAction: () => 'skill',
      chooseTag: (slots) => slots[0]
    },
    paused: true,
    resolution: createOlingClashResolution(),
    setTimeout: scheduler.setTimeout,
    stateModel
  });

  flow.start();
  assert.equal(flow.paused, true);
  assert.equal(flow.state.phase, 'waiting');
  assert.equal(phases[0].paused, true);
  assert.equal(phases[0].phaseEndsAt, null);
  assert.equal(flow.selectAction('attack'), false);
  assert.equal(scheduler.runNext(), null);

  assert.equal(flow.resume(), true);
  assert.equal(flow.paused, false);
  assert.equal(flow.state.phase, 'choose-action');
  assert.equal(flow.pause(), true);
  assert.equal(flow.selectTag(1), false);
  assert.equal(flow.selectTag(1, { allowWhilePaused: true }), true);
  assert.equal(flow.state.selections.localTagSlot, 1);
  assert.equal(flow.resume(), true);
  assert.equal(flow.selectAction('attack'), true);
  assert.equal(flow.state.selections.localAction, 'attack');
});

test('Clash flow can override a pending demo opponent action', () => {
  const stateModel = createOlingClashState({
    teams: {
      local: [createOling('local-active')],
      opponent: [createOling('opponent-active')]
    }
  });
  const scheduler = createScheduler();
  let result = null;
  const flow = createOlingClashFlow({
    clearTimeout: scheduler.clearTimeout,
    hooks: {
      onResult(roundResult) {
        result = roundResult;
      }
    },
    opponent: {
      chooseAction: () => 'guard',
      chooseTag: (slots) => slots[0],
      getActionDelayMs: () => 1000
    },
    resolution: createOlingClashResolution(),
    setTimeout: scheduler.setTimeout,
    stateModel
  });

  flow.start();
  assert.equal(flow.setOpponentAction('skill'), true);
  assert.equal(flow.selectAction('attack'), true);
  for (let step = 0; step < 10 && !result; step += 1) {
    scheduler.runNext();
  }

  assert.equal(result.winner, 'local');
  assert.equal(result.opponentAction, 'skill');
});

test('Clash flow can script the opponent forced Tag', () => {
  const stateModel = createOlingClashState({
    teams: {
      local: [createOling('local-active')],
      opponent: [
        createOling('opponent-active', 2),
        createOling('opponent-first-bench'),
        createOling('opponent-scripted-bench')
      ]
    }
  });
  const scheduler = createScheduler();
  const flow = createOlingClashFlow({
    clearTimeout: scheduler.clearTimeout,
    opponent: {
      chooseAction: () => 'skill',
      chooseTag: (slots) => slots[0]
    },
    resolution: createOlingClashResolution(),
    setTimeout: scheduler.setTimeout,
    stateModel
  });

  flow.start();
  assert.equal(flow.setOpponentTag(2), true);
  assert.equal(flow.selectAction('attack'), true);
  for (let step = 0; step < 10 && flow.state.phase !== 'tagged'; step += 1) {
    scheduler.runNext();
  }

  assert.equal(flow.state.teams.opponent[0].id, 'opponent-scripted-bench');
});

test('Clash flow can queue an opponent Tag after a surviving round', () => {
  const stateModel = createOlingClashState({
    teams: {
      local: [createOling('local-active')],
      opponent: [
        createOling('opponent-active'),
        createOling('opponent-first-bench'),
        createOling('opponent-scripted-bench')
      ]
    }
  });
  const scheduler = createScheduler();
  const flow = createOlingClashFlow({
    clearTimeout: scheduler.clearTimeout,
    opponent: {
      chooseAction: () => 'skill',
      chooseTag: (slots) => slots[0]
    },
    resolution: createOlingClashResolution(),
    setTimeout: scheduler.setTimeout,
    stateModel
  });

  flow.start();
  assert.equal(flow.setOpponentQueuedTag(2), true);
  assert.equal(flow.selectAction('attack'), true);
  for (let step = 0; step < 10 && flow.state.phase !== 'tagged'; step += 1) {
    scheduler.runNext();
  }

  assert.equal(flow.state.teams.opponent[0].id, 'opponent-scripted-bench');
  assert.equal(flow.state.teams.opponent[1].id, 'opponent-first-bench');
  assert.equal(flow.state.teams.opponent[2].id, 'opponent-active');
});

test('Clash tutorial Draw preserves Last Stand damage and resolves its queued Tag', () => {
  const stateModel = createOlingClashState({
    teams: {
      local: [createOling('local-active', 1), createOling('local-bench')],
      opponent: [createOling('opponent-active', 4)]
    }
  });
  const scheduler = createScheduler();
  let result = null;
  const flow = createOlingClashFlow({
    clearTimeout: scheduler.clearTimeout,
    hooks: {
      areAbilityEffectsEnabled: () => false,
      onResult(roundResult) {
        result = roundResult;
      }
    },
    opponent: {
      chooseAction: () => 'skill',
      chooseTag: (slots) => slots[0],
      getActionDelayMs: () => 1000
    },
    resolution: createOlingClashResolution(),
    setTimeout: scheduler.setTimeout,
    stateModel
  });

  flow.start();
  flow.pause();
  assert.equal(flow.selectTag(1, { allowWhilePaused: true }), true);
  assert.equal(flow.setOpponentAction('attack'), true);
  flow.resume();
  assert.equal(flow.selectAction('attack'), true);
  for (let step = 0; step < 10 && !result; step += 1) {
    scheduler.runNext();
  }

  assert.equal(result.winner, 'draw');
  assert.equal(result.localDamage.lastStand, true);
  assert.equal(stateModel.state.teams.local[0].health.heartUnits, 1);
  assert.equal(stateModel.state.teams.opponent[0].health.heartUnits, 3);

  scheduler.runNext();
  assert.equal(flow.state.phase, 'tagged');
  assert.equal(flow.state.teams.local[0].id, 'local-bench');
});

test('Clash flow suppresses ability effect phases when tutorial config disables them', () => {
  const stateModel = createOlingClashState({
    teams: {
      local: [createOling('local-active')],
      opponent: [createOling('opponent-active')]
    }
  });
  const scheduler = createScheduler();
  const baseResolution = createOlingClashResolution();
  let resolveOptions = null;
  let roundStartEffectCalls = 0;
  const resolution = {
    ...baseResolution,
    resolveClash(state, options) {
      resolveOptions = options;
      return baseResolution.resolveClash(state, options);
    },
    resolveRoundStartEffects(...args) {
      roundStartEffectCalls += 1;
      return baseResolution.resolveRoundStartEffects(...args);
    }
  };
  const flow = createOlingClashFlow({
    clearTimeout: scheduler.clearTimeout,
    hooks: {
      areAbilityEffectsEnabled: () => false
    },
    opponent: {
      chooseAction: () => 'skill',
      chooseTag: (slots) => slots[0]
    },
    resolution,
    setTimeout: scheduler.setTimeout,
    stateModel
  });

  flow.start();
  assert.equal(roundStartEffectCalls, 0);
  flow.selectAction('attack');
  scheduler.runNext();
  scheduler.runNext();
  assert.equal(resolveOptions.abilityEffects, false);
});

test('Clash flow reveals, resolves and automatically Tags the opponent', () => {
  const stateModel = createOlingClashState({
    teams: {
      local: [createOling('local-active'), createOling('local-bench')],
      opponent: [
        createOling('opponent-active', 2),
        createOling('opponent-bench')
      ]
    }
  });
  const scheduler = createScheduler();
  const phases = [];
  const reveals = [];
  const results = [];
  const flow = createOlingClashFlow({
    clearTimeout: scheduler.clearTimeout,
    hooks: {
      onPhase({ phase }) {
        phases.push(phase);
      },
      onResult(result) {
        results.push(result.label);
      },
      onReveal(reveal) {
        reveals.push(reveal);
      }
    },
    opponent: {
      chooseAction: () => 'skill',
      chooseTag: (slots) => slots[0]
    },
    resolution: createOlingClashResolution(),
    setTimeout: scheduler.setTimeout,
    stateModel
  });

  flow.start();
  assert.equal(flow.defaultDurations.locked, 1500);
  assert.equal(flow.defaultDurations.reveal, 2500);
  assert.equal(flow.defaultDurations.result, 5000);
  assert.equal(flow.state.phase, 'choose-action');
  assert.equal(flow.selectAction('attack'), true);
  assert.equal(flow.state.phase, 'locked');

  assert.equal(scheduler.runNext(), 1500);
  assert.equal(flow.state.phase, 'reveal');
  assert.equal(reveals[0].durationMs, 2500);
  assert.equal(reveals[0].winner, 'local');
  assert.equal(scheduler.runNext(), 2500);
  assert.equal(flow.state.phase, 'resolving');
  assert.deepEqual(results, ['ATTACK WINS']);

  assert.equal(scheduler.runNext(), 5000);
  assert.equal(flow.state.phase, 'opponent-tag');
  scheduler.runNext();
  assert.equal(flow.state.phase, 'tagged');
  assert.equal(flow.state.teams.opponent[0].id, 'opponent-bench');
  scheduler.runNext();
  assert.equal(flow.state.phase, 'choose-action');
  assert.equal(flow.state.round, 2);
  assert.deepEqual(phases, [
    'choose-action',
    'locked',
    'reveal',
    'resolving',
    'opponent-tag',
    'tagged',
    'choose-action'
  ]);
});

test('Clash flow gives decisive and Draw results the same duration', () => {
  const stateModel = createOlingClashState({
    teams: {
      local: [createOling('local-active')],
      opponent: [createOling('opponent-active')]
    }
  });
  const scheduler = createScheduler();
  const results = [];
  const flow = createOlingClashFlow({
    clearTimeout: scheduler.clearTimeout,
    hooks: {
      onResult(result) {
        results.push(result);
      }
    },
    opponent: {
      chooseAction: () => 'guard',
      chooseTag: (slots) => slots[0]
    },
    resolution: createOlingClashResolution(),
    setTimeout: scheduler.setTimeout,
    stateModel
  });

  flow.start();
  flow.selectAction('guard');
  assert.equal(scheduler.runNext(), flow.defaultDurations.locked);
  assert.equal(scheduler.runNext(), flow.defaultDurations.reveal);
  assert.equal(results[0].winner, 'draw');
  assert.equal(flow.state.phase, 'resolving');
  assert.equal(flow.defaultDurations.drawResult, 5000);
  assert.equal(flow.defaultDurations.result, 5000);
  assert.equal(scheduler.runNext(), 5000);
  assert.equal(flow.state.phase, 'choose-action');
});

test('Clash flow resolves at combat impact and ignores its cancelled fallback', () => {
  const stateModel = createOlingClashState({
    teams: {
      local: [createOling('local-active')],
      opponent: [createOling('opponent-active')]
    }
  });
  const scheduler = createScheduler();
  const results = [];
  let resolveAtImpact = null;
  let setImpactFallback = null;
  const flow = createOlingClashFlow({
    clearTimeout: scheduler.clearTimeout,
    hooks: {
      onResult(result) {
        results.push(result.label);
      },
      onReveal(reveal) {
        resolveAtImpact = reveal.resolveAtImpact;
        setImpactFallback = reveal.setImpactFallback;
      }
    },
    opponent: {
      chooseAction: () => 'skill',
      chooseTag: (slots) => slots[0]
    },
    resolution: createOlingClashResolution(),
    setTimeout: scheduler.setTimeout,
    stateModel
  });

  flow.start();
  flow.selectAction('attack');
  scheduler.runNext();

  assert.equal(flow.state.phase, 'reveal');
  assert.equal(typeof resolveAtImpact, 'function');
  assert.equal(setImpactFallback(3200), true);
  assert.equal(resolveAtImpact()?.label, 'ATTACK WINS');
  assert.equal(flow.state.phase, 'resolving');
  assert.deepEqual(results, ['ATTACK WINS']);
  assert.equal(resolveAtImpact(), null);
  assert.equal(setImpactFallback(3200), false);
  assert.equal(scheduler.runNext(), 5000);
});

test('Clash flow waits for local Tag selection and confirmation', () => {
  const stateModel = createOlingClashState({
    teams: {
      local: [
        createOling('local-active', 2),
        createOling('local-bench-one'),
        createOling('local-bench-two')
      ],
      opponent: [createOling('opponent-active')]
    }
  });
  const scheduler = createScheduler();
  const flow = createOlingClashFlow({
    clearTimeout: scheduler.clearTimeout,
    opponent: {
      chooseAction: () => 'attack',
      chooseTag: (slots) => slots[0]
    },
    resolution: createOlingClashResolution(),
    setTimeout: scheduler.setTimeout,
    stateModel
  });

  flow.start();
  flow.selectAction('skill');
  scheduler.runNext();
  scheduler.runNext();
  scheduler.runNext();
  assert.equal(flow.state.phase, 'choose-tag');

  assert.equal(flow.confirmTag(2), true);
  assert.equal(flow.state.phase, 'tagged');
  assert.equal(flow.state.teams.local[0].id, 'local-bench-two');
});

test('Clash flow applies a queued Tag after the active Oling survives', () => {
  const stateModel = createOlingClashState({
    teams: {
      local: [createOling('local-active'), createOling('local-bench')],
      opponent: [createOling('opponent-active')]
    }
  });
  const scheduler = createScheduler();
  const tagEvents = [];
  const renderedActiveOlings = [];
  const flow = createOlingClashFlow({
    clearTimeout: scheduler.clearTimeout,
    hooks: {
      onRender(state) {
        renderedActiveOlings.push(state.teams.local[0].id);
      },
      onTag(event) {
        tagEvents.push({ stage: 'complete', ...event });
      },
      onTagStart(event) {
        tagEvents.push({ stage: 'start', ...event });
        return event.side === 'local' ? { delayMs: 480 } : null;
      }
    },
    opponent: {
      chooseAction: () => 'guard',
      chooseTag: (slots) => slots[0]
    },
    resolution: createOlingClashResolution(),
    setTimeout: scheduler.setTimeout,
    stateModel
  });

  flow.start();
  assert.equal(flow.selectTag(1), true);
  flow.selectAction('skill');
  scheduler.runNext();
  scheduler.runNext();
  scheduler.runNext();

  assert.equal(flow.state.phase, 'resolving');
  assert.equal(flow.state.teams.local[0].id, 'local-active');
  assert.equal(renderedActiveOlings.at(-1), 'local-active');
  assert.equal(tagEvents.length, 1);
  assert.equal(scheduler.runNext(), 480);
  assert.equal(flow.state.phase, 'tagged');
  assert.equal(flow.state.teams.local[0].id, 'local-bench');
  assert.equal(renderedActiveOlings.at(-1), 'local-bench');
  assert.equal(flow.state.selections.localTagSlot, null);
  assert.equal(tagEvents[0].stage, 'start');
  assert.equal(tagEvents[0].forced, false);
  assert.equal(tagEvents[0].selectedSlot, 1);
  assert.equal(tagEvents[0].outgoingOling.id, 'local-active');
  assert.equal(tagEvents[1].stage, 'complete');
  assert.equal(tagEvents[1].durationMs, 1400);
  assert.equal(tagEvents[1].incomingOling.id, 'local-bench');
});

test('Clash flow can Tag the previous active Oling back in on the next round', () => {
  const stateModel = createOlingClashState({
    teams: {
      local: [
        createOling('local-first'),
        createOling('local-second'),
        createOling('local-third')
      ],
      opponent: [createOling('opponent-active')]
    }
  });
  const scheduler = createScheduler();
  const flow = createOlingClashFlow({
    clearTimeout: scheduler.clearTimeout,
    opponent: {
      chooseAction: () => 'guard',
      chooseTag: (slots) => slots[0]
    },
    resolution: createOlingClashResolution(),
    setTimeout: scheduler.setTimeout,
    stateModel
  });

  flow.start();
  assert.equal(stateModel.swapActive('local', 1).id, 'local-second');
  assert.deepEqual(stateModel.getAvailableBenchSlots('local'), [0, 2]);
  assert.equal(flow.selectTag(0), true);
  assert.equal(flow.state.selections.localTagSlot, 0);

  assert.equal(flow.selectAction('skill'), true);
  scheduler.runNext();
  scheduler.runNext();
  scheduler.runNext();
  assert.equal(flow.state.teams.local[0].id, 'local-first');
});

test('Clash flow rejects Tag changes after the action locks in', () => {
  const stateModel = createOlingClashState({
    teams: {
      local: [
        createOling('local-active'),
        createOling('local-bench-one'),
        createOling('local-bench-two')
      ],
      opponent: [createOling('opponent-active')]
    }
  });
  const scheduler = createScheduler();
  const flow = createOlingClashFlow({
    clearTimeout: scheduler.clearTimeout,
    opponent: {
      chooseAction: () => 'guard',
      chooseTag: (slots) => slots[0]
    },
    resolution: createOlingClashResolution(),
    setTimeout: scheduler.setTimeout,
    stateModel
  });

  flow.start();
  assert.equal(flow.selectTag(1), true);
  assert.equal(flow.selectAction('skill'), true);
  assert.equal(flow.state.phase, 'locked');
  assert.equal(flow.selectTag(2), false);
  assert.equal(flow.selectTag(null), false);
  assert.equal(flow.state.selections.localTagSlot, 1);
});

test('Clash flow automatically Tags the only living local replacement', () => {
  const stateModel = createOlingClashState({
    teams: {
      local: [
        createOling('local-active', 2),
        createOling('local-bench'),
        createOling('local-defeated', 0)
      ],
      opponent: [createOling('opponent-active')]
    }
  });
  const scheduler = createScheduler();
  const forcedTagPrompts = [];
  const tagEvents = [];
  const flow = createOlingClashFlow({
    clearTimeout: scheduler.clearTimeout,
    hooks: {
      onForcedTag(event) {
        forcedTagPrompts.push(event);
      },
      onTag(event) {
        tagEvents.push(event);
      }
    },
    opponent: {
      chooseAction: () => 'attack',
      chooseTag: (slots) => slots[0]
    },
    resolution: createOlingClashResolution(),
    setTimeout: scheduler.setTimeout,
    stateModel
  });

  flow.start();
  flow.selectTag(1);
  flow.selectAction('skill');
  scheduler.runNext();
  scheduler.runNext();
  scheduler.runNext();

  assert.equal(flow.state.phase, 'tagged');
  assert.equal(flow.state.selections.localTagSlot, null);
  assert.equal(flow.state.teams.local[0].id, 'local-bench');
  assert.equal(tagEvents[0].forced, true);
  assert.equal(tagEvents[0].selectedSlot, 1);
  assert.equal(forcedTagPrompts.length, 0);
});

test('Clash flow resolves queued and forced Tags before the next round', () => {
  const stateModel = createOlingClashState({
    teams: {
      local: [createOling('local-active'), createOling('local-bench')],
      opponent: [
        createOling('opponent-active', 2),
        createOling('opponent-bench')
      ]
    }
  });
  const scheduler = createScheduler();
  const flow = createOlingClashFlow({
    clearTimeout: scheduler.clearTimeout,
    opponent: {
      chooseAction: () => 'skill',
      chooseTag: (slots) => slots[0]
    },
    resolution: createOlingClashResolution(),
    setTimeout: scheduler.setTimeout,
    stateModel
  });

  flow.start();
  flow.selectTag(1);
  flow.selectAction('attack');
  scheduler.runNext();
  scheduler.runNext();
  scheduler.runNext();
  assert.equal(flow.state.teams.local[0].id, 'local-bench');
  assert.equal(flow.state.phase, 'tagged');

  scheduler.runNext();
  assert.equal(flow.state.phase, 'opponent-tag');
  scheduler.runNext();
  assert.equal(flow.state.teams.opponent[0].id, 'opponent-bench');
  scheduler.runNext();
  assert.equal(flow.state.phase, 'choose-action');
  assert.equal(flow.state.round, 2);
});

test('Clash flow applies delayed Read Suppression after a forced Tag', () => {
  const outgoing = createOling('opponent-active', 2);
  const incoming = createOling('opponent-bench');
  const stateModel = createOlingClashState({
    teams: {
      local: [createOling('local-active')],
      opponent: [outgoing, incoming]
    }
  });
  const scheduler = createScheduler();
  const roundStartEffects = [];
  const flow = createOlingClashFlow({
    clearTimeout: scheduler.clearTimeout,
    hooks: {
      onRoundStartEffects({ effects }) {
        roundStartEffects.push(...effects);
      }
    },
    opponent: {
      chooseAction: () => 'skill',
      chooseTag: (slots) => slots[0]
    },
    random: () => 0.5,
    resolution: createOlingClashResolution(),
    setTimeout: scheduler.setTimeout,
    stateModel
  });

  flow.start();
  flow.state.pendingRoundStartEffects.push({
    abilityKey: 'bone-read',
    applyAtRound: 2,
    sourcePlayerSlot: 'local',
    statusKey: 'suppressed',
    targetPlayerSlot: 'opponent'
  });
  flow.selectAction('attack');
  scheduler.runNext();
  scheduler.runNext();
  scheduler.runNext();
  scheduler.runNext();
  scheduler.runNext();

  assert.equal(flow.state.round, 2);
  assert.equal(flow.state.teams.opponent[0].id, 'opponent-bench');
  assert.equal(flow.state.teams.opponent[1].effects.length, 0);
  assert.equal(flow.state.teams.opponent[0].effects[0].targetPart, 'flight');
  assert.equal(roundStartEffects[0].targetName, 'OPPONENT-BENCH');
});

test('Clash flow confirms the pending action when the timer expires', () => {
  const stateModel = createOlingClashState({
    teams: {
      local: [createOling('local-active')],
      opponent: [createOling('opponent-active')]
    }
  });
  const scheduler = createScheduler();
  const submissions = [];
  const flow = createOlingClashFlow({
    clearTimeout: scheduler.clearTimeout,
    hooks: {
      onActionSubmitted(submission) {
        submissions.push(submission);
      },
      onActionTimeout: () => 'guard'
    },
    opponent: {
      chooseAction: () => 'attack',
      chooseTag: (slots) => slots[0]
    },
    resolution: createOlingClashResolution(),
    setTimeout: scheduler.setTimeout,
    stateModel
  });

  flow.start();
  scheduler.runNext();
  assert.equal(flow.state.phase, 'locked');
  assert.equal(flow.state.selections.localAction, 'guard');
  assert.equal(submissions.length, 1);
  assert.equal(submissions[0].action, 'guard');
});

test('Clash flow preserves a required effect choice on action timeout', () => {
  const stateModel = createOlingClashState({
    teams: {
      local: [createOling('local-active')],
      opponent: [createOling('opponent-active')]
    }
  });
  const scheduler = createScheduler();
  const effectChoice = {
    abilityKey: 'stone-reinforce',
    targetTeamSlot: 0,
    optionKey: 'body'
  };
  const flow = createOlingClashFlow({
    clearTimeout: scheduler.clearTimeout,
    hooks: {
      onActionTimeout: () => ({ action: 'skill', effectChoice })
    },
    opponent: {
      chooseAction: () => 'attack',
      chooseTag: (slots) => slots[0]
    },
    resolution: createOlingClashResolution(),
    setTimeout: scheduler.setTimeout,
    stateModel
  });

  flow.start();
  scheduler.runNext();

  assert.equal(flow.state.selections.localAction, 'skill');
  assert.deepEqual(flow.state.selections.localEffectChoice, effectChoice);
});

test('Clash flow waits for a delayed AI before locking its action', () => {
  const stateModel = createOlingClashState({
    teams: {
      local: [createOling('local-active')],
      opponent: [createOling('opponent-active')]
    }
  });
  const scheduler = createScheduler();
  const delayRequests = [];
  let actionChoices = 0;
  const flow = createOlingClashFlow({
    clearTimeout: scheduler.clearTimeout,
    opponent: {
      chooseAction() {
        actionChoices += 1;
        return 'guard';
      },
      chooseTag: (slots) => slots[0],
      getActionDelayMs(options) {
        delayRequests.push(options);
        return delayRequests.length === 1 ? 10000 : options.maximumDelayMs;
      }
    },
    now: scheduler.now,
    resolution: createOlingClashResolution(),
    setTimeout: scheduler.setTimeout,
    stateModel
  });

  flow.start();
  assert.equal(actionChoices, 1);
  assert.deepEqual(delayRequests[0], {
    maximumDelayMs: 14500,
    minimumDelayMs: 500
  });
  assert.equal(flow.selectAction('attack'), true);
  assert.equal(flow.state.phase, 'waiting');
  assert.equal(flow.state.selections.localAction, 'attack');
  assert.equal(flow.state.selections.opponentAction, null);
  assert.deepEqual(delayRequests[1], {
    maximumDelayMs: 2000,
    minimumDelayMs: 250
  });

  assert.equal(scheduler.runNext(), 2000);
  assert.equal(flow.state.phase, 'locked');
  assert.equal(flow.state.selections.opponentAction, 'guard');
  assert.equal(actionChoices, 1);

  assert.equal(scheduler.runNext(), flow.defaultDurations.locked);
  assert.equal(flow.state.phase, 'reveal');
});

test('Clash AI acceleration preserves its original time and deadline buffer', () => {
  const stateModel = createOlingClashState({
    teams: {
      local: [createOling('local-active')],
      opponent: [createOling('opponent-active')]
    }
  });
  const scheduler = createScheduler();
  const delayRequests = [];
  const flow = createOlingClashFlow({
    clearTimeout: scheduler.clearTimeout,
    now: scheduler.now,
    opponent: {
      chooseAction: () => 'skill',
      chooseTag: (slots) => slots[0],
      getActionDelayMs(options) {
        delayRequests.push(options);
        return options.maximumDelayMs;
      }
    },
    resolution: createOlingClashResolution(),
    setTimeout: scheduler.setTimeout,
    stateModel
  });

  flow.start();
  scheduler.advanceBy(13500);
  flow.selectAction('guard');

  assert.deepEqual(delayRequests[1], {
    maximumDelayMs: 1000,
    minimumDelayMs: 250
  });
  assert.equal(scheduler.runNext(), 1000);
  assert.equal(scheduler.now(), 14500);
  assert.equal(flow.state.phase, 'locked');
});
