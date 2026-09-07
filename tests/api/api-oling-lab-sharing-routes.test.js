const assert = require('node:assert/strict');
const test = require('node:test');

const {
  registerOlingLabPrivacyRoutes
} = require('../../server/routes/api-olings/lab-privacy-routes');
const {
  registerOlingLabVisitorRoutes
} = require('../../server/routes/api-olings/lab-visitor-routes');

function createResponse(resolve) {
  return {
    apiSuccess(payload) {
      resolve({ ok: true, payload });
    },
    apiError(error) {
      resolve({ ok: false, error });
    }
  };
}

test('Oling Lab privacy updates both canonical and mirrored state', async () => {
  let handler;
  const accountUpdates = [];
  const stateUpdates = [];
  registerOlingLabPrivacyRoutes({
    app: {
      patch(path, routeHandler) {
        handler = routeHandler;
      }
    },
    getCurrentAccount: async () => ({ _id: 'owner-id' }),
    Account: {
      updateOne(...args) {
        accountUpdates.push(args);
        return Promise.resolve();
      }
    },
    OlingState: {
      updateOne(...args) {
        stateUpdates.push(args);
        return Promise.resolve();
      }
    }
  });

  const result = await new Promise((resolve) =>
    handler(
      { body: { visibility: 'friends-only' }, id: 'privacy-test' },
      createResponse(resolve)
    )
  );
  assert.equal(result.ok, true);
  assert.equal(result.payload.privacy.visibility, 'friends-only');
  assert.equal(
    accountUpdates[0][1].$set['olings.lab.visibility'],
    'friends-only'
  );
  assert.equal(stateUpdates[0][1].$set['lab.visibility'], 'friends-only');
});

test('visited Oling Lab payloads omit the owner inventory and account record', async () => {
  let handler;
  const targetAccount = {
    _id: 'owner-id',
    username: 'alice',
    profile: { accountStatus: 'active', displayName: 'Alice' },
    gameData: { friendsAndBlockedUsers: [] },
    olings: {
      eggs: [{ key: 'secret-egg', quantity: 5 }],
      lab: { visibility: 'public', placedItems: [] }
    }
  };
  registerOlingLabVisitorRoutes({
    app: {
      get(path, routeHandler) {
        handler = routeHandler;
      }
    },
    getCurrentAccount: async () => null,
    Account: { findOne: async () => targetAccount },
    PlayerOling: {
      find() {
        return {
          sort() {
            return this;
          },
          lean() {
            return Promise.resolve([]);
          }
        };
      }
    },
    getOlingDefinitions: async () => ({}),
    models: {},
    serializePlayerOling: (oling) => oling,
    serializeOlingLab: () => ({ columns: 3, placedItems: [] }),
    OlingLabItems: {},
    OlingLabWallDecorations: {},
    OlingLabWallpapers: {},
    serializeOlingLabItem: (item) => item,
    serializeOlingLabWallDecoration: (item) => item
  });

  const result = await new Promise((resolve) =>
    handler(
      { params: { username: 'alice' }, id: 'visitor-test' },
      createResponse(resolve)
    )
  );
  assert.equal(result.ok, true);
  assert.equal(result.payload.owner.username, 'alice');
  assert.equal(Object.hasOwn(result.payload, 'inventory'), false);
  assert.equal(Object.hasOwn(result.payload, 'account'), false);
});
