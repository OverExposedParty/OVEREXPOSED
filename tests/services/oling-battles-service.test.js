const test = require('node:test');
const assert = require('node:assert/strict');

const models = require('../../server/models');
const {
  MATCH_CODE_PATTERN,
  generateMatchCode,
  getBattleTimeMultiplier,
  serializeBattleMatch
} = require('../../server/services/oling-battles');

test('Oling battle match codes use the party room code format', () => {
  for (let index = 0; index < 30; index += 1) {
    const matchCode = generateMatchCode();
    assert.match(matchCode, MATCH_CODE_PATTERN);
    assert.match(matchCode, /^[A-Z0-9]{3}-[A-Z0-9]{3}$/);
  }
});

test('Oling battle time multiplier follows match phase thresholds', () => {
  assert.equal(getBattleTimeMultiplier(1), 1);
  assert.equal(getBattleTimeMultiplier(0.76), 1);
  assert.equal(getBattleTimeMultiplier(0.75), 1.15);
  assert.equal(getBattleTimeMultiplier(0.51), 1.15);
  assert.equal(getBattleTimeMultiplier(0.5), 1.35);
  assert.equal(getBattleTimeMultiplier(0.26), 1.35);
  assert.equal(getBattleTimeMultiplier(0.25), 1.6);
  assert.equal(getBattleTimeMultiplier(0, true), 2);
});

test('Oling battle match serialization exposes player health and timer state', () => {
  const startedAt = new Date(Date.now() - 15000);
  const serialized = serializeBattleMatch({
    _id: 'match-id',
    matchCode: 'ABC-123',
    status: 'active',
    config: { matchLengthSeconds: 30 },
    players: [
      {
        accountId: 'account-one',
        connected: true,
        currentHealth: 118,
        maxHealth: 118,
        olingId: 'oling-one',
        olingSnapshot: { name: 'Bin Hero' },
        playerName: 'Player One',
        ready: true,
        slot: 'player-one'
      }
    ],
    state: {
      phase: 'active',
      startedAt,
      marker: { position: 50, direction: 1 }
    }
  });

  assert.equal(serialized.matchCode, 'ABC-123');
  assert.equal(serialized.config.matchLengthSeconds, 30);
  assert.equal(serialized.players[0].currentHealth, 118);
  assert.equal(serialized.players[0].maxHealth, 118);
  assert.equal(serialized.state.timeMultiplier, 1.35);
  assert.ok(serialized.state.remainingSeconds <= 15);
});

test('Oling battle match serialization exposes AI player metadata', () => {
  const serialized = serializeBattleMatch({
    _id: 'match-id',
    matchCode: 'BOT-123',
    status: 'waiting',
    config: { matchLengthSeconds: 30 },
    players: [
      {
        accountId: 'account-one',
        connected: true,
        currentHealth: 100,
        maxHealth: 100,
        olingId: 'oling-one',
        olingSnapshot: { name: 'Sprout' },
        playerName: 'Player One',
        ready: false,
        slot: 'player-one'
      },
      {
        accountId: '000000000000000000000001',
        aiDifficulty: 0.4,
        connected: true,
        currentHealth: 105,
        isAi: true,
        maxHealth: 105,
        olingId: '000000000000000000000002',
        olingSnapshot: { name: 'AI Mossy' },
        playerName: 'AI Mossy',
        ready: true,
        slot: 'player-two'
      }
    ],
    state: { phase: 'waiting' }
  });

  assert.equal(serialized.players[0].isAi, false);
  assert.equal(serialized.players[1].isAi, true);
  assert.equal(serialized.players[1].aiDifficulty, 0.4);
});

test('Oling battle models are registered with the app model registry', () => {
  assert.equal(models.OlingBattleMatch.modelName, 'OlingBattleMatch');
  assert.equal(models.OlingBattleEvent.modelName, 'OlingBattleEvent');
});
