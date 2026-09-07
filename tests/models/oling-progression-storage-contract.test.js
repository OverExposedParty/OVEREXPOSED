const assert = require('node:assert/strict');
const test = require('node:test');

const PlayerOling = require('../../models/olings/player-oling-schema');
const OlingEgg = require('../../models/olings/oling-egg-schema');
const OlingHatchReceipt = require('../../models/olings/oling-hatch-receipt-schema');
const OlingBattleMatch = require('../../models/olings/oling-battle-match-schema');
const OlingClashMatch = require('../../models/olings/oling-clash-match-schema');

function assertNoLegacyProgression(schema) {
  assert.equal(schema.path('level'), undefined);
  assert.equal(schema.path('xp'), undefined);
  assert.equal(schema.path('battleStats'), undefined);
}

function assertNoPersonality(schema) {
  assert.equal(schema.path('personalityKey'), undefined);
}

test('player Olings do not store Oling-specific progression or battle stats', () => {
  assertNoLegacyProgression(PlayerOling.schema);
  assertNoPersonality(PlayerOling.schema);
});

test('Battle and Clash Oling snapshots do not store Oling levels', () => {
  assert.equal(OlingBattleMatch.olingSnapshotSchema.path('level'), undefined);
  assert.equal(OlingClashMatch.olingSnapshotSchema.path('level'), undefined);
  assertNoPersonality(OlingBattleMatch.olingSnapshotSchema);
  assertNoPersonality(OlingClashMatch.olingSnapshotSchema);
});

test('eggs and hatch receipts do not store personality rolls', () => {
  assert.equal(OlingEgg.schema.path('personalityPool'), undefined);
  assert.equal(OlingHatchReceipt.schema.path('rolls.personality'), undefined);
});
