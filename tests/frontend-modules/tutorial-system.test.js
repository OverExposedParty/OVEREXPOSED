const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const tutorialDirectory = path.join(
  __dirname,
  '../../public/scripts/general/tutorial'
);
const tutorialScripts = [
  'tutorial-storage.js',
  'tutorial-target.js',
  'tutorial.js'
].map((fileName) =>
  fs.readFileSync(path.join(tutorialDirectory, fileName), 'utf8')
);

function createDom() {
  const dom = new JSDOM('<main><button id="target">Target</button></main>', {
    runScripts: 'outside-only',
    url: 'https://overexposed.app/example'
  });
  dom.window.requestAnimationFrame = (callback) => callback();
  tutorialScripts.forEach((script) => dom.window.eval(script));
  return dom;
}

test('shared tutorial creates its own UI and stores versioned completion', () => {
  const dom = createDom();
  const tutorial = dom.window.OETutorial.create({
    id: 'example',
    version: 3,
    steps: [
      {
        id: 'welcome',
        eyebrow: 'ORIENTATION',
        title: 'Welcome!',
        copy: 'This tutorial can be used on any page.',
        action: 'Continue',
        modal: true
      }
    ]
  });

  tutorial.start();
  const root = tutorial.root;

  assert.equal(root.parentElement, dom.window.document.body);
  assert.equal(
    root.querySelector('[data-oe-tutorial-title]').textContent,
    'Welcome!'
  );
  root.querySelector('[data-oe-tutorial-notch]').click();
  assert.equal(root.classList.contains('is-collapsed'), true);
  assert.equal(
    root.querySelector('[data-oe-tutorial-notch-label]').textContent,
    'Show'
  );
  root.querySelector('[data-oe-tutorial-notch]').click();
  root.querySelector('[data-oe-tutorial-next]').click();

  assert.equal(root.hidden, true);
  assert.equal(
    dom.window.localStorage.getItem('oe-example-tutorial-version'),
    '3'
  );
  assert.equal(tutorial.hasCompleted(), true);
});

test('shared tutorial restores elevated elements after its backdrop closes', () => {
  const dom = createDom();
  const target = dom.window.document.getElementById('target');
  target.style.position = 'absolute';
  target.style.zIndex = '7';
  const tutorial = dom.window.OETutorial.create({
    id: 'backdrop-example',
    steps: [
      {
        id: 'backdrop',
        backdrop: true,
        elevate: '#target',
        target: '#target'
      }
    ]
  });

  tutorial.start();
  const backdrop = dom.window.document.querySelector(
    '[data-oe-tutorial-backdrop]'
  );
  assert.equal(backdrop.hidden, false);
  assert.equal(target.style.position, 'absolute');
  assert.equal(target.style.zIndex, '2147483601');
  assert.equal(target.classList.contains('is-oe-tutorial-elevated'), true);

  tutorial.root.querySelector('[data-oe-tutorial-skip]').click();
  assert.equal(backdrop.hidden, true);
  assert.equal(target.style.position, 'absolute');
  assert.equal(target.style.zIndex, '7');
  assert.equal(target.classList.contains('is-oe-tutorial-elevated'), false);
});

test('shared tutorial can release and restore a parent stacking context', () => {
  const dom = createDom();
  const target = dom.window.document.getElementById('target');
  target.style.left = '50%';
  target.style.transform = 'translateX(-50%)';
  target.style.transition = 'transform 200ms ease';
  target.style.zIndex = '4';
  const geometryReads = [];
  Object.defineProperty(target, 'offsetLeft', { value: 80 });
  Object.defineProperty(target, 'offsetTop', { value: 100 });
  target.getBoundingClientRect = () => {
    geometryReads.push({
      transform: target.style.transform,
      transition: target.style.transition
    });
    return target.style.transform === 'none'
      ? { left: 80, top: 100 }
      : { left: 40, top: 75 };
  };
  const tutorial = dom.window.OETutorial.create({
    id: 'release-stacking-example',
    steps: [
      {
        id: 'release',
        backdrop: true,
        releaseStacking: '#target'
      }
    ]
  });

  tutorial.start();
  assert.equal(target.style.left, '40px');
  assert.equal(target.style.top, '75px');
  assert.equal(target.style.right, 'auto');
  assert.equal(target.style.bottom, 'auto');
  assert.equal(target.style.transform, 'none');
  assert.equal(target.style.transition, 'none');
  assert.equal(target.style.zIndex, 'auto');

  tutorial.finish();
  assert.equal(target.style.left, '50%');
  assert.equal(target.style.top, '');
  assert.equal(target.style.right, '');
  assert.equal(target.style.bottom, '');
  assert.equal(target.style.transform, 'translateX(-50%)');
  assert.equal(target.style.transition, 'transform 200ms ease');
  assert.equal(target.style.zIndex, '4');
  assert.deepEqual(geometryReads.at(-1), {
    transform: 'translateX(-50%)',
    transition: 'none'
  });
});

