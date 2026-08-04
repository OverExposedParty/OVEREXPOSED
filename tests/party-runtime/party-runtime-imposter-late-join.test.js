const { test, assert, createApplier } = require('./scenarios/helpers');

test('pending Imposter players cannot vote during the current round', () => {
  const { applyPartyActionToSnapshot } = createApplier();
  const party = {
    partyId: 'IMP-123',
    config: {
      gamemode: 'imposter',
      gameRules: {},
      userInstructions: 'DISPLAY_PRIVATE_CARD'
    },
    state: {
      isPlaying: true,
      playerTurn: 0,
      hostComputerId: 'host-device',
      roundParticipantIds: ['host-device']
    },
    deck: { currentCardIndex: 0 },
    players: [
      {
        identity: { computerId: 'host-device' },
        connection: { socketId: 'host-socket' },
        state: { participationStatus: 'active', vote: null }
      },
      {
        identity: { computerId: 'late-device' },
        connection: { socketId: 'late-socket' },
        state: { participationStatus: 'pending_next_round', vote: null }
      }
    ]
  };

  assert.throws(
    () =>
      applyPartyActionToSnapshot({
        party,
        action: 'set-vote',
        actorId: 'late-device',
        payload: { option: 'host-device' }
      }),
    (error) =>
      error.status === 409 && error.code === 'party_player_pending_next_round'
  );
});

test('active Imposter players cannot vote for a pending late joiner', () => {
  const { applyPartyActionToSnapshot } = createApplier();
  const party = {
    partyId: 'IMP-123',
    config: {
      gamemode: 'imposter',
      gameRules: {},
      userInstructions: 'DISPLAY_PRIVATE_CARD'
    },
    state: {
      isPlaying: true,
      playerTurn: 0,
      hostComputerId: 'host-device',
      roundParticipantIds: ['host-device']
    },
    deck: { currentCardIndex: 0 },
    players: [
      {
        identity: { computerId: 'host-device' },
        connection: { socketId: 'host-socket' },
        state: { participationStatus: 'active', vote: null }
      },
      {
        identity: { computerId: 'late-device' },
        connection: { socketId: 'late-socket' },
        state: { participationStatus: 'pending_next_round', vote: null }
      }
    ]
  };

  assert.throws(
    () =>
      applyPartyActionToSnapshot({
        party,
        action: 'set-vote',
        actorId: 'host-device',
        payload: { option: 'late-device' }
      }),
    (error) =>
      error.status === 409 &&
      error.code === 'party_vote_target_pending_next_round'
  );
});
