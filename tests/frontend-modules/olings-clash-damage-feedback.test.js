const assert = require('node:assert/strict');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const createOlingClashDamageFeedback = require('../../public/scripts/olings/clash/game/renderers/damage-feedback');
const createOlingClashResolution = require('../../public/scripts/olings/clash/game/resolution');

function createArena() {
  return new JSDOM(`
    <main data-clash-game>
      <div class="olings-clash-scene">
        <img class="olings-clash-scene-layer is-far-background">
        <img class="olings-clash-scene-layer is-background">
        <img class="olings-clash-scene-layer is-stage">
        <img class="olings-clash-scene-layer is-foreground">
      </div>
      <article class="olings-clash-fighter is-local" data-clash-fighter="local"></article>
      <article class="olings-clash-fighter is-opponent" data-clash-fighter="opponent"></article>
    </main>
  `);
}

test('Clash damage reports every health layer changed by one hit', () => {
  const resolution = createOlingClashResolution();
  const damage = resolution.applyNormalDamage(
    {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 1,
      shieldCount: 1
    },
    4
  );

  assert.equal(damage.destroyedShields, 1);
  assert.equal(damage.shieldDamageUnits, 2);
  assert.equal(damage.overgrowthDamageUnits, 1);
  assert.equal(damage.heartDamageUnits, 1);
});

test('Clash emits Shield, Overgrowth, and Heart losses in one burst', () => {
  const dom = createArena();
  const root = dom.window.document.querySelector('[data-clash-game]');
  const feedback = createOlingClashDamageFeedback();
  const packets = feedback.emitResult(root, {
    damageType: 'normal',
    opponentDamage: {
      defeated: true,
      destroyedShields: 1,
      heartDamageUnits: 1,
      overgrowthDamageUnits: 1,
      shieldDamageUnits: 2
    }
  });

  assert.equal(packets.length, 1);
  assert.equal(packets[0].defeated, true);
  assert.deepEqual(
    packets[0].layers.map((layer) => layer.key),
    ['shields', 'overgrowth', 'hearts']
  );
  const burst = root.querySelector(
    '[data-clash-fighter="opponent"] .olings-clash-damage-burst'
  );
  assert.ok(burst);
  assert.deepEqual(
    [...burst.querySelectorAll('.olings-clash-damage-indicator')].map(
      (indicator) => indicator.textContent
    ),
    ['-1', '-1/2', '-1/2']
  );
  assert.equal(
    root
      .querySelector('[data-clash-fighter="opponent"]')
      .classList.contains('is-taking-hit'),
    true
  );
  feedback.clear(root);
});

test('Clash reuses detached damage burst and indicator nodes', () => {
  const dom = createArena();
  const root = dom.window.document.querySelector('[data-clash-game]');
  const feedback = createOlingClashDamageFeedback();

  feedback.emitResult(root, {
    opponentDamage: { heartDamageUnits: 2 },
    winner: 'local'
  });
  const firstBurst = root.querySelector('.olings-clash-damage-burst');
  const firstIndicator = firstBurst.querySelector(
    '.olings-clash-damage-indicator'
  );
  feedback.clear(root);
  assert.deepEqual(feedback.getPoolStats(), { bursts: 1, indicators: 1 });

  feedback.emitResult(root, {
    opponentDamage: { heartDamageUnits: 1 },
    winner: 'local'
  });
  const secondBurst = root.querySelector('.olings-clash-damage-burst');
  const secondIndicator = secondBurst.querySelector(
    '.olings-clash-damage-indicator'
  );
  assert.equal(secondBurst, firstBurst);
  assert.equal(secondIndicator, firstIndicator);
  assert.equal(secondIndicator.textContent, '-1/2');
  feedback.clear(root);
});

test('Clash can hold and release the real floating damage indicator', () => {
  const dom = createArena();
  const root = dom.window.document.querySelector('[data-clash-game]');
  const feedback = createOlingClashDamageFeedback();
  feedback.emitResult(root, {
    opponentDamage: { heartDamageUnits: 2 },
    winner: 'local'
  });

  const burst = feedback.holdLatest(root, {
    layer: 'hearts',
    side: 'opponent'
  });
  const indicator = burst.querySelector(
    '.olings-clash-damage-indicator.is-hearts'
  );

  assert.ok(burst.classList.contains('is-tutorial-held'));
  assert.equal(indicator.textContent, '-1');
  assert.equal(indicator.style.animationPlayState, 'paused');
  assert.equal(feedback.releaseHeld(burst), true);
  assert.equal(root.contains(burst), true);
  assert.equal(burst.classList.contains('is-tutorial-held'), false);
  assert.equal(indicator.style.animationPlayState, 'running');
  feedback.clear(root);
  assert.equal(root.contains(burst), false);
});

