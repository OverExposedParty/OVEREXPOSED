const test = require('node:test');
const assert = require('node:assert/strict');

const {
  restoreNonRoundRejoinState
} = require('../../server/game-engine/party-runtime/route-handlers/join-route');

test('lobby rejoin clears the persisted reconnecting status', () => {
  const incomingPlayer = {
    state: {
      isReady: false
    }
  };

  const restored = restoreNonRoundRejoinState(incomingPlayer, {
    existingPlayerWasDisconnected: true,
    supportsActiveRoundJoin: false
  });

  assert.equal(restored, true);
  assert.equal(incomingPlayer.state.participationStatus, 'active');
  assert.equal(incomingPlayer.state.reconnectDeadline, null);
  assert.equal(incomingPlayer.state.isReady, false);
});

test('active round rejoin keeps its deadline for round-aware restoration', () => {
  const reconnectDeadline = new Date(Date.now() + 60_000);
  const incomingPlayer = {
    state: {
      participationStatus: 'reconnecting',
      reconnectDeadline
    }
  };

  const restored = restoreNonRoundRejoinState(incomingPlayer, {
    existingPlayerWasDisconnected: true,
    supportsActiveRoundJoin: true
  });

  assert.equal(restored, false);
  assert.equal(incomingPlayer.state.participationStatus, 'reconnecting');
  assert.equal(incomingPlayer.state.reconnectDeadline, reconnectDeadline);
});
