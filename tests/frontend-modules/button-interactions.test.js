const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..', '..');
const interactionScript = fs.readFileSync(
  path.join(root, 'public/scripts/general/dom-and-const/dom-and-const.js'),
  'utf8'
);

function createInteractionDom() {
  const dom = new JSDOM(
    `<!doctype html><body>
      <button id="enabled"><span>Tap</span></button>
      <button id="disabled" disabled>Disabled</button>
      <button id="opt-out" data-press-feedback="none">Static</button>
      <button id="tooltip" class="tool-tip" data-tooltip="Help">Help</button>
    </body>`,
    { runScripts: 'outside-only', url: 'https://overexposed.test/' }
  );
  const { window } = dom;
  const timers = new Map();
  let currentTime = 0;
  let nextTimerId = 1;

  class TestPointerEvent extends window.MouseEvent {
    constructor(type, init = {}) {
      super(type, init);
      Object.defineProperties(this, {
        isPrimary: { value: init.isPrimary ?? true },
        pointerId: { value: init.pointerId ?? 1 },
        pointerType: { value: init.pointerType ?? 'touch' }
      });
    }
  }

  window.PointerEvent = TestPointerEvent;
  window.setTimeout = (callback, delay = 0) => {
    const timerId = nextTimerId;
    nextTimerId += 1;
    timers.set(timerId, {
      callback,
      runAt: currentTime + Math.max(0, Number(delay) || 0)
    });
    return timerId;
  };
  window.clearTimeout = (timerId) => timers.delete(timerId);
  window.eval(interactionScript);

  return {
    dom,
    window,
    advanceTimersBy(duration) {
      const targetTime = currentTime + duration;
      while (timers.size > 0) {
        const [timerId, timer] = [...timers.entries()].sort(
          ([, first], [, second]) => first.runAt - second.runAt
        )[0];
        if (timer.runAt > targetTime) break;
        timers.delete(timerId);
        currentTime = timer.runAt;
        timer.callback();
      }
      currentTime = targetTime;
    }
  };
}

function dispatchPointer(window, target, type, init = {}) {
  target.dispatchEvent(
    new window.PointerEvent(type, {
      bubbles: true,
      button: 0,
      clientX: 20,
      clientY: 20,
      pointerId: 1,
      ...init
    })
  );
}

test('button feedback presses, rebounds, and settles from nested tap targets', () => {
  const { advanceTimersBy, dom, window } = createInteractionDom();
  const button = window.document.getElementById('enabled');
  const child = button.querySelector('span');

  dispatchPointer(window, child, 'pointerdown');
  assert.equal(button.classList.contains('is-pressed'), true);

  dispatchPointer(window, child, 'pointerup');
  assert.equal(button.classList.contains('is-pressed'), false);
  assert.equal(button.classList.contains('is-press-releasing'), true);

  advanceTimersBy(110);
  assert.equal(button.classList.contains('is-press-releasing'), false);
  assert.equal(button.classList.contains('is-press-settling'), true);

  advanceTimersBy(90);
  assert.equal(button.classList.contains('is-press-settling'), false);
  dom.window.close();
});

test('scroll-like pointer movement cancels feedback without a rebound', () => {
  const { dom, window } = createInteractionDom();
  const button = window.document.getElementById('enabled');

  dispatchPointer(window, button, 'pointerdown');
  dispatchPointer(window, button, 'pointermove', { clientX: 40 });

  assert.equal(button.classList.contains('is-pressed'), false);
  assert.equal(button.classList.contains('is-press-releasing'), false);
  dom.window.close();
});

test('disabled, opted-out, and tooltip-owned buttons do not double animate', () => {
  const { dom, window } = createInteractionDom();

  ['disabled', 'opt-out', 'tooltip'].forEach((id, index) => {
    const button = window.document.getElementById(id);
    dispatchPointer(window, button, 'pointerdown', { pointerId: index + 1 });
    assert.equal(button.classList.contains('is-pressed'), false);
  });

  dom.window.close();
});
