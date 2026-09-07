(function () {
  const scriptPath = '/scripts/olings/clash/clash-online-game.js';
  const settingsSplashScreen =
    '/images/splash-screens/olings/clash/settings.png';
  const roomMatch = window.location.pathname.match(
    /^\/olings\/clash\/([a-z0-9]{3}-[a-z0-9]{3})\/?$/i
  );
  const isRoomRoute = Boolean(roomMatch);
  const matchCode = String(
    roomMatch?.[1] ||
      window.sessionStorage.getItem('olings-clash-offline-match') ||
      ''
  ).toUpperCase();
  const gameRoot = document.querySelector('[data-clash-game]');
  let socket = null;
  let accountId = '';
  let latestGameplayMatch = null;
  let currentSocketMatch = null;
  let recoveryRequest = null;
  let hasEnteredGameplay = false;
  const retiredGameIds = new Set();

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      cache: 'no-store',
      credentials: 'same-origin',
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    });
    const payload = (await response.json().catch(() => ({}))) || {};
    if (!response.ok || payload.success === false) {
      const error = new Error(
        payload.error?.message || 'That Oling Clash could not be loaded.'
      );
      error.code = payload.error?.code || 'oling_clash_request_failed';
      throw error;
    }
    return payload;
  }

  function showLoadError(error) {
    gameRoot?.setAttribute('hidden', '');
    const page = document.querySelector('.olings-clash-page');
    const status = document.createElement('section');
    const title = document.createElement('h1');
    const message = document.createElement('p');
    const actions = document.createElement('div');
    const settingsLink = document.createElement('a');
    status.className = 'olings-clash-gate is-standalone';
    status.setAttribute('role', 'alert');
    title.textContent = 'CLASH UNAVAILABLE';
    message.textContent =
      error?.message || 'That Oling Clash could not be loaded.';
    settingsLink.href = '/olings/clash/settings';
    settingsLink.textContent = 'CLASH SETTINGS';
    settingsLink.addEventListener('click', (event) => {
      if (typeof window.transitionSplashScreen !== 'function') return;
      event.preventDefault();
      window.transitionSplashScreen(
        '/olings/clash/settings',
        settingsSplashScreen
      );
    });
    actions.className = 'olings-clash-gate__actions';
    actions.appendChild(settingsLink);
    status.append(title, message, actions);
    page?.appendChild(status);
    if (!isRoomRoute) {
      window.sessionStorage.removeItem('olings-clash-offline-match');
    }
  }

  function returnToWaitingRoom() {
    const path = isRoomRoute
      ? window.location.pathname
      : '/olings/clash/settings';
    const shouldNavigate = window.dispatchEvent(
      new CustomEvent('olings-clash:waiting-room', {
        cancelable: true,
        detail: { path }
      })
    );
    if (!shouldNavigate) return;
    if (typeof window.transitionSplashScreen === 'function') {
      if (!isRoomRoute) {
        window.sessionStorage.removeItem('olings-clash-offline-match');
      }
      window.transitionSplashScreen(path, settingsSplashScreen);
      return;
    }
    if (isRoomRoute) {
      window.location.reload();
      return;
    }
    window.sessionStorage.removeItem('olings-clash-offline-match');
    window.location.assign('/olings/clash/settings');
  }

  function getMatchTimestamp(match) {
    const timestamp = Date.parse(match?.updatedAt);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  function isStaleGameplayMatch(match) {
    const gameId = String(match?.gameId || '');
    if (gameId && retiredGameIds.has(gameId)) return true;
    if (!latestGameplayMatch) return false;
    if (
      gameId &&
      latestGameplayMatch.gameId &&
      gameId !== latestGameplayMatch.gameId
    ) {
      return false;
    }
    const round = Number(match?.round || 0);
    const revision = Number(match?.revision || 0);
    if (
      revision > 0 &&
      latestGameplayMatch.revision > 0 &&
      revision < latestGameplayMatch.revision
    ) {
      return true;
    }
    if (round < latestGameplayMatch.round) return true;
    if (
      latestGameplayMatch.status === 'completed' &&
      match.status !== 'completed'
    ) {
      return true;
    }
    const updatedAt = getMatchTimestamp(match);
    return Boolean(
      round === latestGameplayMatch.round &&
      updatedAt !== null &&
      latestGameplayMatch.updatedAt !== null &&
      updatedAt < latestGameplayMatch.updatedAt
    );
  }

  function recordGameplayMatch(match) {
    const gameId = String(match?.gameId || '');
    if (
      gameId &&
      latestGameplayMatch?.gameId &&
      gameId !== latestGameplayMatch.gameId
    ) {
      retiredGameIds.add(latestGameplayMatch.gameId);
    }
    latestGameplayMatch = {
      gameId,
      round: Number(match?.round || 0),
      status: match.status,
      revision: Number(match?.revision || 0),
      updatedAt: getMatchTimestamp(match)
    };
    hasEnteredGameplay = true;
  }

  function applyMatch(match) {
    if (!match?.matchCode) return false;
    if (['waiting', 'ready'].includes(match.status)) {
      if (hasEnteredGameplay) return false;
      returnToWaitingRoom();
      return false;
    }
    if (!['active', 'completed'].includes(match.status)) return false;
    if (isStaleGameplayMatch(match)) return false;
    recordGameplayMatch(match);
    currentSocketMatch = match;
    window.OlingClashGame?.useOnlineMatch?.(match, accountId);
    return true;
  }

  function isSafePatchPath(path) {
    return (
      Array.isArray(path) &&
      path.every(
        (part) =>
          typeof part === 'string' &&
          !['__proto__', 'constructor', 'prototype'].includes(part)
      )
    );
  }

  function applySnapshotPatch(snapshot, patch) {
    let next = JSON.parse(JSON.stringify(snapshot));
    const resolveParent = (path) => {
      let target = next;
      for (const part of path.slice(0, -1)) {
        if (!target[part] || typeof target[part] !== 'object') {
          target[part] = {};
        }
        target = target[part];
      }
      return target;
    };
    for (const path of patch.removed || []) {
      if (!isSafePatchPath(path) || path.length === 0) continue;
      delete resolveParent(path)[path.at(-1)];
    }
    for (const change of patch.changes || []) {
      const path = change?.path;
      if (!isSafePatchPath(path)) continue;
      if (path.length === 0) {
        next = change.value;
      } else {
        resolveParent(path)[path.at(-1)] = change.value;
      }
    }
    return next;
  }

  function recoverSocketMatch() {
    if (recoveryRequest) return recoveryRequest;
    recoveryRequest = fetchMatch()
      .then((match) => match && applyMatch(match))
      .catch((error) => console.error('Failed to recover Clash state:', error))
      .finally(() => {
        recoveryRequest = null;
      });
    return recoveryRequest;
  }

  function applySocketPayload(payload) {
    if (payload?.type !== 'patch') {
      if (payload?.matchCode === matchCode) applyMatch(payload);
      return;
    }
    if (payload.matchCode !== matchCode) return;
    const currentRevision = Number(currentSocketMatch?.revision || 0);
    if (Number(payload.revision || 0) <= currentRevision) return;
    if (
      !currentSocketMatch ||
      currentSocketMatch.gameId !== payload.gameId ||
      currentRevision !== Number(payload.baseRevision || 0)
    ) {
      void recoverSocketMatch();
      return;
    }
    const next = applySnapshotPatch(currentSocketMatch, payload);
    if (
      next?.matchCode !== matchCode ||
      Number(next?.revision || 0) !== Number(payload.revision || 0)
    ) {
      void recoverSocketMatch();
      return;
    }
    applyMatch(next);
  }

  async function fetchAccountId() {
    const payload = await requestJson('/api/accounts/me');
    const account = payload.account || payload.data?.account || null;
    return String(account?.id || account?._id || '');
  }

  async function fetchMatch() {
    const payload = await requestJson(
      `/api/olings/clashes/${encodeURIComponent(matchCode)}`
    );
    return payload.match || null;
  }

  async function resumeMatch() {
    const payload = await requestJson(
      `/api/olings/clashes/${encodeURIComponent(matchCode)}/join`,
      { method: 'POST', body: JSON.stringify({}) }
    );
    return payload.match || null;
  }

  function waitForImage(image) {
    if (image.complete) {
      return typeof image.decode === 'function'
        ? image.decode().catch(() => {})
        : Promise.resolve();
    }
    return new Promise((resolve) => {
      const finish = () => {
        image.removeEventListener('load', finish);
        image.removeEventListener('error', finish);
        resolve();
      };
      image.addEventListener('load', finish, { once: true });
      image.addEventListener('error', finish, { once: true });
      if (image.complete) finish();
    });
  }

  function waitForNextPaint() {
    if (typeof window.requestAnimationFrame !== 'function') {
      return Promise.resolve();
    }
    return new Promise((resolve) => window.requestAnimationFrame(resolve));
  }

  async function waitForGameReady() {
    const fontReady = document.fonts?.ready || Promise.resolve();
    const backgroundReady =
      window.OlingClashBackgroundThemeReady || Promise.resolve();
    const orientationReady =
      window.OERotateDevice?.waitUntilAllowed?.() || Promise.resolve();
    await Promise.allSettled([fontReady, backgroundReady]);
    await Promise.allSettled(
      [...gameRoot.querySelectorAll('img')].map(waitForImage)
    );
    await orientationReady;
    await waitForNextPaint();
    await waitForNextPaint();
  }

  async function markGameLoaded() {
    const payload = await requestJson(
      `/api/olings/clashes/${encodeURIComponent(matchCode)}/game-loaded`,
      { method: 'POST', body: JSON.stringify({}) }
    );
    return payload.match || null;
  }

  function initializeSocket() {
    if (typeof window.io !== 'function' || !matchCode) return;
    socket = window.io();
    const joinRoom = () => socket.emit('oling-clash:join-room', matchCode);
    socket.on('connect', () => {
      joinRoom();
      fetchMatch().then(applyMatch).catch(showLoadError);
    });
    socket.on('oling-clash:state', applySocketPayload);
    socket.on('oling-clash:started', applySocketPayload);
    socket.on('oling-clash:left', applySocketPayload);
    socket.on('oling-clash:round', applySocketPayload);
    socket.on('oling-clash:replacement', applySocketPayload);
    socket.on('oling-clash:round-resolved', (payload) => {
      window.OlingClashGame?.handleOnlineRoundResult?.(payload);
    });
    socket.on('oling-clash:replacement-selected', (payload) => {
      window.OlingClashGame?.handleOnlineReplacement?.(payload);
    });
    socket.on('oling-clash:forfeited', (payload) => {
      window.OlingClashGame?.handleOnlineForfeit?.(payload);
    });
  }

  async function initialize() {
    if (!matchCode || !gameRoot || !window.OlingClashGame) {
      throw new Error('Start an offline Clash from Clash settings.');
    }
    accountId = await fetchAccountId();
    const match = await resumeMatch();
    if (!match) throw new Error('That Oling Clash could not be found.');
    applyMatch(match);
    initializeSocket();
    if (match.phase === 'starting') {
      await waitForGameReady();
      const readyMatch = await markGameLoaded();
      if (readyMatch) applyMatch(readyMatch);
    }
  }

  initialize()
    .catch(showLoadError)
    .finally(() => window.SetScriptLoaded?.(scriptPath));

  window.addEventListener(
    'pagehide',
    () => {
      socket?.emit?.('oling-clash:leave-room', matchCode);
      socket?.disconnect?.();
    },
    { once: true }
  );
})();
