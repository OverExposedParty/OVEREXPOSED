const assert = require('node:assert/strict');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const createOlingClashTagMotion = require('../../public/scripts/olings/clash/game/renderers/tag-motion');
const createOlingClashMatchRenderer = require('../../public/scripts/olings/clash/game/renderers/match');

function createArt(className) {
  return `<div class="${className}"><div class="olings-clash-oling-art"><img class="olings-clash-oling-layer is-body"></div></div>`;
}

function createArena() {
  const dom = new JSDOM(`
    <main data-clash-game>
      <div class="olings-clash-game__surface">
        <section data-clash-roster="local">
          <article class="is-active" data-clash-roster-slot="active" data-team-slot="0">${createArt('olings-clash-roster-slot__icon')}</article>
          <article data-clash-roster-slot="bench-1" data-team-slot="1">${createArt('olings-clash-roster-slot__icon')}</article>
          <article data-clash-roster-slot="bench-2" data-team-slot="2">${createArt('olings-clash-roster-slot__icon')}</article>
        </section>
        <article class="olings-clash-fighter is-local" data-clash-fighter="local">
          <div class="olings-clash-fighter__art">
            <div class="olings-clash-fighter__motion">
              <div class="olings-clash-oling-art"><img class="olings-clash-oling-layer is-body"></div>
            </div>
          </div>
          <strong data-clash-active-name>ACTIVE</strong>
        </article>
      </div>
    </main>
  `);
  const root = dom.window.document.querySelector('[data-clash-game]');
  const surface = root.querySelector('.olings-clash-game__surface');
  const fighterArt = root.querySelector('.olings-clash-fighter__art');
  const fighterMotion = root.querySelector('.olings-clash-fighter__motion');
  const rosterIcon = root.querySelectorAll(
    '[data-clash-roster-slot] .olings-clash-roster-slot__icon'
  )[1];
  surface.getBoundingClientRect = () => ({
    height: 700,
    left: 0,
    top: 0,
    width: 1000
  });
  fighterArt.getBoundingClientRect = () => ({
    height: 220,
    left: 300,
    top: 300,
    width: 220
  });
  fighterMotion.getBoundingClientRect = () => ({
    height: 220,
    left: 300,
    top: 300,
    width: 220
  });
  rosterIcon.getBoundingClientRect = () => ({
    height: 80,
    left: 30,
    top: 90,
    width: 80
  });
  return { fighterArt, fighterMotion, root, rosterIcon };
}

function createRosterOling(id, teamSlot) {
  return {
    effects: [],
    health: { heartUnits: 6, maxHeartUnits: 6 },
    id,
    name: id.toUpperCase(),
    parts: {},
    teamSlot
  };
}

function createRosterRendererRoot() {
  const card = (position, teamSlot) => `
    <article class="olings-clash-roster-slot${position === 'active' ? ' is-active' : ''}" data-clash-roster-slot="${position}">
      ${createArt('olings-clash-roster-slot__icon')}
      <div class="olings-clash-roster-slot__status">
        <strong></strong>
        <div data-clash-health></div>
        <div data-clash-effects></div>
        <button data-clash-tag-button data-team-slot="${teamSlot}"></button>
      </div>
    </article>`;
  const dom = new JSDOM(`
    <main>
      <section data-clash-roster="local">
        ${card('active', 0)}
        ${card('bench-1', 1)}
        ${card('bench-2', 2)}
      </section>
    </main>
  `);
  return dom.window.document.querySelector('main');
}

test('Clash roster renderer moves Oling-owned cards instead of replacing their contents', () => {
  const root = createRosterRendererRoot();
  const roster = root.querySelector('[data-clash-roster]');
  const originalCards = [...roster.children];
  const renderer = createOlingClashMatchRenderer({
    healthRenderer: { renderHealth() {} }
  });
  const firstTeam = [
    createRosterOling('mossy', 0),
    createRosterOling('pebble', 1),
    createRosterOling('ember', 2)
  ];

  renderer.renderRoster(root, 'local', firstTeam);
  originalCards[1]
    .querySelector('[data-clash-tag-button]')
    .classList.add('is-tag-spinning');
  renderer.renderRoster(root, 'local', [
    firstTeam[1],
    firstTeam[0],
    firstTeam[2]
  ]);

  const reorderedCards = [...roster.children];
  assert.equal(reorderedCards[0], originalCards[1]);
  assert.equal(reorderedCards[0].dataset.olingId, 'pebble');
  assert.equal(reorderedCards[0].dataset.clashRosterSlot, 'active');
  assert.equal(reorderedCards[0].classList.contains('is-active'), true);
  assert.equal(
    reorderedCards[0]
      .querySelector('[data-clash-tag-button]')
      .classList.contains('is-tag-spinning'),
    true
  );
  assert.equal(reorderedCards[1], originalCards[0]);
  assert.equal(reorderedCards[1].dataset.olingId, 'mossy');
  assert.equal(reorderedCards[1].dataset.clashRosterSlot, 'bench-1');
  assert.equal(
    reorderedCards[1].querySelector('[data-clash-tag-button]').dataset.teamSlot,
    '0'
  );
});

