const assert = require('node:assert/strict');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const createOlingClashHealthRenderer = require('../../public/scripts/olings/clash/game/renderers/health');
const createOlingClashPicker = require('../../public/scripts/olings/clash/game/renderers/picker');

function createOling(name, heartUnits) {
  return {
    health: {
      shieldCount: 0,
      heartUnits,
      maxHeartUnits: 6,
      overgrowthUnits: 0
    },
    name,
    parts: {
      body: '/body.svg',
      eyes: '/eyes.svg',
      flight: '/flight.svg',
      mouth: '/mouth.svg'
    }
  };
}

function createPickerDom() {
  return new JSDOM(`
    <main>
      <section data-clash-picker hidden>
        <h2 data-clash-picker-title></h2>
        <div data-clash-picker-options></div>
        <div data-clash-picker-choices hidden></div>
        <button data-clash-picker-confirm></button>
      </section>
    </main>
  `);
}

test('Clash picker disables ineligible Olings and confirms the selection', () => {
  const dom = createPickerDom();
  const root = dom.window.document.querySelector('main');
  const picker = createOlingClashPicker({
    healthRenderer: createOlingClashHealthRenderer()
  });
  let confirmed = null;

  picker.open(root, {
    isEligible: (oling, index) => index > 0 && oling.health.heartUnits > 0,
    mode: 'tag',
    olings: [
      createOling('DEFEATED', 0),
      createOling('READY', 6),
      createOling('BENCHED OUT', 0)
    ],
    onConfirm(index, oling) {
      confirmed = { index, name: oling.name };
    }
  });

  const container = root.querySelector('[data-clash-picker]');
  const options = [...root.querySelectorAll('[data-clash-picker-option]')];
  const confirm = root.querySelector('[data-clash-picker-confirm]');
  assert.equal(container.hidden, false);
  assert.equal(container.dataset.pickerMode, 'tag');
  assert.equal(options[0].disabled, true);
  assert.equal(options[1].disabled, false);
  assert.equal(options[2].disabled, true);
  assert.equal(
    options[0].querySelector('[data-picker-part="eyes"]').getAttribute('src'),
    '/images/olings/builds/eyes/states/defeated-eyes.svg'
  );
  assert.equal(
    options[1].querySelector('[data-picker-part="eyes"]').getAttribute('src'),
    '/eyes.svg'
  );
  assert.equal(
    options[2].querySelector('[data-picker-part="eyes"]').getAttribute('src'),
    '/images/olings/builds/eyes/states/defeated-eyes.svg'
  );
  assert.equal(confirm.disabled, true);
  assert.equal(
    options[1]
      .querySelector('[data-clash-health]')
      .classList.contains('olings-clash-health'),
    true
  );

  options[1].click();
  assert.equal(options[1].getAttribute('aria-pressed'), 'true');
  assert.equal(confirm.disabled, false);
  confirm.click();
  assert.deepEqual(confirmed, { index: 1, name: 'READY' });
  assert.equal(container.hidden, true);
});

test('Clash picker adapts between friendly and enemy target modes', () => {
  const dom = createPickerDom();
  const root = dom.window.document.querySelector('main');
  const picker = createOlingClashPicker({
    healthRenderer: createOlingClashHealthRenderer()
  });
  const olings = [createOling('ONE', 6), createOling('TWO', 4)];
  let cancelled = false;

  picker.open(root, {
    mode: 'friendly-target',
    olings,
    onCancel() {
      cancelled = true;
    }
  });
  const container = root.querySelector('[data-clash-picker]');
  assert.equal(container.dataset.pickerSide, 'local');
  assert.equal(picker.canCancel(), true);
  assert.equal(
    root.querySelector('[data-clash-picker-title]').textContent,
    'CHOOSE A FRIENDLY OLING'
  );
  picker.close(root, { cancelled: true });
  assert.equal(cancelled, true);
  assert.equal(container.hidden, true);

  picker.open(root, { mode: 'enemy-target', olings });
  assert.equal(container.dataset.pickerSide, 'opponent');
  assert.equal(
    root.querySelector('[data-clash-picker-title]').textContent,
    'CHOOSE AN ENEMY OLING'
  );
});

