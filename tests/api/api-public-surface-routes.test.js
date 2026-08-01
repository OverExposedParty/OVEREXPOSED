const assert = require('node:assert/strict');
const test = require('node:test');

const {
  registerPublicSurfaceRoutes
} = require('../../server/routes/api-public-surface');

test('public surface routes preserve their endpoint contract and order', () => {
  const registeredRoutes = [];
  const app = {};

  ['get', 'post', 'patch', 'delete'].forEach((method) => {
    app[method] = (route) => registeredRoutes.push([method, route]);
  });

  registerPublicSurfaceRoutes({ app });

  assert.deepEqual(registeredRoutes, [
    ['get', '/api/site-version'],
    ['get', '/api/overexposure-posts'],
    ['get', '/api/account/game-progress'],
    ['post', '/api/reports'],
    ['get', '/api/reports/status'],
    ['get', '/api/shop/products'],
    ['get', '/api/shop/account-container-access'],
    ['post', '/api/shop/purchase-with-opals'],
    ['post', '/api/shop/admin/grant']
  ]);
});