test('Clash Tag motion exchanges active and bench Oling artwork', () => {
  const { fighterArt, root, rosterIcon } = createArena();
  const scheduled = [];
  const motion = createOlingClashTagMotion({
    setTimeout(callback, delay) {
      scheduled.push({ callback, delay });
      return scheduled.length;
    }
  });

  const prepared = motion.prepare(root, {
    forced: false,
    selectedSlot: 1,
    side: 'local'
  });
  assert.ok(prepared);
  assert.equal(root.querySelectorAll('.olings-clash-tag-ghost').length, 1);

  const result = motion.play(root, { durationMs: 1400 });
  assert.deepEqual(result, {
    durationMs: 1400,
    forced: false,
    side: 'local'
  });
  assert.equal(fighterArt.classList.contains('is-tag-motion-hidden'), false);
  assert.equal(fighterArt.classList.contains('is-tag-incoming'), true);
  assert.equal(rosterIcon.classList.contains('is-tag-motion-hidden'), false);
  const outgoing = root.querySelector('.olings-clash-tag-ghost.is-outgoing');
  const incoming = fighterArt;
  assert.ok(
    Number.parseFloat(outgoing.style.getPropertyValue('--clash-tag-x')) < 0
  );
  assert.ok(
    Number.parseFloat(
      incoming.style.getPropertyValue('--clash-tag-incoming-start-x')
    ) < 0
  );
  assert.equal(scheduled[0].delay, 1400);

  scheduled[0].callback();
  assert.equal(root.querySelector('.olings-clash-tag-motion'), null);
  assert.equal(fighterArt.classList.contains('is-tag-motion-hidden'), false);
  assert.equal(fighterArt.classList.contains('is-tag-incoming'), false);
  assert.equal(rosterIcon.classList.contains('is-tag-motion-hidden'), false);
});

test('Clash Tag motion reuses its detached stage and ghost', () => {
  const { root } = createArena();
  const motion = createOlingClashTagMotion();
  const first = motion.prepare(root, {
    forced: false,
    selectedSlot: 1,
    side: 'local'
  });
  const firstStage = first.stage;
  const firstGhost = first.outgoing;
  motion.clear(root);
  assert.deepEqual(motion.getPoolStats(), { ghosts: 1, stages: 1 });

  const second = motion.prepare(root, {
    forced: false,
    selectedSlot: 1,
    side: 'local'
  });
  assert.equal(second.stage, firstStage);
  assert.equal(second.outgoing, firstGhost);
  motion.clear(root);
});

test('Clash Tag motion slides only the swapped live cards out and back in', () => {
  const { root } = createArena();
  const roster = root.querySelector('[data-clash-roster]');
  const outgoingCard = roster.querySelector('[data-team-slot="0"]');
  const incomingCard = roster.querySelector('[data-team-slot="1"]');
  const untouchedCard = roster.querySelector('[data-team-slot="2"]');
  const scheduled = [];
  const motion = createOlingClashTagMotion({
    setTimeout(callback, delay) {
      scheduled.push({ callback, delay });
      return scheduled.length;
    }
  });

  motion.prepare(root, { forced: false, selectedSlot: 1, side: 'local' });
  const exitResult = motion.exit(root, { durationMs: 280 });

  assert.deepEqual(exitResult, {
    durationMs: 280,
    forced: false,
    side: 'local'
  });
  assert.equal(
    incomingCard.classList.contains('is-roster-tag-sliding-out'),
    true
  );
  assert.equal(
    outgoingCard.classList.contains('is-roster-tag-sliding-out'),
    true
  );
  assert.equal(
    untouchedCard.classList.contains('is-roster-tag-sliding-out'),
    false
  );
  assert.equal(roster.classList.contains('is-tag-reordering'), true);
  assert.equal(root.querySelector('.olings-clash-roster-tag-ghost'), null);

  outgoingCard.dataset.clashRosterSlot = 'bench-1';
  outgoingCard.classList.remove('is-active');
  incomingCard.dataset.clashRosterSlot = 'active';
  incomingCard.classList.add('is-active');
  roster.prepend(incomingCard);
  motion.play(root, { durationMs: 1400 });

  assert.equal(
    incomingCard.classList.contains('is-roster-tag-sliding-in'),
    true
  );
  assert.equal(
    outgoingCard.classList.contains('is-roster-tag-sliding-in'),
    true
  );
  assert.equal(
    untouchedCard.classList.contains('is-roster-tag-sliding-in'),
    false
  );
  assert.equal(
    incomingCard.style.getPropertyValue('--clash-roster-tag-duration'),
    '1400ms'
  );
  assert.equal(scheduled[0].delay, 1400);

  scheduled[0].callback();
  assert.equal(
    incomingCard.classList.contains('is-roster-tag-sliding-in'),
    false
  );
  assert.equal(
    outgoingCard.classList.contains('is-roster-tag-sliding-in'),
    false
  );
  assert.equal(roster.classList.contains('is-tag-reordering'), false);
});

