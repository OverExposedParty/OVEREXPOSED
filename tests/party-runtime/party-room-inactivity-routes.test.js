const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createPartyUtilityRoutes
} = require('../../server/game-engine/party-runtime/route-handlers/utility-routes');

test('party fetch routes do not return rooms beyond the inactivity window', async () => {
  let handler = null;
  const now = Date.now();
  const routes = createPartyUtilityRoutes({
    app: {
      get(_route, routeHandler) {
        handler = routeHandler;
      }
    },
    assertPartyId() {},
    appendPartyError() {},
    createPartyErrorEntry() {}
  });
  routes.createPartyGetHandler({
    route: '/api/party',
    model: {
      async find() {
        return [
          {
            partyId: 'OLD-123',
            state: { lastPinged: new Date(now - 21 * 60 * 1000) }
          },
          {
            partyId: 'NEW-123',
            state: { lastPinged: new Date(now - 19 * 60 * 1000) }
          }
        ];
      }
    },
    logLabel: 'Party'
  });

  let responseBody = null;
  await handler(
    { query: { partyCode: 'NEW-123' }, id: 'request-one' },
    {
      setHeader() {},
      json(value) {
        responseBody = value;
      },
      apiError(error) {
        assert.fail(error.message);
      }
    }
  );

  assert.equal(responseBody.length, 1);
  assert.equal(responseBody[0].partyId, 'NEW-123');
});
