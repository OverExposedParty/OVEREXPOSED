const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createPartyErrorTools
} = require('../../server/game-engine/party-runtime/errors');

test('party errors retain the session release and record the handling build', () => {
  const tools = createPartyErrorTools({
    PARTY_ERROR_LOG_LIMIT: 20,
    PARTY_ID_PATTERN: /^[A-Z]{3}-\d{3}$/,
    debugWarn() {},
    getPartyPlayerId: (player) => player?.identity?.computerId,
    shouldUsePlayerTurnOrder: () => false,
    getTurnPlayer: () => null,
    getPartyRuntimeBuild: () => 'build-that-handled-error'
  });
  const gameModeRelease = {
    version: '2.4.0',
    releaseId: 'paranoia@2.4.0+abc123',
    runtimeBuild: 'build-that-created-game',
    contentHash: 'content-hash',
    capturedAt: new Date('2026-08-06T12:00:00.000Z')
  };

  const entry = tools.createPartyErrorEntry({
    err: new Error('Voting failed'),
    req: { method: 'POST', originalUrl: '/api/paranoia/action', body: {} },
    party: {
      session: { gameModeRelease },
      config: { gamemode: 'paranoia' },
      state: { phase: 'voting' },
      players: []
    }
  });

  assert.deepEqual(entry.gameModeRelease, gameModeRelease);
  assert.equal(entry.runtimeBuild, 'build-that-handled-error');
  assert.equal(entry.gamemode, 'paranoia');
});
