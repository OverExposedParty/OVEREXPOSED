const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryDirectory = path.join(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryDirectory, relativePath), 'utf8');
}

test('Mafia browser gameplay reads only the server-owned roleKey', () => {
  const gameplaySources = [
    'public/scripts/party-games/gamemode/online/mafia/mafia-online-setup.js',
    'public/scripts/party-games/gamemode/online/mafia/mafia-online-logic.js',
    'public/scripts/party-games/gamemode/online/mafia/mafia-online-voting-ui.js',
    'public/scripts/party-games/gamemode/online/mafia/mafia-online-instructions/night-flow.js',
    'public/scripts/party-games/gamemode/online/mafia/civilian-watch/civilian-watch-mafia-hints.js',
    'public/scripts/party-games/gamemode/online/mafia/player-board/renderer.js'
  ].map(read);

  gameplaySources.forEach((source) => {
    assert.doesNotMatch(source, /\.state(?:\?\.|\.)role\b/);
    assert.doesNotMatch(source, /\bnormalizeMafiaRoleKey\b/);
  });

  assert.ok(gameplaySources.every((source) => source.includes('roleKey')));
});

test('browser settings and room diagnostics use roleCounts without selectedRoles', () => {
  const contractSources = [
    'models/party-games/waiting-room-schema.js',
    'models/party-games/archived-room-schema.js',
    'server/services/database/room-archiver.js',
    'server/routes/api-route-context/party-rooms.js',
    'public/scripts/oe-panel/sections/party-games.js',
    'public/scripts/party-games/waiting-room/waiting-room-ui.js',
    'public/scripts/party-games/gamemode/online/general/party-games-online-instructions/session.js'
  ].map(read);

  contractSources.forEach((source) => {
    assert.doesNotMatch(source, /\bselectedRoles\b/);
    assert.match(source, /\broleCounts\b/);
  });

  const waitingRoomUi = contractSources[5];
  assert.match(
    waitingRoomUi,
    /\.increment-container\[data-content-type="role"\]/
  );
});

test('online lobby creation does not submit a client-owned Mafia role', () => {
  const toggleOnlineMode = read(
    'public/scripts/party-games/online/online-game-settings/toggle-online-mode.js'
  );

  assert.doesNotMatch(toggleOnlineMode, /\brole\s*:\s*['"]N\/A['"]/);
  assert.doesNotMatch(toggleOnlineMode, /\broleKey\s*:/);
});
