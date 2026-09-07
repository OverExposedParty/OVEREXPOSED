const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const tutorialScript = [
  '../../public/scripts/olings/clash/tutorial/diagram-geometry.js',
  '../../public/scripts/olings/clash/tutorial/clash-tutorial.js'
]
  .map((relativePath) =>
    fs.readFileSync(path.join(__dirname, relativePath), 'utf8')
  )
  .join('\n');
const tutorialStyles = fs.readFileSync(
  path.join(
    __dirname,
    '../../public/css/olings/clash/tutorial/clash-tutorial.css'
  ),
  'utf8'
);

function createActionButton(document, action, left) {
  const button = document.createElement('button');
  button.dataset.clashAction = action;
  button.getBoundingClientRect = () => ({
    bottom: 600,
    height: 100,
    left,
    right: left + 100,
    top: 500,
    width: 100
  });
  document.body.appendChild(button);
  return button;
}

test('Clash action tutorial draws responsive curves with separate arrowheads', () => {
  const dom = new JSDOM('<main data-tutorial-root></main>', {
    runScripts: 'outside-only',
    url: 'https://overexposed.app/olings/clash/tutorial'
  });
  const { document } = dom.window;
  const root = document.querySelector('[data-tutorial-root]');
  let tutorialConfig = null;
  let gameplayConfig = null;
  let resumed = false;

  createActionButton(document, 'attack', 100);
  createActionButton(document, 'guard', 220);
  createActionButton(document, 'skill', 340);
  dom.window.requestAnimationFrame = (callback) => {
    callback();
    return 1;
  };
  dom.window.cancelAnimationFrame = () => {};
  dom.window.OlingClashGame = {
    configureTutorialGameplay(config) {
      gameplayConfig = config;
    },
    pauseTutorial() {},
    resumeTutorial() {
      resumed = true;
    }
  };
  dom.window.OETutorial = {
    create(config) {
      tutorialConfig = config;
      return { root, start() {} };
    }
  };

  dom.window.eval(tutorialScript);
  const actionStep = tutorialConfig.steps.find(
    (step) => step.id === 'available-actions'
  );
  actionStep.onEnter({ tutorial: { root } });
  assert.deepEqual(JSON.parse(JSON.stringify(gameplayConfig)), {
    abilityEffects: false,
    abilityInformation: false
  });

  actionStep.gameplay = {
    abilityEffects: true,
    abilityInformation: true
  };
  actionStep.onEnter({ tutorial: { root } });
  assert.deepEqual(JSON.parse(JSON.stringify(gameplayConfig)), {
    abilityEffects: true,
    abilityInformation: true
  });

  const diagram = root.querySelector('.olings-clash-tutorial-action-diagram');
  const curves = diagram.querySelectorAll(
    '.olings-clash-tutorial-action-curve'
  );
  const heads = diagram.querySelectorAll('.olings-clash-tutorial-action-head');

  assert.equal(curves.length, 3);
  assert.equal(heads.length, 3);
  curves.forEach((curve) => assert.match(curve.getAttribute('d'), /^M .* C /));
  heads.forEach((head) =>
    assert.match(head.getAttribute('d'), /^M .* L .* L /)
  );
  assert.equal(
    diagram.querySelectorAll('.olings-clash-tutorial-action-anchor').length,
    6
  );
  assert.equal(
    diagram.querySelectorAll('.olings-clash-tutorial-action-beats').length,
    3
  );
  assert.deepEqual(
    Array.from(
      diagram.querySelectorAll('.olings-clash-tutorial-action-type'),
      (label) => label.textContent
    ),
    ['ATTACK', 'GUARD', 'SKILL']
  );
  const typeLabelTops = Array.from(
    diagram.querySelectorAll('.olings-clash-tutorial-action-type'),
    (label) => Number.parseFloat(label.style.top)
  );
  const arrowAnchorTops = Array.from(
    diagram.querySelectorAll('.olings-clash-tutorial-action-anchor'),
    (anchor) => Number.parseFloat(anchor.getAttribute('cy'))
  );
  assert.ok(typeLabelTops.every((top) => top < 500));
  assert.ok(arrowAnchorTops.every((top) => top < Math.min(...typeLabelTops)));
  assert.doesNotMatch(actionStep.copy, /draw/i);
  assert.match(actionStep.copy, /Attack beats Skill/);

  actionStep.onExit();
  assert.equal(
    root.querySelector('.olings-clash-tutorial-action-diagram'),
    null
  );
  assert.equal(resumed, true);
});

