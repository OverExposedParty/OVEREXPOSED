const assert = require('node:assert/strict');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const flightMotion = require('../../public/scripts/olings/shared/oling-flight-motion');
const createOlingClashMatchRenderer = require('../../public/scripts/olings/clash/game/renderers/match');
const createOlingClashState = require('../../public/scripts/olings/clash/game/state');

function createArt(className) {
  return `
    <div class="${className}">
      <img class="olings-clash-oling-layer is-flight" src="/flight.svg">
      <img class="olings-clash-oling-layer is-body" src="/body.svg">
      <img class="olings-clash-oling-layer is-eyes" src="/eyes.svg">
      <img class="olings-clash-oling-layer is-mouth" src="/mouth.svg">
    </div>
  `;
}

function createDom() {
  return new JSDOM(`
    <main>
      <section data-clash-roster="local">
        <div data-clash-tag-resource="local" hidden>
          <span data-clash-tag-charge-pips></span>
          <span data-clash-tag-recharge-pips></span>
        </div>
        <article
          data-clash-roster-slot
          data-flight-type="balloons"
          data-flight-motion="sway"
          data-flight-speed="1.25"
        >
          <div class="olings-clash-roster-slot__icon">
            ${createArt('olings-clash-oling-art')}
          </div>
          <div class="olings-clash-roster-slot__status">
            <strong>SCRAP</strong>
            <div data-clash-health data-heart-units="6"></div>
            <div data-clash-effects></div>
          </div>
        </article>
      </section>
      <section data-clash-roster="opponent">
        <div data-clash-tag-resource="opponent" hidden>
          <span data-clash-tag-charge-pips></span>
          <span data-clash-tag-recharge-pips></span>
        </div>
      </section>
      <article data-clash-fighter="local">
        <div class="olings-clash-fighter__art">
          <div class="olings-clash-fighter__motion">
            ${createArt('olings-clash-oling-art')}
          </div>
        </div>
        <strong data-clash-active-name></strong>
      </article>
      <section data-clash-actions></section>
      <strong data-clash-round></strong>
      <strong data-clash-last-outcome></strong>
      <button data-clash-last-ability="local" hidden>
        <img data-clash-last-ability-image>
        <strong data-clash-last-ability-name></strong>
        <small data-clash-last-ability-action></small>
      </button>
      <button data-clash-last-ability="opponent" hidden>
        <img data-clash-last-ability-image>
        <strong data-clash-last-ability-name></strong>
        <small data-clash-last-ability-action></small>
      </button>
    </main>
  `);
}

function createOling(overrides = {}) {
  return {
    effects: [],
    flightMotion: 'sway',
    flightSpeed: 1.25,
    flightType: 'balloons',
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    id: 'scrap',
    moves: {},
    name: 'SCRAP',
    parts: {
      body: '/body.svg',
      eyes: '/eyes.svg',
      flight: '/flight.svg',
      mouth: '/mouth.svg'
    },
    ...overrides
  };
}

test('Clash state keeps flight motion metadata with each Oling', () => {
  const dom = createDom();
  const root = dom.window.document.querySelector('main');
  const model = createOlingClashState({ root });
  const [oling] = model.state.teams.local;

  assert.equal(oling.flightType, 'balloons');
  assert.equal(oling.flightMotion, 'sway');
  assert.equal(oling.flightSpeed, 1.25);
});

test('Clash renders Tag charges and decisive recharge progress for both players', () => {
  const dom = createDom();
  const root = dom.window.document.querySelector('main');
  const renderer = createOlingClashMatchRenderer();
  const local = root.querySelector('[data-clash-tag-resource="local"]');
  const opponent = root.querySelector('[data-clash-tag-resource="opponent"]');

  renderer.renderTagResource(root, 'local', {
    charges: 1,
    decisiveClashesPerCharge: 3,
    maximumCharges: 2,
    rechargeProgress: 2
  });
  renderer.renderTagResource(root, 'opponent', {
    charges: 0,
    decisiveClashesPerCharge: 3,
    maximumCharges: 2,
    rechargeProgress: 1
  });

  assert.equal(local.hidden, false);
  assert.equal(
    local.querySelectorAll('[data-clash-tag-charge-pips] > *').length,
    2
  );
  assert.equal(
    local.querySelectorAll('[data-clash-tag-charge-pips] > .is-active').length,
    1
  );
  assert.equal(
    local.querySelectorAll('[data-clash-tag-recharge-pips] > *').length,
    3
  );
  assert.equal(
    local.querySelectorAll('[data-clash-tag-recharge-pips] > .is-active')
      .length,
    2
  );
  assert.equal(
    opponent.querySelectorAll('[data-clash-tag-recharge-pips] > .is-active')
      .length,
    1
  );
  assert.equal(opponent.classList.contains('is-exhausted'), true);
});

