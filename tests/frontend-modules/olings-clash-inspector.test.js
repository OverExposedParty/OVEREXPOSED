const assert = require('node:assert/strict');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const createOlingClashEffectRenderer = require('../../public/scripts/olings/clash/game/renderers/effects');
const createOlingClashHealthRenderer = require('../../public/scripts/olings/clash/game/renderers/health');
const createOlingClashInspector = require('../../public/scripts/olings/clash/game/renderers/inspector');
const createOlingClashMatchRenderer = require('../../public/scripts/olings/clash/game/renderers/match');

function createOling() {
  return {
    effects: [
      {
        abbreviation: 'WRD',
        key: 'ward',
        name: 'Ward',
        type: 'positive'
      },
      {
        abbreviation: 'BRN',
        key: 'burn',
        name: 'Burn',
        type: 'negative'
      }
    ],
    health: {
      shieldCount: 2,
      heartUnits: 5,
      maxHeartUnits: 6,
      overgrowthUnits: 1
    },
    id: 'mossy',
    moves: {
      attack: 'MEND',
      draw: 'CANOPY',
      guard: 'CLEANSE',
      skill: 'WILD GROWTH'
    },
    name: 'MOSSY',
    parts: {
      body: '/images/moss-body.svg',
      eyes: '/images/moss-eyes.svg',
      flight: '/images/moss-wings.svg',
      mouth: '/images/moss-mouth.svg'
    }
  };
}

function createInspectorDom() {
  return new JSDOM(`
    <main>
      <div data-clash-inspector hidden>
        <section class="olings-clash-inspector" tabindex="-1">
          <small data-clash-inspector-position></small>
          <div data-clash-inspector-content></div>
        </section>
      </div>
    </main>
  `);
}

test('Clash inspector maps Parts into one compact ability overview', () => {
  const dom = createInspectorDom();
  const root = dom.window.document.querySelector('main');
  const inspector = createOlingClashInspector({
    effectRenderer: createOlingClashEffectRenderer(),
    healthRenderer: createOlingClashHealthRenderer()
  });
  inspector.setAbilityCatalog([
    {
      description: 'Heal a benched Oling.',
      name: 'Mend',
      roleTags: ['support'],
      traitKey: 'moss-mouth'
    },
    {
      description: 'Remove a Negative Status.',
      name: 'Cleanse',
      roleTags: ['support'],
      traitKey: 'moss-body'
    },
    {
      description: 'Gain Overgrowth.',
      name: 'Wild Growth',
      roleTags: ['support'],
      traitKey: 'moss-wings'
    },
    {
      description: 'Grant a Shield.',
      name: 'Canopy',
      roleTags: ['guardian'],
      traitKey: 'moss-eyes'
    }
  ]);

  inspector.open(root, {
    index: 0,
    oling: createOling(),
    side: 'local',
    state: {
      lastResult: null,
      selections: { localTagSlot: null }
    }
  });

  assert.equal(root.querySelector('[data-clash-inspector]').hidden, false);
  assert.equal(root.querySelectorAll('[data-clash-inspector-tab]').length, 0);
  assert.equal(
    root.querySelector('[data-clash-inspector-role]').textContent,
    'SUPPORT / GUARDIAN'
  );
  assert.equal(
    root.querySelector('[data-clash-inspector-title]').textContent,
    'MOSSY'
  );
  assert.deepEqual(
    [...root.querySelectorAll('.olings-clash-inspector-ability > strong')].map(
      (element) => element.textContent
    ),
    ['Mend', 'Cleanse', 'Wild Growth', 'Canopy']
  );
  assert.match(
    root.querySelector('.olings-clash-inspector-ability-detail p').textContent,
    /Heal a benched Oling/
  );
  const profile = root.querySelector('.olings-clash-inspector-profile');
  assert.ok(
    profile.firstElementChild.classList.contains(
      'olings-clash-inspector-profile__art'
    )
  );
  const health = profile.querySelector('[data-clash-health]');
  assert.ok(health.closest('.olings-clash-inspector-vitality'));
  assert.ok(
    profile.lastElementChild.classList.contains(
      'olings-clash-inspector-active-effects'
    )
  );
  assert.deepEqual(
    [...health.querySelectorAll('.olings-clash-health-unit')].map((unit) => [
      unit.dataset.heartType,
      unit.dataset.heartUnits
    ]),
    [
      ['hearts', '2'],
      ['hearts', '2'],
      ['hearts', '1'],
      ['overgrowth', '1'],
      ['shields', '2'],
      ['shields', '2']
    ]
  );
  assert.equal(
    root.querySelectorAll(
      '.olings-clash-inspector-active-effects__list article'
    ).length,
    2
  );
  assert.match(profile.lastElementChild.textContent, /CURRENT STATUS/);
  assert.equal(
    root.querySelector('.olings-clash-inspector-last-move > p').textContent,
    'NO MOVE USED YET'
  );
});

test('Clash inspector keeps an empty Current Status panel in the profile row', () => {
  const dom = createInspectorDom();
  const root = dom.window.document.querySelector('main');
  const inspector = createOlingClashInspector({
    effectRenderer: createOlingClashEffectRenderer(),
    healthRenderer: createOlingClashHealthRenderer()
  });
  const oling = createOling();
  oling.effects = [];

  inspector.open(root, {
    index: 0,
    oling,
    side: 'local',
    state: { lastResult: null, selections: {} }
  });

  const profile = root.querySelector('.olings-clash-inspector-profile');
  assert.match(profile.lastElementChild.textContent, /CURRENT STATUS/);
  assert.match(profile.lastElementChild.textContent, /NO ACTIVE EFFECTS/);
  assert.equal(
    root.querySelector('.olings-clash-inspector-overview').lastElementChild
      .className,
    'olings-clash-inspector-abilities'
  );
});