test('Clash splits guided ability selection from action lock-in', () => {
  const dom = new JSDOM('<main data-tutorial-root></main>', {
    runScripts: 'outside-only',
    url: 'https://overexposed.app/olings/clash/tutorial'
  });
  const { document } = dom.window;
  const root = document.querySelector('[data-tutorial-root]');
  const gameRoot = document.createElement('section');
  const actionContainer = document.createElement('div');
  const actions = [
    createActionButton(document, 'attack', 100),
    createActionButton(document, 'guard', 220),
    createActionButton(document, 'skill', 340)
  ];
  const confirmButton = document.createElement('button');
  let tutorialConfig = null;
  let confirmed = false;
  let opponentPrepared = false;
  let inputEnabled = false;
  let resumeCalls = 0;

  gameRoot.dataset.clashGame = '';
  actionContainer.dataset.clashActions = '';
  confirmButton.dataset.clashActionConfirm = '';
  confirmButton.disabled = true;
  actionContainer.append(...actions, confirmButton);
  gameRoot.appendChild(actionContainer);
  document.body.appendChild(gameRoot);
  actions.forEach((button) => {
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      actions.forEach((action) => action.setAttribute('aria-pressed', 'false'));
      button.setAttribute('aria-pressed', 'true');
      confirmButton.disabled = false;
    });
  });
  dom.window.OlingClashGame = {
    confirmAction() {
      confirmed = true;
    },
    pauseTutorial() {},
    resumeTutorial() {
      resumeCalls += 1;
    },
    setTutorialActionInput(enabled) {
      inputEnabled = enabled;
    },
    setTutorialOpponentToLose() {
      opponentPrepared = true;
    }
  };
  dom.window.OETutorial = {
    create(config) {
      tutorialConfig = config;
      return { root, start() {} };
    }
  };

  dom.window.eval(tutorialScript);
  const selectionStep = tutorialConfig.steps.find(
    (step) => step.id === 'choose-an-ability'
  );
  const lockInStep = tutorialConfig.steps.find(
    (step) => step.id === 'lock-in-action'
  );
  selectionStep.onEnter({ tutorial: { root } });

  assert.equal(selectionStep.actionRequired, true);
  assert.deepEqual(JSON.parse(JSON.stringify(selectionStep.elevate)), [
    '[data-clash-action="attack"]',
    '[data-clash-action="guard"]',
    '[data-clash-action="skill"]',
    '[data-clash-phase]'
  ]);
  assert.equal(selectionStep.releaseStacking, '[data-clash-actions]');
  assert.equal(inputEnabled, true);
  assert.deepEqual(
    Array.from(
      root.querySelectorAll('.olings-clash-tutorial-action-type'),
      (label) => label.textContent
    ),
    ['ATTACK', 'GUARD', 'SKILL']
  );
  assert.ok(
    Array.from(
      root.querySelectorAll('.olings-clash-tutorial-action-type'),
      (label) => Number.parseFloat(label.style.top)
    ).every((top) => top < 500)
  );

  actions[0].click();
  assert.equal(selectionStep.advanceOn.predicate({ target: actions[0] }), true);
  selectionStep.onExit();
  assert.equal(actions[0].getAttribute('aria-pressed'), 'true');
  assert.equal(root.querySelector('.olings-clash-tutorial-action-type'), null);
  assert.equal(resumeCalls, 0);
  assert.equal(confirmed, false);

  lockInStep.onEnter();
  assert.deepEqual(JSON.parse(JSON.stringify(lockInStep.elevate)), [
    '[data-clash-actions]',
    '[data-clash-phase]',
    '.olings-clash-arena'
  ]);
  assert.equal(lockInStep.releaseStacking, undefined);
  assert.equal(inputEnabled, true);
  assert.equal(lockInStep.advanceOn.predicate({ target: actions[0] }), false);
  assert.equal(lockInStep.advanceOn.predicate({ target: confirmButton }), true);
  assert.match(lockInStep.copy, /Confirm or press the enemy Oling/);
  assert.doesNotMatch(
    tutorialStyles,
    /is-tutorial-action-input \[data-clash-action-summary\]/
  );

  lockInStep.onExit();
  assert.equal(inputEnabled, false);
  assert.equal(opponentPrepared, true);
  assert.equal(confirmed, true);
  assert.equal(resumeCalls, 1);
});

test('Clash result lesson freezes and explains full normal Heart damage', () => {
  const dom = new JSDOM(
    `
      <main data-tutorial-root>
        <svg data-oe-tutorial-target></svg>
        <h1 data-oe-tutorial-title></h1>
        <p data-oe-tutorial-copy></p>
        <button data-oe-tutorial-next hidden></button>
      </main>
      <div data-oe-tutorial-backdrop></div>
      <section data-clash-game>
        <article data-clash-fighter="opponent"></article>
      </section>
    `,
    {
      runScripts: 'outside-only',
      url: 'https://overexposed.app/olings/clash/tutorial'
    }
  );
  const { document } = dom.window;
  const root = document.querySelector('[data-tutorial-root]');
  const gameRoot = document.querySelector('[data-clash-game]');
  const backdrop = document.querySelector('[data-oe-tutorial-backdrop]');
  let tutorialConfig = null;
  let fightersHeld = false;
  let fightersReleased = false;
  let heldDamage = null;
  let releasedDamage = null;
  let pauseCalls = 0;
  const resultCallbacks = new Map();
  let resumeCalls = 0;

  dom.window.setTimeout = (callback, delayMs) => {
    resultCallbacks.set(delayMs, callback);
    return 1;
  };
  dom.window.clearTimeout = () => {};
  dom.window.OlingClashGame = {
    combatMotion: {
      hold() {
        fightersHeld = true;
      },
      release() {
        fightersReleased = true;
      }
    },
    configureTutorialGameplay() {},
    damageFeedback: {
      holdLatest(_root, options) {
        heldDamage = options;
        return { id: 'real-damage-burst' };
      },
      releaseHeld(burst) {
        releasedDamage = burst;
      }
    },
    pauseTutorial() {
      pauseCalls += 1;
    },
    resumeTutorial() {
      resumeCalls += 1;
    }
  };
  dom.window.OETutorial = {
    create(config) {
      tutorialConfig = config;
      return { root, start() {} };
    }
  };

  dom.window.eval(tutorialScript);
  const resultStep = tutorialConfig.steps.find(
    (step) => step.id === 'understand-heart-damage'
  );
  resultStep.onEnter({
    tutorial: { refreshTarget() {}, root }
  });
  assert.equal(backdrop.hidden, true);

  gameRoot.dispatchEvent(
    new dom.window.CustomEvent('olings-clash:tutorial-round-result', {
      detail: {
        damagePackets: [
          {
            layers: [{ amount: 2, key: 'hearts' }],
            side: 'opponent'
          }
        ]
      }
    })
  );

  assert.equal(pauseCalls, 0);
  assert.equal(backdrop.hidden, true);
  assert.equal(typeof resultCallbacks.get(250), 'function');
  assert.equal(typeof resultCallbacks.get(600), 'function');

  resultCallbacks.get(250)();
  assert.deepEqual(JSON.parse(JSON.stringify(heldDamage)), {
    layer: 'hearts',
    side: 'opponent'
  });
  assert.equal(pauseCalls, 0);
  assert.equal(fightersHeld, false);
  assert.equal(backdrop.hidden, true);

  resultCallbacks.get(600)();

  assert.equal(pauseCalls, 1);
  assert.equal(backdrop.hidden, false);
  assert.match(
    root.querySelector('[data-oe-tutorial-copy]').textContent,
    /red -1/
  );
  assert.equal(root.querySelector('[data-oe-tutorial-next]').hidden, false);
  assert.equal(fightersHeld, true);
  assert.equal(
    root.querySelector('.olings-clash-tutorial-damage-callout'),
    null
  );
  assert.deepEqual(JSON.parse(JSON.stringify(resultStep.elevate)), [
    '.olings-clash-arena',
    '[data-clash-roster="opponent"] [data-clash-roster-slot="active"]'
  ]);

  resultStep.onExit();
  assert.deepEqual(releasedDamage, { id: 'real-damage-burst' });
  assert.equal(fightersReleased, true);
  assert.equal(resumeCalls, 1);
});

