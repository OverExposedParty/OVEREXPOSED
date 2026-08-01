const assert = require('node:assert/strict');
const test = require('node:test');

const {
  registerOePanelPartyGameRoutes
} = require('../../server/routes/api-oe-panel-party-games');

test('OE panel party game routes preserve their endpoint contract and order', () => {
  const registeredRoutes = [];
  const app = {};

  ['get', 'post', 'patch', 'delete'].forEach((method) => {
    app[method] = (route) => registeredRoutes.push([method, route]);
  });

  registerOePanelPartyGameRoutes({ app });

  assert.deepEqual(registeredRoutes, [
    ['get', '/api/oe-panel/party-games/gamemode-distribution'],
    ['get', '/api/oe-panel/party-rooms'],
    ['delete', '/api/oe-panel/party-rooms/:partyCode'],
    ['post', '/api/oe-panel/game-packs'],
    ['patch', '/api/oe-panel/game-packs/:packKey'],
    ['delete', '/api/oe-panel/game-packs/:packKey'],
    ['post', '/api/oe-panel/game-packs/export'],
    ['post', '/api/oe-panel/game-modes/export'],
    ['patch', '/api/oe-panel/game-rules/:ruleKey'],
    ['delete', '/api/oe-panel/game-rules/:ruleKey'],
    ['get', '/api/oe-panel/gamemode-settings-alerts'],
    ['post', '/api/oe-panel/game-rules/export'],
    ['patch', '/api/oe-panel/game-roles/:roleKey'],
    ['delete', '/api/oe-panel/game-roles/:roleKey'],
    ['post', '/api/oe-panel/game-roles/export']
  ]);
});