test('Clash match renderer shows Bloodbound only while Blood is pending', () => {
  const dom = new JSDOM('<div data-clash-effects></div>');
  const container = dom.window.document.querySelector('[data-clash-effects]');
  const renderer = createOlingClashMatchRenderer({
    effectRenderer: createOlingClashEffectRenderer()
  });
  const oling = createOling();
  oling.pendingReclaimUnits = 1;

  renderer.renderEffects(container, oling, createOlingClashEffectRenderer());
  assert.equal(
    container
      .querySelector('[data-effect-key="bloodbound"] img')
      .getAttribute('src'),
    '/images/olings/clash/ui/effects/bloodbound.svg'
  );

  oling.pendingReclaimUnits = 0;
  renderer.renderEffects(container, oling, createOlingClashEffectRenderer());
  assert.equal(container.querySelector('[data-effect-key="bloodbound"]'), null);
});

test('Clash effect renderer preserves unchanged status icon nodes', () => {
  const dom = new JSDOM('<div data-clash-effects></div>');
  const container = dom.window.document.querySelector('[data-clash-effects]');
  const effectRenderer = createOlingClashEffectRenderer();
  const renderer = createOlingClashMatchRenderer({ effectRenderer });
  const oling = createOling();
  oling.effects = [
    { abbreviation: 'WRD', key: 'warded', name: 'Warded', type: 'positive' }
  ];

  renderer.renderEffects(container, oling, effectRenderer);
  const ward = container.querySelector('[data-effect-key="warded"]');
  const wardIcon = ward.querySelector('img');
  oling.effects.push({
    abbreviation: 'BRN',
    key: 'burn',
    name: 'Burn',
    type: 'negative'
  });
  renderer.renderEffects(container, oling, effectRenderer);

  assert.equal(container.querySelector('[data-effect-key="warded"]'), ward);
  assert.equal(
    container.querySelector('[data-effect-key="warded"] img'),
    wardIcon
  );
  assert.ok(container.querySelector('[data-effect-key="burn"]'));
});

test('Clash inspector resolves a Part asset whose filename omits its build prefix', () => {
  const dom = createInspectorDom();
  const root = dom.window.document.querySelector('main');
  const inspector = createOlingClashInspector();
  const oling = createOling();
  oling.parts = {
    body: '/images/trash-body.svg',
    eyes: '/images/trash-eyes.svg',
    flight: '/images/balloons.svg',
    mouth: '/images/trash-mouth.svg'
  };
  inspector.setAbilityCatalog([
    {
      description: 'Apply Junk.',
      name: 'Junkyard',
      traitKey: 'trash-balloons'
    }
  ]);

  inspector.open(root, {
    index: 0,
    oling,
    side: 'local',
    state: { selections: {} }
  });

  assert.equal(
    [...root.querySelectorAll('.olings-clash-inspector-ability > strong')][2]
      .textContent,
    'Junkyard'
  );
});

test('Clash inspector centres cadence pips with their ability name', () => {
  const dom = createInspectorDom();
  const root = dom.window.document.querySelector('main');
  const inspector = createOlingClashInspector();
  const oling = createOling();
  oling.abilityProgress = [
    {
      abilityKey: 'moss-harden',
      activationCount: 1
    }
  ];
  inspector.setAbilityCatalog([
    {
      cadence: { every: 2, mode: 'cumulative' },
      key: 'moss-harden',
      name: 'Harden',
      traitKey: 'moss-eyes'
    }
  ]);

  inspector.open(root, {
    index: 0,
    oling,
    side: 'local',
    state: { selections: {} }
  });

  const card = root.querySelector('[data-clash-inspector-ability="eyes"]');
  const name = card.querySelector(':scope > strong');
  const pips = name.querySelector('.olings-clash-activation-pips');
  assert.equal(name.firstChild.textContent, 'Harden');
  assert.ok(pips);
  assert.equal(pips.parentElement, name);
  assert.equal(
    [...card.children].some((child) =>
      child.classList.contains('olings-clash-activation-pips')
    ),
    false
  );
});

test('Clash inspector uses accessible icons instead of text ability badges', () => {
  const dom = createInspectorDom();
  const root = dom.window.document.querySelector('main');
  const inspector = createOlingClashInspector();
  const oling = createOling();
  oling.effects.push({
    key: 'warded',
    targetPart: 'mouth',
    type: 'positive'
  });

  inspector.open(root, {
    index: 0,
    oling,
    side: 'local',
    state: { selections: {} }
  });

  const badge = root.querySelector(
    '[data-clash-inspector-ability="mouth"] .olings-clash-inspector-ability__states em'
  );
  assert.equal(badge.textContent, '');
  assert.equal(badge.getAttribute('aria-label'), 'PROTECTED');
  assert.equal(
    badge.querySelector('img').getAttribute('src'),
    '/images/olings/clash/ui/effects/warded.svg'
  );
});

test('Clash inspector renders per-Oling move history and live status safely', () => {
  const dom = createInspectorDom();
  const root = dom.window.document.querySelector('main');
  const inspector = createOlingClashInspector({
    effectRenderer: createOlingClashEffectRenderer(),
    healthRenderer: createOlingClashHealthRenderer()
  });
  const state = {
    lastResult: null,
    selections: { localTagSlot: 1 }
  };
  const oling = createOling();
  oling.teamSlot = 1;
  oling.lastMove = {
    action: 'skill',
    activationStatus: 'activated',
    outcome: 'win',
    round: 3
  };
  inspector.open(root, {
    index: 1,
    oling,
    side: 'opponent',
    state
  });

  assert.equal(
    root.querySelectorAll(
      '.olings-clash-inspector-active-effects__list article'
    ).length,
    2
  );
  assert.deepEqual(
    [...root.querySelectorAll('.olings-clash-effect__icon')].map((icon) =>
      icon.getAttribute('src')
    ),
    [
      '/images/olings/clash/ui/effects/warded.svg',
      '/images/olings/clash/ui/effects/burn.svg'
    ]
  );
  const lastMove = root.querySelector('[data-clash-inspector-last-move]');
  assert.match(lastMove.textContent, /WILD GROWTH/);
  assert.match(lastMove.textContent, /SKILL/);
  assert.match(lastMove.textContent, /WON/);
  assert.match(lastMove.textContent, /ROUND 3/);
  assert.match(lastMove.textContent, /ACTIVATED/);
  assert.equal(
    root.querySelector('[data-clash-inspector-position]').textContent,
    'OPPONENT · BENCH'
  );
  assert.doesNotMatch(
    root.querySelector('[data-clash-inspector-panel]').textContent,
    /QUEUED/
  );

  oling.lastMove.activationStatus = 'revealed';
  inspector.render(root);
  assert.doesNotMatch(
    root.querySelector('[data-clash-inspector-last-move]').textContent,
    /ACTIVATED/
  );

  inspector.selectAbility(root, 'body');
  assert.equal(
    root.querySelector('[data-clash-inspector-ability-detail]').dataset
      .clashInspectorAbilityDetail,
    'body'
  );
});

