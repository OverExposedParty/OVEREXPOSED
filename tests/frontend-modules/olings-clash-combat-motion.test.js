const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const createOlingClashCombatMotion = require('../../public/scripts/olings/clash/game/renderers/combat-motion');

const clashStyles = fs.readFileSync(
  path.join(__dirname, '../../public/css/olings/clash/clash.css'),
  'utf8'
);

function createArena() {
  const dom = new JSDOM(`
    <main data-clash-game>
      <article class="olings-clash-fighter is-local" data-clash-fighter="local"></article>
      <article class="olings-clash-fighter is-opponent" data-clash-fighter="opponent"></article>
    </main>
  `);
  const root = dom.window.document.querySelector('[data-clash-game]');
  const local = root.querySelector('[data-clash-fighter="local"]');
  const opponent = root.querySelector('[data-clash-fighter="opponent"]');
  local.getBoundingClientRect = () => ({ left: 100, width: 300 });
  opponent.getBoundingClientRect = () => ({ left: 900, width: 300 });
  return { local, opponent, root };
}

test('Clash combat motion braces both Olings during lock in', () => {
  const { local, opponent, root } = createArena();
  const motion = createOlingClashCombatMotion();

  motion.renderPhase(root, 'locked');
  assert.equal(local.classList.contains('is-clash-bracing'), true);
  assert.equal(opponent.classList.contains('is-clash-bracing'), true);

  motion.renderPhase(root, 'reveal');
  assert.equal(local.classList.contains('is-clash-bracing'), true);
  assert.equal(opponent.classList.contains('is-clash-bracing'), true);

  motion.renderPhase(root, 'waiting');
  assert.equal(local.classList.contains('is-clash-bracing'), false);
  assert.equal(opponent.classList.contains('is-clash-bracing'), false);
});

test('Clash combat motion sends the winner into the loser', () => {
  const { local, opponent, root } = createArena();
  const scheduled = [];
  const motion = createOlingClashCombatMotion({
    setTimeout(callback, delay) {
      scheduled.push({ callback, delay });
      return scheduled.length;
    }
  });

  const result = motion.play(root, { durationMs: 3200, winner: 'local' });

  assert.deepEqual(result, { durationMs: 3200, winner: 'local' });
  assert.equal(root.classList.contains('is-clash-combat-active'), false);
  assert.equal(local.classList.contains('is-clash-winner'), true);
  assert.equal(opponent.classList.contains('is-clash-loser'), true);
  assert.equal(local.style.getPropertyValue('--clash-motion-contact'), '544px');
  assert.equal(
    opponent.style.getPropertyValue('--clash-motion-knockback'),
    '36px'
  );
  assert.equal(scheduled[0].delay, 3200);
  assert.equal(scheduled[2].delay, 576);

  scheduled[2].callback();
  assert.equal(root.classList.contains('is-clash-combat-active'), true);

  scheduled[0].callback();
  assert.equal(root.classList.contains('is-clash-combat-active'), false);
  assert.equal(local.classList.contains('is-clash-combatant'), false);
  assert.equal(opponent.classList.contains('is-clash-loser'), false);
});

test('Clash combat motion can hold both Olings until a tutorial releases them', () => {
  const { local, opponent, root } = createArena();
  const cancelled = [];
  const scheduled = [];
  const motion = createOlingClashCombatMotion({
    clearTimeout(timer) {
      cancelled.push(timer);
    },
    setTimeout(callback, delay) {
      scheduled.push({ callback, delay });
      return scheduled.length;
    }
  });

  motion.play(root, { durationMs: 3200, winner: 'local' });
  assert.equal(root.classList.contains('is-clash-combat-active'), false);
  scheduled[2].callback();
  assert.equal(root.classList.contains('is-clash-combat-active'), true);
  assert.equal(motion.hold(root), true);
  assert.equal(local.classList.contains('is-clash-motion-held'), true);
  assert.equal(opponent.classList.contains('is-clash-motion-held'), true);
  assert.equal(cancelled.length, 0);

  scheduled[0].callback();
  assert.equal(root.classList.contains('is-clash-combat-active'), true);
  assert.equal(local.classList.contains('is-clash-winner'), true);
  assert.equal(opponent.classList.contains('is-clash-loser'), true);

  assert.equal(motion.release(root), true);
  assert.equal(local.classList.contains('is-clash-motion-held'), false);
  assert.equal(local.classList.contains('is-clash-winner'), true);
  assert.equal(opponent.classList.contains('is-clash-loser'), true);
  assert.equal(scheduled[3].delay, 700);

  scheduled[3].callback();
  assert.equal(root.classList.contains('is-clash-combat-active'), false);
  assert.equal(local.classList.contains('is-clash-winner'), false);
  assert.equal(opponent.classList.contains('is-clash-loser'), false);
});

test('Clash combat motion plays collision audio when the Olings make contact', () => {
  const { root } = createArena();
  const scheduled = [];
  const collisions = [];
  const playCollisions = [];
  const motion = createOlingClashCombatMotion({
    onCollision({ winner }) {
      collisions.push(winner);
    },
    setTimeout(callback, delay) {
      scheduled.push({ callback, delay });
      return scheduled.length;
    }
  });

  motion.play(root, {
    durationMs: 3200,
    onCollision({ winner }) {
      playCollisions.push(winner);
    },
    winner: 'local'
  });

  assert.equal(scheduled[0].delay, 3200);
  assert.equal(scheduled[1].delay, 2496);
  assert.deepEqual(collisions, []);
  assert.deepEqual(playCollisions, []);

  scheduled[1].callback();
  assert.deepEqual(collisions, ['local']);
  assert.deepEqual(playCollisions, ['local']);
});