test('Clash Tag motion resolves an online Oling by team slot after roster reordering', () => {
  const { root } = createArena();
  const rosterSlots = [...root.querySelectorAll('[data-clash-roster-slot]')];
  const teamSlotsByPosition = [1, 0, 2];
  const olingsByPosition = ['OLD-ACTIVE', 'INCOMING', 'OTHER-BENCH'];

  rosterSlots.forEach((slot, index) => {
    const tagButton = root.ownerDocument.createElement('button');
    tagButton.dataset.teamSlot = String(teamSlotsByPosition[index]);
    slot.dataset.teamSlot = String(teamSlotsByPosition[index]);
    slot.append(tagButton);
    slot.querySelector('img').dataset.oling = olingsByPosition[index];
  });

  const motion = createOlingClashTagMotion({ setTimeout: () => 1 });
  const prepared = motion.prepare(root, {
    forced: false,
    selectedSlot: 0,
    side: 'local'
  });

  assert.ok(prepared);
  assert.equal(
    prepared.rosterIcon.closest('[data-clash-roster-slot]').querySelector('img')
      ?.dataset.oling,
    'INCOMING'
  );
});

test('Clash opponent Tags leave and enter through the right edge', () => {
  const { root } = createArena();
  const fighter = root.querySelector('[data-clash-fighter]');
  const roster = root.querySelector('[data-clash-roster]');
  fighter.dataset.clashFighter = 'opponent';
  fighter.classList.replace('is-local', 'is-opponent');
  roster.dataset.clashRoster = 'opponent';
  const motion = createOlingClashTagMotion({ setTimeout: () => 1 });

  motion.prepare(root, {
    forced: false,
    selectedSlot: 1,
    side: 'opponent'
  });
  motion.play(root);

  const outgoing = root.querySelector('.olings-clash-tag-ghost.is-outgoing');
  const incoming = root.querySelector('.olings-clash-fighter__art');
  assert.ok(
    Number.parseFloat(outgoing.style.getPropertyValue('--clash-tag-x')) > 0
  );
  assert.ok(
    Number.parseFloat(
      incoming.style.getPropertyValue('--clash-tag-incoming-start-x')
    ) > 0
  );
});

test('Clash forced Tag motion marks the outgoing Oling as defeated', () => {
  const { fighterMotion, root } = createArena();
  const motion = createOlingClashTagMotion({ setTimeout: () => 1 });
  fighterMotion.getBoundingClientRect = () => ({
    height: 210,
    left: 294,
    top: 410,
    width: 210
  });

  motion.prepare(root, { forced: true, selectedSlot: 1, side: 'local' });
  motion.play(root);

  const stage = root.querySelector('.olings-clash-tag-motion');
  const outgoing = stage.querySelector('.olings-clash-tag-ghost.is-outgoing');
  assert.equal(stage.dataset.tagForced, 'true');
  assert.equal(stage.classList.contains('is-forced'), true);
  assert.equal(outgoing.style.left, '294px');
  assert.equal(outgoing.style.top, '410px');
});

test('Clash Tag motion reports the first collision once', () => {
  const { root } = createArena();
  const frames = [];
  const collisions = [];
  const cancelledTimers = [];
  const motion = createOlingClashTagMotion({
    clearTimeout(timer) {
      cancelledTimers.push(timer);
    },
    onCollision(event) {
      collisions.push(event);
    },
    requestAnimationFrame(callback) {
      frames.push(callback);
      return frames.length;
    },
    setTimeout() {
      return 10 + cancelledTimers.length;
    }
  });

  motion.prepare(root, { forced: false, selectedSlot: 1, side: 'local' });
  const outgoing = root.querySelector('.olings-clash-tag-ghost.is-outgoing');
  const incoming = root.querySelector('.olings-clash-fighter__art');
  let touching = false;
  outgoing.getBoundingClientRect = () => ({
    bottom: 300,
    height: 100,
    left: touching ? 200 : 100,
    right: touching ? 300 : 200,
    top: 200,
    width: 100
  });
  incoming.getBoundingClientRect = () => ({
    bottom: 300,
    height: 100,
    left: touching ? 300 : 500,
    right: touching ? 400 : 600,
    top: 200,
    width: 100
  });

  motion.play(root, { durationMs: 1400 });
  frames[0]();
  assert.equal(collisions.length, 0);
  touching = true;
  frames[1]();
  assert.equal(collisions.length, 1);
  assert.equal(collisions[0].side, 'local');
  assert.equal(collisions[0].forced, false);
  assert.equal(cancelledTimers.length, 1);
});