test('Clash match renderer exposes only roster icons as inspection controls', () => {
  const dom = new JSDOM(`
    <main>
      <section data-clash-roster="local">
        <article data-clash-roster-slot>
          <div class="olings-clash-roster-slot__icon"></div>
          <div class="olings-clash-roster-slot__status">
            <strong></strong><div data-clash-health></div><div data-clash-effects></div>
          </div>
        </article>
      </section>
      <article data-clash-fighter="local">
        <div class="olings-clash-fighter__art"></div>
      </article>
      <section data-clash-roster="opponent"></section>
      <section data-clash-actions>
        <button data-clash-action="attack"><img data-clash-move-image><strong data-clash-move-name></strong></button>
        <button data-clash-action="guard"><img data-clash-move-image><strong data-clash-move-name></strong></button>
        <button data-clash-action="skill"><img data-clash-move-image><strong data-clash-move-name></strong></button>
        <button data-clash-action="draw" data-clash-passive><img data-clash-move-image><strong data-clash-move-name></strong></button>
      </section>
    </main>
  `);
  const root = dom.window.document.querySelector('main');
  const abilities = {
    body: {
      imagePath: '/images/olings/clash/abilities/moss/cleanse.svg',
      name: 'Cleanse'
    },
    flight: {
      effects: [
        {
          handler: 'grant_overgrowth_to_self_or_tag_recipient',
          target: { selector: 'self-or-tag-recipient' }
        }
      ],
      imagePath: '/images/olings/clash/abilities/moss/wild-growth.svg',
      key: 'moss-wild-growth',
      name: 'Wild Growth'
    },
    eyes: {
      cadence: { every: 2, mode: 'cumulative' },
      imagePath: '/images/olings/clash/abilities/moss/canopy.svg',
      key: 'moss-canopy',
      name: 'Canopy',
      revision: 2
    },
    mouth: {
      imagePath: '/images/olings/clash/abilities/moss/mend.svg',
      name: 'Mend'
    }
  };
  const renderer = createOlingClashMatchRenderer({
    effectRenderer: createOlingClashEffectRenderer(),
    healthRenderer: createOlingClashHealthRenderer(),
    resolveAbility: (_oling, partKey) => abilities[partKey]
  });
  const oling = createOling();
  oling.teamSlot = 2;
  oling.abilityProgress = [
    {
      abilityKey: 'moss-canopy',
      abilityRevision: 2,
      activationCount: 1
    }
  ];

  renderer.render(root, {
    lastOutcome: 'NO RESULT',
    playerEffects: {
      local: [
        {
          abbreviation: 'BLK',
          key: 'blocked',
          name: 'Blocked',
          type: 'negative'
        }
      ],
      opponent: []
    },
    round: 1,
    selections: { localAction: null },
    teams: { local: [oling], opponent: [] }
  });

  const triggers = [...root.querySelectorAll('[data-clash-inspect-side]')];
  assert.equal(triggers.length, 1);
  assert.equal(
    triggers.every((trigger) => trigger.getAttribute('role') === 'button'),
    true
  );
  assert.equal(
    triggers.every((trigger) => trigger.tabIndex === 0),
    true
  );
  assert.equal(triggers[0].getAttribute('aria-label'), 'View MOSSY details');
  assert.equal(triggers[0].dataset.olingId, 'mossy');
  assert.equal(triggers[0].dataset.teamSlot, '2');
  assert.equal(
    root.querySelector('.olings-clash-fighter__art').hasAttribute('role'),
    false
  );
  const positiveGroup = root.querySelector('[data-effect-group="positive"]');
  const negativeGroup = root.querySelector('[data-effect-group="negative"]');
  assert.equal(
    positiveGroup.querySelector('[data-effect-key]').dataset.effectKey,
    'ward'
  );
  assert.deepEqual(
    [...negativeGroup.querySelectorAll('[data-effect-key]')].map(
      (effect) => effect.dataset.effectKey
    ),
    ['burn', 'blocked']
  );
  assert.deepEqual(
    [...root.querySelectorAll('.olings-clash-effect__icon')].map((icon) =>
      icon.getAttribute('src')
    ),
    [
      '/images/olings/clash/ui/effects/warded.svg',
      '/images/olings/clash/ui/effects/burn.svg',
      '/images/olings/clash/ui/effects/blocked.svg'
    ]
  );
  assert.equal(root.querySelector('[data-clash-active-name]'), null);
  assert.deepEqual(
    [...root.querySelectorAll('[data-clash-move-image]')].map((image) =>
      image.getAttribute('src')
    ),
    [
      '/images/olings/clash/abilities/moss/mend.svg',
      '/images/olings/clash/abilities/moss/cleanse.svg',
      '/images/olings/clash/abilities/moss/wild-growth.svg',
      '/images/olings/clash/abilities/moss/canopy.svg'
    ]
  );
  assert.deepEqual(
    [...root.querySelectorAll('[data-clash-move-name]')].map(
      (label) => label.firstChild?.textContent
    ),
    ['Mend', 'Cleanse', 'Wild Growth', 'Canopy']
  );
  const draw = root.querySelector('[data-clash-action="draw"]');
  const drawPips = [...draw.querySelectorAll('.olings-clash-activation-pip')];
  assert.deepEqual(
    drawPips.map((pip) => pip.textContent),
    ['●', '○']
  );
  assert.equal(drawPips[0].classList.contains('is-filled'), true);
  assert.equal(drawPips[1].classList.contains('is-empty'), true);
  assert.match(draw.getAttribute('aria-label'), /next qualifying result/);
  assert.equal(draw.classList.contains('is-passive'), true);
  assert.equal(draw.hasAttribute('aria-pressed'), false);
  assert.equal(
    draw.querySelector('[data-clash-ability-state-icon]').getAttribute('src'),
    '/images/olings/clash/ui/icons/passive.svg'
  );
  oling.abilityProgress = [];
  renderer.renderActions(root, oling, null, [], {
    effects: [
      {
        abilityKey: 'moss-canopy',
        activationThreshold: 2,
        afterActivationCount: 1,
        playerSlot: 'local',
        status: 'progressed',
        triggered: false
      }
    ]
  });
  assert.deepEqual(
    [...draw.querySelectorAll('.olings-clash-activation-pip')].map(
      (pip) => pip.textContent
    ),
    ['●', '○']
  );
  oling.abilityProgress = [
    {
      abilityKey: 'moss-canopy',
      abilityRevision: 2,
      activationCount: 1
    }
  ];
  oling.effects.push({
    key: 'suppressed',
    name: 'Suppressed',
    targetPart: 'eyes',
    type: 'negative'
  });
  renderer.renderActions(root, oling, null, []);
  assert.deepEqual(
    [...draw.querySelectorAll('.olings-clash-activation-pip')].map(
      (pip) => pip.textContent
    ),
    ['●', '○']
  );
  assert.equal(
    draw.querySelector('.olings-clash-activation-pip.is-primed'),
    null
  );
  assert.equal(
    draw.querySelector('[data-clash-ability-state-icon]').getAttribute('src'),
    '/images/olings/clash/ui/effects/suppressed.svg'
  );
  const skill = root.querySelector('[data-clash-action="skill"]');
  assert.equal(skill.classList.contains('has-tag-synergy'), true);
  assert.equal(skill.classList.contains('is-tag-synergy-live'), false);

  renderer.renderActions(root, oling, null, [], null, true);
  assert.equal(skill.classList.contains('is-tag-synergy-live'), true);
  assert.match(skill.getAttribute('aria-label'), /Tag synergy is active/);

  oling.effects.push({
    key: 'suppressed',
    name: 'Suppressed',
    targetPart: 'flight',
    type: 'negative'
  });
  renderer.renderActions(root, oling, null, [], null, true);
  assert.equal(skill.classList.contains('has-tag-synergy'), true);
  assert.equal(skill.classList.contains('is-tag-synergy-live'), false);

  oling.effects = oling.effects.filter(
    (effect) => effect.targetPart !== 'flight'
  );
  renderer.renderActions(
    root,
    oling,
    null,
    [],
    { effects: [], winner: 'opponent' },
    true
  );
  assert.equal(skill.classList.contains('has-tag-synergy'), true);
  assert.equal(skill.classList.contains('is-tag-synergy-live'), false);
  assert.equal(skill.classList.contains('is-tag-synergy-triggered'), false);

  renderer.renderActions(
    root,
    oling,
    null,
    [],
    {
      effects: [
        {
          abilityKey: 'moss-wild-growth',
          appliedUnits: 1,
          playerSlot: 'local',
          status: 'resolved',
          targetReason: 'tag-recipient'
        }
      ]
    },
    true
  );
  assert.equal(skill.classList.contains('is-tag-synergy-triggered'), true);
  assert.equal(skill.classList.contains('is-tag-synergy-live'), false);
});