test('Clash combat animation overrides the preserved brace animation', () => {
  const dom = new JSDOM(`
    <style>${clashStyles}</style>
    <article class="olings-clash-fighter is-local is-clash-bracing is-clash-combatant is-clash-winner"></article>
  `);
  const fighter = dom.window.document.querySelector('.olings-clash-fighter');
  const style = dom.window.getComputedStyle(fighter);

  assert.match(style.animation, /olings-clash-winning-hit/);
  assert.doesNotMatch(style.animation, /olings-clash-brace-local/);
});

test('Clash combat movement slides the intact action stack downward', () => {
  const dom = new JSDOM(`
    <style>${clashStyles}</style>
    <main class="olings-clash-game is-clash-combat-active">
      <section class="olings-clash-actions">
        <div class="olings-clash-action-summary is-visible"></div>
        <div class="olings-clash-actions__choices"></div>
        <button class="olings-clash-action-confirm"></button>
      </section>
    </main>
  `);
  const documentRef = dom.window.document;
  const summary = documentRef.querySelector('.olings-clash-action-summary');
  const choices = documentRef.querySelector('.olings-clash-actions__choices');
  const confirm = documentRef.querySelector('.olings-clash-action-confirm');

  assert.equal(dom.window.getComputedStyle(summary).visibility, 'visible');
  assert.equal(dom.window.getComputedStyle(choices).visibility, 'visible');
  assert.equal(dom.window.getComputedStyle(confirm).visibility, 'visible');
});

test('Clash action summary can grow upward when its content wraps', () => {
  const dom = new JSDOM(`
    <style>${clashStyles}</style>
    <main class="olings-clash-game">
      <section class="olings-clash-actions">
        <div class="olings-clash-action-summary is-visible">
          <div class="olings-clash-action-summary__content">
            <p class="olings-clash-action-summary__copy">Long ability details</p>
          </div>
        </div>
      </section>
    </main>
  `);
  const summary = dom.window.document.querySelector(
    '.olings-clash-action-summary'
  );
  const content = summary.querySelector(
    '.olings-clash-action-summary__content'
  );

  assert.equal(dom.window.getComputedStyle(summary).height, '');
  assert.notEqual(dom.window.getComputedStyle(summary).minHeight, '0');
  assert.equal(dom.window.getComputedStyle(content).height, '');
  assert.notEqual(dom.window.getComputedStyle(content).minHeight, '0');
});

test('Clash fighters sway without rotation and pause idle motion during combat', () => {
  const dom = new JSDOM(`
    <style>${clashStyles}</style>
    <article class="olings-clash-fighter is-local is-clash-combatant">
      <div class="olings-clash-fighter__motion"></div>
    </article>
  `);
  const motion = dom.window.document.querySelector(
    '.olings-clash-fighter__motion'
  );
  const style = dom.window.getComputedStyle(motion);
  const hoverKeyframes = clashStyles.match(
    /@keyframes olings-clash-fighter-hover\s*\{[\s\S]*?\n\}\s*\n\s*@keyframes olings-clash-tag-outgoing/
  )?.[0];
  const balloonKeyframes = clashStyles.match(
    /@keyframes olings-clash-fighter-balloon-drift\s*\{[\s\S]*?\n\}\s*\n\s*@keyframes olings-clash-defeat-fall/
  )?.[0];

  assert.equal(style.animationPlayState, 'paused');
  assert.match(hoverKeyframes, /translate3d\(-3\.2%, 1\.4%, 0\)/);
  assert.match(hoverKeyframes, /translate3d\(3\.2%, -1\.6%, 0\)/);
  assert.doesNotMatch(hoverKeyframes, /rotate\(/);
  assert.match(balloonKeyframes, /translate3d\(-3\.6%, 1\.2%, 0\)/);
  assert.match(balloonKeyframes, /translate3d\(3\.6%, -1\.5%, 0\)/);
  assert.doesNotMatch(balloonKeyframes, /rotate\(/);
});

test('Defeated Clash Olings fall while their flight motion remains paused', () => {
  const dom = new JSDOM(`
    <style>${clashStyles}</style>
    <article class="olings-clash-fighter is-local is-defeated">
      <div class="olings-clash-fighter__motion is-flight-motion-paused"></div>
    </article>
  `);
  const motion = dom.window.document.querySelector(
    '.olings-clash-fighter__motion'
  );
  const style = dom.window.getComputedStyle(motion);

  assert.match(style.animation, /olings-clash-defeat-fall/);
  assert.equal(style.animationPlayState, 'running');
  const defeatKeyframes = clashStyles.match(
    /@keyframes olings-clash-defeat-fall\s*\{[\s\S]*?\n\}\s*\n\s*@keyframes olings-clash-brace-local/
  )?.[0];
  assert.doesNotMatch(defeatKeyframes, /rotate\(|scale\(/);
});

test('Clash combat motion sends both Olings toward the middle on a Draw', () => {
  const { local, opponent, root } = createArena();
  const motion = createOlingClashCombatMotion({ setTimeout: () => 1 });

  motion.play(root, { winner: 'draw' });

  assert.equal(local.classList.contains('is-clash-drawing'), true);
  assert.equal(opponent.classList.contains('is-clash-drawing'), true);
  assert.equal(local.style.getPropertyValue('--clash-motion-contact'), '304px');
  assert.equal(
    opponent.style.getPropertyValue('--clash-motion-contact'),
    '-304px'
  );
});
