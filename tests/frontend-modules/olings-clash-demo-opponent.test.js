const assert = require('node:assert/strict');
const test = require('node:test');

const createOlingClashDemoOpponent = require('../../public/scripts/olings/clash/game/demo-opponent');

test('Clash demo opponent returns a configurable randomized action delay', () => {
  const randomValues = [0, 0.999999];
  const opponent = createOlingClashDemoOpponent({
    maximumActionDelayMs: 1800,
    minimumActionDelayMs: 900,
    random: () => randomValues.shift()
  });

  assert.equal(opponent.getActionDelayMs(), 900);
  assert.equal(opponent.getActionDelayMs(), 1800);
});

test('Clash demo opponent applies timing bounds supplied by the turn flow', () => {
  const opponent = createOlingClashDemoOpponent({ random: () => 0.5 });

  assert.equal(
    opponent.getActionDelayMs({
      maximumDelayMs: 14500,
      minimumDelayMs: 500
    }),
    7500
  );
  assert.equal(
    opponent.getActionDelayMs({
      maximumDelayMs: 2000,
      minimumDelayMs: 250
    }),
    1125
  );
});

test('Clash demo opponent prevents its maximum delay falling below its minimum', () => {
  const opponent = createOlingClashDemoOpponent({
    maximumActionDelayMs: 200,
    minimumActionDelayMs: 600,
    random: () => 0.5
  });

  assert.equal(opponent.getActionDelayMs(), 600);
});
