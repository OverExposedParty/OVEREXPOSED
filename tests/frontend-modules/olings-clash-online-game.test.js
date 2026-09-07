const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const scriptSource = fs.readFileSync(
  path.join(
    __dirname,
    '../../public/scripts/olings/clash/clash-online-game.js'
  ),
  'utf8'
);

function createResponse(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return payload;
    }
  };
}

function waitForTasks() {
  return new Promise((resolve) => setImmediate(resolve));
}

function createGameDom(url) {
  return new JSDOM(
    '<main class="olings-clash-page"><section data-clash-game></section></main>',
    { runScripts: 'outside-only', url }
  );
}

test('active room URLs resume the participant and join the socket room', async () => {
  const dom = createGameDom('https://overexposed.app/olings/clash/ABC-123');
  const { window } = dom;
  const requests = [];
  const socketEvents = [];
  const appliedMatches = [];
  const activeMatch = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    players: []
  };

  window.SetScriptLoaded = () => {};
  window.OlingClashGame = {
    useOnlineMatch(match, accountId) {
      appliedMatches.push({ accountId, match });
    }
  };
  window.fetch = async (url, options = {}) => {
    requests.push({ method: options.method || 'GET', url });
    if (url === '/api/accounts/me') {
      return createResponse({ account: { id: 'account-1' } });
    }
    return createResponse({ match: activeMatch });
  };
  window.io = () => ({
    disconnect() {},
    emit(event, value) {
      socketEvents.push({ event, value });
    },
    on(event, handler) {
      if (event === 'connect') window.queueMicrotask(handler);
    }
  });

  window.eval(scriptSource);
  await waitForTasks();
  await waitForTasks();

  assert.equal(
    requests.some(
      ({ method, url }) =>
        method === 'POST' && url === '/api/olings/clashes/ABC-123/join'
    ),
    true
  );
  assert.equal(appliedMatches[0].accountId, 'account-1');
  assert.equal(appliedMatches[0].match, activeMatch);
  assert.deepEqual(socketEvents[0], {
    event: 'oling-clash:join-room',
    value: 'ABC-123'
  });
  assert.equal(
    requests.some(({ url }) => url.endsWith('/game-loaded')),
    false
  );

  dom.window.close();
});

test('a waiting match returns the coded URL to its waiting-room document', async () => {
  const dom = createGameDom('https://overexposed.app/olings/clash/ABC-123');
  const { window } = dom;
  let waitingPath = '';
  let gameApplied = false;

  window.SetScriptLoaded = () => {};
  window.OlingClashGame = {
    useOnlineMatch() {
      gameApplied = true;
    }
  };
  window.addEventListener('olings-clash:waiting-room', (event) => {
    event.preventDefault();
    waitingPath = event.detail?.path || '';
  });
  window.fetch = async (url) => {
    if (url === '/api/accounts/me') {
      return createResponse({ account: { id: 'account-1' } });
    }
    return createResponse({
      match: { matchCode: 'ABC-123', status: 'waiting', players: [] }
    });
  };

  window.eval(scriptSource);
  await waitForTasks();
  await waitForTasks();

  assert.equal(waitingPath, '/olings/clash/ABC-123');
  assert.equal(gameApplied, false);

  dom.window.close();
});

test('active gameplay ignores stale waiting and older-round snapshots', async () => {
  const dom = createGameDom('https://overexposed.app/olings/clash/ABC-123');
  const { window } = dom;
  const appliedMatches = [];
  const socketHandlers = {};
  let waitingRoomEvents = 0;
  const activeMatch = {
    gameId: 'OCL-CURRENT',
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 4,
    updatedAt: '2026-08-22T12:00:00.000Z',
    players: []
  };

  window.SetScriptLoaded = () => {};
  window.OlingClashGame = {
    useOnlineMatch(match) {
      appliedMatches.push(match);
    }
  };
  window.addEventListener('olings-clash:waiting-room', (event) => {
    event.preventDefault();
    waitingRoomEvents += 1;
  });
  window.fetch = async (url) => {
    if (url === '/api/accounts/me') {
      return createResponse({ account: { id: 'account-1' } });
    }
    return createResponse({ match: activeMatch });
  };
  window.io = () => ({
    disconnect() {},
    emit() {},
    on(event, handler) {
      socketHandlers[event] = handler;
    }
  });

  window.eval(scriptSource);
  await waitForTasks();
  await waitForTasks();

  socketHandlers['oling-clash:state']({
    gameId: 'OCL-NEXT',
    matchCode: 'ABC-123',
    status: 'waiting',
    phase: 'waiting',
    round: 0,
    players: []
  });
  socketHandlers['oling-clash:round']({
    ...activeMatch,
    round: 3,
    updatedAt: '2026-08-22T11:59:59.000Z'
  });

  assert.equal(waitingRoomEvents, 0);
  assert.deepEqual(appliedMatches, [activeMatch]);

  dom.window.close();
});

