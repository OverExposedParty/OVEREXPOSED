const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..', '..');
const tooltipScript = fs.readFileSync(
  path.join(root, 'public/scripts/general/tool-tip/tool-tip.js'),
  'utf8'
);

function createTooltipDom() {
  const dom = new JSDOM(
    `<!doctype html><body>
      <button class="tool-tip" data-tooltip="Helpful text">
        <svg aria-hidden="true"><path></path></svg>
        Help
      </button>
      <p>Selectable page text</p>
    </body>`,
    { runScripts: 'outside-only', url: 'https://overexposed.test/' }
  );
  const { window } = dom;
  const timers = new Map();
  let nextTimerId = 1;
  let currentTime = 0;

  class TestPointerEvent extends window.MouseEvent {
    constructor(type, init = {}) {
      super(type, init);
      Object.defineProperties(this, {
        isPrimary: { value: init.isPrimary ?? true },
        pointerId: { value: init.pointerId ?? 1 },
        pointerType: { value: init.pointerType ?? 'mouse' }
      });
    }
  }

  window.PointerEvent = TestPointerEvent;
  window.Date.now = () => currentTime;
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
  window.eval(tooltipScript);

  return {
    button: window.document.querySelector('button'),
    dom,
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
    },
    flushTimers() {
      while (timers.size > 0) {
        const [timerId, timer] = [...timers.entries()].sort(
          ([, first], [, second]) => first.runAt - second.runAt
        )[0];
        timers.delete(timerId);
        currentTime = timer.runAt;
        timer.callback();
      }
    },
    iconPath: window.document.querySelector('path'),
    pageText: window.document.querySelector('p'),
    tooltip: window.document.querySelector('.floating-tooltip'),
    window
  };
}

function dispatchPointer(window, target, type, init = {}) {
  target.dispatchEvent(
    new window.PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: 20,
      clientY: 20,
      pointerId: 1,
      ...init
    })
  );
}

test('mouse hover and keyboard focus still show tooltips', () => {
  const { button, dom, tooltip, window } = createTooltipDom();

  try {
    dispatchPointer(window, button, 'pointerover', { pointerType: 'mouse' });
    assert.equal(tooltip.classList.contains('visible'), true);

    dispatchPointer(window, button, 'pointerout', { pointerType: 'mouse' });
    assert.equal(tooltip.classList.contains('visible'), false);

    button.focus();
    assert.equal(tooltip.classList.contains('visible'), true);
  } finally {
    dom.window.close();
  }
});

test('a quick touch activates the control without showing its tooltip', () => {
  const { advanceTimersBy, button, dom, tooltip, window } = createTooltipDom();
  let clickCount = 0;
  button.addEventListener('click', () => {
    clickCount += 1;
    window.setTooltipSelectedState(button, 'Done');
  });

  try {
    dispatchPointer(window, button, 'pointerover', { pointerType: 'touch' });
    dispatchPointer(window, button, 'pointerdown', { pointerType: 'touch' });
    button.focus();
    assert.equal(tooltip.classList.contains('visible'), false);
    assert.equal(button.classList.contains('touch-pressed'), true);

    dispatchPointer(window, button, 'pointerup', { pointerType: 'touch' });
    assert.equal(button.classList.contains('touch-pressed'), true);
    button.click();

    assert.equal(clickCount, 1);
    assert.equal(tooltip.classList.contains('visible'), false);
    advanceTimersBy(139);
    assert.equal(button.classList.contains('touch-pressed'), true);
    advanceTimersBy(1);
    assert.equal(button.classList.contains('touch-pressed'), false);
    assert.equal(button.classList.contains('touch-feedback-releasing'), true);
    advanceTimersBy(120);
    assert.equal(button.classList.contains('touch-feedback-releasing'), false);
  } finally {
    dom.window.close();
  }
});

