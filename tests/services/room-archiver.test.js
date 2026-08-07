const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createRoomArchiver
} = require('../../server/services/database/room-archiver');

test('room archiver snapshots each player OE and defaults missing legacy icons', async () => {
  let archivedSnapshot = null;
  const archivedRoomSchema = {
    async updateOne(filter, update) {
      archivedSnapshot = update.$setOnInsert;
    },
    findOne() {
      return {
        select() {
          return {
            async lean() {
              return { _id: null, players: [] };
            }
          };
        }
      };
    }
  };
  const archiver = createRoomArchiver({
    models: {
      archivedRoomSchema,
      Account: { async updateMany() {} }
    }
  });

  const archived = await archiver.archiveRoomSnapshot({
    sourceCollection: 'party-game-mafia',
    roomDocument: {
      partyId: 'ROOM-ONE',
      session: {
        gameId: 'GAME-ONE',
        gameModeRelease: {
          version: '1.2.0',
          releaseId: 'mafia@1.2.0+release',
          runtimeBuild: 'build-123',
          contentHash: 'content-123',
          capturedAt: new Date('2026-08-06T12:00:00.000Z')
        }
      },
      config: { gamemode: 'mafia' },
      state: { hostComputerId: 'host-device' },
      players: [
        {
          identity: {
            computerId: 'host-device',
            username: 'Host',
            userIcon: '1000:1100:1200:1300'
          }
        },
        {
          identity: {
            computerId: 'guest-device',
            username: 'Guest'
          }
        }
      ]
    }
  });

  assert.equal(archived, true);
  assert.deepEqual(
    archivedSnapshot.players.map((player) => player.userIcon),
    ['1000:1100:1200:1300', '0000:0100:0200:0300']
  );
  assert.equal(archivedSnapshot.players[0].isHost, true);
  assert.equal(archivedSnapshot.completionStatus, 'lobby-closed');
  assert.equal(archivedSnapshot.session.gameModeRelease.version, '1.2.0');
});

test('only completed archived games are added to account match history', async () => {
  const accountUpdates = [];
  let archivedSnapshot = null;
  const archivedRoomSchema = {
    async updateOne(filter, update) {
      archivedSnapshot = update.$setOnInsert;
    },
    findOne() {
      return {
        select() {
          return {
            async lean() {
              return {
                _id: 'archive-one',
                players: [{ accountId: 'account-one' }]
              };
            }
          };
        }
      };
    }
  };
  const archiver = createRoomArchiver({
    models: {
      archivedRoomSchema,
      Account: {
        async updateMany(filter, update) {
          accountUpdates.push({ filter, update });
        }
      }
    }
  });

  await archiver.archiveRoomSnapshot({
    roomDocument: {
      partyId: 'ROOM-ONE',
      session: {
        gameId: 'GAME-ONE',
        startedAt: new Date('2026-08-05T12:00:00.000Z')
      },
      config: { gamemode: 'most-likely-to' },
      state: { phase: 'game-over', hostComputerId: 'host-device' },
      players: [
        {
          identity: {
            computerId: 'host-device',
            accountId: 'account-one'
          }
        }
      ]
    }
  });

  assert.equal(archivedSnapshot.completionStatus, 'completed');
  assert.equal(accountUpdates.length, 1);
});