test('Clash animates active fighter flight layers but keeps roster icons still', () => {
  const dom = createDom();
  const root = dom.window.document.querySelector('main');
  let configuredFlights = 0;
  const renderer = createOlingClashMatchRenderer({
    configureFlight(container, oling, options) {
      configuredFlights += 1;
      flightMotion.configure(container, oling, {
        flightLayer: container.querySelector(
          '.olings-clash-oling-layer.is-flight'
        ),
        paused: options.paused
      });
    },
    healthRenderer: { renderHealth() {} }
  });
  const oling = createOling();
  const state = {
    lastOutcome: 'NO RESULT',
    playerEffects: { local: [], opponent: [] },
    round: 1,
    selections: { localAction: null },
    teams: { local: [oling], opponent: [] }
  };

  renderer.render(root, state);
  renderer.render(root, state);
  assert.equal(configuredFlights, 1);

  const lastOutcome = root.querySelector('[data-clash-last-outcome]');
  assert.equal(lastOutcome.hasAttribute('data-outcome'), false);

  state.lastOutcome = 'ATTACK WINS';
  state.lastResult = { winner: 'local' };
  renderer.render(root, state);
  assert.equal(lastOutcome.dataset.outcome, 'win');

  state.lastOutcome = 'SKILL WINS';
  state.lastResult = { winner: 'opponent' };
  renderer.render(root, state);
  assert.equal(lastOutcome.dataset.outcome, 'loss');

  state.lastOutcome = 'DRAW';
  state.lastResult = { winner: 'draw' };
  renderer.render(root, state);
  assert.equal(lastOutcome.dataset.outcome, 'draw');

  const fighterMotion = root.querySelector(
    '[data-clash-fighter="local"] .olings-clash-fighter__motion'
  );
  const fighterArt = root.querySelector(
    '[data-clash-fighter="local"] .olings-clash-oling-art'
  );
  const fighterFlight = fighterArt.querySelector(
    '.olings-clash-oling-layer.is-flight'
  );
  const rosterArt = root.querySelector(
    '[data-clash-roster="local"] .olings-clash-oling-art'
  );
  const rosterFlight = rosterArt.querySelector(
    '.olings-clash-oling-layer.is-flight'
  );
  const fighterEyes = fighterArt.querySelector(
    '.olings-clash-oling-layer.is-eyes'
  );
  const rosterEyes = rosterArt.querySelector(
    '.olings-clash-oling-layer.is-eyes'
  );
  assert.equal(
    fighterMotion.classList.contains('oling-flight-motion-root'),
    true
  );
  assert.equal(fighterFlight.classList.contains('is-flight-motion-sway'), true);
  assert.equal(rosterArt.classList.contains('oling-flight-motion-root'), false);
  assert.equal(
    rosterFlight.classList.contains('oling-flight-motion-layer'),
    false
  );

  Object.assign(oling, {
    flightMotion: 'flutter',
    flightSpeed: 1,
    flightType: 'wings',
    health: { ...oling.health, heartUnits: 0 }
  });
  renderer.render(root, state);

  assert.equal(
    fighterFlight.classList.contains('is-flight-motion-flutter'),
    true
  );
  assert.equal(
    fighterFlight.classList.contains('is-flight-motion-sway'),
    false
  );
  assert.equal(
    fighterMotion.classList.contains('is-flight-motion-paused'),
    true
  );
  assert.equal(
    fighterEyes.getAttribute('src'),
    '/images/olings/builds/eyes/states/defeated-eyes.svg'
  );
  assert.equal(
    rosterEyes.getAttribute('src'),
    '/images/olings/builds/eyes/states/defeated-eyes.svg'
  );

  oling.health = { ...oling.health, heartUnits: 1 };
  renderer.render(root, state);

  assert.equal(fighterEyes.getAttribute('src'), '/eyes.svg');
  assert.equal(rosterEyes.getAttribute('src'), '/eyes.svg');
});

