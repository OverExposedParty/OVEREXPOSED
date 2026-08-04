const { test, assert, createApplier } = require('./scenarios/helpers');

test('pending Would You Rather players cannot vote during the current question', () => {
  const { applyPartyActionToSnapshot } = createApplier();
  const party = {
    partyId: 'ABC-123',
    config: { gamemode: 'would-you-rather', gameRules: {} },
    state: {
      isPlaying: true,
      hostComputerId: 'host-device',
      roundParticipantIds: ['host-device']
    },
    deck: { currentCardIndex: 0 },
    players: [
      {
        identity: { computerId: 'host-device' },
        state: { participationStatus: 'active' }
      },
      {
        identity: { computerId: 'late-device' },
        state: { participationStatus: 'pending_next_round' }
      }
    ]
  };

  assert.throws(
    () =>
      applyPartyActionToSnapshot({
        party,
        action: 'set-vote',
        actorId: 'late-device',
        payload: { option: 'A' },
        hasDeck: true
      }),
    /join at the next round/
  );
});

test('active Would You Rather players can answer if the participant snapshot is stale', () => {
  const { applyPartyActionToSnapshot } = createApplier({
    SCORE_RULES: { 'would-you-rather': { selectSide: 1 } },
    addScoreToPartyPlayer: (player, score) => {
      player.state.score = (player.state.score || 0) + score;
    }
  });
  const party = {
    partyId: 'ABC-123',
    config: { gamemode: 'would-you-rather', gameRules: {} },
    state: {
      isPlaying: true,
      hostComputerId: 'host-device',
      roundParticipantIds: ['host-device']
    },
    deck: { currentCardIndex: 0 },
    players: [
      {
        identity: { computerId: 'host-device' },
        state: { participationStatus: 'active' }
      },
      {
        identity: { computerId: 'guest-device' },
        state: { participationStatus: 'active' }
      }
    ]
  };

  const updated = applyPartyActionToSnapshot({
    party,
    action: 'set-vote',
    actorId: 'guest-device',
    payload: { option: 'A', hover: false },
    hasDeck: true
  });

  assert.equal(updated.players[1].state.vote, 'A');
  assert.equal(updated.players[1].state.hasConfirmed, true);
  assert.deepEqual(updated.state.roundParticipantIds, [
    'host-device',
    'guest-device'
  ]);
});

test('Would You Rather question reset activates pending players', () => {
  const { applyPartyActionToSnapshot } = createApplier();
  const party = {
    partyId: 'ABC-123',
    config: { gamemode: 'would-you-rather', gameRules: {} },
    state: {
      isPlaying: true,
      hostComputerId: 'host-device',
      roundParticipantIds: ['host-device']
    },
    deck: { currentCardIndex: 0 },
    players: [
      {
        identity: { computerId: 'host-device' },
        state: { participationStatus: 'active' }
      },
      {
        identity: { computerId: 'late-device' },
        state: { participationStatus: 'pending_next_round' }
      }
    ]
  };

  const updated = applyPartyActionToSnapshot({
    party,
    action: 'reset-question',
    actorId: 'host-device',
    payload: { instruction: 'DISPLAY_PRIVATE_CARD' },
    hasDeck: true
  });

  assert.equal(updated.players[1].state.participationStatus, 'active');
  assert.deepEqual(updated.state.roundParticipantIds, [
    'host-device',
    'late-device'
  ]);
  assert.deepEqual(
    updated.state.roundTimeline.map((event) => event.type),
    ['question-shown', 'players-choosing']
  );
});
