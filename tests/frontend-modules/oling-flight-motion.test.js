const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const flightMotion = require('../../public/scripts/olings/shared/oling-flight-motion');
const OlingTrait = require('../../models/olings/oling-trait-schema');
const { serializeOlingTrait } = require('../../server/services/olings');
const traitDefinitions = require('../../public/json-files/olings/traits.json');

function createOlingElement() {
  const dom = new JSDOM(`
    <div class="oling">
      <img class="oling-battle-layer is-flight" />
      <img class="oling-battle-layer is-body" />
    </div>
  `);
  return dom.window.document.querySelector('.oling');
}

test('flight motion configures balloon sway on only the flight layer', () => {
  const root = createOlingElement();
  const state = flightMotion.configure(root, {
    flightType: 'balloons',
    flightMotion: 'sway',
    flightSpeed: 2
  });
  const flightLayer = root.querySelector('.is-flight');
  const bodyLayer = root.querySelector('.is-body');

  assert.equal(state.flightMotion, 'sway');
  assert.ok(flightLayer.classList.contains('is-flight-motion-sway'));
  assert.ok(!bodyLayer.classList.contains('is-flight-motion-sway'));
  assert.equal(
    root.style.getPropertyValue('--oling-flight-motion-duration'),
    '1.2s'
  );
});

test('flight speed multiplies an updated motion speed', () => {
  const root = createOlingElement();
  flightMotion.configure(root, {
    flightType: 'wings',
    flightMotion: 'flutter',
    flightSpeed: 2
  });

  assert.equal(flightMotion.setMotionDuration(root, 0.8), true);
  assert.equal(
    root.style.getPropertyValue('--oling-flight-motion-duration'),
    '0.4s'
  );
});

test('battle speed multiplier stacks with trait flight speed', () => {
  const root = createOlingElement();
  flightMotion.configure(root, {
    flightType: 'balloons',
    flightMotion: 'sway',
    flightSpeed: 2
  });

  assert.equal(flightMotion.setSpeedMultiplier(root, 1.2), true);
  assert.equal(
    root.style.getPropertyValue('--oling-flight-motion-duration'),
    '1s'
  );
  assert.equal(root.dataset.flightSpeedMultiplier, '1.2');
});

test('legacy flight types resolve to their intended motions', () => {
  assert.equal(flightMotion.resolveMotion({ flightType: 'wings' }), 'flutter');
  assert.equal(flightMotion.resolveMotion({ flightType: 'balloons' }), 'sway');
  assert.equal(
    flightMotion.resolveMotion({
      flightType: 'balloons',
      flightMotion: 'figure8'
    }),
    'sway'
  );
  assert.equal(flightMotion.resolveMotion(null), '');
});

test('every current flight trait defines motion and speed', () => {
  const flightTraits = traitDefinitions.traits.filter(
    (trait) => trait.layer === 'flight'
  );

  assert.equal(flightTraits.length, 8);
  flightTraits.forEach((trait) => {
    assert.equal(trait.flightSpeed, 1);
    assert.equal(
      trait.flightMotion,
      trait.flightType === 'balloons' ? 'sway' : 'flutter'
    );
  });
});

test('flight configuration survives schema and API serialization', () => {
  assert.ok(OlingTrait.schema.path('flightMotion'));
  assert.ok(OlingTrait.schema.path('flightSpeed'));

  const serialized = serializeOlingTrait({
    key: 'base-trash-balloons',
    name: 'Trash Balloons',
    collection: 'base',
    theme: 'trash',
    layer: 'flight',
    flightType: 'balloons',
    flightMotion: 'sway',
    flightSpeed: 1,
    rarity: 'epic'
  });

  assert.equal(serialized.flightMotion, 'sway');
  assert.equal(serialized.flightSpeed, 1);
});
