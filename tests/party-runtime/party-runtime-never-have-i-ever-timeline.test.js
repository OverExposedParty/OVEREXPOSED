const {
  test,
  assert,
  createApplier
} = require("./scenarios/helpers");

test('Never Have I Ever timeline only appends phases that have happened', () => {
  const { applyPartyActionToSnapshot } = createApplier();
  const party = {
    partyId: 'ABC-123',
    config: {
      gamemode: 'never-have-i-ever',
      gameRules: {},
      userInstructions: 'DISPLAY_PRIVATE_CARD'
    },
    state: {
      isPlaying: true,
      hostComputerId: 'host-device',
      roundParticipantIds: ['host-device'],
      roundTimeline: [
        { type: 'question-shown', at: 1 },
        { type: 'players-answering', at: 2 }
      ]
    },
    deck: { currentCardIndex: 0 },
    players: [
      {
        identity: { computerId: 'host-device' },
        state: { participationStatus: 'active' }
      }
    ]
  };

  const voting = applyPartyActionToSnapshot({
    party,
    action: 'set-bool-vote',
    actorId: 'host-device',
    payload: { bool: true },
    hasDeck: true
  });
  assert.deepEqual(
    voting.state.roundTimeline.map((event) => event.type),
    ['question-shown', 'players-answering']
  );

  const results = applyPartyActionToSnapshot({
    party: voting,
    action: 'send-instruction',
    actorId: 'host-device',
    payload: { instruction: 'DISPLAY_VOTE_RESULTS' },
    hasDeck: true
  });
  assert.deepEqual(
    results.state.roundTimeline.map((event) => event.type),
    ['question-shown', 'players-answering', 'answers-revealed']
  );
});

test('Never Have I Ever question reset keeps disconnected late joiners pending', () => {
  const { applyPartyActionToSnapshot } = createApplier();
  const party = {
    partyId: 'ABC-123',
    config: { gamemode: 'never-have-i-ever', gameRules: {} },
    state: {
      isPlaying: true,
      hostComputerId: 'host-device',
      roundParticipantIds: ['host-device']
    },
    deck: { currentCardIndex: 0 },
    players: [
      {
        identity: { computerId: 'host-device' },
        connection: { socketId: 'host-socket' },
        state: { participationStatus: 'active' }
      },
      {
        identity: { computerId: 'late-device' },
        connection: { socketId: 'DISCONNECTED' },
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

  assert.equal(
    updated.players[1].state.participationStatus,
    'pending_next_round'
  );
  assert.deepEqual(updated.state.roundParticipantIds, ['host-device']);
});

test('pending Never Have I Ever players do not block punishment completion', () => {
  let resetCalled = false;
  const { applyPartyActionToSnapshot } = createApplier({
    applyNeverHaveIEverRoundReset: () => {
      resetCalled = true;
    }
  });
  const party = {
    partyId: 'ABC-123',
    config: { gamemode: 'never-have-i-ever', gameRules: {} },
    state: {
      isPlaying: true,
      phase: 'never-have-i-ever-show-punishment',
      phaseData: { targetIds: ['host-device'] },
      hostComputerId: 'host-device',
      roundParticipantIds: ['host-device']
    },
    deck: { currentCardIndex: 0 },
    players: [
      {
        identity: { computerId: 'host-device' },
        state: {
          isReady: false,
          participationStatus: 'active'
        }
      },
      {
        identity: { computerId: 'late-device' },
        state: {
          isReady: false,
          participationStatus: 'pending_next_round'
        }
      }
    ]
  };

  applyPartyActionToSnapshot({
    party,
    action: 'never-have-i-ever-complete-punishment',
    actorId: 'host-device',
    payload: {},
    hasDeck: true
  });

  assert.equal(resetCalled, true);
});
