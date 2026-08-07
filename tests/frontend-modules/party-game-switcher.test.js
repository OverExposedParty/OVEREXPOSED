const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const switcherPath = path.join(
  __dirname,
  '../../public/scripts/party-games/online/party-game-switcher.js'
);
const statisticsTemplatePath = path.join(
  __dirname,
  '../../public/html-templates/party-games/party-game-statistics.html'
);

function createHarness({
  playerCount = 2,
  unavailableGamemodes = [],
  url = 'https://overexposed.app/most-likely-to/ABC-123'
} = {}) {
  const dom = new JSDOM(fs.readFileSync(statisticsTemplatePath, 'utf8'), {
    url
  });

  const players = Array.from({ length: playerCount }, (_, index) => ({
    identity: { computerId: index === 0 ? 'host-device' : `guest-${index}` }
  }));
  const party = {
    partyId: 'ABC-123',
    session: { gameId: 'MLT-OLD' },
    config: { gamemode: 'most-likely-to' },
    state: {
      isPlaying: false,
      phase: 'game-over',
      hostComputerId: 'host-device'
    },
    players
  };
  const homepageGamemodes = [
    'truth-or-dare',
    'paranoia',
    'never-have-i-ever',
    'most-likely-to',
    'imposter',
    'would-you-rather',
    'mafia'
  ];
  const transitions = [];
  const requests = [];
  const popUpClassArray = [];
  dom.window.SideButtons = {
    createIconButton({ id, label, iconSrc }) {
      const shell = dom.window.document.createElement('div');
      shell.className = 'side-button-shell';
      const button = dom.window.document.createElement('button');
      button.id = id;
      button.className = 'side-button side-button-icon';
      button.setAttribute('aria-label', label);
      const iconContainer = dom.window.document.createElement('span');
      iconContainer.className = 'side-button-icon-container';
      const icon = dom.window.document.createElement('img');
      icon.src = iconSrc;
      iconContainer.appendChild(icon);
      button.appendChild(iconContainer);
      shell.appendChild(button);
      dom.window.document.body.appendChild(shell);
      return button;
    }
  };
  const context = vm.createContext({
    window: dom.window,
    document: dom.window.document,
    currentPartyData: party,
    deviceId: 'host-device',
    partyGameMode: 'most-likely-to',
    partyGamesInformation: Object.fromEntries(
      homepageGamemodes.map((gamemode) => [
        gamemode,
        { forceOnline: gamemode === 'mafia' }
      ])
    ),
    popUpClassArray,
    showContainer(element) {
      element.classList.add('is-visible');
    },
    hideContainer(element) {
      element.classList.remove('is-visible');
    },
    isContainerVisible(element) {
      return element.classList.contains('is-visible');
    },
    addElementIfNotExists(elements, element) {
      if (!elements.includes(element)) elements.push(element);
    },
    removeElementIfExists(elements, element) {
      if (element.dataset.preventContainerClose === 'true') return false;
      const index = elements.indexOf(element);
      if (index === -1) return false;
      elements.splice(index, 1);
      return true;
    },
    syncOverlayStack() {},
    toggleOverlay(show) {
      if (show) return;
      const element = popUpClassArray.at(-1);
      if (!element || element.dataset.preventContainerClose === 'true') return;
      element.classList.remove('is-visible');
      popUpClassArray.pop();
    },
    transitionSplashScreen(destination, splashScreen) {
      transitions.push({ destination, splashScreen });
    },
    console,
    fetch: async (url, options = {}) => {
      requests.push({ url, options });
      if (url !== '/api/homepage-tiles') {
        throw new Error(`Unexpected fetch: ${url}`);
      }
      return {
        ok: true,
        async json() {
          return {
            data: {
              homepageTiles: homepageGamemodes.map((gamemode) => ({
                id: gamemode,
                kind: 'gamemode',
                canAccess: !unavailableGamemodes.includes(gamemode)
              }))
            }
          };
        }
      };
    }
  });
  vm.runInContext(fs.readFileSync(switcherPath, 'utf8'), context, {
    filename: 'party-game-switcher.js'
  });
  return {
    context,
    document: dom.window.document,
    party,
    requests,
    transitions,
    window: dom.window
  };
}