test('active gameplay applies contiguous socket patches', async () => {
  const dom = createGameDom('https://overexposed.app/olings/clash/ABC-123');
  const { window } = dom;
  const appliedMatches = [];
  const socketHandlers = {};
  const activeMatch = {
    gameId: 'OCL-CURRENT',
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    revision: 3,
    round: 2,
    players: []
  };

  window.SetScriptLoaded = () => {};
  window.OlingClashGame = {
    useOnlineMatch(match) {
      appliedMatches.push(match);
    }
  };
  window.fetch = async (url) => {
    if (url === '/api/accounts/me') {
      return createResponse({ account: { id: 'account-1' } });
    }
    return createResponse({ match: activeMatch });
  };
  window.io = () => ({
    disconnect() {},
    emit() {},
    on(event, handler) {
      socketHandlers[event] = handler;
    }
  });

  window.eval(scriptSource);
  await waitForTasks();
  socketHandlers['oling-clash:round']({
    type: 'patch',
    gameId: activeMatch.gameId,
    matchCode: activeMatch.matchCode,
    baseRevision: 3,
    revision: 4,
    removed: [],
    changes: [
      { path: ['phase'], value: 'replacement' },
      { path: ['revision'], value: 4 }
    ]
  });

  assert.equal(appliedMatches.length, 2);
  assert.equal(appliedMatches[1].phase, 'replacement');
  assert.equal(appliedMatches[1].revision, 4);
  dom.window.close();
});

test('a socket patch gap recovers with a fresh snapshot', async () => {
  const dom = createGameDom('https://overexposed.app/olings/clash/ABC-123');
  const { window } = dom;
  const appliedMatches = [];
  const socketHandlers = {};
  let matchRequests = 0;
  const initialMatch = {
    gameId: 'OCL-CURRENT',
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    revision: 3,
    round: 2,
    players: []
  };

  window.SetScriptLoaded = () => {};
  window.OlingClashGame = {
    useOnlineMatch(match) {
      appliedMatches.push(match);
    }
  };
  window.fetch = async (url) => {
    if (url === '/api/accounts/me') {
      return createResponse({ account: { id: 'account-1' } });
    }
    matchRequests += 1;
    return createResponse({
      match:
        matchRequests === 1
          ? initialMatch
          : { ...initialMatch, phase: 'replacement', revision: 6 }
    });
  };
  window.io = () => ({
    disconnect() {},
    emit() {},
    on(event, handler) {
      socketHandlers[event] = handler;
    }
  });

  window.eval(scriptSource);
  await waitForTasks();
  socketHandlers['oling-clash:round']({
    type: 'patch',
    gameId: initialMatch.gameId,
    matchCode: initialMatch.matchCode,
    baseRevision: 4,
    revision: 6,
    changes: [],
    removed: []
  });
  await waitForTasks();

  assert.equal(matchRequests, 2);
  assert.equal(appliedMatches.at(-1).phase, 'replacement');
  assert.equal(appliedMatches.at(-1).revision, 6);
  dom.window.close();
});

test('offline AI matches resume from session storage on the root route', async () => {
  const dom = createGameDom('https://overexposed.app/olings/clash');
  const { window } = dom;
  const requests = [];

  window.sessionStorage.setItem('olings-clash-offline-match', 'AI1-234');
  window.SetScriptLoaded = () => {};
  window.OlingClashGame = { useOnlineMatch() {} };
  window.fetch = async (url, options = {}) => {
    requests.push({ method: options.method || 'GET', url });
    if (url === '/api/accounts/me') {
      return createResponse({ account: { id: 'account-1' } });
    }
    return createResponse({
      match: { matchCode: 'AI1-234', status: 'active', players: [] }
    });
  };

  window.eval(scriptSource);
  await waitForTasks();

  assert.equal(
    requests.some(({ url }) => url === '/api/olings/clashes/AI1-234/join'),
    true
  );

  dom.window.close();
});

test('a starting match acknowledges loading after assets and orientation are ready', async () => {
  const dom = createGameDom('https://overexposed.app/olings/clash/ABC-123');
  const { window } = dom;
  const requests = [];
  const appliedPhases = [];
  let resolveBackground;
  let resolveOrientation;
  window.OlingClashBackgroundThemeReady = new Promise((resolve) => {
    resolveBackground = resolve;
  });
  window.OERotateDevice = {
    waitUntilAllowed() {
      return new Promise((resolve) => {
        resolveOrientation = resolve;
      });
    }
  };
  window.SetScriptLoaded = () => {};
  window.OlingClashGame = {
    useOnlineMatch(match) {
      appliedPhases.push(match.phase);
    }
  };
  window.fetch = async (url, options = {}) => {
    requests.push({ method: options.method || 'GET', url });
    if (url === '/api/accounts/me') {
      return createResponse({ account: { id: 'account-1' } });
    }
    if (String(url).endsWith('/game-loaded')) {
      return createResponse({
        match: {
          matchCode: 'ABC-123',
          status: 'active',
          phase: 'selection',
          phaseEndsAt: new Date(Date.now() + 15_000).toISOString(),
          players: []
        }
      });
    }
    return createResponse({
      match: {
        matchCode: 'ABC-123',
        status: 'active',
        phase: 'starting',
        phaseEndsAt: null,
        players: []
      }
    });
  };

  window.eval(scriptSource);
  await waitForTasks();
  await waitForTasks();
  assert.deepEqual(appliedPhases, ['starting']);
  assert.equal(
    requests.some(({ url }) => url.endsWith('/game-loaded')),
    false
  );

  resolveBackground();
  await waitForTasks();
  await waitForTasks();
  assert.equal(
    requests.some(({ url }) => url.endsWith('/game-loaded')),
    false
  );

  resolveOrientation();
  await waitForTasks();
  await waitForTasks();
  assert.equal(
    requests.some(
      ({ method, url }) => method === 'POST' && url.endsWith('/game-loaded')
    ),
    true
  );
  assert.deepEqual(appliedPhases, ['starting', 'selection']);

  dom.window.close();
});