test('Clash match renderer locks a Suppressed ability without disabling its base action', () => {
  const dom = new JSDOM(`
    <main>
      <section data-clash-actions>
        <button data-clash-action="attack"></button>
        <button data-clash-action="guard"></button>
        <button data-clash-action="skill"></button>
      </section>
    </main>
  `);
  const root = dom.window.document.querySelector('main');
  const oling = createOling();
  oling.effects.push({
    key: 'suppressed',
    name: 'Suppressed',
    targetPart: 'body',
    type: 'negative'
  });
  const renderer = createOlingClashMatchRenderer({
    effectRenderer: createOlingClashEffectRenderer()
  });

  renderer.renderActions(root, oling, null);

  const attack = root.querySelector('[data-clash-action="attack"]');
  const guard = root.querySelector('[data-clash-action="guard"]');
  assert.equal(attack.classList.contains('is-ability-locked'), false);
  assert.equal(guard.classList.contains('is-ability-locked'), true);
  assert.equal(guard.dataset.abilityLocked, 'true');
  assert.equal(guard.disabled, false);
  assert.match(guard.getAttribute('aria-label'), /Ability suppressed/);
  assert.match(guard.getAttribute('title'), /base guard remains available/);
  assert.equal(
    guard.querySelector('[data-clash-ability-state-icon]').getAttribute('src'),
    '/images/olings/clash/ui/effects/suppressed.svg'
  );
});