test('shared tutorial destroy restores elevated elements and removes backdrop', () => {
  const dom = createDom();
  const target = dom.window.document.getElementById('target');
  const tutorial = dom.window.OETutorial.create({
    id: 'backdrop-destroy-example',
    steps: [
      {
        id: 'backdrop',
        backdrop: true,
        elevate: '#target'
      }
    ]
  });

  tutorial.start();
  tutorial.destroy();
  assert.equal(target.style.position, '');
  assert.equal(target.style.zIndex, '');
  assert.equal(
    dom.window.document.querySelector('[data-oe-tutorial-backdrop]'),
    null
  );
});

test('shared tutorial target module positions rings around page elements', () => {
  const dom = createDom();
  const target = dom.window.document.getElementById('target');
  target.getBoundingClientRect = () => ({
    left: 20,
    top: 30,
    width: 100,
    height: 40
  });
  const tutorial = dom.window.OETutorial.create({
    id: 'target-example',
    steps: [
      {
        id: 'target',
        title: 'Look here',
        copy: 'This element is highlighted.',
        target: '#target',
        targetPadding: 10
      }
    ]
  });

  tutorial.start();
  const ring = tutorial.root.querySelector('[data-oe-tutorial-ring-primary]');

  assert.equal(ring.getAttribute('cx'), '70');
  assert.equal(ring.getAttribute('cy'), '50');
  assert.equal(ring.getAttribute('rx'), '60');
  assert.equal(ring.getAttribute('ry'), '30');
});

test('shared tutorial target module positions and colours an annotation', () => {
  const dom = createDom();
  const target = dom.window.document.getElementById('target');
  target.getBoundingClientRect = () => ({
    left: 20,
    top: 30,
    width: 100,
    height: 40
  });
  const tutorial = dom.window.OETutorial.create({
    id: 'annotation-example',
    steps: [
      {
        id: 'annotation',
        title: 'Look here',
        copy: 'This element has a brace beside it.',
        target: '#target',
        targetAnnotation: {
          padding: 5,
          src: '/images/tutorial/brace-right/1.svg'
        }
      }
    ]
  });

  tutorial.start();
  const layer = tutorial.root.querySelector('[data-oe-tutorial-target]');
  const annotation = tutorial.root.querySelector(
    '[data-oe-tutorial-annotation]'
  );

  assert.equal(layer.classList.contains('has-annotation'), true);
  assert.equal(
    annotation.style.getPropertyValue('--oe-tutorial-annotation-image'),
    'url("/images/tutorial/brace-right/1.svg")'
  );
  assert.equal(
    annotation.style.getPropertyValue('--oe-tutorial-annotation-colour'),
    'var(--oe-tutorial-page-primary-colour)'
  );
  assert.equal(annotation.style.left, '15px');
  assert.equal(annotation.style.top, '25px');
  assert.equal(annotation.style.width, '110px');
  assert.equal(annotation.style.height, '50px');
});

test('shared tutorial annotations accept a colour override', () => {
  const dom = createDom();
  const target = dom.window.document.getElementById('target');
  target.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 100,
    height: 40
  });
  const tutorial = dom.window.OETutorial.create({
    id: 'annotation-colour-example',
    steps: [
      {
        id: 'annotation',
        target: '#target',
        targetAnnotation: {
          colour: '#ff00aa',
          src: '/images/tutorial/circle/1.svg'
        }
      }
    ]
  });

  tutorial.start();
  const annotation = tutorial.root.querySelector(
    '[data-oe-tutorial-annotation]'
  );
  assert.equal(
    annotation.style.getPropertyValue('--oe-tutorial-annotation-colour'),
    '#ff00aa'
  );
});

