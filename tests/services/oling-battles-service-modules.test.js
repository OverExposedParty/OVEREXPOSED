const test = require('node:test');
const assert = require('node:assert/strict');

const olingBattles = require('../../server/services/oling-battles');
const constants = require('../../server/services/oling-battles/constants');
const matchCodes = require('../../server/services/oling-battles/match-codes');
const matchView = require('../../server/services/oling-battles/match-view');
const lifecycle = require('../../server/services/oling-battles/match-lifecycle');
const aiOpponent = require('../../server/services/oling-battles/ai-opponent');
const battleHits = require('../../server/services/oling-battles/battle-hits');
const participants = require('../../server/services/oling-battles/match-participants');
const events = require('../../server/services/oling-battles/events');
const players = require('../../server/services/oling-battles/battle-players');

test('Oling battle service facade preserves the public API', () => {
  assert.deepEqual(Object.keys(olingBattles).sort(), [
    'DEFAULT_MATCH_LENGTH_SECONDS',
    'MATCH_CODE_PATTERN',
    'addAiBattleOpponent',
    'assertMatchCode',
    'createBattleMatch',
    'emitBattleUpdate',
    'generateMatchCode',
    'generateUniqueMatchCode',
    'getBattleMatch',
    'getBattleTimeMultiplier',
    'getMatchTiming',
    'joinBattleMatch',
    'kickBattleOpponent',
    'leaveBattleMatch',
    'readyBattlePlayer',
    'recordBattleEvent',
    'resolveAiBattleHit',
    'resolveBattleHit',
    'selectBattlePlayerOling',
    'serializeBattleMatch',
    'snapshotBattleOling',
    'startBattleMatch'
  ].sort());
});

test('Oling battle service facade delegates to focused modules', () => {
  assert.equal(
    olingBattles.DEFAULT_MATCH_LENGTH_SECONDS,
    constants.DEFAULT_MATCH_LENGTH_SECONDS
  );
  assert.equal(olingBattles.MATCH_CODE_PATTERN, constants.MATCH_CODE_PATTERN);
  assert.equal(olingBattles.assertMatchCode, matchCodes.assertMatchCode);
  assert.equal(olingBattles.generateMatchCode, matchCodes.generateMatchCode);
  assert.equal(
    olingBattles.generateUniqueMatchCode,
    matchCodes.generateUniqueMatchCode
  );
  assert.equal(olingBattles.getBattleTimeMultiplier, matchView.getBattleTimeMultiplier);
  assert.equal(olingBattles.getMatchTiming, matchView.getMatchTiming);
  assert.equal(olingBattles.serializeBattleMatch, matchView.serializeBattleMatch);
  assert.equal(olingBattles.createBattleMatch, lifecycle.createBattleMatch);
  assert.equal(olingBattles.getBattleMatch, lifecycle.getBattleMatch);
  assert.equal(olingBattles.joinBattleMatch, lifecycle.joinBattleMatch);
  assert.equal(olingBattles.readyBattlePlayer, lifecycle.readyBattlePlayer);
  assert.equal(olingBattles.startBattleMatch, lifecycle.startBattleMatch);
  assert.equal(olingBattles.addAiBattleOpponent, aiOpponent.addAiBattleOpponent);
  assert.equal(olingBattles.resolveAiBattleHit, battleHits.resolveAiBattleHit);
  assert.equal(olingBattles.resolveBattleHit, battleHits.resolveBattleHit);
  assert.equal(
    olingBattles.selectBattlePlayerOling,
    participants.selectBattlePlayerOling
  );
  assert.equal(olingBattles.leaveBattleMatch, participants.leaveBattleMatch);
  assert.equal(olingBattles.kickBattleOpponent, participants.kickBattleOpponent);
  assert.equal(olingBattles.emitBattleUpdate, events.emitBattleUpdate);
  assert.equal(olingBattles.recordBattleEvent, events.recordBattleEvent);
  assert.equal(olingBattles.snapshotBattleOling, players.snapshotBattleOling);
});
