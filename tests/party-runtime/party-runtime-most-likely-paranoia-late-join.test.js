const {
  test,
  assert,
  createApplier
} = require("./scenarios/helpers");

test('pending Most Likely To players cannot vote during the current question', () => {
  const { applyPartyActionToSnapshot } = createApplier();
  const party = {
    partyId: 'ABC-123',
    config: { gamemode: 'most-likely-to', gameRules: {} },
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
        payload: { option: 'host-device' },
        hasDeck: true
      }),
    /join at the next round/
  );
});

test('Most Likely To players cannot vote for pending late joiners', () => {
  const { applyPartyActionToSnapshot } = createApplier({
    SCORE_RULES: { 'most-likely-to': { selectPlayer: 1 } },
    addScoreToPartyPlayer: (player, score) => {
      player.state.score = (player.state.score || 0) + score;
    }
  });
  const party = {
    partyId: 'ABC-123',
    config: { gamemode: 'most-likely-to', gameRules: {} },
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
        actorId: 'host-device',
        payload: { option: 'late-device', hover: false },
        hasDeck: true
      }),
    /cannot be voted for yet/
  );
});

test('active Most Likely To players can vote if the participant snapshot is stale', () => {
  const { applyPartyActionToSnapshot } = createApplier({
    SCORE_RULES: { 'most-likely-to': { selectPlayer: 1 } },
    addScoreToPartyPlayer: (player, score) => {
      player.state.score = (player.state.score || 0) + score;
    }
  });
  const party = {
    partyId: 'ABC-123',
    config: { gamemode: 'most-likely-to', gameRules: {} },
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
    payload: { option: 'host-device', hover: false },
    hasDeck: true
  });

  assert.equal(updated.players[1].state.vote, 'host-device');
  assert.equal(updated.players[1].state.hasConfirmed, true);
  assert.deepEqual(updated.state.roundParticipantIds, [
    'host-device',
    'guest-device'
  ]);
});

test('Most Likely To question reset activates pending players', () => {
  const { applyPartyActionToSnapshot } = createApplier({
    addScoreToPartyPlayer: () => {}
  });
  const party = {
    partyId: 'ABC-123',
    config: { gamemode: 'most-likely-to', gameRules: {} },
    state: {
      isPlaying: true,
      hostComputerId: 'host-device',
      playerTurn: 0,
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
    ['question-shown', 'players-voting']
  );
});

test('pending Paranoia players cannot act during the current question', () => {
  const { applyPartyActionToSnapshot } = createApplier();
  const party = {
    partyId: 'ABC-123',
    config: { gamemode: 'paranoia', gameRules: {} },
    state: {
      isPlaying: true,
      hostComputerId: 'host-device',
      playerTurn: 0,
      playerTurnOrder: ['host-device'],
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
        action: 'paranoia-select-target',
        actorId: 'late-device',
        payload: { targetId: 'host-device' },
        hasDeck: true
      }),
    /join at the next round/
  );
});

test('Paranoia players cannot select pending late joiners', () => {
  const { applyPartyActionToSnapshot } = createApplier({
    SCORE_RULES: { paranoia: { selectTarget: 1 } },
    addScoreToPartyPlayer: () => {},
    appendPartyAccountStatEvent: () => {},
    createAccountStatEvent: () => null,
    createParanoiaAchievementEvent: () => null
  });
  const party = {
    partyId: 'ABC-123',
    config: { gamemode: 'paranoia', gameRules: {} },
    state: {
      isPlaying: true,
      hostComputerId: 'host-device',
      playerTurn: 0,
      playerTurnOrder: ['host-device'],
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
        action: 'paranoia-select-target',
        actorId: 'host-device',
        payload: { targetId: 'late-device' },
        hasDeck: true
      }),
    /cannot be selected yet/
  );
});

test('active Paranoia players can act if the participant snapshot is stale', () => {
  const { applyPartyActionToSnapshot } = createApplier({
    SCORE_RULES: { paranoia: { selectTarget: 1 } },
    addScoreToPartyPlayer: () => {},
    appendPartyAccountStatEvent: () => {},
    createAccountStatEvent: () => null,
    createParanoiaAchievementEvent: () => null
  });
  const party = {
    partyId: 'ABC-123',
    config: { gamemode: 'paranoia', gameRules: {} },
    state: {
      isPlaying: true,
      hostComputerId: 'host-device',
      playerTurn: 1,
      playerTurnOrder: ['host-device', 'guest-device'],
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
    action: 'paranoia-select-target',
    actorId: 'guest-device',
    payload: { targetId: 'host-device' },
    hasDeck: true
  });

  assert.equal(updated.players[1].state.vote, 'host-device');
  assert.deepEqual(updated.state.roundParticipantIds, [
    'host-device',
    'guest-device'
  ]);
});

test('Paranoia card timeout records a missed reward opportunity', () => {
  const { applyPartyActionToSnapshot } = createApplier({
    SCORE_RULES: { paranoia: { selectTarget: 1 } }
  });
  const party = {
    partyId: 'ABC-123',
    config: { gamemode: 'paranoia', gameRules: {} },
    state: {
      isPlaying: true,
      hostComputerId: 'host-device',
      playerTurn: 0,
      playerTurnOrder: ['host-device'],
      roundParticipantIds: ['host-device']
    },
    deck: { currentCardIndex: 0 },
    players: [
      {
        identity: {
          computerId: 'host-device',
          accountId: 'account-one'
        },
        state: { participationStatus: 'active' }
      }
    ]
  };

  const updated = applyPartyActionToSnapshot({
    party,
    action: 'paranoia-handle-card-timeout',
    actorId: 'host-device',
    payload: {},
    hasDeck: true
  });

  assert.deepEqual(updated.__accountStatEvents[0].rewardProgress, [
    { accountId: 'account-one', actionsAvailable: 1, actionsTaken: 0 }
  ]);
});

test('Paranoia question reset activates pending players', () => {
  const { applyPartyActionToSnapshot } = createApplier({
    addScoreToPartyPlayer: () => {},
    getPlayerTurnOrder: (state, players) => {
      state.playerTurnOrder = players
        .map((player) => player.identity.computerId)
        .filter(Boolean);
      return state.playerTurnOrder;
    }
  });
  const party = {
    partyId: 'ABC-123',
    config: { gamemode: 'paranoia', gameRules: {} },
    state: {
      isPlaying: true,
      hostComputerId: 'host-device',
      playerTurn: 0,
      playerTurnOrder: ['host-device'],
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
    payload: { instruction: 'DISPLAY_PRIVATE_CARD:READING_CARD' },
    hasDeck: true
  });

  assert.equal(updated.players[1].state.participationStatus, 'active');
  assert.deepEqual(updated.state.roundParticipantIds, [
    'host-device',
    'late-device'
  ]);
  assert.deepEqual(
    updated.state.roundTimeline.map((event) => event.type),
    ['question-shown', 'target-selection']
  );
  assert.equal(updated.state.roundTimeline[0].playerId, 'host-device');
  assert.equal(updated.state.roundTimeline[1].playerId, 'host-device');
});