test('shared tutorial annotations can align a fixed width to a target edge', () => {
  const dom = createDom();
  const target = dom.window.document.getElementById('target');
  target.getBoundingClientRect = () => ({
    left: 20,
    right: 120,
    top: 30,
    width: 100,
    height: 40
  });
  const tutorial = dom.window.OETutorial.create({
    id: 'annotation-edge-example',
    steps: [
      {
        id: 'annotation',
        target: '#target',
        targetAnnotation: {
          side: 'right',
          src: '/images/tutorial/brace-right/1.svg',
          width: 32
        }
      }
    ]
  });

  tutorial.start();
  const annotation = tutorial.root.querySelector(
    '[data-oe-tutorial-annotation]'
  );
  assert.equal(annotation.style.left, '88px');
  assert.equal(annotation.style.width, '32px');
});

test('shared tutorial annotations can align visible artwork after a target', () => {
  const dom = createDom();
  const target = dom.window.document.getElementById('target');
  target.getBoundingClientRect = () => ({
    left: 20,
    right: 120,
    top: 30,
    width: 100,
    height: 40
  });
  const tutorial = dom.window.OETutorial.create({
    id: 'annotation-visible-bounds-example',
    steps: [
      {
        id: 'annotation',
        target: '#target',
        targetAnnotation: {
          gap: 10,
          placement: 'after',
          src: '/images/tutorial/brace-right/1.svg',
          visibleBounds: { left: 0.75 }
        }
      }
    ]
  });

  tutorial.start();
  const annotation = tutorial.root.querySelector(
    '[data-oe-tutorial-annotation]'
  );
  assert.equal(annotation.style.left, '34px');
  assert.equal(annotation.style.width, '128px');
});

test('shared tutorial advances on page events and skips unavailable steps', () => {
  const dom = createDom();
  const tutorial = dom.window.OETutorial.create({
    id: 'events-example',
    steps: [
      {
        id: 'action',
        title: 'Try the action',
        copy: 'This step waits for the page.',
        actionRequired: true,
        advanceOn: 'example:completed'
      },
      {
        id: 'unavailable',
        title: 'Unavailable',
        when: () => false
      },
      {
        id: 'complete',
        title: 'Complete',
        copy: 'The event advanced the tutorial.'
      }
    ]
  });

  tutorial.start();
  assert.equal(
    tutorial.root.querySelector('[data-oe-tutorial-next]').hidden,
    true
  );
  dom.window.dispatchEvent(new dom.window.CustomEvent('example:completed'));

  assert.equal(tutorial.currentStep.id, 'complete');
  assert.equal(
    tutorial.root.querySelector('[data-oe-tutorial-progress]').textContent,
    '2 / 2'
  );
});

test('shared tutorial steps can move dialogue away from their target', () => {
  const dom = createDom();
  const tutorial = dom.window.OETutorial.create({
    id: 'dialogue-placement-example',
    steps: [
      {
        id: 'top',
        dialoguePlacement: 'top',
        target: '#target'
      },
      {
        id: 'bottom',
        target: '#target'
      }
    ]
  });

  tutorial.start();
  assert.equal(tutorial.root.dataset.dialoguePlacement, 'top');
  tutorial.advance();
  assert.equal(tutorial.root.dataset.dialoguePlacement, 'bottom');
});

test('shared tutorial can refresh a step presentation after dynamic content settles', () => {
  const dom = createDom();
  const target = dom.window.document.getElementById('target');
  let contentReady = false;
  const tutorial = dom.window.OETutorial.create({
    id: 'dynamic-presentation-example',
    steps: [
      {
        id: 'dynamic',
        backdrop: true,
        elevate: () => (contentReady ? target : null)
      }
    ]
  });

  tutorial.start();
  assert.equal(target.classList.contains('is-oe-tutorial-elevated'), false);

  contentReady = true;
  assert.equal(tutorial.refreshPresentation(), true);
  assert.equal(target.classList.contains('is-oe-tutorial-elevated'), true);
});