test('game-over switch control is visible only to the host', () => {
  const { context, document, party, window } = createHarness();
  const button = document.querySelector('#statistics-change-game');

  window.syncOnlinePartyGameSwitcherButtons(party);
  assert.equal(button.hidden, false);

  context.deviceId = 'guest-1';
  window.syncOnlinePartyGameSwitcherButtons(party);
  assert.equal(button.hidden, true);
});

test('switch picker selects the current game and disables over-capacity games', async () => {
  const { document, window } = createHarness({ playerCount: 17 });
  await window.openOnlinePartyGameSwitcher();

  const currentInput = document.querySelector('input[value="most-likely-to"]');
  assert.equal(currentInput.disabled, false);
  assert.equal(currentInput.checked, true);
  assert.equal(
    currentInput
      .closest('.party-game-switch-option')
      .classList.contains('is-selected'),
    true
  );
  assert.equal(
    document.querySelector('[data-party-switch-confirm]').disabled,
    true
  );
  assert.equal(
    document.querySelector('input[value="imposter"]').disabled,
    true
  );
  assert.equal(
    document.querySelector('input[value="paranoia"]').disabled,
    true
  );
  assert.equal(
    document.querySelector('input[value="truth-or-dare"]').disabled,
    false
  );
});

test('switch picker reuses homepage artwork and has no cancel action', async () => {
  const { document, window } = createHarness();
  await window.openOnlinePartyGameSwitcher();

  const paranoiaTile = document.querySelector(
    '.party-game-switch-option[data-gamemode="paranoia"]'
  );
  assert.ok(paranoiaTile.classList.contains('homepage-tile'));
  assert.ok(paranoiaTile.classList.contains('has-homepage-image'));
  assert.equal(
    paranoiaTile.querySelector('source').getAttribute('srcset'),
    '/images/homepage/mobile/paranoia.svg'
  );
  assert.equal(
    paranoiaTile.querySelector('img').getAttribute('src'),
    '/images/homepage/desktop/paranoia.svg'
  );
  assert.equal(document.querySelector('[data-party-switch-cancel]'), null);
  assert.ok(document.querySelector('[data-party-switch-confirm]'));
});

test('switch picker shows each game player-count range', async () => {
  const { document, window } = createHarness();
  await window.openOnlinePartyGameSwitcher();

  const truthOrDareDetail = document.querySelector(
    '.party-game-switch-option[data-gamemode="truth-or-dare"] .party-game-switch-option-detail'
  );
  const paranoiaDetail = document.querySelector(
    '.party-game-switch-option[data-gamemode="paranoia"] .party-game-switch-option-detail'
  );

  assert.equal(truthOrDareDetail.textContent, '2-20 players');
  assert.equal(paranoiaDetail.textContent, '3-15 players');
});

test('switch picker omits games unavailable to the current account', async () => {
  const { document, window } = createHarness({
    unavailableGamemodes: ['imposter', 'mafia']
  });
  await window.openOnlinePartyGameSwitcher();

  assert.equal(document.querySelector('input[value="imposter"]'), null);
  assert.equal(document.querySelector('input[value="mafia"]'), null);
  assert.ok(document.querySelector('input[value="paranoia"]'));
});

test('selecting a game previews its primary and secondary colours', async () => {
  const { document, window } = createHarness();
  await window.openOnlinePartyGameSwitcher();

  const dialog = document.querySelector('#party-game-switch-dialog');
  const paranoiaInput = document.querySelector('input[value="paranoia"]');
  const paranoiaTile = paranoiaInput.closest('.party-game-switch-option');
  const confirmButton = document.querySelector('[data-party-switch-confirm]');

  assert.equal(
    dialog.style.getPropertyValue('--party-switch-primary'),
    '#FFEE66'
  );
  paranoiaInput.checked = true;
  paranoiaInput.dispatchEvent(new window.Event('change', { bubbles: true }));

  assert.equal(paranoiaTile.classList.contains('is-selected'), true);
  assert.equal(
    dialog.style.getPropertyValue('--party-switch-primary'),
    '#9D8AFF'
  );
  assert.equal(
    dialog.style.getPropertyValue('--party-switch-secondary'),
    '#7F71B2'
  );
  assert.equal(confirmButton.disabled, false);

  const currentInput = document.querySelector('input[value="most-likely-to"]');
  currentInput.checked = true;
  currentInput.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(confirmButton.disabled, true);
});