test('Clash can hold and release a Last Stand burst without a damage number', () => {
  const dom = createArena();
  const root = dom.window.document.querySelector('[data-clash-game]');
  const feedback = createOlingClashDamageFeedback();
  feedback.emitResult(root, {
    localDamage: { lastStand: true },
    winner: 'draw'
  });

  const burst = feedback.holdLatest(root, {
    lastStand: true,
    side: 'local'
  });
  const label = burst.querySelector('.olings-clash-damage-last-stand');

  assert.ok(burst.classList.contains('is-tutorial-held'));
  assert.equal(label.textContent, 'LAST STAND');
  assert.equal(label.style.animationPlayState, 'paused');
  assert.equal(feedback.releaseHeld(burst), true);
  assert.equal(label.style.animationPlayState, 'running');
  feedback.clear(root);
});

test('Clash damage feedback supports routed server layers and Last Stand', () => {
  const feedback = createOlingClashDamageFeedback();
  const packets = feedback.collectDamagePackets({
    damage: [
      {
        damageType: 'normal',
        lastStand: true,
        layers: [
          { layer: 'shields', shieldsDestroyed: 1, units: 2 },
          { layer: 'hearts', units: 1 }
        ],
        playerSlot: 'local',
        teamSlot: 0
      }
    ]
  });

  assert.equal(packets.length, 1);
  assert.equal(packets[0].lastStand, true);
  assert.deepEqual(
    packets[0].layers.map((layer) => [layer.key, layer.amount]),
    [
      ['shields', 1],
      ['hearts', 1]
    ]
  );
});

test('Clash damage feedback ignores null damage from effect-only rounds', () => {
  const dom = createArena();
  const root = dom.window.document.querySelector('[data-clash-game]');
  const feedback = createOlingClashDamageFeedback();

  assert.deepEqual(
    feedback.emitResult(root, {
      localDamage: null,
      opponentDamage: null,
      effects: [{ effectKey: 'wild-growth', targetPlayerSlot: 'local' }]
    }),
    []
  );
  assert.equal(
    root.querySelector('.olings-clash-scene-layer.is-clash-shaking'),
    null
  );
});

test('Clash shakes every scene depth when either Oling takes damage', () => {
  const dom = createArena();
  const root = dom.window.document.querySelector('[data-clash-game]');
  const feedback = createOlingClashDamageFeedback();
  const layers = [...root.querySelectorAll('.olings-clash-scene-layer')];

  [
    {
      opponentDamage: { heartDamageUnits: 2 },
      winner: 'local'
    },
    {
      localDamage: { destroyedShields: 1 },
      winner: 'opponent'
    }
  ].forEach((result) => {
    feedback.emitResult(root, result);

    assert.equal(layers.length, 4);
    assert.ok(
      layers.every((layer) => layer.classList.contains('is-clash-shaking'))
    );
    assert.ok(
      layers.every(
        (layer) => !layer.classList.contains('is-clash-draw-shaking')
      )
    );

    feedback.clear(root);
    assert.ok(
      layers.every((layer) => !layer.classList.contains('is-clash-shaking'))
    );
  });
});

test('Clash uses the reduced scene shake when a draw damages both Olings', () => {
  const dom = createArena();
  const root = dom.window.document.querySelector('[data-clash-game]');
  const feedback = createOlingClashDamageFeedback();

  feedback.emitResult(root, {
    localDamage: { heartDamageUnits: 1 },
    opponentDamage: { heartDamageUnits: 1 },
    winner: 'draw'
  });

  const layers = [...root.querySelectorAll('.olings-clash-scene-layer')];
  assert.ok(
    layers.every((layer) => layer.classList.contains('is-clash-draw-shaking'))
  );
  assert.ok(
    layers.every((layer) => !layer.classList.contains('is-clash-shaking'))
  );

  feedback.clear(root);
});

test('Clash separates base, bonus, and Status damage packets', () => {
  const feedback = createOlingClashDamageFeedback();
  const packets = feedback.collectDamagePackets({
    opponentDamage: { heartDamageUnits: 2 },
    effects: [
      {
        damageSource: 'bonus',
        heartDamageUnits: 1,
        targetPlayerSlot: 'opponent',
        targetTeamSlot: 0
      }
    ],
    triggeredStatuses: [
      {
        damageSource: 'burn',
        heartDamageUnits: 1,
        playerSlot: 'opponent',
        targetTeamSlot: 0
      }
    ]
  });

  assert.equal(packets.length, 3);
  assert.deepEqual(
    packets.map((packet) => packet.layers[0].amount),
    [2, 1, 1]
  );
});
