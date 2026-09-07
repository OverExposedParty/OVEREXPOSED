const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');

const OlingBattleArchive = require('../../models/olings/oling-battle-archive-schema');
const OlingBattleMatch = require('../../models/olings/oling-battle-match-schema');
const {
  OLING_BATTLE_GAME_ID_PATTERN
} = require('../../models/olings/oling-battle-game-id');
const {
  archiveAndResetBattle,
  createBattleArchiveSnapshot
} = require('../../server/services/oling-battles/archives');
const {
  recordBattleEvent
} = require('../../server/services/oling-battles/events');
const {
  resolveBattleHit
} = require('../../server/services/oling-battles/battle-hits');
const {
  leaveBattleMatch
} = require('../../server/services/oling-battles/match-participants');
const {
  getCurrentLegacyEventSegment
} = require('../../scripts/migrate-oling-battle-archives');

function createPlayer(slot, overrides = {}) {
  return {
    accountId: new mongoose.Types.ObjectId(),
    slot,
    olingId: new mongoose.Types.ObjectId(),
    olingSnapshot: { name: slot, build: {} },
    currentHealth: 100,
    maxHealth: 100,
    ...overrides
  };
}

function createMatch(overrides = {}) {
  return new OlingBattleMatch({
    matchCode: 'ABC-123',
    status: 'active',
    players: [createPlayer('player-one'), createPlayer('player-two')],
    state: {
      phase: 'active',
      startedAt: new Date('2026-08-11T12:00:00.000Z')
    },
    ...overrides
  });
}

test('Oling Battle matches generate game IDs and embed ordered events', async () => {
  const match = createMatch();
  const actor = match.players[0];

  await recordBattleEvent({}, match, 'started', actor.accountId);
  await recordBattleEvent({}, match, 'hit', actor.accountId, {
    damage: 3
  });
  await match.validate();

  assert.match(match.gameId, OLING_BATTLE_GAME_ID_PATTERN);
  assert.equal(match.events.length, 2);
  assert.equal(match.events[0].sequence, 1);
  assert.equal(match.events[0].actorSlot, 'player-one');
  assert.equal(match.events[1].payload.damage, 3);
  assert.equal(match.state.hitHistory, undefined);
});

test('completed Battle snapshots validate as immutable archive records', async () => {
  const match = createMatch({ status: 'completed' });
  match.state.phase = 'complete';
  match.state.endedAt = new Date('2026-08-11T12:00:30.000Z');
  match.state.endReason = 'knockout';
  match.state.winnerAccountId = match.players[0].accountId;
  await recordBattleEvent({}, match, 'completed', match.players[0].accountId);

  const archive = new OlingBattleArchive(
    createBattleArchiveSnapshot(match, 'completed')
  );
  await archive.validate();

  assert.equal(archive.gameId, match.gameId);
  assert.equal(archive.finalState.phase, 'complete');
  assert.equal(archive.events.at(-1).type, 'completed');
  assert.equal(archive.players.length, 2);
});

test('archiving preserves the completed game before preparing a rematch', async () => {
  const match = createMatch({ status: 'completed' });
  const oldGameId = match.gameId;
  match.players[1].currentHealth = 0;
  match.state.phase = 'complete';
  match.state.endedAt = new Date('2026-08-11T12:00:30.000Z');
  match.state.endReason = 'knockout';
  match.state.winnerAccountId = match.players[0].accountId;
  await recordBattleEvent({}, match, 'completed', match.players[0].accountId, {
    damage: 3
  });

  let archivedSnapshot;
  let accountHistoryUpdate;
  const archiveId = new mongoose.Types.ObjectId();
  const models = {
    OlingBattleArchive: {
      async findOneAndUpdate(_filter, update) {
        archivedSnapshot = update.$setOnInsert;
        return { _id: archiveId, ...archivedSnapshot };
      }
    },
    Account: {
      async updateMany(filter, update) {
        accountHistoryUpdate = { filter, update };
      }
    }
  };
  match.save = async () => match;

  await archiveAndResetBattle({
    models,
    match,
    completionStatus: 'completed'
  });

  assert.equal(archivedSnapshot.gameId, oldGameId);
  assert.equal(archivedSnapshot.finalState.phase, 'complete');
  assert.equal(archivedSnapshot.players[1].currentHealth, 0);
  assert.equal(archivedSnapshot.events.at(-1).type, 'completed');
  assert.notEqual(match.gameId, oldGameId);
  assert.equal(match.status, 'waiting');
  assert.equal(match.players[1].currentHealth, 100);
  assert.equal(match.events.length, 1);
  assert.equal(match.events[0].type, 'created');
  assert.deepEqual(accountHistoryUpdate.update, {
    $addToSet: { 'gameData.matchHistory': archiveId }
  });
});

test('legacy migration keeps only the current rematch event segment', () => {
  const events = [
    { sequence: 1, type: 'created' },
    { sequence: 2, type: 'completed' },
    { sequence: 3, type: 'ready' },
    { sequence: 4, type: 'started' },
    { sequence: 5, type: 'hit' }
  ];

  assert.deepEqual(
    getCurrentLegacyEventSegment(events, 'active').map((event) => event.type),
    ['ready', 'started', 'hit']
  );
  assert.deepEqual(
    getCurrentLegacyEventSegment(events, 'completed').map(
      (event) => event.type
    ),
    ['created', 'completed', 'ready', 'started', 'hit']
  );
});

test('a knockout archives the finished game and returns a fresh lobby', async () => {
  const match = createMatch();
  const winner = match.players[0];
  match.players[1].currentHealth = 3;
  match.save = async () => match;
  let archivedSnapshot;
  const models = {
    OlingBattleMatch: {
      async findOne() {
        return match;
      }
    },
    OlingBattleArchive: {
      async findOneAndUpdate(_filter, update) {
        archivedSnapshot = update.$setOnInsert;
        return { _id: new mongoose.Types.ObjectId(), ...archivedSnapshot };
      }
    },
    Account: { async updateMany() {} }
  };

  const { battleResult } = await resolveBattleHit({
    models,
    account: { _id: winner.accountId },
    matchCode: match.matchCode,
    zone: 'critical'
  });

  assert.equal(battleResult.ended, true);
  assert.equal(archivedSnapshot.endReason, 'knockout');
  assert.equal(archivedSnapshot.players[1].currentHealth, 0);
  assert.equal(archivedSnapshot.events.at(-1).type, 'completed');
  assert.equal(match.status, 'waiting');
  assert.equal(match.players[1].currentHealth, 100);
});

test('leaving an active Battle archives a surrender before resetting', async () => {
  const match = createMatch();
  const leavingPlayer = match.players[0];
  match.save = async () => match;
  let archivedSnapshot;
  const models = {
    OlingBattleMatch: {
      async findOne() {
        return match;
      }
    },
    OlingBattleArchive: {
      async findOneAndUpdate(_filter, update) {
        archivedSnapshot = update.$setOnInsert;
        return { _id: new mongoose.Types.ObjectId(), ...archivedSnapshot };
      }
    },
    Account: { async updateMany() {} }
  };

  await leaveBattleMatch({
    models,
    account: { _id: leavingPlayer.accountId },
    matchCode: match.matchCode
  });

  assert.equal(archivedSnapshot.endReason, 'surrender');
  assert.equal(
    String(archivedSnapshot.winnerAccountId),
    String(match.players[1].accountId)
  );
  assert.deepEqual(
    archivedSnapshot.events.slice(-2).map((event) => event.type),
    ['left', 'completed']
  );
  assert.equal(match.status, 'waiting');
});