test('Clash action padlocks are reserved for effects that prevent selectable actions', () => {
  const dom = new JSDOM(`
    <main>
      <section data-clash-actions>
        <button data-clash-action="attack"></button>
        <button data-clash-action="guard"></button>
        <button data-clash-action="draw" data-clash-passive></button>
      </section>
    </main>
  `);
  const root = dom.window.document.querySelector('main');
  const oling = createOling();
  oling.effects.push(
    {
      key: 'blocked',
      name: 'Attack Lock',
      parameters: { preventsAction: true },
      targetPart: 'mouth',
      type: 'negative'
    },
    {
      key: 'blocked',
      name: 'Draw Lock',
      parameters: { preventsAction: true },
      targetPart: 'eyes',
      type: 'negative'
    }
  );
  const renderer = createOlingClashMatchRenderer({
    effectRenderer: createOlingClashEffectRenderer()
  });

  renderer.renderActions(root, oling, null);

  const attack = root.querySelector('[data-clash-action="attack"]');
  const guard = root.querySelector('[data-clash-action="guard"]');
  const draw = root.querySelector('[data-clash-action="draw"]');
  assert.equal(attack.dataset.actionLocked, 'true');
  assert.equal(attack.classList.contains('is-action-locked'), true);
  assert.match(attack.getAttribute('aria-label'), /Action unavailable/);
  assert.equal(guard.dataset.actionLocked, 'false');
  assert.equal(draw.dataset.actionLocked, 'false');
  assert.equal(draw.classList.contains('is-action-locked'), false);
});

test('Clash action summary remains visible through round resolution', () => {
  const dom = new JSDOM(`
    <main>
      <div data-clash-action-summary aria-hidden="true"></div>
    </main>
  `);
  const root = dom.window.document.querySelector('main');
  const oling = createOling();
  oling.abilityProgress = [
    {
      abilityKey: 'moss-canopy',
      abilityRevision: 2,
      activationCount: 1
    }
  ];
  const abilities = {
    body: {
      description: 'Remove one Negative Status from a chosen teammate.',
      effects: [{ mechanic: 'cleanse', parameters: {} }],
      imagePath: '/images/olings/clash/abilities/moss/cleanse.svg',
      key: 'moss-cleanse',
      name: 'Cleanse'
    },
    eyes: {
      cadence: { every: 2, mode: 'cumulative' },
      description: 'Gain one Shield after surviving a Draw.',
      effects: [{ mechanic: 'grant-shield', parameters: {} }],
      imagePath: '/images/olings/clash/abilities/moss/canopy.svg',
      key: 'moss-canopy',
      name: 'Canopy',
      revision: 2
    },
    flight: {
      description:
        'Gain 1/2 Overgrowth. If this Oling successfully Tags, grant it to the incoming Oling instead.',
      effects: [
        {
          handler: 'grant_overgrowth_to_self_or_tag_recipient',
          target: { selector: 'self-or-tag-recipient' }
        }
      ],
      imagePath: '/images/olings/clash/abilities/moss/wild-growth.svg',
      key: 'moss-wild-growth',
      name: 'Wild Growth'
    },
    mouth: {
      description: 'Heal the most damaged benched Oling by 1/2 Heart.',
      effects: [{ mechanic: 'heal', parameters: { amountUnits: 1 } }],
      imagePath: '/images/olings/clash/abilities/moss/mend.svg',
      key: 'moss-mend',
      name: 'Mend'
    }
  };
  const renderer = createOlingClashMatchRenderer({
    effectRenderer: createOlingClashEffectRenderer(),
    resolveAbility: (_oling, partKey) => abilities[partKey]
  });
  const summary = root.querySelector('[data-clash-action-summary]');

  renderer.renderActionSummary(root, oling, 'attack', {
    phase: 'choose-action'
  });

  assert.equal(summary.classList.contains('is-visible'), true);
  assert.equal(summary.getAttribute('aria-hidden'), 'false');
  assert.equal(summary.dataset.abilityKey, 'moss-mend');
  assert.equal(
    summary.querySelector('.olings-clash-action-summary__copy > strong')
      .textContent,
    'Mend'
  );
  assert.equal(
    summary.querySelector('.olings-clash-action-summary__fraction sup')
      .textContent,
    '1'
  );
  assert.equal(
    summary.querySelector('.olings-clash-action-summary__fraction sub')
      .textContent,
    '2'
  );
  assert.equal(
    summary
      .querySelector('.olings-clash-action-summary__ability-icon')
      .getAttribute('src'),
    '/images/olings/clash/abilities/moss/mend.svg'
  );
  assert.equal(
    summary
      .querySelector('.olings-clash-action-summary__inline-icon')
      .getAttribute('src'),
    '/images/olings/clash/ui/health/hearts/normal/half.svg'
  );
  assert.equal(
    summary.querySelector('.olings-clash-action-summary__cue-icon'),
    null
  );

  renderer.renderActionSummary(root, oling, 'skill', {
    phase: 'choose-action'
  });
  assert.equal(summary.classList.contains('has-tag-synergy'), true);
  assert.equal(summary.classList.contains('is-tag-synergy-live'), false);
  assert.deepEqual(
    [
      ...summary.querySelectorAll('.olings-clash-action-summary__inline-icon')
    ].map((icon) => icon.getAttribute('src')),
    [
      '/images/olings/clash/ui/health/hearts/overgrowth/half.svg',
      '/images/olings/clash/ui/actions/tag.svg'
    ]
  );

  renderer.renderActionSummary(root, oling, 'skill', {
    phase: 'choose-action',
    tagQueued: true
  });
  assert.equal(summary.classList.contains('is-tag-synergy-live'), true);

  renderer.renderActionSummary(root, oling, 'skill', {
    phase: 'resolving',
    result: {
      effects: [
        {
          abilityKey: 'moss-wild-growth',
          appliedUnits: 1,
          playerSlot: 'local',
          status: 'resolved',
          targetReason: 'tag-recipient'
        }
      ]
    },
    tagQueued: true
  });
  assert.equal(summary.classList.contains('is-tag-synergy-triggered'), true);
  assert.equal(summary.classList.contains('is-tag-synergy-live'), false);

  renderer.renderActionSummary(root, oling, 'draw', { phase: 'resolving' });
  assert.equal(summary.dataset.abilityKey, 'moss-canopy');
  assert.equal(summary.classList.contains('is-updating'), true);
  assert.equal(
    summary.querySelector('.olings-clash-action-summary__copy > strong')
      .firstChild.textContent,
    'DRAW: Canopy'
  );
  assert.deepEqual(
    [...summary.querySelectorAll('.olings-clash-activation-pip')].map(
      (pip) => pip.textContent
    ),
    ['●', '○']
  );
  assert.match(summary.getAttribute('aria-label'), /next qualifying result/);

  renderer.renderActionSummary(root, oling, 'attack', { phase: 'locked' });
  assert.equal(summary.classList.contains('is-visible'), true);
  assert.equal(summary.classList.contains('is-dismissing'), false);
  assert.equal(summary.getAttribute('aria-hidden'), 'false');
  assert.notEqual(summary.firstElementChild, null);

  renderer.renderActionSummary(root, oling, 'attack', { phase: 'reveal' });
  assert.equal(summary.classList.contains('is-visible'), true);
  assert.equal(summary.getAttribute('aria-hidden'), 'false');

  renderer.renderActionSummary(root, oling, 'attack', { phase: 'tagged' });
  assert.equal(summary.classList.contains('is-visible'), false);
  assert.equal(summary.getAttribute('aria-hidden'), 'true');

  oling.effects.push({
    key: 'suppressed',
    targetPart: 'body',
    type: 'negative'
  });
  renderer.renderActionSummary(root, oling, 'guard', {
    phase: 'choose-action'
  });
  assert.equal(summary.classList.contains('is-ability-locked'), true);
  assert.match(summary.getAttribute('aria-label'), /Ability suppressed/);
  assert.equal(
    summary
      .querySelector('.olings-clash-action-summary__lock-icon')
      .getAttribute('src'),
    '/images/olings/clash/ui/effects/suppressed.svg'
  );
});