test('Clash explains the round layout after the damage lesson', () => {
  const dom = new JSDOM(
    `
      <main data-tutorial-root></main>
      <section data-clash-game>
        <section data-clash-round-display></section>
        <section data-clash-phase></section>
      </section>
    `,
    {
      runScripts: 'outside-only',
      url: 'https://overexposed.app/olings/clash/tutorial'
    }
  );
  const { document } = dom.window;
  const root = document.querySelector('[data-tutorial-root]');
  const roundDisplay = document.querySelector('[data-clash-round-display]');
  const phase = document.querySelector('[data-clash-phase]');
  let pauseCalls = 0;
  let resumeCalls = 0;
  let tutorialConfig = null;

  roundDisplay.getBoundingClientRect = () => ({
    bottom: 200,
    left: 400,
    right: 700,
    top: 100
  });
  phase.getBoundingClientRect = () => ({
    bottom: 360,
    left: 350,
    right: 750,
    top: 240
  });
  dom.window.OlingClashGame = {
    configureTutorialGameplay() {},
    pauseTutorial() {
      pauseCalls += 1;
    },
    resumeTutorial() {
      resumeCalls += 1;
    },
    state: { phase: 'choose-action' }
  };
  dom.window.OETutorial = {
    create(config) {
      tutorialConfig = config;
      return { root, start() {} };
    }
  };

  dom.window.eval(tutorialScript);
  const layoutStep = tutorialConfig.steps.find(
    (step) => step.id === 'understand-round-results'
  );
  const layoutIndex = tutorialConfig.steps.indexOf(layoutStep);
  const damageIndex = tutorialConfig.steps.findIndex(
    (step) => step.id === 'understand-heart-damage'
  );
  assert.equal(damageIndex + 1, layoutIndex);
  assert.deepEqual(JSON.parse(JSON.stringify(layoutStep.elevate)), [
    '[data-clash-round-display]',
    '[data-clash-phase]'
  ]);
  assert.equal(layoutStep.target, undefined);
  assert.equal(layoutStep.targetPadding, undefined);
  assert.match(layoutStep.copy, /Last Round/);
  assert.match(layoutStep.copy, /currently waiting for or resolving/);

  layoutStep.onEnter({ tutorial: { root } });
  layoutStep.onExit();
  assert.equal(pauseCalls, 1);
  assert.equal(resumeCalls, 1);
});

test('Clash queues a Tag before guiding the player into a Draw', () => {
  const dom = new JSDOM('<main data-tutorial-root></main>', {
    runScripts: 'outside-only',
    url: 'https://overexposed.app/olings/clash/tutorial'
  });
  const { document } = dom.window;
  const root = document.querySelector('[data-tutorial-root]');
  const gameRoot = document.createElement('section');
  const roster = document.createElement('section');
  const actionContainer = document.createElement('section');
  const arena = document.createElement('section');
  const actions = [
    createActionButton(document, 'attack', 100),
    createActionButton(document, 'guard', 220),
    createActionButton(document, 'skill', 340)
  ];
  const confirm = document.createElement('button');
  const mossyTag = document.createElement('button');
  const emberTag = document.createElement('button');
  let confirmed = false;
  let drawPrepared = false;
  const actionInputStates = [];
  const tagInputStates = [];
  let tutorialConfig = null;

  gameRoot.dataset.clashGame = '';
  roster.dataset.clashRoster = 'local';
  actionContainer.dataset.clashActions = '';
  arena.className = 'olings-clash-arena';
  confirm.dataset.clashActionConfirm = '';
  mossyTag.dataset.clashTagButton = '';
  mossyTag.dataset.teamSlot = '1';
  mossyTag.setAttribute('aria-pressed', 'true');
  emberTag.dataset.clashTagButton = '';
  emberTag.dataset.teamSlot = '2';
  emberTag.setAttribute('aria-pressed', 'true');
  ['active', 'bench-1', 'bench-2'].forEach((slot, index) => {
    const item = document.createElement('article');
    item.dataset.clashRosterSlot = slot;
    if (index === 1) item.append(mossyTag);
    if (index === 2) item.append(emberTag);
    roster.append(item);
  });
  actionContainer.append(...actions, confirm);
  gameRoot.append(roster, actionContainer, arena);
  document.body.append(gameRoot);
  dom.window.requestAnimationFrame = (callback) => {
    callback();
    return 1;
  };
  dom.window.cancelAnimationFrame = () => {};
  dom.window.OlingClashGame = {
    configureTutorialGameplay() {},
    confirmAction() {
      confirmed = true;
    },
    pauseTutorial() {},
    resumeTutorial() {},
    setTutorialActionInput(enabled) {
      actionInputStates.push(enabled);
    },
    setTutorialOpponentToDraw() {
      drawPrepared = true;
    },
    setTutorialTagInput(enabled) {
      tagInputStates.push(enabled);
    }
  };
  dom.window.OETutorial = {
    create(config) {
      tutorialConfig = config;
      return { root, start() {} };
    }
  };

  dom.window.eval(tutorialScript);
  const tagStep = tutorialConfig.steps.find(
    (step) => step.id === 'queue-a-tag'
  );
  const chooseStep = tutorialConfig.steps.find(
    (step) => step.id === 'choose-draw-ability'
  );
  const lockStep = tutorialConfig.steps.find(
    (step) => step.id === 'lock-in-draw'
  );
  const layoutIndex = tutorialConfig.steps.findIndex(
    (step) => step.id === 'understand-round-results'
  );

  assert.equal(tutorialConfig.steps.indexOf(tagStep), layoutIndex + 1);
  assert.equal(tagStep.dialoguePlacement, 'bottom');
  assert.equal(tagStep.title, 'Tag in Mossy');
  assert.match(tagStep.copy, /Pebble only has half a Heart/);
  assert.match(tagStep.copy, /Mossy/);
  assert.deepEqual(JSON.parse(JSON.stringify(tagStep.elevate)), [
    '[data-clash-roster="local"] [data-clash-roster-slot="active"]',
    '[data-clash-roster="local"] [data-clash-roster-slot="bench-1"]'
  ]);
  tagStep.onEnter({ tutorial: { root } });
  assert.equal(tagInputStates.at(-1), true);
  assert.equal(emberTag.disabled, true);
  assert.equal(tagStep.advanceOn.predicate({ target: emberTag }), false);
  assert.equal(tagStep.advanceOn.predicate({ target: mossyTag }), true);
  tagStep.onExit();
  assert.equal(tagInputStates.at(-1), false);
  assert.equal(emberTag.disabled, false);

  chooseStep.onEnter({ tutorial: { root } });
  assert.equal(actionInputStates.at(-1), true);
  assert.equal(chooseStep.advanceOn.predicate({ target: actions[0] }), true);
  chooseStep.onExit();
  assert.equal(actionInputStates.at(-1), false);

  confirm.disabled = false;
  lockStep.onEnter();
  assert.equal(lockStep.advanceOn.predicate({ target: confirm }), true);
  lockStep.onExit();
  assert.equal(drawPrepared, true);
  assert.equal(confirmed, true);
});

