const { test, assert, createApplier } = require('./scenarios/helpers');

test('pending Never Have I Ever players cannot vote during the current question', () => {
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
        action: 'set-bool-vote',
        actorId: 'late-device',
        payload: { bool: true },
        hasDeck: true
      }),
    /join at the next round/
  );
});

test('active Never Have I Ever players can answer if the participant snapshot is stale', () => {
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
    action: 'set-bool-vote',
    actorId: 'guest-device',
    payload: { bool: true },
    hasDeck: true
  });

  assert.equal(updated.players[1].state.vote, true);
  assert.equal(updated.players[1].state.hasConfirmed, true);
  assert.deepEqual(updated.state.roundParticipantIds, [
    'host-device',
    'guest-device'
  ]);
});

test('Never Have I Ever reward progress counts unanswered active players', () => {
  const { applyPartyActionToSnapshot } = createApplier({
    getPartyRuleValue: () => false,
    addNeverHaveIEverVoteResultScores: () => {},
    createNeverHaveIEverRoundStatEvent: ({ rewardEligiblePlayers }) => ({
      gameMode: 'never-have-i-ever',
      increments: [],
      rewardProgress: rewardEligiblePlayers.map((player) => ({
        accountId: player.identity.accountId,
        actionsAvailable: 1,
        actionsTaken: typeof player.state.vote === 'boolean' ? 1 : 0
      }))
    }),
    applyNeverHaveIEverRoundReset: () => {}
  });
  const party = {
    partyId: 'ABC-123',
    config: { gamemode: 'never-have-i-ever', gameRules: {} },
    state: {
      isPlaying: true,
      hostComputerId: 'host-device',
      roundParticipantIds: ['host-device', 'guest-device']
    },
    deck: { currentCardIndex: 0 },
    players: [
      {
        identity: {
          computerId: 'host-device',
          accountId: 'account-one'
        },
        connection: { socketId: 'host-socket' },
        state: { participationStatus: 'active', vote: true }
      },
      {
        identity: {
          computerId: 'guest-device',
          accountId: 'account-two'
        },
        connection: { socketId: 'guest-socket' },
        state: { participationStatus: 'active', vote: null }
      }
    ]
  };

  const updated = applyPartyActionToSnapshot({
    party,
    action: 'never-have-i-ever-resolve-vote-results',
    actorId: 'host-device',
    payload: {},
    hasDeck: true
  });

  assert.deepEqual(updated.__accountStatEvents[0].rewardProgress, [
    { accountId: 'account-one', actionsAvailable: 1, actionsTaken: 1 },
    { accountId: 'account-two', actionsAvailable: 1, actionsTaken: 0 }
  ]);
});

test('Never Have I Ever question reset activates pending players', () => {
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
    ['question-shown', 'players-answering']
  );
});
