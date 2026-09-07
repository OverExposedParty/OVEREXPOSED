const test = require('node:test');
const assert = require('node:assert/strict');

const {
  registerOlingClashRoutes
} = require('../../server/routes/api-oling-clashes');

test('every Oling Clash API route requires beta feature access', async () => {
  const routes = [];
  const app = {
    get(path, handler) {
      routes.push({ method: 'GET', path, handler });
    },
    post(path, handler) {
      routes.push({ method: 'POST', path, handler });
    }
  };
  const checkedFeatures = [];

  registerOlingClashRoutes({
    app,
    models: {},
    runtime: {},
    getCurrentAccount: async () => ({ _id: 'regular-account' }),
    requireFeatureAccess(_account, res, feature) {
      checkedFeatures.push(feature);
      res.apiError({
        status: 403,
        code: 'feature_access_required',
        message: 'This feature is currently available to beta testers.'
      });
      return false;
    }
  });

  assert.equal(routes.length, 16);

  for (const route of routes) {
    let responseError = null;
    await route.handler(
      {
        body: {},
        id: 'clash-beta-access-test',
        params: { matchCode: 'ABC-123' }
      },
      {
        apiError(error) {
          responseError = error;
        }
      }
    );

    assert.equal(responseError?.status, 403, `${route.method} ${route.path}`);
    assert.equal(
      responseError?.code,
      'feature_access_required',
      `${route.method} ${route.path}`
    );
  }

  assert.deepEqual(checkedFeatures, Array(16).fill('olings.clash'));
});