test('Clash freezes both Draw outcomes and explains Last Stand', () => {
  const dom = new JSDOM(
    `
      <main data-tutorial-root>
        <svg data-oe-tutorial-target></svg>
        <section data-oe-tutorial-dialogue>
          <h1 data-oe-tutorial-title></h1>
          <p data-oe-tutorial-copy></p>
          <button data-oe-tutorial-next hidden></button>
        </section>
      </main>
      <div data-oe-tutorial-backdrop></div>
      <section data-clash-game>
        <article data-clash-fighter="local"></article>
        <article data-clash-fighter="opponent"></article>
      </section>
    `,
    {
      runScripts: 'outside-only',
      url: 'https://overexposed.app/olings/clash/tutorial'
    }
  );
  const { document } = dom.window;
  const root = document.querySelector('[data-tutorial-root]');
  const gameRoot = document.querySelector('[data-clash-game]');
  const backdrop = document.querySelector('[data-oe-tutorial-backdrop]');
  const heldOptions = [];
  const releasedBursts = [];
  let fightersHeld = false;
  let fightersReleased = false;
  let pauseCalls = 0;
  let resumeCalls = 0;
  let tutorialConfig = null;

  dom.window.setTimeout = (callback) => {
    callback();
    return 1;
  };
  dom.window.clearTimeout = () => {};
  dom.window.OlingClashGame = {
    combatMotion: {
      hold() {
        fightersHeld = true;
      },
      release() {
        fightersReleased = true;
      }
    },
    configureTutorialGameplay() {},
    damageFeedback: {
      holdLatest(_gameRoot, options) {
        heldOptions.push(options);
        return { side: options.side };
      },
      releaseHeld(burst) {
        releasedBursts.push(burst);
      }
    },
    pauseTutorial() {
      pauseCalls += 1;
    },
    resumeTutorial() {
      resumeCalls += 1;
    }
  };
  dom.window.OETutorial = {
    create(config) {
      tutorialConfig = config;
      return { root, start() {} };
    }
  };

  dom.window.eval(tutorialScript);
  const drawStep = tutorialConfig.steps.find(
    (step) => step.id === 'understand-draw-and-last-stand'
  );
  assert.deepEqual(JSON.parse(JSON.stringify(drawStep.elevate)), [
    '.olings-clash-arena',
    '[data-clash-roster="local"] [data-clash-roster-slot="active"]',
    '[data-clash-roster="opponent"] [data-clash-roster-slot="active"]'
  ]);
  drawStep.onEnter({ tutorial: { refreshTarget() {}, root } });
  assert.equal(backdrop.hidden, true);

  gameRoot.dispatchEvent(
    new dom.window.CustomEvent('olings-clash:tutorial-round-result', {
      detail: { result: { winner: 'draw' } }
    })
  );

  assert.equal(pauseCalls, 1);
  assert.equal(fightersHeld, true);
  assert.deepEqual(JSON.parse(JSON.stringify(heldOptions)), [
    { lastStand: true, side: 'local' },
    { layer: 'hearts', side: 'opponent' }
  ]);
  assert.equal(backdrop.hidden, false);
  assert.match(
    root.querySelector('[data-oe-tutorial-copy]').textContent,
    /both Olings take half a Heart/
  );
  assert.match(
    root.querySelector('[data-oe-tutorial-copy]').textContent,
    /does not protect against a decisive loss/
  );
  assert.equal(drawStep.target, undefined);

  drawStep.onExit();
  assert.equal(fightersReleased, true);
  assert.equal(releasedBursts.length, 2);
  assert.equal(resumeCalls, 1);
});