test('Clash picker requires an eligible target and effect choice', () => {
  const dom = createPickerDom();
  const root = dom.window.document.querySelector('main');
  const picker = createOlingClashPicker();
  let confirmed = null;

  picker.open(root, {
    choiceOptions: [
      { key: 'self-to-bench', label: 'GIVE 1/2 HEART' },
      { key: 'bench-to-self', label: 'RECEIVE 1/2 HEART' }
    ],
    isChoiceEligible: (choiceKey, _oling, index) =>
      index === 1 || choiceKey === 'bench-to-self',
    isEligible: (_oling, index) => index > 0,
    mode: 'friendly-target',
    olings: [
      createOling('ACTIVE', 4),
      createOling('FLEXIBLE', 3),
      createOling('DONOR ONLY', 6)
    ],
    onConfirm(index, oling, choiceKey) {
      confirmed = { choiceKey, index, name: oling.name };
    }
  });

  const options = [...root.querySelectorAll('[data-clash-picker-option]')];
  const choices = [...root.querySelectorAll('[data-clash-picker-choice]')];
  const confirm = root.querySelector('[data-clash-picker-confirm]');
  assert.equal(choices.length, 2);
  assert.equal(
    choices.every((choice) => choice.disabled),
    true
  );

  options[2].click();
  assert.equal(choices[0].disabled, true);
  assert.equal(choices[1].disabled, false);
  assert.equal(confirm.disabled, false);
  assert.equal(choices[1].getAttribute('aria-checked'), 'true');
  confirm.click();
  assert.deepEqual(confirmed, {
    choiceKey: 'bench-to-self',
    index: 2,
    name: 'DONOR ONLY'
  });
});

test('Clash picker keeps effect choices in one adaptive icon row', () => {
  const dom = createPickerDom();
  const root = dom.window.document.querySelector('main');
  const picker = createOlingClashPicker();
  const createEffectChoices = (count) =>
    Array.from({ length: count }, (_, index) => ({
      imagePath: `/effects/status-${index + 1}.svg`,
      key: `status-${index + 1}`,
      label: `STATUS ${index + 1}`,
      presentation: 'effect',
      statusKey: `status-${index + 1}`
    }));

  picker.open(root, {
    choiceOptions: createEffectChoices(3),
    olings: [createOling('ACTIVE', 6)],
    selectedIndex: 0
  });

  const row = root.querySelector('[data-clash-picker-choices]');
  let choices = [...row.querySelectorAll('[data-clash-picker-choice]')];
  assert.equal(row.classList.contains('is-effect-row'), true);
  assert.equal(row.classList.contains('is-icon-only'), false);
  assert.equal(
    row.style.getPropertyValue('--clash-picker-choice-count'),
    '3'
  );
  assert.equal(
    choices.every(
      (choice) =>
        choice.querySelector('.olings-clash-effect__icon') &&
        choice.querySelector('strong')?.textContent.startsWith('STATUS')
    ),
    true
  );

  picker.open(root, {
    choiceOptions: createEffectChoices(4),
    olings: [createOling('ACTIVE', 6)],
    selectedIndex: 0
  });
  choices = [...row.querySelectorAll('[data-clash-picker-choice]')];
  assert.equal(row.classList.contains('is-icon-only'), true);
  assert.equal(
    row.style.getPropertyValue('--clash-picker-choice-count'),
    '4'
  );
  assert.equal(
    choices.every(
      (choice) =>
        choice.querySelector('.olings-clash-effect__icon') &&
        choice.getAttribute('aria-label')?.startsWith('STATUS')
    ),
    true
  );
});