test('Clash ability reveal identifies both abilities and their outcomes', () => {
  const dom = new JSDOM(`
    <main>
      <div data-clash-ability-reveal hidden>
        <article data-clash-revealed-ability="local">
          <div class="olings-clash-ability-reveal__tile">
            <img data-clash-revealed-ability-image alt="">
            <strong data-clash-revealed-ability-name></strong>
          </div>
          <small data-clash-revealed-action></small>
          <div data-clash-revealed-effects></div>
        </article>
        <strong data-clash-reveal-versus>VS</strong>
        <article data-clash-revealed-ability="opponent">
          <div class="olings-clash-ability-reveal__tile">
            <img data-clash-revealed-ability-image alt="">
            <strong data-clash-revealed-ability-name></strong>
          </div>
          <small data-clash-revealed-action></small>
          <div data-clash-revealed-effects></div>
        </article>
      </div>
      <aside data-clash-opponent-ability-explanation hidden>
        <img data-clash-opponent-ability-explanation-image alt="">
        <strong data-clash-opponent-ability-explanation-name></strong>
        <strong data-clash-opponent-ability-explanation-cadence hidden></strong>
        <span data-clash-opponent-ability-explanation-description></span>
      </aside>
    </main>
  `);
  const root = dom.window.document.querySelector('main');
  const local = createOling();
  const opponent = {
    ...createOling(),
    id: 'marrow',
    moves: { ...createOling().moves, draw: 'READ', skill: 'WITHER' },
    name: 'MARROW'
  };
  const abilities = {
    'mossy:body': {
      description: 'Remove one Negative Status.',
      imagePath: '/images/cleanse.svg',
      key: 'moss-cleanse',
      name: 'Cleanse'
    },
    'mossy:eyes': {
      cadence: { every: 2, mode: 'cumulative' },
      description: 'Grant Overgrowth after a Draw.',
      imagePath: '/images/canopy.svg',
      key: 'moss-canopy',
      name: 'Canopy',
      revision: 2
    },
    'mossy:flight': {
      description:
        'Gain 1/2 Overgrowth. If this Oling successfully Tags, grant it to the incoming Oling instead.',
      effects: [
        {
          handler: 'grant_overgrowth_to_self_or_tag_recipient',
          target: { selector: 'self-or-tag-recipient' }
        }
      ],
      imagePath: '/images/wild-growth.svg',
      key: 'moss-wild-growth',
      name: 'Wild Growth'
    },
    'marrow:eyes': {
      description: 'Read the opponent after a Draw.',
      imagePath: '/images/read.svg',
      key: 'bone-read',
      name: 'Read'
    },
    'marrow:flight': {
      description: 'Prevent the opponent from applying a Positive Status.',
      imagePath: '/images/wither.svg',
      key: 'bone-wither',
      name: 'Wither'
    }
  };
  const renderer = createOlingClashMatchRenderer({
    effectRenderer: createOlingClashEffectRenderer(),
    resolveAbility: (oling, partKey) => abilities[`${oling.id}:${partKey}`]
  });
  const reveal = root.querySelector('[data-clash-ability-reveal]');
  const localCard = root.querySelector('[data-clash-revealed-ability="local"]');
  const opponentCard = root.querySelector(
    '[data-clash-revealed-ability="opponent"]'
  );

  renderer.renderAbilityReveal(
    root,
    { teams: { local: [local], opponent: [opponent] } },
    {
      localAction: 'guard',
      opponentAction: 'skill',
      winner: 'opponent'
    }
  );

  assert.equal(reveal.hidden, false);
  assert.equal(
    localCard.querySelector('[data-clash-revealed-ability-name]').textContent,
    'CLEANSE'
  );
  assert.equal(localCard.dataset.activationStatus, 'failed');
  assert.equal(localCard.classList.contains('is-loser'), true);
  assert.equal(localCard.classList.contains('is-winner'), false);
  assert.equal(
    opponentCard.querySelector('[data-clash-revealed-ability-name]')
      .textContent,
    'WITHER'
  );
  assert.equal(
    opponentCard.querySelector('[data-clash-revealed-action]').textContent,
    'SKILL'
  );
  assert.equal(
    opponentCard.querySelector('[data-clash-revealed-ability-name]')
      .parentElement.className,
    'olings-clash-ability-reveal__tile'
  );
  assert.equal(
    opponentCard.querySelector('[data-clash-revealed-action]').parentElement,
    opponentCard
  );
  assert.equal(opponentCard.dataset.activationStatus, 'revealed');
  assert.equal(opponentCard.classList.contains('is-winner'), true);
  assert.equal(opponentCard.classList.contains('is-loser'), false);
  assert.equal(
    opponentCard.querySelector('[data-clash-revealed-ability-description]'),
    null
  );
  const opponentExplanation = root.querySelector(
    '[data-clash-opponent-ability-explanation]'
  );
  assert.equal(opponentExplanation.hidden, true);

  renderer.renderAbilityReveal(
    root,
    { teams: { local: [local], opponent: [opponent] } },
    {
      localAction: 'guard',
      opponentAction: 'skill',
      result: {
        effects: [
          {
            abilityKey: 'bone-wither',
            mechanic: 'block',
            playerSlot: 'opponent',
            status: 'resolved',
            statusKey: 'blocked',
            statusResult: 'applied',
            targetPlayerSlot: 'local'
          },
          {
            abilityKey: 'moss-wild-growth',
            appliedUnits: 1,
            mechanic: 'grant-overgrowth',
            playerSlot: 'opponent',
            status: 'resolved',
            targetPlayerSlot: 'opponent'
          },
          {
            abilityKey: 'vampire-blood-bank',
            appliedUnits: 2,
            converted: true,
            mechanic: 'store-resource',
            playerSlot: 'opponent',
            resource: 'blood',
            status: 'resolved',
            storedResourceUnits: 1,
            targetPlayerSlot: 'opponent'
          }
        ],
        triggeredStatuses: []
      },
      winner: 'opponent'
    }
  );
  const localEffect = localCard.querySelector(
    '[data-clash-revealed-effects] img'
  );
  const opponentEffects = [
    ...opponentCard.querySelectorAll('[data-clash-revealed-effects] img')
  ];
  assert.equal(
    localEffect.getAttribute('src'),
    '/images/olings/clash/ui/effects/blocked.svg'
  );
  assert.equal(localEffect.dataset.sourceSide, 'opponent');
  assert.deepEqual(
    opponentEffects.map((effect) => effect.getAttribute('src')),
    [
      '/images/olings/clash/ui/health/hearts/overgrowth/half.svg',
      '/images/olings/clash/ui/health/hearts/normal/full.svg'
    ]
  );
  assert.equal(opponentEffects[0].dataset.sourceSide, 'opponent');
  assert.equal(opponentExplanation.hidden, false);
  assert.equal(
    opponentExplanation.querySelector(
      '[data-clash-opponent-ability-explanation-name]'
    ).textContent,
    'WITHER'
  );
  assert.equal(
    opponentExplanation.querySelector(
      '[data-clash-opponent-ability-explanation-description]'
    ).textContent,
    'Prevent the opponent from applying a Positive Status.'
  );
  assert.equal(
    opponentExplanation
      .querySelector('[data-clash-opponent-ability-explanation-image]')
      .getAttribute('src'),
    '/images/wither.svg'
  );

  renderer.renderAbilityReveal(
    root,
    { teams: { local: [local], opponent: [opponent] } },
    {
      localAction: 'guard',
      opponentAction: 'skill',
      result: {
        effects: [],
        triggeredStatuses: [
          { outcome: 'activation-suppressed', playerSlot: 'opponent' }
        ]
      },
      winner: 'opponent'
    }
  );
  assert.equal(opponentCard.dataset.activationStatus, 'suppressed');
  assert.equal(opponentExplanation.hidden, true);
  assert.equal(
    opponentCard.querySelector('[data-clash-revealed-effects]').hidden,
    true
  );

  renderer.renderAbilityReveal(
    root,
    { teams: { local: [local], opponent: [opponent] } },
    {
      localAction: 'guard',
      opponentAction: 'skill',
      result: {
        effects: [
          {
            abilityKey: 'bone-wither',
            outcome: 'effect-prevented',
            playerSlot: 'opponent'
          },
          {
            abilityKey: 'vampire-reclaim',
            playerSlot: 'opponent',
            status: 'resolved'
          }
        ],
        triggeredStatuses: []
      },
      winner: 'opponent'
    }
  );
  assert.equal(opponentCard.dataset.activationStatus, 'blocked');
  assert.equal(opponentExplanation.hidden, true);

  renderer.renderAbilityReveal(
    root,
    { teams: { local: [local], opponent: [opponent] } },
    {
      localAction: 'guard',
      opponentAction: 'skill',
      result: {
        effects: [
          {
            abilityKey: 'bone-wither',
            playerSlot: 'opponent',
            status: 'no-target'
          }
        ],
        triggeredStatuses: []
      },
      winner: 'opponent'
    }
  );
  assert.equal(opponentCard.dataset.activationStatus, 'activated');
  assert.equal(opponentExplanation.hidden, false);

  renderer.renderAbilityReveal(
    root,
    { teams: { local: [local], opponent: [opponent] } },
    {
      localAction: 'guard',
      opponentAction: 'skill',
      result: {
        effects: [
          {
            abilityKey: 'bone-wither',
            activationThreshold: 2,
            afterActivationCount: 1,
            playerSlot: 'opponent',
            status: 'progressed',
            triggered: false
          }
        ],
        triggeredStatuses: []
      },
      winner: 'opponent'
    }
  );
  assert.equal(opponentCard.dataset.activationStatus, 'progressed');
  assert.equal(opponentExplanation.hidden, false);
  assert.equal(
    opponentExplanation.querySelector(
      '[data-clash-opponent-ability-explanation-cadence]'
    ).textContent,
    ' — PROGRESS 1/2'
  );

  renderer.renderAbilityReveal(
    root,
    { teams: { local: [local], opponent: [opponent] } },
    {
      localAction: 'guard',
      opponentAction: 'guard',
      winner: 'draw'
    }
  );
  assert.equal(reveal.classList.contains('is-draw-result'), true);
  assert.equal(
    localCard.querySelector('[data-clash-revealed-ability-name]').firstChild
      .textContent,
    'CANOPY'
  );
  assert.equal(
    opponentCard.querySelector('[data-clash-revealed-ability-name]')
      .textContent,
    'READ'
  );
  assert.equal(
    localCard.querySelector('[data-clash-revealed-action]').textContent,
    'DRAW'
  );
  assert.equal(
    opponentCard.querySelector('[data-clash-revealed-action]').textContent,
    'DRAW'
  );
  assert.equal(localCard.dataset.activationStatus, 'revealed');
  assert.equal(opponentCard.dataset.activationStatus, 'revealed');
  assert.equal(opponentExplanation.hidden, true);

  renderer.renderAbilityReveal(
    root,
    { teams: { local: [local], opponent: [opponent] } },
    {
      localAction: 'guard',
      opponentAction: 'guard',
      result: {
        effects: [
          {
            abilityKey: 'moss-canopy',
            activationThreshold: 2,
            afterActivationCount: 1,
            playerSlot: 'local',
            status: 'progressed',
            triggered: false
          }
        ],
        triggeredStatuses: [],
        winner: 'draw'
      },
      winner: 'draw'
    }
  );
  assert.equal(reveal.classList.contains('is-draw-result'), true);
  assert.equal(localCard.classList.contains('is-draw'), true);
  assert.equal(opponentCard.classList.contains('is-draw'), true);
  assert.equal(localCard.classList.contains('is-winner'), false);
  assert.equal(opponentCard.classList.contains('is-loser'), false);
  assert.equal(
    reveal.querySelector('[data-clash-reveal-versus]').textContent,
    '='
  );
  assert.equal(
    localCard.querySelector('[data-clash-revealed-ability-name]').firstChild
      .textContent,
    'CANOPY'
  );
  assert.equal(
    opponentCard.querySelector('[data-clash-revealed-ability-name]')
      .textContent,
    'READ'
  );
  assert.equal(
    localCard.querySelector('[data-clash-revealed-action]').textContent,
    'DRAW'
  );
  assert.deepEqual(
    [...localCard.querySelectorAll('.olings-clash-activation-pip')].map(
      (pip) => pip.textContent
    ),
    ['●', '○']
  );
  assert.equal(
    opponentCard.querySelector('[data-clash-revealed-action]').textContent,
    'DRAW'
  );
  assert.equal(localCard.dataset.clashRevealedAction, 'draw');
  assert.equal(localCard.dataset.activationStatus, 'progressed');
  assert.equal(localCard.classList.contains('is-progressed'), true);
  assert.equal(localCard.classList.contains('is-activated'), false);
  assert.equal(opponentCard.dataset.activationStatus, 'activated');
  assert.equal(opponentCard.dataset.clashRevealedAction, 'draw');
  assert.equal(localCard.hasAttribute('data-clash-action'), false);
  assert.equal(opponentCard.hasAttribute('data-clash-action'), false);
  assert.equal(reveal.querySelector('[data-clash-ability-state-icon]'), null);
  assert.equal(
    reveal.getAttribute('aria-label'),
    'Draw. Revealed Clash abilities.'
  );

  renderer.renderAbilityReveal(
    root,
    { teams: { local: [local], opponent: [opponent] } },
    {
      localAction: 'guard',
      opponentAction: 'guard',
      result: {
        effects: [
          {
            abilityKey: 'moss-canopy',
            activationThreshold: 2,
            afterActivationCount: 0,
            playerSlot: 'local',
            status: 'resolved',
            triggered: true
          }
        ],
        triggeredStatuses: [],
        winner: 'draw'
      },
      winner: 'draw'
    }
  );
  const activatedPips = localCard.querySelector('[data-clash-activation-pips]');
  assert.equal(activatedPips.classList.contains('is-activated'), true);
  assert.deepEqual(
    [...activatedPips.children].map((pip) => pip.textContent),
    ['●', '●']
  );

  renderer.renderAbilityReveal(
    root,
    { teams: { local: [local], opponent: [opponent] } },
    {
      localAction: 'skill',
      opponentAction: 'guard',
      result: {
        effects: [
          {
            abilityKey: 'moss-wild-growth',
            appliedUnits: 1,
            playerSlot: 'local',
            status: 'resolved',
            targetReason: 'tag-recipient'
          }
        ],
        triggeredStatuses: [],
        winner: 'local'
      },
      winner: 'local'
    }
  );
  assert.equal(localCard.classList.contains('has-tag-synergy'), false);
  assert.equal(localCard.classList.contains('is-tag-synergy-triggered'), false);

  local.abilityProgress = [];
  renderer.renderAbilityReveal(
    root,
    { teams: { local: [local], opponent: [opponent] } },
    {
      localAction: 'draw',
      opponentAction: 'draw',
      winner: 'draw'
    }
  );
  assert.equal(localCard.dataset.activationStatus, 'revealed');
  assert.deepEqual(
    [...localCard.querySelectorAll('.olings-clash-activation-pip')].map(
      (pip) => pip.textContent
    ),
    ['○', '○']
  );

  renderer.renderAbilityReveal(
    root,
    { teams: { local: [local], opponent: [opponent] } },
    {
      localAction: 'guard',
      opponentAction: 'skill',
      winner: 'opponent'
    }
  );
  assert.equal(reveal.classList.contains('is-draw-result'), false);
  assert.equal(
    reveal.querySelector('[data-clash-reveal-versus]').textContent,
    'VS'
  );
});
