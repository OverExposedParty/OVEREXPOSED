const {
  test,
  assert,
  createApplier
} = require("./scenarios/helpers");

test('truth or dare question selection can create its round stat event', () => {
  const { applyPartyActionToSnapshot } = createApplier();
  const party = {
    partyId: 'ABC-123',
    config: {
      gamemode: 'truth-or-dare',
      gameRules: { rounds: 5 },
      userInstructions: 'DISPLAY_SELECT_QUESTION_TYPE'
    },
    state: {
      isPlaying: true,
      phase: null,
      playerTurn: 0,
      hostComputerId: 'host-device'
    },
    deck: {
      currentCardIndex: 0,
      currentCardSecondIndex: 0,
      questionType: 'truth'
    },
    players: [
      {
        identity: { computerId: 'host-device' },
        state: { isReady: true, hasConfirmed: false, score: 0 }
      }
    ]
  };

  const updated = applyPartyActionToSnapshot({
    party,
    action: 'truth-or-dare-select-question-type',
    actorId: 'host-device',
    payload: { questionType: 'truth' },
    hasDeck: true
  });

  assert.equal(updated.deck.currentCardIndex, 1);
  assert.equal(updated.config.userInstructions, 'DISPLAY_PUBLIC_CARD');
});

test('starting a Truth or Dare prompt always enters spoken completion', () => {
  const { applyPartyActionToSnapshot } = createApplier();
  const party = {
    partyId: 'ABC-123',
    config: {
      gamemode: 'truth-or-dare',
      gameRules: {},
      userInstructions: 'DISPLAY_PUBLIC_CARD'
    },
    state: {
      isPlaying: true,
      phase: null,
      playerTurn: 0,
      hostComputerId: 'host-device'
    },
    deck: { questionType: 'truth' },
    players: [
      {
        identity: { computerId: 'host-device' },
        state: { participationStatus: 'active' }
      }
    ]
  };

  const updated = applyPartyActionToSnapshot({
    party,
    action: 'truth-or-dare-start-prompt',
    actorId: 'host-device',
    payload: { instruction: 'DISPLAY_CONFIRM_INPUT' },
    hasDeck: true
  });

  assert.equal(updated.config.userInstructions, 'DISPLAY_COMPLETE_QUESTION');
  assert.equal(updated.state.userInstructions, 'DISPLAY_COMPLETE_QUESTION');
});

test('completing an NSFW dare emits streak and NSFW achievement signals', () => {
  const { applyPartyActionToSnapshot } = createApplier();
  const party = {
    partyId: 'ABC-123',
    config: {
      gamemode: 'truth-or-dare',
      gameRules: { rounds: 5 },
      userInstructions: 'DISPLAY_COMPLETE_QUESTION'
    },
    state: {
      isPlaying: true,
      phase: null,
      playerTurn: 0,
      hostComputerId: 'host-device'
    },
    deck: {
      currentCardIndex: 0,
      currentCardSecondIndex: 1,
      questionType: 'dare'
    },
    players: [
      {
        identity: {
          computerId: 'host-device',
          accountId: 'account-one'
        },
        state: { isReady: true, hasConfirmed: false, score: 0 }
      }
    ]
  };

  const updated = applyPartyActionToSnapshot({
    party,
    action: 'truth-or-dare-reset-round',
    actorId: 'host-device',
    payload: {
      force: true,
      incrementScore: 1,
      isNsfwDare: true
    },
    hasDeck: true
  });

  assert.deepEqual(updated.__accountStatEvents, [
    {
      gameMode: 'truth-or-dare',
      increments: [
        {
          accountId: 'account-one',
          paths: {
            'stats.daresCompleted': 1,
            'achievement.truthOrDareDareCompleted': 1,
            'achievement.nsfwDareCompleted': 1
          }
        }
      ]
    }
  ]);
});

test('pending Truth or Dare players cannot act during the current round', () => {
  const { applyPartyActionToSnapshot } = createApplier();
  const party = {
    partyId: 'ABC-123',
    config: { gamemode: 'truth-or-dare', gameRules: {} },
    state: {
      isPlaying: true,
      playerTurn: 0,
      hostComputerId: 'host-device',
      roundParticipantIds: ['host-device']
    },
    deck: { questionType: 'truth' },
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
        action: 'truth-or-dare-reset-round',
        actorId: 'late-device',
        payload: {},
        hasDeck: true
      }),
    /join at the next round/
  );
});

test('pending Truth or Dare players do not block current round confirmation', () => {
  let resetCalled = false;
  const { applyPartyActionToSnapshot } = createApplier({
    applyTruthOrDareRoundReset: () => {
      resetCalled = true;
    }
  });
  const party = {
    partyId: 'ABC-123',
    config: { gamemode: 'truth-or-dare', gameRules: {} },
    state: {
      isPlaying: true,
      playerTurn: 0,
      hostComputerId: 'host-device',
      roundParticipantIds: ['host-device']
    },
    deck: { questionType: 'truth' },
    players: [
      {
        identity: { computerId: 'host-device' },
        state: {
          hasConfirmed: false,
          participationStatus: 'active'
        }
      },
      {
        identity: { computerId: 'late-device' },
        state: {
          hasConfirmed: false,
          participationStatus: 'pending_next_round'
        }
      }
    ]
  };

  applyPartyActionToSnapshot({
    party,
    action: 'truth-or-dare-reset-round',
    actorId: 'host-device',
    payload: {},
    hasDeck: true
  });

  assert.equal(resetCalled, true);
});