test('Clash renderer coalesces scheduled state updates into one frame', () => {
  const dom = createDom();
  const root = dom.window.document.querySelector('main');
  let scheduledFrame = null;
  let frameRequests = 0;
  const renderer = createOlingClashMatchRenderer({
    healthRenderer: { renderHealth() {} },
    requestAnimationFrame(callback) {
      frameRequests += 1;
      scheduledFrame = callback;
      return frameRequests;
    }
  });
  const oling = createOling();
  const baseState = {
    lastOutcome: 'NO RESULT',
    playerEffects: { local: [], opponent: [] },
    round: 1,
    selections: { localAction: null },
    teams: { local: [oling], opponent: [] }
  };

  renderer.scheduleRender(root, baseState);
  renderer.scheduleRender(root, {
    ...baseState,
    lastOutcome: 'ATTACK WINS',
    round: 2
  });

  assert.equal(frameRequests, 1);
  assert.equal(root.querySelector('[data-clash-round]').textContent, '');
  scheduledFrame();
  assert.equal(root.querySelector('[data-clash-round]').textContent, '2');
  assert.equal(
    root.querySelector('[data-clash-last-outcome]').textContent,
    'ATTACK WINS'
  );
});

test('Clash flanks the last-round outcome with both previously played abilities', () => {
  const dom = createDom();
  const root = dom.window.document.querySelector('main');
  const renderer = createOlingClashMatchRenderer({
    resolveAbility(oling, partKey) {
      return {
        imagePath: `/${oling.name.toLowerCase()}-${partKey}.svg`,
        key: `${oling.name.toLowerCase()}-${partKey}`,
        name: `${oling.name} ${partKey}`
      };
    }
  });
  const taggedIn = createOling({ name: 'MOSSY', teamSlot: 1 });
  const previousLocal = createOling({ name: 'PEBBLE', teamSlot: 0 });
  const previousOpponent = createOling({ name: 'HUSH', teamSlot: 2 });
  const state = {
    lastOutcome: 'GUARD WINS',
    lastResult: {
      lastAbilityTeamSlots: { local: 0, opponent: 2 },
      localAction: 'guard',
      opponentAction: 'skill',
      winner: 'local'
    },
    playerEffects: { local: [], opponent: [] },
    round: 2,
    selections: { localAction: null },
    teams: {
      local: [taggedIn, previousLocal],
      opponent: [previousOpponent]
    }
  };

  renderer.render(root, state);

  const local = root.querySelector('[data-clash-last-ability="local"]');
  const opponent = root.querySelector('[data-clash-last-ability="opponent"]');
  assert.equal(local.hidden, false);
  assert.equal(local.classList.contains('is-winner'), true);
  assert.equal(opponent.classList.contains('is-loser'), true);
  assert.equal(
    local.querySelector('[data-clash-last-ability-name]').textContent,
    'PEBBLE BODY'
  );
  assert.equal(
    local.querySelector('[data-clash-last-ability-action]').textContent,
    'GUARD'
  );
  assert.equal(local.dataset.teamSlot, '0');
  assert.equal(
    opponent.querySelector('[data-clash-last-ability-name]').textContent,
    'HUSH FLIGHT'
  );
  assert.equal(
    opponent
      .querySelector('[data-clash-last-ability-image]')
      .getAttribute('src'),
    '/hush-flight.svg'
  );

  state.lastResult = {
    lastAbilityTeamSlots: { local: 0, opponent: 2 },
    localAction: 'guard',
    opponentAction: 'skill',
    winner: 'draw'
  };
  renderer.render(root, state);
  assert.equal(local.classList.contains('is-draw'), true);
  assert.equal(opponent.classList.contains('is-draw'), true);
  assert.equal(local.classList.contains('is-winner'), false);
  assert.equal(opponent.classList.contains('is-loser'), false);

  state.lastResult = null;
  renderer.render(root, state);
  assert.equal(local.hidden, true);
  assert.equal(opponent.hidden, true);
});
