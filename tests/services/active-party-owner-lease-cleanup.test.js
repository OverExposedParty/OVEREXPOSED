const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createRoomArchiver
} = require('../../server/services/database/room-archiver');

function createFindQuery(rows) {
  return {
    limit() {
      return this;
    },
    async lean() {
      return rows;
    }
  };
}

function createEmptyRoomModel() {
  return {
    find() {
      return createFindQuery([]);
    },
    async exists() {
      return false;
    },
    async deleteOne() {
      return { deletedCount: 0 };
    }
  };
}

test('room expiry releases the captured owner lease after active rooms are deleted', async () => {
  const lifecycle = [];
  const expiredRoom = {
    partyId: 'ABC-123',
    session: { gameId: 'game-one', createdAt: new Date(0) },
    config: { gamemode: 'truth-or-dare', gameRules: {} },
    state: {
      hostComputerId: 'host-device',
      lastPinged: new Date(0)
    },
    players: [
      {
        identity: {
          computerId: 'host-device',
          accountId: 'account-one',
          username: 'Host'
        }
      }
    ]
  };
  const truthModel = createEmptyRoomModel();
  let returnedExpiredRoom = false;
  truthModel.find = () => {
    if (returnedExpiredRoom) return createFindQuery([]);
    returnedExpiredRoom = true;
    return createFindQuery([expiredRoom]);
  };
  truthModel.deleteOne = async () => {
    lifecycle.push('delete:main');
    return { deletedCount: 1 };
  };

  const waitingRoomSchema = createEmptyRoomModel();
  waitingRoomSchema.deleteOne = async () => {
    lifecycle.push('delete:waiting');
    return { deletedCount: 1 };
  };
  const emptyModel = createEmptyRoomModel();
  const archiver = createRoomArchiver({
    models: {
      partyGameTruthOrDareSchema: truthModel,
      partyGameParanoiaSchema: emptyModel,
      partyGameNeverHaveIEverSchema: emptyModel,
      partyGameMostLikelyToSchema: emptyModel,
      partyGameImposterSchema: emptyModel,
      partyGameWouldYouRatherSchema: emptyModel,
      partyGameMafiaSchema: emptyModel,
      partyGameChatLogSchema: {
        async deleteOne() {
          lifecycle.push('delete:chat');
        }
      },
      archivedRoomSchema: {
        async updateOne() {
          lifecycle.push('archive');
        },
        findOne() {
          return {
            select() {
              return this;
            },
            async lean() {
              return { _id: 'archive-one', players: [] };
            }
          };
        }
      },
      waitingRoomSchema,
      Account: { async updateMany() {} }
    },
    partyOwnerLeases: {
      async getActivePartyOwnerLeaseReleaseToken(partyId) {
        assert.equal(partyId, 'ABC-123');
        lifecycle.push('lease:capture');
        return { leaseId: 'lease-one', leaseToken: 'release-token' };
      },
      async releaseActivePartyOwnerLeaseIfInactive({ partyId, releaseToken }) {
        assert.equal(partyId, 'ABC-123');
        assert.equal(releaseToken.leaseToken, 'release-token');
        lifecycle.push('lease:release');
      }
    }
  });

  await archiver.archiveExpiredRooms();

  assert.deepEqual(lifecycle, [
    'lease:capture',
    'archive',
    'delete:main',
    'delete:waiting',
    'delete:chat',
    'lease:release'
  ]);
});
