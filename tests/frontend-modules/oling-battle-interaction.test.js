const test = require('node:test');
const assert = require('node:assert/strict');
const {
  battleLobbySource,
  battleStyles,
  createBattleDom,
  createChooseOlingLobbyDom,
  getSproutOling,
  getWaitingMatch,
  loadBattleScripts
} = require('./oling-battle-interaction/helpers');

test('hit tracker keeps the newest 12 results from left to right', () => {
  const hitMarkers = Array.from(
    { length: 12 },
    (_, index) =>
      `<li class="hit-tracker-marker" data-hit-number="${index + 1}"></li>`
  ).join('');
  const dom = createBattleDom(
    `<section class="oling-battle-arena"></section>
    <div class="oling-battle-command-panel"></div>
    <div class="battle-momentum-bar">
      <div class="player-oling-head-marker"></div>
      <div class="momentum-track"></div>
      <ol>${hitMarkers}</ol>
    </div>
    <p class="battle-hit-result"></p>`
  );
  const { window } = dom;
  const arena = window.document.querySelector('.oling-battle-arena');
  const commandPanel = window.document.querySelector(
    '.oling-battle-command-panel'
  );
  const playerMarker = window.document.querySelector(
    '.player-oling-head-marker'
  );
  const momentumTrack = window.document.querySelector('.momentum-track');

  window.requestAnimationFrame = () => 1;
  arena.getBoundingClientRect = () => ({
    bottom: 600,
    height: 600,
    left: 0,
    right: 400,
    top: 0,
    width: 400
  });
  commandPanel.getBoundingClientRect = () => ({ top: 500 });
  playerMarker.getBoundingClientRect = () => ({ left: 190, width: 20 });
  momentumTrack.getBoundingClientRect = () => ({ left: 100, width: 200 });

  loadBattleScripts(window);
  for (let index = 0; index < 13; index += 1) {
    arena.dispatchEvent(
      new window.MouseEvent('click', {
        bubbles: true,
        clientX: 200,
        clientY: 200
      })
    );
  }

  const renderedMarkers = [
    ...window.document.querySelectorAll('.hit-tracker-marker')
  ];
  assert.equal(renderedMarkers[0].dataset.hitSequence, '13');
  assert.equal(renderedMarkers[11].dataset.hitSequence, '2');
  assert.ok(
    !renderedMarkers.some((marker) => marker.dataset.hitSequence === '1')
  );
});

test('battle timer exposes speed multiplier thresholds and overtime state', () => {
  let animationFrameCallback = null;
  const speedMultiplierCalls = [];
  const dom = createBattleDom(
    `<section class="oling-battle-shell" data-match-length="30">
      <div class="oling-battle-timer" data-match-length="30">30</div>
      <section class="oling-battle-arena"></section>
      <div class="oling-battle-oling"></div>
      <div class="oling-battle-command-panel"></div>
      <div class="battle-momentum-bar">
        <div class="player-oling-head-marker"></div>
        <div class="momentum-track"></div>
        <ol></ol>
      </div>
      <p class="battle-hit-result"></p>
    </section>`
  );
  const { window } = dom;

  window.requestAnimationFrame = (callback) => {
    animationFrameCallback = callback;
    return 1;
  };
  window.OlingFlightMotion = {
    setSpeedMultiplier(root, multiplier) {
      speedMultiplierCalls.push({ root, multiplier });
      return true;
    }
  };

  loadBattleScripts(window);
  const timer = window.document.querySelector('.oling-battle-timer');
  const shell = window.document.querySelector('.oling-battle-shell');

  animationFrameCallback(0);
  assert.equal(timer.textContent, '30');
  assert.equal(shell.dataset.battleTimeMultiplier, '1');

  animationFrameCallback(15000);
  assert.equal(timer.textContent, '15');
  assert.equal(shell.dataset.battleTimeMultiplier, '1.35');

  animationFrameCallback(22501);
  assert.equal(timer.textContent, '8');
  assert.equal(shell.dataset.battleTimeMultiplier, '1.6');

  animationFrameCallback(30000);
  assert.equal(timer.textContent, '0');
  assert.equal(shell.dataset.battleTimeMultiplier, '2');
  assert.ok(timer.classList.contains('is-overtime'));
  assert.equal(speedMultiplierCalls.at(-1).multiplier, 2);
});

