const assert = require('node:assert/strict');
const test = require('node:test');

const { registerPageRoutes } = require('../../server/routes/pages');

function createAccountModel(target, viewer = null) {
  return {
    findOne(query) {
      if (query?.username) return Promise.resolve(target);
      return {
        select() {
          return Promise.resolve(viewer);
        }
      };
    }
  };
}

function registerVisitorRoute(target, viewer = null) {
  const routes = [];
  registerPageRoutes({
    app: {
      get(route, handler) {
        routes.push({ route, handler });
      },
      use() {}
    },
    accountModel: createAccountModel(target, viewer),
    debugLog() {},
    hostedPartyModels: [],
    waitingRoomModel: null
  });
  return routes.find(({ route }) =>
    String(route).startsWith('/olings/lab/:username')
  );
}

function requestRoute(route, username = 'alice') {
  return new Promise((resolve, reject) => {
    let statusCode = 200;
    const response = {
      headersSent: false,
      locals: {},
      append() {},
      setHeader() {},
      status(value) {
        statusCode = value;
        return this;
      },
      type() {
        return this;
      },
      send(body) {
        resolve({ body, statusCode });
        return this;
      }
    };
    Promise.resolve(
      route.handler(
        {
          headers: { cookie: '' },
          id: 'oling-lab-visitor-test',
          originalUrl: `/olings/lab/${username}`,
          params: { username },
          path: `/olings/lab/${username}`,
          query: {}
        },
        response
      )
    ).catch(reject);
  });
}

function target(visibility) {
  return {
    _id: 'owner-id',
    username: 'alice',
    profile: { accountStatus: 'active' },
    gameData: { friendsAndBlockedUsers: [] },
    olings: { lab: { visibility } }
  };
}

test('private username Oling Labs render the protected-page explanation', async () => {
  const response = await requestRoute(registerVisitorRoute(target('private')));
  assert.equal(response.statusCode, 403);
  assert.match(response.body, /Private Oling Lab/);
  assert.match(response.body, /Only its owner can view it/);
  assert.match(response.body, /returnTo=%2Folings%2Flab%2Falice/);
});

test('public username Oling Labs render the read-only lab shell', async () => {
  const response = await requestRoute(registerVisitorRoute(target('public')));
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /data-template="oling-lab"/);
  assert.doesNotMatch(response.body, /oling-lab-privacy-select/);
});