test('a touch hold shows the tooltip and suppresses activation on release', () => {
  const { button, dom, flushTimers, tooltip, window } = createTooltipDom();
  let clickCount = 0;
  button.addEventListener('click', () => {
    clickCount += 1;
  });

  try {
    dispatchPointer(window, button, 'pointerdown', { pointerType: 'touch' });
    assert.equal(button.classList.contains('touch-pressed'), true);
    flushTimers();
    assert.equal(tooltip.classList.contains('visible'), true);

    dispatchPointer(window, button, 'pointerup', { pointerType: 'touch' });
    assert.equal(tooltip.classList.contains('visible'), false);
    assert.equal(button.classList.contains('touch-pressed'), false);

    button.click();
    assert.equal(clickCount, 0);
  } finally {
    dom.window.close();
  }
});

test('moving a touch cancels the pending tooltip hold', () => {
  const { button, dom, flushTimers, tooltip, window } = createTooltipDom();

  try {
    dispatchPointer(window, button, 'pointerdown', { pointerType: 'touch' });
    dispatchPointer(window, button, 'pointermove', {
      clientX: 50,
      pointerType: 'touch'
    });
    flushTimers();

    assert.equal(tooltip.classList.contains('visible'), false);
    assert.equal(button.classList.contains('touch-pressed'), false);
  } finally {
    dom.window.close();
  }
});

test('disabled tooltip controls do not show touch-press feedback', () => {
  const { button, dom, window } = createTooltipDom();
  button.disabled = true;

  try {
    dispatchPointer(window, button, 'pointerdown', { pointerType: 'touch' });
    assert.equal(button.classList.contains('touch-pressed'), false);
  } finally {
    dom.window.close();
  }
});

test('linger feedback remains pressed and fades for longer', () => {
  const { advanceTimersBy, button, dom, window } = createTooltipDom();
  button.dataset.pressFeedback = 'linger';

  try {
    dispatchPointer(window, button, 'pointerdown', { pointerType: 'touch' });
    dispatchPointer(window, button, 'pointerup', { pointerType: 'touch' });

    advanceTimersBy(279);
    assert.equal(button.classList.contains('touch-pressed'), true);
    advanceTimersBy(1);
    assert.equal(button.classList.contains('touch-pressed'), false);
    assert.equal(button.classList.contains('touch-feedback-releasing'), true);

    advanceTimersBy(359);
    assert.equal(button.classList.contains('touch-feedback-releasing'), true);
    advanceTimersBy(1);
    assert.equal(button.classList.contains('touch-feedback-releasing'), false);
  } finally {
    dom.window.close();
  }
});

test('a new touch cancels an existing linger fade and restarts feedback', () => {
  const { advanceTimersBy, button, dom, window } = createTooltipDom();
  button.dataset.pressFeedback = 'linger';

  try {
    dispatchPointer(window, button, 'pointerdown', { pointerType: 'touch' });
    dispatchPointer(window, button, 'pointerup', { pointerType: 'touch' });
    advanceTimersBy(280);
    assert.equal(button.classList.contains('touch-feedback-releasing'), true);

    dispatchPointer(window, button, 'pointerdown', { pointerType: 'touch' });
    assert.equal(button.classList.contains('touch-feedback-releasing'), false);
    assert.equal(button.classList.contains('touch-pressed'), true);
  } finally {
    dom.window.close();
  }
});

test('native selection and dragging are prevented only inside tooltip controls', () => {
  const { button, dom, iconPath, pageText, window } = createTooltipDom();

  try {
    const selectionEvent = new window.Event('selectstart', {
      bubbles: true,
      cancelable: true
    });
    assert.equal(iconPath.dispatchEvent(selectionEvent), false);

    const dragEvent = new window.Event('dragstart', {
      bubbles: true,
      cancelable: true
    });
    assert.equal(iconPath.dispatchEvent(dragEvent), false);

    const pageSelectionEvent = new window.Event('selectstart', {
      bubbles: true,
      cancelable: true
    });
    assert.equal(pageText.dispatchEvent(pageSelectionEvent), true);

    dispatchPointer(window, button, 'pointerdown', { pointerType: 'touch' });
    const contextMenuEvent = new window.Event('contextmenu', {
      bubbles: true,
      cancelable: true
    });
    assert.equal(iconPath.dispatchEvent(contextMenuEvent), false);
  } finally {
    dom.window.close();
  }
});