test('battle marker base speed matches the previous overtime pace', () => {
  let animationFrameCallback = null;
  const dom = createBattleDom(
    `<section class="oling-battle-shell" data-match-length="30">
      <div class="oling-battle-timer" data-match-length="30">30</div>
      <section class="oling-battle-arena"></section>
      <div class="oling-battle-command-panel"></div>
      <div class="battle-momentum-bar">
        <div class="player-oling-head-marker"></div>
        <div class="momentum-track"></div>
        <ol></ol>
      </div>
      <p class="battle-hit-result"></p>
    </section>`
  );
  const { window } = dom;
  const momentumBar = window.document.querySelector('.battle-momentum-bar');

  window.requestAnimationFrame = (callback) => {
    animationFrameCallback = callback;
    return 1;
  };

  loadBattleScripts(window);
  animationFrameCallback(0);
  animationFrameCallback(50);

  assert.equal(
    momentumBar.style.getPropertyValue('--player-marker-position'),
    '54.8%'
  );
});

test('all four battle scene depths shake only for locally initiated attacks', () => {
  const dom = createBattleDom(
    `<section class="oling-battle-shell" data-current-player-slot="player-one">
      <section class="oling-battle-arena">
        <div class="oling-battle-scene">
          <img class="oling-battle-scene-layer is-far-background">
          <img class="oling-battle-scene-layer is-background">
          <img class="oling-battle-scene-layer is-stage">
          <img class="oling-battle-scene-layer is-foreground">
        </div>
      </section>
      <div class="oling-battle-command-panel"></div>
      <div class="battle-momentum-bar">
        <div class="player-oling-head-marker"></div>
        <div class="momentum-track"></div>
      </div>
      <div class="player-oling-health"><span></span></div>
      <div class="enemy-oling-health"><span></span></div>
      <p class="battle-hit-result"></p>
    </section>`
  );
  const { window } = dom;
  const arena = window.document.querySelector('.oling-battle-arena');
  const layers = [
    ...window.document.querySelectorAll('.oling-battle-scene-layer')
  ];
  const playerMarker = window.document.querySelector(
    '.player-oling-head-marker'
  );
  const momentumTrack = window.document.querySelector('.momentum-track');

  window.requestAnimationFrame = () => 1;
  arena.getBoundingClientRect = () => ({
    height: 500,
    left: 0,
    top: 0,
    width: 300
  });
  playerMarker.getBoundingClientRect = () => ({ left: 145, width: 10 });
  momentumTrack.getBoundingClientRect = () => ({ left: 50, width: 200 });

  loadBattleScripts(window);
  arena.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.ok(layers.every((layer) => layer.classList.contains('is-shaking')));

  layers.forEach((layer) => layer.classList.remove('is-shaking'));
  window.document.dispatchEvent(
    new window.CustomEvent('oling-battle:external-hit', {
      detail: {
        payload: {
          battleResult: {
            ended: false,
            targetCurrentHealth: 90,
            targetMaxHealth: 100,
            targetSlot: 'player-one',
            zone: 'strike'
          }
        }
      }
    })
  );
  assert.ok(layers.every((layer) => !layer.classList.contains('is-shaking')));
});