test('switch picker uses the shared dismissible overlay stack', async () => {
  const { context, document, window } = createHarness();
  await window.openOnlinePartyGameSwitcher();

  const dialog = document.querySelector('#party-game-switch-dialog');
  assert.equal(dialog.tagName, 'DIV');
  assert.equal(dialog.getAttribute('role'), 'dialog');
  assert.equal(dialog.classList.contains('is-visible'), true);
  assert.equal(context.popUpClassArray.includes(dialog), true);

  context.toggleOverlay(false);
  assert.equal(dialog.classList.contains('is-visible'), false);
  assert.equal(context.popUpClassArray.includes(dialog), false);
});

test('switch destinations send the host to settings and guests to the lobby', () => {
  const { context, window } = createHarness();
  const transition = {
    partyId: 'ABC-123',
    toGamemode: 'mafia',
    hostComputerId: 'host-device'
  };

  assert.equal(
    window.getPartySwitchDestination(transition),
    '/mafia/settings?partyCode=ABC-123'
  );
  assert.equal(
    window.getPartySwitchSplashScreen(transition),
    '/images/splash-screens/mafia-settings.png'
  );
  context.deviceId = 'guest-1';
  assert.equal(window.getPartySwitchDestination(transition), '/ABC-123');
  assert.equal(
    window.getPartySwitchSplashScreen(transition),
    '/images/splash-screens/mafia.png'
  );
});

test('switched guests transition into the new lobby with its game splash', () => {
  const { context, transitions, window } = createHarness({
    url: 'https://overexposed.app/ABC-123'
  });
  context.deviceId = 'guest-1';

  assert.equal(
    window.handleOnlinePartyGameSwitched({
      partyId: 'ABC-123',
      fromGamemode: 'most-likely-to',
      toGamemode: 'mafia',
      gameId: 'MAF-NEW',
      hostComputerId: 'host-device'
    }),
    true
  );
  assert.deepEqual(transitions, [
    {
      destination: '/ABC-123',
      splashScreen: '/images/splash-screens/mafia.png'
    }
  ]);
});

test('lobby switch control uses the shared side-button shell and SVG icon', () => {
  const { document, party, window } = createHarness();
  party.state.phase = 'lobby';

  window.syncOnlinePartyGameSwitcherButtons(party);

  const button = document.querySelector('#change-party-game-side-button');
  assert.ok(button);
  assert.equal(button.classList.contains('side-button'), true);
  assert.equal(button.closest('.side-button-shell').hidden, false);
  assert.equal(
    button.querySelector('img').getAttribute('src'),
    '/images/icons/gamemode-settings/change-game.svg'
  );
  assert.equal(button.getAttribute('aria-label'), 'Change party game');
});

test('offline settings expose the shared switch control and omit force-online games', async () => {
  const { document, window } = createHarness();

  window.syncOfflinePartyGameSwitcherButton('most-likely-to');
  const button = document.querySelector('#change-party-game-side-button');
  assert.ok(button);
  assert.equal(button.closest('.side-button-shell').hidden, false);

  await window.openOfflinePartyGameSwitcher();
  assert.equal(
    document.querySelector('input[value="most-likely-to"]').disabled,
    false
  );
  assert.equal(
    document.querySelector('input[value="most-likely-to"]').checked,
    true
  );
  assert.equal(document.querySelector('input[value="mafia"]'), null);
  assert.equal(
    document.querySelector('.party-game-switch-heading p').textContent,
    'Choose another party game to play on this device.'
  );
});

test('offline game changes navigate to settings without calling the online switch API', async () => {
  const { document, requests, transitions, window } = createHarness();
  window.syncOfflinePartyGameSwitcherButton('most-likely-to');
  await window.openOfflinePartyGameSwitcher();

  const paranoiaInput = document.querySelector('input[value="paranoia"]');
  paranoiaInput.checked = true;
  paranoiaInput.dispatchEvent(new window.Event('change', { bubbles: true }));
  document
    .querySelector('.party-game-switch-form')
    .dispatchEvent(
      new window.Event('submit', { bubbles: true, cancelable: true })
    );
  await new Promise((resolve) => window.setTimeout(resolve, 0));

  assert.deepEqual(transitions, [
    {
      destination: '/paranoia/settings?playMode=offline',
      splashScreen: '/images/splash-screens/paranoia-settings.png'
    }
  ]);
  assert.deepEqual(
    requests.map(({ url }) => url),
    ['/api/homepage-tiles']
  );
});