test('Clash Step 5 explains the revealed ability matchup', () => {
  const dom = new JSDOM(
    `
      <main data-tutorial-root>
        <svg data-oe-tutorial-target></svg>
        <section data-oe-tutorial-dialogue>
          <h1 data-oe-tutorial-title></h1>
          <p data-oe-tutorial-copy></p>
          <button data-oe-tutorial-next hidden></button>
        </section>
      </main>
      <div data-oe-tutorial-backdrop></div>
      <section data-clash-game>
        <section data-clash-phase>
          <div data-clash-ability-reveal>
            <article data-clash-revealed-ability="local">
              <strong data-clash-revealed-ability-name>CLEANSE</strong>
              <small data-clash-revealed-action>GUARD</small>
            </article>
            <article data-clash-revealed-ability="opponent">
              <strong data-clash-revealed-ability-name>BLOODSUCK</strong>
              <small data-clash-revealed-action>ATTACK</small>
            </article>
          </div>
        </section>
      </section>
    `,
    {
      runScripts: 'outside-only',
      url: 'https://overexposed.app/olings/clash/tutorial'
    }
  );
  const { document } = dom.window;
  const root = document.querySelector('[data-tutorial-root]');
  const gameRoot = document.querySelector('[data-clash-game]');
  const backdrop = document.querySelector('[data-oe-tutorial-backdrop]');
  let pauseCalls = 0;
  let resumeCalls = 0;
  let fightersHeld = false;
  let fightersReleased = false;
  let revealPlaybackCalls = 0;
  let tutorialConfig = null;

  const scheduledCallbacks = [];
  dom.window.setTimeout = (callback) => {
    scheduledCallbacks.push(callback);
    return scheduledCallbacks.length;
  };
  dom.window.clearTimeout = () => {};
  dom.window.OlingClashGame = {
    combatMotion: {
      hold() {
        fightersHeld = true;
      },
      release() {
        fightersReleased = true;
      }
    },
    configureTutorialGameplay() {},
    pauseTutorial() {
      pauseCalls += 1;
    },
    resumeTutorial() {
      resumeCalls += 1;
    },
    state: { phase: 'locked' }
  };
  dom.window.OETutorial = {
    create(config) {
      tutorialConfig = config;
      return { root, start() {} };
    }
  };

  dom.window.eval(tutorialScript);
  const revealStep = tutorialConfig.steps.find(
    (step) => step.id === 'understand-ability-reveal'
  );
  assert.equal(tutorialConfig.steps.indexOf(revealStep), 4);
  revealStep.onEnter({ tutorial: { refreshTarget() {}, root } });
  assert.equal(backdrop.hidden, true);
  assert.equal(
    root.querySelector('[data-oe-tutorial-dialogue]').style.visibility,
    'hidden'
  );

  const revealStartedImmediately = gameRoot.dispatchEvent(
    new dom.window.CustomEvent('olings-clash:tutorial-abilities-revealed', {
      cancelable: true,
      detail: {
        localAction: 'guard',
        opponentAction: 'attack',
        resumeRevealPlayback() {
          revealPlaybackCalls += 1;
        },
        winner: 'local'
      }
    })
  );

  assert.equal(revealStartedImmediately, false);
  assert.equal(revealPlaybackCalls, 0);
  assert.equal(pauseCalls, 0);
  assert.equal(fightersHeld, false);
  assert.equal(backdrop.hidden, true);

  const revealCards = [
    ...gameRoot.querySelectorAll('[data-clash-revealed-ability]')
  ];
  revealCards[0].dispatchEvent(
    new dom.window.Event('animationend', { bubbles: true })
  );
  assert.equal(pauseCalls, 0);
  revealCards[1].dispatchEvent(
    new dom.window.Event('animationend', { bubbles: true })
  );

  assert.equal(pauseCalls, 1);
  assert.equal(fightersHeld, true);
  assert.equal(
    gameRoot.classList.contains('is-tutorial-ability-reveal-lesson'),
    true
  );
  assert.equal(backdrop.hidden, false);
  assert.equal(
    root.querySelector('[data-oe-tutorial-dialogue]').style.visibility,
    ''
  );
  assert.match(
    root.querySelector('[data-oe-tutorial-copy]').textContent,
    /left card is your CLEANSE ability/
  );
  assert.match(
    root.querySelector('[data-oe-tutorial-copy]').textContent,
    /right card is the enemy’s BLOODSUCK ability/
  );
  assert.match(
    root.querySelector('[data-oe-tutorial-copy]').textContent,
    /GUARD beats ATTACK/
  );
  assert.equal(root.querySelector('[data-oe-tutorial-next]').hidden, false);
  assert.equal(revealStep.elevate, '[data-clash-phase]');
  assert.equal(revealStep.target, undefined);

  revealStep.onExit();
  assert.equal(fightersReleased, true);
  assert.equal(revealPlaybackCalls, 1);
  assert.equal(
    gameRoot.classList.contains('is-tutorial-ability-reveal-lesson'),
    false
  );
  assert.equal(resumeCalls, 1);
});

