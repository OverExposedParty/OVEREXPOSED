const {
  test,
  assert,
  createApplier,
  createGameOverParty,
  isReservedPartyShell
} = require('./scenarios/helpers');

test('return-to-lobby preserves the party config and resets gameplay state', () => {
  const { applyPartyActionToSnapshot } = createApplier();
  const party = createGameOverParty();

  const updated = applyPartyActionToSnapshot({
    party,
    action: 'return-to-lobby',
    actorId: 'host-device',
    payload: {},
    hasDeck: true
  });

  assert.deepEqual(updated.config.selectedPacks, ['pack-one']);
  assert.match(updated.session.gameId, /^MLT-[A-F0-9]{16}$/);
  assert.equal(updated.session.startedAt, null);
  assert.equal(updated.session.endedAt, null);
  assert.deepEqual(updated.config.gameRules, { rounds: 20 });
  assert.equal(updated.config.userInstructions, '');
  assert.equal(updated.state.isPlaying, false);
  assert.equal(updated.state.phase, 'lobby');
  assert.equal(updated.state.hostComputerId, 'host-device');
  assert.equal(updated.state.completedRounds, 0);
  assert.equal(updated.state.playerTurn, 0);
  assert.equal(updated.deck.currentCardIndex, 0);
  assert.equal(updated.players[0].state.isReady, true);
  assert.equal(updated.players[1].state.isReady, false);
  assert.equal(updated.players[0].state.score, 0);
  assert.equal(updated.players[1].state.score, 0);
});

test('return-to-lobby rotates the game id while preserving the party code', () => {
  const { applyPartyActionToSnapshot } = createApplier();
  const party = createGameOverParty();
  party.session = {
    gameId: 'MLT-OLDGAME1234',
    createdAt: new Date('2026-08-05T12:00:00.000Z'),
    startedAt: new Date('2026-08-05T12:01:00.000Z'),
    endedAt: new Date('2026-08-05T12:10:00.000Z'),
    playSequence: 1,
    access: { originalHostComputerId: 'host-device' }
  };

  const updated = applyPartyActionToSnapshot({
    party,
    action: 'return-to-lobby',
    actorId: 'host-device',
    payload: {},
    hasDeck: true
  });

  assert.equal(updated.partyId, 'ABC-123');
  assert.notEqual(updated.session.gameId, party.session.gameId);
  assert.equal(updated.session.playSequence, 1);
  assert.equal(updated.session.access.originalHostComputerId, 'host-device');
});

test('return-to-lobby rejects a game that has not ended', () => {
  const { applyPartyActionToSnapshot } = createApplier();
  const party = createGameOverParty();
  party.state.phase = 'lobby';

  assert.throws(
    () =>
      applyPartyActionToSnapshot({
        party,
        action: 'return-to-lobby',
        actorId: 'host-device',
        payload: {},
        hasDeck: true
      }),
    /must end/
  );
});

test('return-to-lobby rejects non-host players', () => {
  const { applyPartyActionToSnapshot } = createApplier();

  assert.throws(
    () =>
      applyPartyActionToSnapshot({
        party: createGameOverParty(),
        action: 'return-to-lobby',
        actorId: 'guest-device',
        payload: {},
        hasDeck: true
      }),
    /Only the host/
  );
});

test('only an empty unconfigured waiting-room reservation is claimable', () => {
  assert.equal(
    isReservedPartyShell({ partyId: 'ABC-123', players: [], state: {} }),
    true
  );
  assert.equal(
    isReservedPartyShell({
      partyId: 'ABC-123',
      players: [{ identity: { computerId: 'host-device' } }],
      state: { hostComputerId: 'host-device' },
      config: { gamemode: 'most-likely-to' }
    }),
    false
  );
});

