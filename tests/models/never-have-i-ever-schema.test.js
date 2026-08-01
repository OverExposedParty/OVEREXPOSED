const test = require('node:test');
const assert = require('node:assert/strict');

const NeverHaveIEver = require('../../models/party-games/party-game-never-have-i-ever-schema');

test('Never Have I Ever persists late-join participation state', () => {
  const party = new NeverHaveIEver({
    partyId: 'ABC-123',
    config: {
      gamemode: 'never-have-i-ever',
      gameRules: {},
      selectedPacks: [],
      shuffleSeed: 1
    },
    state: {
      isPlaying: true,
      playerTurn: 0,
      roundParticipantIds: ['host-device'],
      roundTimeline: [{ type: 'question-shown', at: 1 }]
    },
    players: [
      {
        identity: {
          computerId: 'late-device',
          username: 'Late Player',
          userIcon: 'test-icon'
        },
        connection: { socketId: 'late-socket' },
        state: { participationStatus: 'pending_next_round' }
      }
    ]
  });

  const serialized = party.toObject();
  assert.deepEqual(serialized.state.roundParticipantIds, ['host-device']);
  assert.equal(serialized.state.roundTimeline[0].type, 'question-shown');
  assert.equal(
    serialized.players[0].state.participationStatus,
    'pending_next_round'
  );
});