test('players without an Oling see the hatch prompt before a battle request', async () => {
  const requestedUrls = [];
  const dom = createBattleDom(
    `<main class="battle-olings-page">
      <section class="oling-battle-shell is-lobby">
        <div class="oling-battle-timer"></div>
        <section class="oling-battle-lobby-screen"></section>
        <footer class="oling-battle-lobby-footer"></footer>
      </section>
      <section class="oling-battle-no-oling" tabindex="-1" hidden>
        <h1>NO OLING FOUND</h1>
        <a href="/olings/lab">GO TO OLINGS LAB</a>
        <a href="/">BACK TO MAIN MENU</a>
      </section>
    </main>`,
    { url: 'https://overexposed.app/olings/battle' }
  );
  const { window } = dom;

  window.requestAnimationFrame = () => 1;
  window.fetch = async (url) => {
    requestedUrls.push(String(url));
    return {
      ok: true,
      async json() {
        return {
          success: true,
          account: { id: 'account-1', username: 'New Player' },
          olings: []
        };
      }
    };
  };

  loadBattleScripts(window);
  await new Promise((resolve) => window.setTimeout(resolve, 0));

  const battleShell = window.document.querySelector('.oling-battle-shell');
  const noOlingState = window.document.querySelector('.oling-battle-no-oling');

  assert.equal(battleShell.hidden, true);
  assert.equal(noOlingState.hidden, false);
  assert.deepEqual(requestedUrls, ['/api/olings/mine']);
  assert.equal(
    noOlingState.querySelector('a[href="/olings/lab"]').textContent.trim(),
    'GO TO OLINGS LAB'
  );
  assert.ok(noOlingState.querySelector('a[href="/"]'));
});

test('choose Oling mode enables save and fills the detail pane while waiting for opponent', async () => {
  const dom = createChooseOlingLobbyDom();
  const { window } = dom;
  const sprout = getSproutOling();

  window.requestAnimationFrame = () => 1;
  window.localStorage.clear();
  window.fetch = async (url) => {
    const requestUrl = String(url);
    if (requestUrl === '/api/olings/mine') {
      return {
        ok: true,
        async json() {
          return {
            success: true,
            account: { id: 'account-1', username: 'Tester' },
            olings: [sprout]
          };
        }
      };
    }

    if (requestUrl === '/api/olings/battles') {
      return {
        ok: true,
        async json() {
          return {
            success: true,
            match: getWaitingMatch(sprout)
          };
        }
      };
    }

    throw new Error(`Unexpected fetch: ${requestUrl}`);
  };

  loadBattleScripts(window);
  await new Promise((resolve) => window.setTimeout(resolve, 0));

  const selectTrigger = window.document.querySelector(
    '.oling-battle-lobby-player-select-trigger'
  );
  const readyButton = window.document.querySelector(
    '.oling-battle-lobby-ready'
  );
  const descriptionPanel = window.document.querySelector(
    '.oling-battle-lobby-player-description'
  );

  assert.equal(readyButton.disabled, true);
  assert.equal(readyButton.textContent, 'WAITING FOR PLAYER');

  selectTrigger.click();

  assert.equal(readyButton.disabled, false);
  assert.equal(readyButton.textContent, 'SAVE');
  assert.equal(descriptionPanel.hidden, false);
  assert.ok(
    battleStyles.includes(
      '.oling-battle-screen-lower-half\r\n  > .oling-battle-lobby-player-description'
    ) ||
      battleStyles.includes(
        '.oling-battle-screen-lower-half\n  > .oling-battle-lobby-player-description'
      ),
    'choose-mode player description must be owned by the lower-half panel'
  );
  assert.ok(
    battleStyles.includes('grid-template-rows: repeat(7, minmax(0, 1fr));'),
    'choose-mode player description stats must stretch through the lower half'
  );
  assert.ok(
    battleLobbySource.includes(
      'renderOlingArt(pickerPreview, opponentOling)'
    ) &&
      battleLobbySource.includes('panel: playerDescriptionPanel') &&
      battleLobbySource.includes('stats: playerDescriptionStats'),
    'enemy Oling view must reuse the shared upper preview and lower details'
  );
  assert.ok(
    battleStyles.includes('.oling-battle-lobby-matchup.is-viewing-enemy') &&
      battleStyles.includes('.oling-battle-lobby-oling-arrow') &&
      battleStyles.includes('display: none;'),
    'enemy Oling view must hide picker arrows while sharing the picker shell'
  );
  assert.match(descriptionPanel.textContent, /Sprout/);
  assert.match(descriptionPanel.textContent, /Level/);
  assert.match(descriptionPanel.textContent, /Moss Body/);
});