test('Clash inspects all three abilities before drawing and explaining both passives', () => {
  const dom = new JSDOM(
    `
      <main data-tutorial-root>
        <svg data-oe-tutorial-target></svg>
        <section data-oe-tutorial-dialogue>
          <h1 data-oe-tutorial-title></h1>
          <p data-oe-tutorial-copy></p>
          <button data-oe-tutorial-next hidden></button>
        </section>
      </main>
      <div data-oe-tutorial-backdrop></div>
      <section data-clash-game>
        <div data-clash-actions>
          <button data-clash-action="attack"><strong data-clash-move-name>MEND</strong></button>
          <button data-clash-action="guard"><strong data-clash-move-name>CLEANSE</strong></button>
          <button data-clash-action="skill"><strong data-clash-move-name>WILD GROWTH</strong></button>
          <button data-clash-action="draw" data-clash-passive><strong data-clash-move-name>CANOPY</strong></button>
          <button data-clash-action-confirm>CONFIRM</button>
          <div data-clash-action-summary></div>
        </div>
        <div class="olings-clash-arena"></div>
        <div data-clash-phase></div>
        <section data-clash-roster="local">
          <article data-clash-roster-slot="bench-1">
            <div data-clash-health>
              <img class="olings-clash-health-unit is-shields" data-shield-count="1">
            </div>
          </article>
        </section>
        <section data-clash-roster="opponent">
          <article data-clash-roster-slot="active">
            <div data-clash-effects>
              <span data-effect-key="bloodbound"></span>
            </div>
          </article>
        </section>
        <section data-clash-ability-reveal>
          <article data-clash-revealed-ability="local">
            <strong data-clash-revealed-ability-name>CANOPY</strong>
          </article>
          <article data-clash-revealed-ability="opponent">
            <strong data-clash-revealed-ability-name>RECLAIM</strong>
          </article>
        </section>
      </section>
    `,
    {
      runScripts: 'outside-only',
      url: 'https://overexposed.app/olings/clash/tutorial'
    }
  );
  const { document } = dom.window;
  const root = document.querySelector('[data-tutorial-root]');
  const gameRoot = document.querySelector('[data-clash-game]');
  const backdrop = document.querySelector('[data-oe-tutorial-backdrop]');
  const attack = document.querySelector('[data-clash-action="attack"]');
  const guard = document.querySelector('[data-clash-action="guard"]');
  const skill = document.querySelector('[data-clash-action="skill"]');
  const confirm = document.querySelector('[data-clash-action-confirm]');
  let advanceCalls = 0;
  let confirmed = false;
  const confirmSuppressedStates = [];
  let drawPrepared = false;
  let gameplayConfig = null;
  const heldDamageLayers = [];
  let holdCalls = 0;
  let inputEnabled = false;
  let opponentLosePreparations = 0;
  let opponentWinPreparations = 0;
  let opponentQueuedTagSlot = null;
  let opponentTagSlot = null;
  let pauseCalls = 0;
  let releaseCalls = 0;
  let resumeCalls = 0;
  let presentationRefreshCalls = 0;
  let tutorialConfig = null;

  dom.window.setTimeout = (callback) => {
    callback();
    return 1;
  };
  dom.window.clearTimeout = () => {};
  dom.window.OlingClashGame = {
    combatMotion: {
      hold() {
        holdCalls += 1;
      },
      release() {
        releaseCalls += 1;
      }
    },
    configureTutorialGameplay(config) {
      gameplayConfig = config;
    },
    damageFeedback: {
      holdLatest(_gameRoot, options) {
        heldDamageLayers.push(options.layer);
        return { layer: options.layer };
      },
      releaseHeld() {}
    },
    pauseTutorial() {
      pauseCalls += 1;
    },
    confirmAction() {
      confirmed = true;
    },
    resumeTutorial() {
      resumeCalls += 1;
    },
    setTutorialActionInput(enabled) {
      inputEnabled = enabled;
    },
    setTutorialConfirmSuppressed(suppressed) {
      confirmSuppressedStates.push(suppressed);
    },
    setTutorialOpponentToDraw() {
      drawPrepared = true;
    },
    setTutorialOpponentToLose() {
      opponentLosePreparations += 1;
    },
    setTutorialOpponentToWin() {
      opponentWinPreparations += 1;
    },
    setTutorialOpponentQueuedTagSlot(slot) {
      opponentQueuedTagSlot = slot;
    },
    setTutorialOpponentTagSlot(slot) {
      opponentTagSlot = slot;
    },
    state: { phase: 'resolving' }
  };
  dom.window.OETutorial = {
    create(config) {
      tutorialConfig = config;
      return { root, start() {} };
    }
  };

  dom.window.eval(tutorialScript);
  const abilityStep = tutorialConfig.steps.find(
    (step) => step.id === 'inspect-ability-effects'
  );
  abilityStep.onEnter({
    tutorial: {
      advance() {
        advanceCalls += 1;
      },
      refreshPresentation() {
        presentationRefreshCalls += 1;
      },
      refreshTarget() {},
      root
    }
  });
  assert.equal(confirmSuppressedStates.at(-1), true);

  assert.deepEqual(JSON.parse(JSON.stringify(gameplayConfig)), {
    abilityEffects: false,
    abilityInformation: true
  });
  assert.equal(backdrop.hidden, true);
  assert.equal(inputEnabled, false);
  assert.equal(
    root.querySelector('[data-oe-tutorial-dialogue]').style.visibility,
    'hidden'
  );
  assert.equal(abilityStep.releaseStacking(), null);

  dom.window.OlingClashGame.state.phase = 'choose-action';
  gameRoot.dispatchEvent(
    new dom.window.CustomEvent('olings-clash:tutorial-phase', {
      detail: { phase: 'choose-action' }
    })
  );
  assert.equal(pauseCalls, 1);
  assert.equal(presentationRefreshCalls, 1);
  assert.equal(
    abilityStep.releaseStacking(),
    document.querySelector('[data-clash-actions]')
  );
  assert.equal(inputEnabled, true);
  assert.equal(backdrop.hidden, false);
  assert.equal(
    root.querySelector('[data-oe-tutorial-dialogue]').style.visibility,
    ''
  );
  assert.match(
    root.querySelector('[data-oe-tutorial-copy]').textContent,
    /Select any ability/
  );
  assert.match(
    root.querySelector('[data-oe-tutorial-title]').textContent,
    /\(0\/3\)$/
  );

  attack.click();
  assert.match(
    root.querySelector('[data-oe-tutorial-title]').textContent,
    /MEND has a unique effect \(1\/3\)/
  );
  assert.match(
    root.querySelector('[data-oe-tutorial-copy]').textContent,
    /ATTACK determines what this ability beats/
  );
  attack.click();
  assert.match(
    root.querySelector('[data-oe-tutorial-title]').textContent,
    /\(1\/3\)$/
  );
  guard.click();
  assert.match(
    root.querySelector('[data-oe-tutorial-title]').textContent,
    /\(2\/3\)$/
  );
  skill.click();
  assert.match(
    root.querySelector('[data-oe-tutorial-title]').textContent,
    /\(3\/3\)$/
  );
  assert.equal(advanceCalls, 1);
  assert.equal(root.querySelector('[data-oe-tutorial-next]').hidden, true);
  assert.deepEqual(JSON.parse(JSON.stringify(abilityStep.elevate)), [
    '[data-clash-action="attack"]',
    '[data-clash-action="guard"]',
    '[data-clash-action="skill"]',
    '[data-clash-action-summary]',
    '[data-clash-phase]'
  ]);

  abilityStep.onExit();
  assert.equal(confirmSuppressedStates.at(-1), true);
  assert.equal(inputEnabled, false);
  assert.equal(resumeCalls, 1);

  const confirmDrawStep = tutorialConfig.steps.find(
    (step) => step.id === 'confirm-ability-draw'
  );
  assert.equal(
    tutorialConfig.steps.indexOf(confirmDrawStep),
    tutorialConfig.steps.indexOf(abilityStep) + 1
  );
  assert.deepEqual(JSON.parse(JSON.stringify(confirmDrawStep.elevate)), [
    '[data-clash-actions]',
    '[data-clash-phase]',
    '.olings-clash-arena'
  ]);
  assert.equal(confirmDrawStep.releaseStacking, undefined);
  confirmDrawStep.onEnter();
  assert.equal(confirmSuppressedStates.at(-1), false);
  assert.deepEqual(JSON.parse(JSON.stringify(gameplayConfig)), {
    abilityEffects: true,
    abilityInformation: true
  });
  assert.equal(attack.disabled, false);
  assert.equal(guard.disabled, false);
  assert.equal(skill.disabled, false);
  assert.equal(confirmDrawStep.advanceOn.predicate({ target: confirm }), true);
  confirmDrawStep.onExit();
  assert.equal(drawPrepared, true);
  assert.equal(confirmed, true);

  const drawAbilitiesStep = tutorialConfig.steps.find(
    (step) => step.id === 'understand-draw-abilities'
  );
  assert.equal(
    tutorialConfig.steps.indexOf(drawAbilitiesStep),
    tutorialConfig.steps.indexOf(confirmDrawStep) + 1
  );
  drawAbilitiesStep.onEnter({
    tutorial: { refreshTarget() {}, root }
  });
  assert.deepEqual(JSON.parse(JSON.stringify(gameplayConfig)), {
    abilityEffects: true,
    abilityInformation: true
  });
  assert.deepEqual(JSON.parse(JSON.stringify(drawAbilitiesStep.elevate)), [
    '[data-clash-ability-reveal]',
    '[data-clash-action="draw"]',
    '[data-clash-action-summary]'
  ]);
  assert.equal(drawAbilitiesStep.target, undefined);
  assert.equal(drawAbilitiesStep.targetPadding, undefined);
  assert.equal(backdrop.hidden, true);
  gameRoot.dispatchEvent(
    new dom.window.CustomEvent('olings-clash:tutorial-round-result', {
      detail: { result: { winner: 'draw' } }
    })
  );
  assert.equal(backdrop.hidden, false);
  assert.equal(holdCalls, 1);
  assert.equal(
    gameRoot.classList.contains('is-tutorial-ability-reveal-lesson'),
    true
  );
  assert.match(
    root.querySelector('[data-oe-tutorial-title]').textContent,
    /Draw activates CANOPY and RECLAIM/
  );
  assert.match(
    root.querySelector('[data-oe-tutorial-copy]').textContent,
    /CANOPY.*RECLAIM.*activate together/
  );
  assert.doesNotMatch(
    root.querySelector('[data-oe-tutorial-copy]').textContent,
    /fourth ability/i
  );
  assert.equal(root.querySelector('[data-oe-tutorial-next]').hidden, false);
  drawAbilitiesStep.onExit();
  assert.equal(releaseCalls, 1);
  assert.equal(
    gameRoot.classList.contains('is-tutorial-ability-reveal-lesson'),
    false
  );

  const canopyShieldStep = tutorialConfig.steps.find(
    (step) => step.id === 'understand-canopy-shield'
  );
  const bloodboundEffectStep = tutorialConfig.steps.find(
    (step) => step.id === 'understand-bloodbound-effect'
  );
  assert.equal(
    tutorialConfig.steps.indexOf(canopyShieldStep),
    tutorialConfig.steps.indexOf(drawAbilitiesStep) + 1
  );
  assert.equal(
    tutorialConfig.steps.indexOf(bloodboundEffectStep),
    tutorialConfig.steps.indexOf(canopyShieldStep) + 1
  );
  assert.equal(
    canopyShieldStep.elevate,
    '[data-clash-roster="local"] [data-clash-roster-slot="bench-1"] [data-clash-health] .olings-clash-health-unit.is-shields'
  );
  assert.match(canopyShieldStep.copy, /Pebble.*Shield.*bench/);
  assert.equal(canopyShieldStep.target, undefined);
  canopyShieldStep.onEnter();
  assert.equal(holdCalls, 2);
  canopyShieldStep.onExit();
  assert.equal(releaseCalls, 2);

  assert.equal(
    bloodboundEffectStep.elevate,
    '[data-clash-roster="opponent"] [data-clash-roster-slot="active"] [data-effect-key="bloodbound"]'
  );
  assert.match(bloodboundEffectStep.copy, /Reclaim.*Bloodbound/);
  assert.match(bloodboundEffectStep.copy, /decisive win.*decisive loss/);
  assert.equal(bloodboundEffectStep.target, undefined);
  bloodboundEffectStep.onEnter();
  assert.equal(holdCalls, 3);
  bloodboundEffectStep.onExit();
  assert.equal(releaseCalls, 3);

  const finishStepIds = [
    'choose-wild-growth',
    'confirm-wild-growth',
    'understand-wild-growth',
    'understand-forced-opponent-tag',
    'queue-pebble-tag',
    'win-and-tag-pebble',
    'understand-pebble-shield',
    'test-pebble-shield',
    'understand-shield-damage',
    'understand-moss-overgrowth',
    'damage-moss-overgrowth',
    'understand-overgrowth-damage',
    'complete-clash-basics'
  ];
  const bloodboundIndex = tutorialConfig.steps.indexOf(bloodboundEffectStep);
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        tutorialConfig.steps.slice(bloodboundIndex + 1).map((step) => step.id)
      )
    ),
    finishStepIds
  );

  const chooseWildGrowthStep = tutorialConfig.steps.find(
    (step) => step.id === 'choose-wild-growth'
  );
  const confirmWildGrowthStep = tutorialConfig.steps.find(
    (step) => step.id === 'confirm-wild-growth'
  );
  const wildGrowthResultStep = tutorialConfig.steps.find(
    (step) => step.id === 'understand-wild-growth'
  );
  const forcedTagStep = tutorialConfig.steps.find(
    (step) => step.id === 'understand-forced-opponent-tag'
  );
  assert.equal(forcedTagStep.dialoguePlacement, 'top');
  const testPebbleShieldStep = tutorialConfig.steps.find(
    (step) => step.id === 'test-pebble-shield'
  );
  const tutorialContext = {
    refreshPresentation() {
      presentationRefreshCalls += 1;
    },
    refreshTarget() {},
    root
  };

  const refreshCallsBeforeWildGrowth = presentationRefreshCalls;
  chooseWildGrowthStep.onEnter({ tutorial: tutorialContext });
  assert.equal(confirmSuppressedStates.at(-1), true);
  assert.equal(
    chooseWildGrowthStep.releaseStacking(),
    document.querySelector('[data-clash-actions]')
  );
  gameRoot.dispatchEvent(
    new dom.window.CustomEvent('olings-clash:tutorial-phase', {
      detail: { phase: 'choose-action' }
    })
  );
  assert.equal(presentationRefreshCalls, refreshCallsBeforeWildGrowth + 1);
  assert.equal(inputEnabled, true);
  assert.equal(attack.disabled, true);
  assert.equal(guard.disabled, true);
  assert.equal(skill.disabled, false);
  assert.equal(
    chooseWildGrowthStep.advanceOn.predicate({ target: skill }),
    true
  );
  chooseWildGrowthStep.onExit();
  assert.equal(confirmSuppressedStates.at(-1), true);
  assert.equal(attack.disabled, false);
  assert.equal(guard.disabled, false);

  assert.deepEqual(JSON.parse(JSON.stringify(confirmWildGrowthStep.elevate)), [
    '[data-clash-actions]',
    '[data-clash-phase]',
    '.olings-clash-arena'
  ]);
  assert.equal(confirmWildGrowthStep.releaseStacking, undefined);
  confirmWildGrowthStep.onEnter();
  assert.equal(confirmSuppressedStates.at(-1), false);
  assert.equal(
    confirmWildGrowthStep.advanceOn.predicate({ target: confirm }),
    true
  );
  confirmWildGrowthStep.onExit();
  assert.equal(opponentLosePreparations, 1);
  assert.equal(opponentTagSlot, 1);

  wildGrowthResultStep.onEnter({ tutorial: tutorialContext });
  gameRoot.dispatchEvent(
    new dom.window.CustomEvent('olings-clash:tutorial-round-result', {
      detail: { result: { localAction: 'skill', winner: 'local' } }
    })
  );
  assert.match(
    root.querySelector('[data-oe-tutorial-copy]').textContent,
    /half an Overgrowth Heart/
  );
  assert.equal(wildGrowthResultStep.dialoguePlacement, 'bottom');
  assert.equal(
    wildGrowthResultStep.elevate,
    '[data-clash-roster="local"] [data-clash-roster-slot="active"] [data-clash-health]'
  );
  wildGrowthResultStep.onExit();

  forcedTagStep.onEnter({ tutorial: tutorialContext });
  gameRoot.dispatchEvent(
    new dom.window.CustomEvent('olings-clash:tutorial-phase', {
      detail: { phase: 'tagged' }
    })
  );
  assert.match(
    root.querySelector('[data-oe-tutorial-copy]').textContent,
    /Scrap was automatically tagged in/
  );
  forcedTagStep.onExit();

  testPebbleShieldStep.onEnter({ tutorial: tutorialContext });
  gameRoot.dispatchEvent(
    new dom.window.CustomEvent('olings-clash:tutorial-phase', {
      detail: { phase: 'choose-action' }
    })
  );
  assert.equal(
    testPebbleShieldStep.advanceOn.predicate({ target: confirm }),
    true
  );
  testPebbleShieldStep.onExit();
  assert.equal(opponentWinPreparations, 1);
  assert.equal(opponentQueuedTagSlot, 2);

  const shieldDamageStep = tutorialConfig.steps.find(
    (step) => step.id === 'understand-shield-damage'
  );
  shieldDamageStep.onEnter({ tutorial: tutorialContext });
  gameRoot.dispatchEvent(
    new dom.window.CustomEvent('olings-clash:tutorial-round-result', {
      detail: {
        result: {
          localDamage: { destroyedShields: 1 },
          winner: 'opponent'
        }
      }
    })
  );
  assert.equal(heldDamageLayers.at(-1), 'shields');
  assert.match(
    root.querySelector('[data-oe-tutorial-copy]').textContent,
    /Shield absorbed the entire one-Heart hit/
  );
  shieldDamageStep.onExit();

  const overgrowthDamageStep = tutorialConfig.steps.find(
    (step) => step.id === 'understand-overgrowth-damage'
  );
  overgrowthDamageStep.onEnter({ tutorial: tutorialContext });
  gameRoot.dispatchEvent(
    new dom.window.CustomEvent('olings-clash:tutorial-round-result', {
      detail: {
        result: {
          opponentDamage: { overgrowthDamageUnits: 2 },
          winner: 'local'
        }
      }
    })
  );
  assert.equal(heldDamageLayers.at(-1), 'overgrowth');
  assert.match(
    root.querySelector('[data-oe-tutorial-copy]').textContent,
    /Shields first, then Overgrowth, and finally normal Hearts/
  );
  overgrowthDamageStep.onExit();
});
