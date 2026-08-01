const test = require('node:test');
const assert = require('node:assert/strict');

const Imposter = require('../../models/party-games/party-game-imposter-schema');

test('Imposter persists late-join participation and timeline state', () => {
  const party = new Imposter({
    partyId: 'IMP-123',
    config: {
      gamemode: 'imposter',
      gameRules: { rounds: 5 },
      selectedPacks: ['foody']
    },
    state: {
      isPlaying: true,
      playerTurn: 0,
      roundParticipantIds: ['host-device'],
      roundTimeline: [{ type: 'roles-assigned', at: Date.now() }]
    },
    players: [
      {
        identity: {
          computerId: 'host-device',
          username: 'Host',
          userIcon: 'host-icon'
        },
        state: { participationStatus: 'active' }
      },
      {
        identity: {
          computerId: 'late-device',
          username: 'Late',
          userIcon: 'late-icon'
        },
        state: { participationStatus: 'pending_next_round' }
      }
    ]
  });

  const stored = party.toObject();
  assert.deepEqual(stored.state.roundParticipantIds, ['host-device']);
  assert.equal(stored.state.roundTimeline[0].type, 'roles-assigned');
  assert.equal(
    stored.players[1].state.participationStatus,
    'pending_next_round'
  );
});
