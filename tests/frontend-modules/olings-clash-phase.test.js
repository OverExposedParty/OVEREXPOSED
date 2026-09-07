const assert = require('node:assert/strict');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const createOlingClashPhaseRenderer = require('../../public/scripts/olings/clash/game/renderers/phase');
const createOlingClashTimer = require('../../public/scripts/olings/clash/game/timer');

function createPhaseDom() {
  return new JSDOM(`
    <div data-clash-decision-stack>
      <section data-clash-phase data-phase="choose-action">
        <strong data-clash-decision-label data-clash-phase-label></strong>
        <img data-clash-lock-in-icon hidden alt="">
        <div data-clash-timer>
          <span data-clash-timer-fill></span>
          <strong data-clash-timer-value></strong>
        </div>
        <small data-clash-result-detail hidden></small>
        <div data-clash-ability-reveal hidden></div>
      </section>
      <aside data-clash-opponent-ability-explanation hidden></aside>
    </div>
  `);
}

test('Clash phase renderer presents known and future phase labels', () => {
  const dom = createPhaseDom();
  const container = dom.window.document.querySelector('[data-clash-phase]');
  const label = container.querySelector('[data-clash-phase-label]');
  const renderer = createOlingClashPhaseRenderer();

  assert.deepEqual(renderer.renderPhase(container, 'choose-target'), {
    label: 'CHOOSE TARGET',
    phase: 'choose-target'
  });
  assert.equal(label.textContent, 'CHOOSE TARGET');
  assert.equal(
    container.getAttribute('aria-label'),
    'Turn phase: CHOOSE TARGET'
  );

  renderer.renderPhase(container, 'locking-in');
  assert.equal(label.textContent, 'LOCKING IN');

  renderer.renderPhase(container, 'Sudden Death');
  assert.equal(label.textContent, 'SUDDEN DEATH');
  assert.equal(container.dataset.phase, 'sudden-death');
});

test('Clash phase renderer replaces locked text with the padlock animation', () => {
  const dom = createPhaseDom();
  const container = dom.window.document.querySelector('[data-clash-phase]');
  const label = container.querySelector('[data-clash-phase-label]');
  const lockIcon = container.querySelector('[data-clash-lock-in-icon]');
  const renderer = createOlingClashPhaseRenderer();

  renderer.renderPhase(container, 'locked');
  assert.equal(label.textContent, 'LOCKED IN');
  assert.equal(label.hidden, true);
  assert.equal(lockIcon.hidden, false);
  assert.equal(lockIcon.classList.contains('is-animating'), true);

  renderer.renderPhase(container, 'reveal');
  assert.equal(label.hidden, false);
  assert.equal(lockIcon.hidden, true);
  assert.equal(lockIcon.classList.contains('is-animating'), false);
});

test('Clash phase renderer reuses the decision area for results', () => {
  const dom = createPhaseDom();
  const container = dom.window.document.querySelector('[data-clash-phase]');
  const label = container.querySelector('[data-clash-decision-label]');
  const detail = container.querySelector('[data-clash-result-detail]');
  const renderer = createOlingClashPhaseRenderer();

  assert.deepEqual(
    renderer.renderResult(container, 'Attack wins', 'Mend activated'),
    { detail: 'Mend activated', result: 'ATTACK WINS' }
  );
  assert.equal(container.dataset.displayMode, 'result');
  assert.equal(container.dataset.result, 'attack-wins');
  assert.equal(container.classList.contains('is-result'), true);
  assert.equal(label.textContent, 'ATTACK WINS');
  assert.equal(detail.textContent, 'Mend activated');
  assert.equal(detail.hidden, false);

  renderer.renderPhase(container, 'choose-action');
  assert.equal(container.dataset.displayMode, 'decision');
  assert.equal(container.classList.contains('is-result'), false);
  assert.equal(detail.hidden, true);
  assert.equal(
    container.querySelector('[data-clash-ability-reveal]').hidden,
    true
  );
});

test('Clash phase renderer keeps ability reveals through resolution only', () => {
  const dom = createPhaseDom();
  const container = dom.window.document.querySelector('[data-clash-phase]');
  const reveal = container.querySelector('[data-clash-ability-reveal]');
  const explanation = dom.window.document.querySelector(
    '[data-clash-opponent-ability-explanation]'
  );
  const renderer = createOlingClashPhaseRenderer();

  reveal.hidden = false;
  explanation.hidden = false;
  reveal.classList.add('is-visible');
  renderer.renderPhase(container, 'resolving');
  assert.equal(reveal.hidden, false);
  assert.equal(explanation.hidden, false);
  assert.equal(reveal.classList.contains('is-visible'), true);

  renderer.renderPhase(container, 'tagged');
  assert.equal(reveal.hidden, true);
  assert.equal(explanation.hidden, true);
  assert.equal(reveal.classList.contains('is-visible'), false);
});

test('Clash timer renders a server deadline and warns at five seconds', () => {
  const dom = createPhaseDom();
  const container = dom.window.document.querySelector('[data-clash-timer]');
  const fill = container.querySelector('[data-clash-timer-fill]');
  const value = container.querySelector('[data-clash-timer-value]');
  let currentTime = 1000;
  let scheduledUpdate = null;
  const clearedIntervals = [];
  const timer = createOlingClashTimer({
    now: () => currentTime,
    setInterval(callback) {
      scheduledUpdate = callback;
      return 7;
    },
    clearInterval(intervalId) {
      clearedIntervals.push(intervalId);
    }
  });

  timer.start(container, {
    phaseEndsAt: 31000,
    phaseDurationMs: 30000
  });
  assert.equal(value.textContent, '30');
  assert.equal(fill.style.width, '100%');
  assert.equal(container.classList.contains('is-warning'), false);

  currentTime = 26000;
  scheduledUpdate();
  assert.equal(value.textContent, '5');
  assert.equal(container.classList.contains('is-warning'), true);
  assert.ok(Math.abs(Number.parseFloat(fill.style.width) - 16.6667) < 0.001);

  let expiryEvents = 0;
  container.addEventListener('oling-clash:timer-expired', () => {
    expiryEvents += 1;
  });
  currentTime = 31000;
  scheduledUpdate();
  assert.equal(value.textContent, '0');
  assert.equal(fill.style.width, '0%');
  assert.equal(container.classList.contains('is-expired'), true);
  assert.equal(expiryEvents, 1);
  assert.deepEqual(clearedIntervals, [7]);
});

test('Clash timer can hide between timed decision phases', () => {
  const dom = createPhaseDom();
  const container = dom.window.document.querySelector('[data-clash-timer]');
  const timer = createOlingClashTimer({
    now: () => 1000,
    setInterval: () => 2,
    clearInterval() {}
  });

  timer.start(container, { phaseEndsAt: 11000, phaseDurationMs: 10000 });
  assert.equal(container.hidden, false);
  timer.stop({ hide: true });
  assert.equal(container.hidden, true);
});

test('Clash timer does not schedule background updates on a hidden page', () => {
  const dom = createPhaseDom();
  const container = dom.window.document.querySelector('[data-clash-timer]');
  const originalDocument = global.document;
  let scheduled = 0;
  global.document = { hidden: true };

  try {
    const timer = createOlingClashTimer({
      now: () => 1000,
      setInterval() {
        scheduled += 1;
        return 1;
      },
      clearInterval() {}
    });
    timer.start(container, { phaseEndsAt: 11000, phaseDurationMs: 10000 });
    assert.equal(scheduled, 0);
    assert.equal(
      container.querySelector('[data-clash-timer-value]').textContent,
      '10'
    );
  } finally {
    global.document = originalDocument;
  }
});
