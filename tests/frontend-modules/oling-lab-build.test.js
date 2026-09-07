const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

test('Oling Build presents a preview and four selectable rarity-themed parts', () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  const context = { window: dom.window, document: dom.window.document };
  vm.runInNewContext(
    fs.readFileSync(
      path.join(__dirname, '../../public/scripts/olings/lab/olings/build.js'),
      'utf8'
    ),
    context
  );

  const traits = {
    flight: {
      name: 'Stone Wings',
      rarity: 'uncommon',
      theme: 'stone',
      flavor: 'Wings that fly through determination.',
      assets: { image: '/stone-wings.svg' }
    },
    body: {
      name: 'Vampire Body',
      rarity: 'common',
      theme: 'vampire',
      assets: { image: '/vampire-body.svg' }
    },
    eyes: {
      name: 'Moss Eyes',
      rarity: 'common',
      theme: 'moss',
      assets: { image: '/moss-eyes.svg' }
    },
    mouth: {
      name: 'Moss Mouth',
      rarity: 'common',
      theme: 'moss',
      assets: { image: '/moss-mouth.svg' }
    }
  };
  const themedParts = [];
  const tools = dom.window.createOlingLabBuildTools({
    state: { layers: ['flight', 'body', 'eyes', 'mouth'] },
    helpers: {
      applyRarityTheme(element, rarity) {
        element.dataset.rarity = rarity;
        themedParts.push(rarity);
      },
      createImage(src, alt) {
        const image = dom.window.document.createElement('img');
        image.src = src;
        image.alt = alt;
        return image;
      },
      formatTitle(value) {
        return String(value)
          .split('-')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');
      }
    },
    previewTools: {
      createPreview() {
        const preview = dom.window.document.createElement('div');
        preview.className = 'oling-lab-oling-preview assembled-preview';
        return preview;
      }
    }
  });

  const [presentation] = tools.createBuildPresentation({ traits });
  const buttons = [
    ...presentation.querySelectorAll('.oling-lab-hatch-build-part-button')
  ];
  const details = presentation.querySelector(
    '.oling-lab-hatch-build-part-details'
  );

  assert.ok(presentation.querySelector('.assembled-preview'));
  assert.ok(
    presentation.querySelector(
      '.oling-lab-hatch-build-preview.oling-lab-egg-insertion-stage.oling-lab-oling-info-stage > .oling-lab-oling-hero > .assembled-preview'
    )
  );
  assert.equal(buttons.length, 4);
  assert.deepEqual(themedParts, ['uncommon', 'common', 'common', 'common']);
  assert.deepEqual(
    buttons.map((button) => button.dataset.olingBuildLayer),
    ['flight', 'body', 'eyes', 'mouth']
  );
  assert.ok(buttons.every((button) => button.dataset.soundIntent === 'select'));
  assert.equal(presentation.querySelector('.oling-lab-stats-toggle'), null);
  assert.equal(
    presentation.querySelector('.oling-lab-hatch-build-panel'),
    null
  );
  assert.equal(
    presentation.querySelector('.oling-lab-set-preview-meta span'),
    null
  );
  assert.equal(buttons[0].getAttribute('aria-pressed'), 'true');
  assert.deepEqual(
    buttons.slice(1).map((button) => button.getAttribute('aria-pressed')),
    ['false', 'false', 'false']
  );
  assert.match(details.textContent, /Stone Wings/);
  assert.match(details.textContent, /Flight parts/);
  assert.match(details.textContent, /Stone set/);

  buttons[1].click();
  assert.equal(buttons[0].getAttribute('aria-pressed'), 'false');
  assert.equal(buttons[1].getAttribute('aria-pressed'), 'true');
  assert.match(details.textContent, /Vampire Body/);
  assert.match(details.textContent, /Body parts/);
  assert.match(details.textContent, /Vampire set/);

  let linkedSelection = '';
  const [linkedPresentation] = tools.createBuildPresentation(
    { traits },
    {
      selectedLayer: 'eyes',
      onSelectPart: (layer) => {
        linkedSelection = layer;
      }
    }
  );
  const linkedButtons = [
    ...linkedPresentation.querySelectorAll('.oling-lab-hatch-build-part-button')
  ];
  assert.equal(linkedButtons[2].getAttribute('aria-pressed'), 'true');
  assert.equal(linkedSelection, 'eyes');
  assert.match(
    linkedPresentation.querySelector('.oling-lab-hatch-build-part-details')
      .textContent,
    /Moss Eyes/
  );
  linkedButtons[3].click();
  assert.equal(linkedSelection, 'mouth');
  dom.window.close();
});
