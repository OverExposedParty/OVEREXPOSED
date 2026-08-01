const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createCoreActionHandler
} = require('../../server/game-engine/party-runtime/action-handlers/core-actions');

function createVoteContext({
  actorRole,
  actorId = 'actor',
  phase = 'night',
  targetRole = 'inspector'
}) {
  const players = [
    {
      identity: { computerId: actorId },
      state: {
        roleKey: actorRole,
        status: 'alive',
        vote: null,
        isReady: false,
        hasConfirmed: false
      }
    },
    {
      identity: { computerId: 'target' },
      state: {
        roleKey: targetRole,
        status: 'alive',
        vote: null,
        isReady: false,
        hasConfirmed: false
      }
    }
  ];

  return {
    SCORE_RULES: {},
    getPartyPlayerId: (player) => player.identity.computerId,
    getPartyPlayerState: (player) => player.state,
    ensurePartyPlayerConnection: () => ({}),
    getPartyInstruction: () => '',
    addScoreToPartyPlayer: () => {},
    applyPartyPatchesToSnapshot: () => {},
    assertActorCanControlParty: () => {},
    actorId,
    payload: {
      option: 'target',
      hover: false
    },
    hasDeck: false,
    workingParty: { gamemode: 'mafia' },
    config: { gamemode: 'mafia' },
    state: { phase },
    players,
    allowBypass: false,
    actorPlayer: players[0],
    appendNeverHaveIEverTimelineEvent: () => {},
    appendWouldYouRatherTimelineEvent: () => {},
    appendMostLikelyToTimelineEvent: () => {},
    getCurrentRoundPlayers: () => players,
    actionGamemode: 'mafia'
  };
}

test('Inspector cannot submit the Mafia night kill vote', () => {
  const handleCoreAction = createCoreActionHandler();
  const context = createVoteContext({ actorRole: 'inspector' });

  assert.throws(() => handleCoreAction('set-vote', context), {
    code: 'mafia_role_action_not_allowed'
  });
});

test('Mafioso can target an alive Inspector at night', () => {
  const handleCoreAction = createCoreActionHandler();
  const context = createVoteContext({ actorRole: 'mafioso' });

  assert.equal(handleCoreAction('set-vote', context), true);
  assert.equal(context.actorPlayer.state.vote, 'target');
  assert.equal(context.actorPlayer.state.hasConfirmed, true);
});

test('Inspector retains the shared town vote during the day', () => {
  const handleCoreAction = createCoreActionHandler();
  const context = createVoteContext({
    actorRole: 'inspector',
    phase: 'day',
    targetRole: 'mafioso'
  });

  assert.equal(handleCoreAction('set-vote', context), true);
  assert.equal(context.actorPlayer.state.vote, 'target');
});