test('ending a non-mafia game emits one completed-game stat event', () => {
  const { applyPartyActionToSnapshot } = createApplier();
  const party = createGameOverParty();
  party.state.phase = null;
  party.state.isPlaying = true;
  party.session = {
    playSequence: 4,
    playtimeStartedAt: new Date(Date.now() - 5_000),
    playtimeAccumulatedMilliseconds: 10_000
  };
  party.players[0].identity.accountId = 'account-one';
  party.players[1].identity.accountId = 'account-two';

  const utcHour = new Date().getUTCHours();
  const offsetHours = ((utcHour - 3 + 12) % 24) - 12;
  const ended = applyPartyActionToSnapshot({
    party,
    action: 'end-game',
    actorId: 'host-device',
    payload: { timezoneOffsetMinutes: offsetHours * 60 },
    hasDeck: true
  });
  const playtimeSeconds =
    ended.__accountStatEvents[0].increments[0].paths.totalPlaytimeSeconds;

  assert.ok(playtimeSeconds >= 14 && playtimeSeconds <= 16);
  assert.equal(ended.session.playtimeStartedAt, null);
  assert.ok(
    ended.session.playtimeAccumulatedMilliseconds >= 14_000 &&
      ended.session.playtimeAccumulatedMilliseconds <= 16_000
  );

  assert.deepEqual(
    ended.state.phaseData.gameOverPlayers.map((player) => ({
      id: player.identity.computerId,
      username: player.identity.username,
      userIcon: player.identity.userIcon,
      score: player.state.score
    })),
    [
      {
        id: 'host-device',
        username: 'Player',
        userIcon: null,
        score: 9
      },
      {
        id: 'guest-device',
        username: 'Player',
        userIcon: null,
        score: 7
      }
    ]
  );

  assert.deepEqual(ended.__accountStatEvents, [
    {
      gameMode: 'most-likely-to',
      increments: [
        {
          accountId: 'account-one',
          paths: {
            gamesPlayed: 1,
            totalPlaytimeSeconds: playtimeSeconds,
            'achievement.completedParty': 1,
            'achievement.hostedParties': 1,
            'achievement.noSkipsGiven': 1
          }
        },
        {
          accountId: 'account-two',
          paths: {
            gamesPlayed: 1,
            totalPlaytimeSeconds: playtimeSeconds,
            'achievement.completedParty': 1,
            'achievement.noSkipsGiven': 1
          }
        }
      ],
      selectedPacks: ['pack-one'],
      participantAccountIds: ['account-one', 'account-two'],
      playerCount: 2,
      maxPlayers: 2,
      localHour: 3
    }
  ]);

  const repeated = applyPartyActionToSnapshot({
    party: ended,
    action: 'end-game',
    actorId: 'host-device',
    payload: {},
    hasDeck: true
  });
  assert.equal(repeated.__accountStatEvents.length, 1);
});

test('game-over ignores delayed gameplay actions until return-to-lobby', () => {
  const { applyPartyActionToSnapshot } = createApplier();
  const party = createGameOverParty();
  const originalState = structuredClone(party.state);

  const updated = applyPartyActionToSnapshot({
    party,
    action: 'send-instruction',
    actorId: 'host-device',
    payload: {
      instruction: 'STARTING',
      isPlaying: true,
      timer: 30
    },
    hasDeck: true
  });

  assert.deepEqual(updated.state, originalState);
  assert.equal(updated.state.phase, 'game-over');
  assert.equal(updated.state.isPlaying, false);
});

test('ending a long comeback game emits session achievement signals', () => {
  const { applyPartyActionToSnapshot } = createApplier();
  const party = createGameOverParty();
  party.session = {
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000 - 1000)
  };
  party.state.phase = null;
  party.state.isPlaying = true;
  party.state.achievementData = {
    skipOccurred: false,
    comebackHalfwayLowestPlayerIds: ['host-device']
  };
  party.players[0].identity.accountId = 'account-one';
  party.players[1].identity.accountId = 'account-two';

  const ended = applyPartyActionToSnapshot({
    party,
    action: 'end-game',
    actorId: 'host-device',
    payload: {},
    hasDeck: true
  });

  assert.deepEqual(ended.__accountStatEvents[0].increments, [
    {
      accountId: 'account-one',
      paths: {
        gamesPlayed: 1,
        'achievement.completedParty': 1,
        'achievement.hostedParties': 1,
        'achievement.marathonSession': 3,
        'achievement.noSkipsGiven': 1,
        'achievement.theComeback': 1
      }
    },
    {
      accountId: 'account-two',
      paths: {
        gamesPlayed: 1,
        'achievement.completedParty': 1,
        'achievement.marathonSession': 3,
        'achievement.noSkipsGiven': 1
      }
    }
  ]);
});

