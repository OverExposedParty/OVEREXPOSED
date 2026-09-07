const assert = require('node:assert/strict');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const createOlingClashHealthRenderer = require('../../public/scripts/olings/clash/game/renderers/health');

function createHealthContainer(attributes = '') {
  const dom = new JSDOM(`<div data-clash-health ${attributes}></div>`);
  return {
    container: dom.window.document.querySelector('[data-clash-health]'),
    document: dom.window.document
  };
}

test('Clash health renders Hearts followed by protection', () => {
  const { container } = createHealthContainer();
  const renderer = createOlingClashHealthRenderer();

  renderer.renderHealth(container, {
    maxHeartUnits: 6,
    heartUnits: 5,
    overgrowthUnits: 1,
    shieldCount: 2
  });

  const units = [...container.querySelectorAll('.olings-clash-health-unit')];
  assert.deepEqual(
    units.map((unit) => unit.dataset.heartType),
    ['hearts', 'hearts', 'hearts', 'overgrowth', 'shields', 'shields']
  );
  assert.deepEqual(
    units.map((unit) => unit.dataset.heartUnits),
    ['2', '2', '1', '1', '2', '2']
  );
  assert.equal(units[0].classList.contains('is-half'), false);
  assert.equal(units[1].classList.contains('is-half'), false);
  assert.equal(units[2].classList.contains('is-half'), true);
  assert.equal(units[3].classList.contains('is-half'), true);
  assert.deepEqual(
    units.map((unit) => unit.getAttribute('src')),
    [
      '/images/olings/clash/ui/health/hearts/normal/full.svg',
      '/images/olings/clash/ui/health/hearts/normal/full.svg',
      '/images/olings/clash/ui/health/hearts/normal/half.svg',
      '/images/olings/clash/ui/health/hearts/overgrowth/half.svg',
      '/images/olings/clash/ui/health/shields/default.svg',
      '/images/olings/clash/ui/health/shields/default.svg'
    ]
  );
  assert.equal(
    container.getAttribute('aria-label'),
    '2 Shields, 0.5 Hearts of Overgrowth, 2.5 Hearts, maximum 3 Hearts'
  );
});

test('Clash health uses fixed-size full and half Blood Heart assets', () => {
  const { container } = createHealthContainer();
  const renderer = createOlingClashHealthRenderer();

  renderer.renderHealth(container, {
    bloodUnits: 3,
    heartUnits: 0,
    maxHeartUnits: 6
  });

  const blood = [...container.querySelectorAll('.is-blood')];
  assert.deepEqual(
    blood.map((unit) => unit.getAttribute('src')),
    [
      '/images/olings/clash/ui/health/hearts/blood/full.svg',
      '/images/olings/clash/ui/health/hearts/blood/half.svg'
    ]
  );
  assert.equal(blood[0].classList.contains('is-half'), false);
  assert.equal(blood[1].classList.contains('is-half'), true);
  assert.equal(
    container.getAttribute('aria-label'),
    '0 Hearts, 1.5 Hearts of Blood, maximum 3 Hearts'
  );
});

test('Clash health preserves image nodes when its values have not changed', () => {
  const { container } = createHealthContainer();
  const renderer = createOlingClashHealthRenderer();
  const health = {
    maxHeartUnits: 6,
    heartUnits: 5,
    overgrowthUnits: 1,
    shieldCount: 1
  };

  renderer.renderHealth(container, health);
  const originalUnits = [...container.children];
  renderer.renderHealth(container, { ...health });

  assert.ok(
    [...container.children].every((unit, index) => unit === originalUnits[index])
  );
});

test('Clash health initializes every declarative health display', () => {
  const dom = new JSDOM(`
    <main>
      <div
        data-clash-health
        data-max-heart-units="6"
        data-heart-units="3"
        data-overgrowth-units="2"
        data-shield-count="0"
      ></div>
      <div
        data-clash-health
        data-max-heart-units="8"
        data-heart-units="8"
        data-overgrowth-units="0"
        data-shield-count="1"
      ></div>
    </main>
  `);
  const renderer = createOlingClashHealthRenderer();

  assert.equal(renderer.initialize(dom.window.document), 2);
  assert.equal(
    dom.window.document.querySelectorAll('.olings-clash-health-unit').length,
    8
  );
  assert.equal(
    dom.window.document.querySelectorAll('.olings-clash-health-unit.is-half')
      .length,
    1
  );
});

test('Clash health normalizes unit values and caps permanent Hearts', () => {
  const renderer = createOlingClashHealthRenderer();

  assert.deepEqual(
    renderer.normalizeHealthState({
      maxHeartUnits: 6,
      heartUnits: 9,
      bloodUnits: 1.9,
      overgrowthUnits: 2.9,
      shieldCount: -3
    }),
    {
      maxHeartUnits: 6,
      heartUnits: 6,
      bloodUnits: 1,
      overgrowthUnits: 2,
      shieldCount: 0
    }
  );
});
