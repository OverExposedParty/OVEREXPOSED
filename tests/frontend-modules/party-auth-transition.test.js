const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const source = fs.readFileSync(
  path.join(
    __dirname,
    '../../public/scripts/general/online/party-auth-transition.js'
  ),
  'utf8'
);

test('intentional sign-in navigation begins and stores a party lease', async () => {
  const requests = [];
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'outside-only',
    url: 'https://overexposed.app/ABC-123'
  });
  const context = dom.getInternalVMContext();
  Object.assign(context, {
    partyCode: 'ABC-123',
    currentPartyData: {
      state: {
        hostComputerId: 'host-device',
        isPlaying: false,
        phase: 'lobby'
      }
    },
    deviceId: 'guest-device',
    sessionPartyType: 'party-game-truth-or-dare',
    socket: { id: 'guest-socket' },
    isCurrentPartyLobby: () => true,
    isCurrentPartyHost: () => false,
    fetch: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        async json() {
          return {
            transitionId: 'transition-one',
            token: 'secret-token',
            expiresAt: '2026-08-06T12:05:00.000Z',
            hardExpiresAt: '2026-08-06T12:20:00.000Z'
          };
        }
      };
    }
  });
  new vm.Script(source).runInContext(context);

  let destination = '';
  const preserved = await context.beginOnlinePartyAuthNavigation('/sign-in', {
    navigate(pathname) {
      destination = pathname;
    }
  });
  const stored = JSON.parse(
    dom.window.sessionStorage.getItem('oe-party-auth-transition')
  );

  assert.equal(preserved, true);
  assert.equal(destination, '/sign-in');
  assert.equal(context.onlinePartyAuthTransitionInProgress, true);
  assert.equal(
    requests[0].url,
    '/api/party-game-truth-or-dare/auth-transition/begin'
  );
  assert.equal(stored.transitionId, 'transition-one');
  assert.equal(stored.computerId, 'guest-device');
  dom.window.close();
});

test('an active-game host can preserve their player while signing in', async () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'outside-only',
    url: 'https://overexposed.app/truth-or-dare/game'
  });
  const context = dom.getInternalVMContext();
  Object.assign(context, {
    partyCode: 'ABC-123',
    currentPartyData: {
      state: {
        hostComputerId: 'host-device',
        isPlaying: true,
        phase: 'playing'
      }
    },
    deviceId: 'host-device',
    sessionPartyType: 'party-game-truth-or-dare',
    socket: { id: 'host-socket' },
    isCurrentPartyHost: () => true,
    fetch: async () => ({
      ok: true,
      async json() {
        return {
          transitionId: 'host-transition',
          token: 'host-token'
        };
      }
    })
  });
  new vm.Script(source).runInContext(context);

  let navigated = false;
  const preserved = await context.beginOnlinePartyAuthNavigation('/sign-in', {
    navigate() {
      navigated = true;
    }
  });

  assert.equal(preserved, true);
  assert.equal(navigated, true);
  dom.window.close();
});

test('the sign-in page immediately heartbeats a stored party lease', async () => {
  const requests = [];
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'outside-only',
    url: 'https://overexposed.app/sign-in?returnTo=%2FABC-123'
  });
  dom.window.sessionStorage.setItem(
    'oe-party-auth-transition',
    JSON.stringify({
      apiRoute: 'party-game-truth-or-dare',
      partyId: 'ABC-123',
      computerId: 'guest-device',
      transitionId: 'transition-one',
      token: 'secret-token'
    })
  );
  const context = dom.getInternalVMContext();
  context.fetch = async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      async json() {
        return {
          expiresAt: '2026-08-06T12:05:00.000Z',
          hardExpiresAt: '2026-08-06T12:20:00.000Z'
        };
      }
    };
  };

  new vm.Script(source).runInContext(context);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(
    requests[0].url,
    '/api/party-game-truth-or-dare/auth-transition/heartbeat'
  );
  assert.equal(JSON.parse(requests[0].options.body).token, 'secret-token');
  dom.window.close();
});