test('ending mafia records only the host achievement increment', () => {
  const { applyPartyActionToSnapshot } = createApplier();
  const party = createGameOverParty();
  party.config.gamemode = 'mafia';
  party.state.phase = null;
  party.state.isPlaying = true;
  party.players[0].identity.accountId = 'account-one';
  party.players[1].identity.accountId = 'account-two';

  const ended = applyPartyActionToSnapshot({
    party,
    action: 'end-game',
    actorId: 'host-device',
    payload: {},
    hasDeck: true
  });

  assert.deepEqual(ended.__accountStatEvents, [
    {
      gameMode: 'mafia',
      increments: [
        {
          accountId: 'account-one',
          paths: {
            'achievement.completedParty': 1,
            'achievement.hostedParties': 1
          }
        },
        {
          accountId: 'account-two',
          paths: { 'achievement.completedParty': 1 }
        }
      ],
      selectedPacks: ['pack-one'],
      participantAccountIds: ['account-one', 'account-two'],
      playerCount: 2,
      maxPlayers: 20
    }
  ]);
});

test('starting within 60 seconds emits the organiser event for the host', () => {
  const { applyPartyActionToSnapshot } = createApplier();
  const party = createGameOverParty();
  party.session = { createdAt: new Date() };
  party.state.phase = 'lobby';
  party.players[0].identity.accountId = 'account-one';
  party.players[1].identity.accountId = 'account-two';

  const started = applyPartyActionToSnapshot({
    party,
    action: 'start-game',
    actorId: 'host-device',
    payload: { bypassPlayerRestrictions: true },
    hasDeck: true
  });

  assert.equal(started.session.playSequence, 1);
  assert.ok(
    Number.isFinite(new Date(started.session.playtimeStartedAt).getTime())
  );
  assert.equal(started.session.playtimeAccumulatedMilliseconds, 0);

  assert.deepEqual(started.__accountStatEvents, [
    {
      gameMode: 'most-likely-to',
      increments: [
        {
          accountId: 'account-one',
          paths: { 'achievement.theOrganiser': 1 }
        }
      ]
    }
  ]);
});

test('playtime pauses and resumes with the server isPlaying state', () => {
  const { applyPartyActionToSnapshot } = createApplier();
  const party = createGameOverParty();
  party.state.phase = null;
  party.state.isPlaying = true;
  party.session = {
    playSequence: 2,
    playtimeStartedAt: new Date(Date.now() - 5_000),
    playtimeAccumulatedMilliseconds: 3_000
  };

  const paused = applyPartyActionToSnapshot({
    party,
    action: 'send-instruction',
    actorId: 'host-device',
    payload: { instruction: 'PAUSED', isPlaying: false },
    hasDeck: true
  });

  assert.equal(paused.state.isPlaying, false);
  assert.equal(paused.session.playtimeStartedAt, null);
  assert.ok(
    paused.session.playtimeAccumulatedMilliseconds >= 7_000 &&
      paused.session.playtimeAccumulatedMilliseconds <= 9_000
  );

  const accumulatedBeforeResume =
    paused.session.playtimeAccumulatedMilliseconds;
  const resumed = applyPartyActionToSnapshot({
    party: paused,
    action: 'send-instruction',
    actorId: 'host-device',
    payload: { instruction: 'RESUMED', isPlaying: true },
    hasDeck: true
  });

  assert.equal(resumed.state.isPlaying, true);
  assert.ok(
    Number.isFinite(new Date(resumed.session.playtimeStartedAt).getTime())
  );
  assert.equal(
    resumed.session.playtimeAccumulatedMilliseconds,
    accumulatedBeforeResume
  );
});
