const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const pageSource = fs.readFileSync(
  path.join(__dirname, '../../public/pages/olings/clash-settings.html'),
  'utf8'
);
const scriptSource = [
  '../../public/scripts/olings/clash/oe-layers.js',
  '../../public/scripts/olings/clash/settings/api.js',
  '../../public/scripts/olings/clash/settings/rules-summary.js',
  '../../public/scripts/olings/clash/settings/team-drag.js',
  '../../public/scripts/olings/clash/clash-lobby.js'
]
  .map((relativePath) =>
    fs.readFileSync(path.join(__dirname, relativePath), 'utf8')
  )
  .join('\n');
const selectorSource = fs.readFileSync(
  path.join(__dirname, '../../public/scripts/olings/shared/oling-selector.js'),
  'utf8'
);
const abilityDetailsSource = fs.readFileSync(
  path.join(__dirname, '../../public/scripts/olings/clash/ability-details.js'),
  'utf8'
);

function waitForTasks() {
  return new Promise((resolve) => setImmediate(resolve));
}

test('Clash lobby renders the current account and opponent insertion state', async () => {
  const dom = new JSDOM(pageSource, {
    runScripts: 'outside-only',
    url: 'https://overexposed.app/olings/clash/settings'
  });
  const { window } = dom;
  const loadedScripts = [];

  window.Ready = { isReady: () => true };
  window.parseCustomisationString = (value) => {
    const [colour, head, eyes, mouth] = value.split(':');
    return { colour, head, eyes, mouth };
  };
  window.getFilePathByCustomisationId = (id) => `/oe/${id}.svg`;
  window.SetScriptLoaded = (source) => loadedScripts.push(source);
  window.fetch = async () => ({
    ok: true,
    async json() {
      return {
        account: {
          username: 'CURRENT_PLAYER',
          oeIcon: '1000:2000:3000:4000',
          gameData: { level: 14 }
        }
      };
    }
  });

  window.eval(scriptSource);
  await waitForTasks();

  const localCard = window.document.querySelector(
    '[data-clash-player="local"]'
  );
  const opponentCard = window.document.querySelector(
    '[data-clash-player="opponent"]'
  );

  assert.equal(
    localCard.querySelector('[data-clash-player-name]').textContent,
    'CURRENT_PLAYER'
  );
  assert.equal(
    localCard.querySelector('[data-clash-player-level]').textContent,
    'LEVEL 14'
  );
  assert.equal(
    localCard.querySelectorAll('[data-clash-player-oe] img').length,
    4
  );
  assert.equal(opponentCard.classList.contains('is-empty'), true);
  assert.equal(
    opponentCard.querySelector('[data-clash-opponent-slot]').hidden,
    false
  );
  assert.equal(
    window.document.querySelectorAll(
      '[data-clash-rule-health] [data-clash-rule-heart="full"]'
    ).length,
    3
  );
  assert.equal(
    window.document
      .querySelector('[data-clash-rule-health]')
      .getAttribute('aria-label'),
    '3 hearts'
  );
  assert.equal(
    window.document.querySelectorAll(
      '[data-clash-rule-decisive] [data-clash-rule-heart="full"]'
    ).length,
    1
  );
  assert.equal(
    window.document.querySelectorAll(
      '[data-clash-rule-draw] [data-clash-rule-heart="half"]'
    ).length,
    1
  );
  assert.equal(
    window.document
      .querySelector('[data-clash-rule-draw]')
      .getAttribute('aria-label'),
    'Half a heart'
  );
  assert.deepEqual(loadedScripts, ['/scripts/olings/clash/clash-lobby.js']);

  dom.window.close();
});

test('Clash lobby replaces the opponent insertion with opponent details', async () => {
  const dom = new JSDOM(pageSource, {
    runScripts: 'outside-only',
    url: 'https://overexposed.app/olings/clash/settings'
  });
  const { window } = dom;

  window.Ready = { isReady: () => true };
  window.parseCustomisationString = (value) => {
    const [colour, head, eyes, mouth] = value.split(':');
    return { colour, head, eyes, mouth };
  };
  window.getFilePathByCustomisationId = (id) => `/oe/${id}.svg`;
  window.SetScriptLoaded = () => {};
  window.fetch = async () => ({
    ok: true,
    async json() {
      return { olings: [] };
    }
  });

  window.eval(scriptSource);
  await waitForTasks();

  const opponentCard = window.document.querySelector(
    '[data-clash-player="opponent"]'
  );
  window.OlingsClashLobby.setOpponent({
    username: 'RIVAL',
    oeIcon: '5000:6000:7000:8000',
    level: 22
  });

  assert.equal(opponentCard.classList.contains('is-empty'), false);
  assert.equal(
    opponentCard.querySelector('[data-clash-player-name]').textContent,
    'RIVAL'
  );
  assert.equal(
    opponentCard.querySelector('[data-clash-player-level]').textContent,
    'LEVEL 22'
  );
  assert.equal(
    opponentCard.querySelector('[data-clash-opponent-slot]').hidden,
    true
  );
  assert.equal(
    opponentCard.querySelectorAll('[data-clash-player-oe] img').length,
    4
  );

  window.OlingsClashLobby.setOpponent(null);
  assert.equal(opponentCard.classList.contains('is-empty'), true);
  assert.equal(
    opponentCard.querySelector('[data-clash-opponent-slot]').hidden,
    false
  );

  dom.window.close();
});

test('Clash team slots can cancel or save a shared Oling selector choice', async () => {
  const dom = new JSDOM(pageSource, {
    runScripts: 'outside-only',
    url: 'https://overexposed.app/olings/clash/settings'
  });
  const { window } = dom;
  const oling = {
    id: 'oling-1',
    name: 'Mossling',
    eggKey: 'base-egg',
    care: { energy: 80, maxEnergy: 100 },
    build: {
      flight: 'moss-wings',
      body: 'moss-body',
      eyes: 'moss-eyes',
      mouth: 'moss-mouth'
    },
    buildRarities: { body: 'uncommon' },
    clashRoles: ['support', 'guardian'],
    traits: {
      flight: {
        key: 'moss-wings',
        name: 'Moss Wings',
        assets: { image: '/olings/flight.svg' }
      },
      body: {
        key: 'moss-body',
        name: 'Moss Body',
        body: { health: 120 },
        assets: { image: '/olings/body.svg' }
      },
      eyes: {
        key: 'moss-eyes',
        name: 'Moss Eyes',
        assets: { image: '/olings/eyes.svg' }
      },
      mouth: {
        key: 'moss-mouth',
        name: 'Moss Mouth',
        assets: { image: '/olings/mouth.svg' }
      }
    }
  };

  window.Ready = { isReady: () => true };
  window.parseCustomisationString = (value) => {
    const [colour, head, eyes, mouth] = value.split(':');
    return { colour, head, eyes, mouth };
  };
  window.getFilePathByCustomisationId = (id) => `/oe/${id}.svg`;
  window.SetScriptLoaded = () => {};
  window.OlingFlightMotion = { configure() {} };
  window.fetch = async (url) => ({
    ok: true,
    async json() {
      if (url === '/api/olings/mine') return { olings: [oling] };
      if (url === '/json-files/olings/clash-abilities.json') {
        return {
          abilities: [
            ['mouth', 'Mend'],
            ['body', 'Cleanse'],
            ['flight', 'Wild Growth'],
            ['eyes', 'Canopy']
          ].map(([layer, name]) => ({
            description:
              name === 'Mend'
                ? 'Heal the most damaged benched Oling by 1/2 Heart.'
                : `${name} ability description.`,
            enabled: true,
            effects: [
              {
                mechanic: 'test-effect',
                target: { location: 'any', side: 'ally' }
              }
            ],
            imagePath: `/abilities/${layer}.svg`,
            isCurrent: true,
            key: `moss-${name.toLowerCase().replaceAll(' ', '-')}`,
            layer,
            name,
            roleTags: ['support'],
            traitKey: `moss-${layer === 'flight' ? 'wings' : layer}`
          }))
        };
      }
      return {
        account: {
          username: 'CURRENT_PLAYER',
          oeIcon: '1000:2000:3000:4000',
          gameData: { level: 14 }
        }
      };
    }
  });

  window.eval(selectorSource);
  window.eval(abilityDetailsSource);
  window.eval(scriptSource);
  await waitForTasks();

  const lobby = window.document.querySelector('.olings-clash-lobby');
  const firstSlotButton = window.document.querySelector(
    '.olings-clash-team-slot button'
  );
  const teamSlots = [
    ...window.document.querySelectorAll('.olings-clash-team-slot')
  ];

  assert.deepEqual(
    teamSlots.map((slot) =>
      slot.querySelector('[data-clash-team-name]').textContent.trim()
    ),
    ['OLING 1', 'OLING 2', 'OLING 3']
  );
  assert.equal(
    teamSlots.every(
      (slot) => slot.querySelector('[data-clash-team-roles]').hidden
    ),
    true
  );
  firstSlotButton.click();

  assert.equal(lobby.classList.contains('is-selecting-oling'), true);
  assert.equal(
    window.document.querySelectorAll('[data-clash-selector-preview] img')
      .length,
    4
  );
  assert.equal(
    window.document.querySelector('[data-clash-selector-details]'),
    null
  );
  assert.equal(
    window.document.querySelector('[data-clash-selector-energy]'),
    null
  );
  const abilityCards = [
    ...window.document.querySelectorAll('[data-clash-selector-ability]')
  ];
  assert.equal(abilityCards.length, 4);
  assert.deepEqual(
    abilityCards.map((card) =>
      card.querySelector('[data-clash-move-name]').textContent.trim()
    ),
    ['Mend', 'Cleanse', 'Wild Growth', 'Canopy']
  );
  assert.equal(abilityCards.at(-1).classList.contains('is-passive'), true);
  abilityCards[0].click();
  const abilityDialog = window.document.querySelector(
    '[data-clash-ability-details]'
  );
  assert.ok(abilityDialog);
  assert.equal(abilityDialog.querySelector('h2').textContent, 'Mend');
  assert.equal(
    abilityDialog.querySelector('.oling-clash-ability-dialog__close'),
    null
  );
  const detailArtwork = [
    ...abilityDialog.querySelectorAll('.oling-clash-ability-dialog__art')
  ];
  assert.equal(detailArtwork.length, 2);
  assert.match(detailArtwork[0].src, /\/abilities\/mouth\.svg$/);
  assert.match(detailArtwork[1].src, /\/olings\/mouth\.svg$/);
  const descriptionIcon = abilityDialog.querySelector(
    '.oling-clash-ability-dialog__inline-icon'
  );
  const detailPanel = abilityDialog.querySelector(
    '.oling-clash-ability-dialog__detail'
  );
  const detailHeader = detailPanel.querySelector(
    '.oling-clash-ability-dialog__detail-header'
  );
  const detailBack = detailHeader.querySelector(
    '.oling-clash-ability-dialog__detail-back'
  );
  const detailArt = detailHeader.querySelector(
    '.oling-clash-ability-dialog__detail-art'
  );
  assert.equal(
    detailPanel.querySelector('.oling-clash-ability-dialog__detail-visual'),
    null
  );
  assert.equal(
    detailPanel.querySelector('.oling-clash-ability-dialog__detail-copy'),
    null
  );
  assert.equal(detailBack.hidden, true);
  assert.match(detailArt.src, /\/abilities\/mouth\.svg$/);
  assert.match(
    descriptionIcon.src,
    /\/olings\/clash\/ui\/health\/hearts\/normal\/half\.svg$/
  );
  const descriptionIconButton = descriptionIcon.closest('button');
  assert.equal(descriptionIcon.alt, '');
  assert.equal(
    descriptionIconButton.getAttribute('aria-label'),
    'Learn about Heart'
  );
  assert.ok(
    abilityDialog.querySelector('.oling-clash-ability-dialog__fraction')
  );
  descriptionIconButton.click();
  assert.equal(detailPanel.dataset.detailMode, 'icon');
  assert.equal(
    abilityDialog.querySelector('.oling-clash-ability-dialog__detail-title')
      .textContent,
    'Heart'
  );
  assert.match(
    detailArt.src,
    /\/olings\/clash\/ui\/health\/hearts\/normal\/half\.svg$/
  );
  assert.equal(detailBack.hidden, false);
  assert.equal(
    detailBack.getAttribute('aria-label'),
    'Back to ability description'
  );
  assert.match(detailPanel.textContent, /normal health/i);
  detailBack.click();
  assert.equal(detailPanel.dataset.detailMode, 'ability');
  assert.equal(detailBack.hidden, true);
  assert.match(detailArt.src, /\/abilities\/mouth\.svg$/);
  assert.ok(
    abilityDialog.querySelector(
      '.oling-clash-ability-dialog__inline-icon-button'
    )
  );
  const previousAbilityRail = abilityDialog.querySelector(
    '.oling-clash-ability-dialog__rail.is-previous'
  );
  const nextAbilityRail = abilityDialog.querySelector(
    '.oling-clash-ability-dialog__rail.is-next'
  );
  assert.equal(previousAbilityRail.dataset.pressFeedback, 'none');
  assert.equal(nextAbilityRail.dataset.pressFeedback, 'none');
  abilityDialog
    .querySelector('.oling-clash-ability-dialog__inline-icon-button')
    .click();
  nextAbilityRail.click();
  assert.equal(abilityDialog.querySelector('h2').textContent, 'Cleanse');
  assert.equal(detailPanel.dataset.detailMode, 'ability');
  assert.equal(
    abilityDialog.querySelector('.oling-clash-ability-dialog__position')
      .textContent,
    '2/4'
  );
  window.document.dispatchEvent(
    new window.KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })
  );
  assert.equal(
    window.document.querySelector('[data-clash-ability-details]'),
    null
  );
  assert.equal(lobby.classList.contains('is-selecting-oling'), true);
  const footerButton = window.document.querySelector('[data-clash-ready]');
  const cancelButton = window.document.querySelector(
    '[data-clash-selector-cancel]'
  );
  assert.equal(footerButton.textContent.trim(), 'SAVE');
  assert.equal(footerButton.disabled, false);
  assert.equal(cancelButton.hidden, false);

  cancelButton.click();
  assert.equal(lobby.classList.contains('is-selecting-oling'), false);
  assert.equal(cancelButton.hidden, true);
  assert.equal(firstSlotButton.classList.contains('has-oling'), false);

  firstSlotButton.click();
  window.document.dispatchEvent(
    new window.KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })
  );
  assert.equal(lobby.classList.contains('is-selecting-oling'), false);
  assert.equal(firstSlotButton.classList.contains('has-oling'), false);

  firstSlotButton.click();
  assert.equal(footerButton.textContent.trim(), 'SAVE');

  footerButton.click();

  assert.equal(lobby.classList.contains('is-selecting-oling'), false);
  assert.equal(firstSlotButton.classList.contains('has-oling'), true);
  assert.equal(firstSlotButton.querySelectorAll('img').length, 4);
  assert.equal(
    teamSlots[0].querySelector('[data-clash-team-name]').textContent,
    'Mossling'
  );
  assert.equal(
    teamSlots[0].querySelector('[data-clash-team-roles]').textContent,
    'Support/Guardian'
  );
  assert.equal(
    teamSlots[0].querySelector('[data-clash-team-roles]').hidden,
    false
  );
  assert.equal(
    teamSlots[1].querySelector('[data-clash-team-roles]').hidden,
    true
  );
  assert.equal(
    JSON.parse(window.localStorage.getItem('olings-clash-team'))[0],
    'oling-1'
  );

  dom.window.close();
});

test('Clash lobby restores a saved Oling name and single role', async () => {
  const dom = new JSDOM(pageSource, {
    runScripts: 'outside-only',
    url: 'https://overexposed.app/olings/clash/settings'
  });
  const { window } = dom;
  const oling = {
    id: 'oling-restored',
    name: 'Ember',
    build: {},
    traits: {},
    clashRoles: ['striker']
  };

  window.Ready = { isReady: () => true };
  window.SetScriptLoaded = () => {};
  window.OlingFlightMotion = { configure() {} };
  window.localStorage.setItem(
    'olings-clash-team',
    JSON.stringify(['oling-missing', 'oling-restored', 'oling-also-missing'])
  );
  window.fetch = async (url) => ({
    ok: true,
    async json() {
      return url === '/api/olings/mine'
        ? { olings: [oling] }
        : { account: { username: 'CURRENT_PLAYER' } };
    }
  });

  window.eval(selectorSource);
  window.eval(scriptSource);
  await waitForTasks();

  const slots = [
    ...window.document.querySelectorAll('.olings-clash-team-slot')
  ];
  assert.equal(
    slots[1].querySelector('[data-clash-team-name]').textContent,
    'Ember'
  );
  assert.equal(
    slots[1].querySelector('[data-clash-team-roles]').textContent,
    'Striker'
  );
  assert.equal(slots[1].querySelector('[data-clash-team-roles]').hidden, false);
  assert.equal(slots[0].querySelector('[data-clash-team-roles]').hidden, true);
  assert.equal(
    slots[2].querySelector('[data-clash-team-name]').textContent.trim(),
    'OLING 3'
  );
  assert.deepEqual(
    JSON.parse(window.localStorage.getItem('olings-clash-team')),
    [null, 'oling-restored', null]
  );

  dom.window.close();
});

test('Clash lobby leaves a server-restored slot empty when its Oling is no longer owned', async () => {
  const dom = new JSDOM(pageSource, {
    runScripts: 'outside-only',
    url: 'https://overexposed.app/olings/clash/ABC-123'
  });
  const { window } = dom;
  const account = { id: 'host-account', username: 'HOST' };
  const olings = createOwnedOlings(3);
  window.localStorage.setItem(
    'olings-clash-team',
    JSON.stringify(olings.map((oling) => oling.id))
  );
  window.Ready = { isReady: () => true };
  window.SetScriptLoaded = () => {};
  window.fetch = async (url) => {
    if (url === '/api/accounts/me') return createJsonResponse({ account });
    if (url === '/api/olings/mine') return createJsonResponse({ olings });
    if (String(url).endsWith('/join')) {
      return createJsonResponse({
        match: {
          matchCode: 'ABC-123',
          status: 'waiting',
          players: [
            {
              accountId: account.id,
              username: account.username,
              slot: 'player-one',
              ready: false,
              team: [
                { playerOlingId: 'oling-1', teamSlot: 0 },
                { playerOlingId: 'oling-deleted', teamSlot: 1 },
                { playerOlingId: 'oling-3', teamSlot: 2 }
              ]
            }
          ]
        }
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  window.eval(selectorSource);
  window.eval(scriptSource);
  await waitForTasks();
  await waitForTasks();

  const slots = [
    ...window.document.querySelectorAll('.olings-clash-team-slot')
  ];
  assert.deepEqual(
    slots.map(
      (slot) => slot.querySelector('[data-clash-team-name]').textContent
    ),
    ['Oling 1', 'OLING 2', 'Oling 3']
  );
  assert.deepEqual(
    JSON.parse(window.localStorage.getItem('olings-clash-team')),
    ['oling-1', null, 'oling-3']
  );

  dom.window.close();
});

test('An empty Clash slot starts on the first unselected Oling', async () => {
  const dom = new JSDOM(pageSource, {
    runScripts: 'outside-only',
    url: 'https://overexposed.app/olings/clash/settings'
  });
  const { window } = dom;
  const account = { id: 'host-account', username: 'HOST' };
  const olings = createOwnedOlings(4);
  window.localStorage.setItem(
    'olings-clash-team',
    JSON.stringify(['oling-1', null, 'oling-3'])
  );
  window.Ready = { isReady: () => true };
  window.SetScriptLoaded = () => {};
  window.fetch = async (url) => {
    if (url === '/api/accounts/me') return createJsonResponse({ account });
    if (url === '/api/olings/mine') return createJsonResponse({ olings });
    if (url === '/api/olings/clashes') {
      return createJsonResponse({
        match: {
          matchCode: 'ABC-123',
          status: 'waiting',
          players: [
            {
              accountId: account.id,
              username: account.username,
              slot: 'player-one',
              ready: false,
              team: []
            }
          ]
        }
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  window.eval(selectorSource);
  window.eval(scriptSource);
  await waitForTasks();
  await waitForTasks();

  const slots = [
    ...window.document.querySelectorAll('.olings-clash-team-slot')
  ];
  const selectedLabel = window.document.querySelector(
    '[data-clash-selector-selected]'
  );
  const selectorPicker = window.document.querySelector(
    '[data-clash-selector-picker]'
  );
  const footerButton = window.document.querySelector('[data-clash-ready]');
  slots[1].querySelector('button').click();
  assert.equal(selectedLabel.hidden, true);
  assert.equal(selectorPicker.classList.contains('is-selected'), false);
  assert.equal(footerButton.textContent.trim(), 'SAVE');

  window.document.querySelector('[data-clash-selector-previous]').click();
  assert.equal(selectedLabel.hidden, false);
  assert.equal(selectorPicker.classList.contains('is-selected'), true);

  footerButton.click();
  assert.deepEqual(
    slots.map(
      (slot) => slot.querySelector('[data-clash-team-name]').textContent
    ),
    ['OLING 1', 'Oling 1', 'Oling 3']
  );
  assert.deepEqual(
    JSON.parse(window.localStorage.getItem('olings-clash-team')),
    [null, 'oling-1', 'oling-3']
  );

  dom.window.close();
});

test('Clash lobby swaps occupied Oling team slots', async () => {
  const dom = new JSDOM(pageSource, {
    runScripts: 'outside-only',
    url: 'https://overexposed.app/olings/clash/settings'
  });
  const { window } = dom;
  const account = { id: 'host-account', username: 'HOST' };
  const olings = createOwnedOlings(3);
  const pausedStates = [];
  const createMatch = (team = []) => ({
    matchCode: 'ABC-123',
    status: 'waiting',
    players: [
      {
        accountId: account.id,
        username: account.username,
        slot: 'player-one',
        ready: false,
        team
      }
    ]
  });
  window.localStorage.setItem(
    'olings-clash-team',
    JSON.stringify(olings.map((oling) => oling.id))
  );
  window.Ready = { isReady: () => true };
  window.SetScriptLoaded = () => {};
  window.OlingFlightMotion = {
    configure() {},
    setPaused(_root, paused) {
      pausedStates.push(paused);
    }
  };
  window.fetch = async (url) => {
    if (url === '/api/accounts/me') return createJsonResponse({ account });
    if (url === '/api/olings/mine') return createJsonResponse({ olings });
    if (url === '/api/olings/clashes') {
      return createJsonResponse({ match: createMatch() });
    }
    if (String(url).endsWith('/team')) {
      return createJsonResponse({
        match: createMatch(
          olings.map((oling, teamSlot) => ({
            playerOlingId: oling.id,
            teamSlot
          }))
        )
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  window.eval(selectorSource);
  window.eval(scriptSource);
  await waitForTasks();
  await waitForTasks();

  const slots = [
    ...window.document.querySelectorAll('.olings-clash-team-slot')
  ];
  window.document.elementFromPoint = () => slots[2];
  slots[0].querySelector('button').dispatchEvent(
    new window.MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX: 10,
      clientY: 10
    })
  );
  await new Promise((resolve) => window.setTimeout(resolve, 200));
  assert.equal(slots[0].classList.contains('is-dragging'), true);
  window.document.dispatchEvent(
    new window.MouseEvent('pointerup', {
      bubbles: true,
      button: 0,
      clientX: 30,
      clientY: 10
    })
  );

  assert.deepEqual(
    slots.map(
      (slot) => slot.querySelector('[data-clash-team-name]').textContent
    ),
    ['Oling 3', 'Oling 2', 'Oling 1']
  );
  assert.deepEqual(
    JSON.parse(window.localStorage.getItem('olings-clash-team')),
    ['oling-3', 'oling-2', 'oling-1']
  );
  assert.deepEqual(pausedStates.slice(-2), [true, false]);

  dom.window.close();
});

function createJsonResponse(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return payload;
    }
  };
}

function createOwnedOlings(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `oling-${index + 1}`,
    name: `Oling ${index + 1}`,
    build: {},
    traits: {},
    clashRoles: []
  }));
}

test('Clash settings creates an online room after team and mode selection', async () => {
  const dom = new JSDOM(pageSource, {
    runScripts: 'outside-only',
    url: 'https://overexposed.app/olings/clash/settings'
  });
  const { window } = dom;
  const requests = [];
  const account = { id: 'account-1', username: 'HOST', gameData: { level: 8 } };
  const olings = createOwnedOlings(3);
  let navigationPath = '';
  let splashTransition = null;

  window.localStorage.setItem(
    'olings-clash-team',
    JSON.stringify(olings.map((oling) => oling.id))
  );
  window.addEventListener('olings-clash:navigate', (event) => {
    navigationPath = event.detail?.path || '';
  });
  window.transitionSplashScreen = (destination, splashScreen) => {
    splashTransition = { destination, splashScreen };
  };

  window.Ready = { isReady: () => true };
  window.SetScriptLoaded = () => {};
  window.fetch = async (url, options = {}) => {
    requests.push({
      url,
      method: options.method || 'GET',
      body: options.body || ''
    });
    if (url === '/api/accounts/me') {
      return createJsonResponse({ account });
    }
    if (url === '/api/olings/mine') {
      return createJsonResponse({ olings });
    }
    if (url === '/api/olings/clashes') {
      return createJsonResponse({
        match: {
          matchCode: 'ABC-123',
          status: 'waiting',
          players: [
            {
              accountId: 'account-1',
              username: 'HOST',
              level: 8,
              team: [],
              ready: false
            }
          ]
        }
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  window.eval(scriptSource);
  await waitForTasks();
  await waitForTasks();

  const continueButton = window.document.querySelector('[data-clash-ready]');
  const modeSelection = window.document.querySelector(
    '[data-clash-mode-selection]'
  );
  assert.equal(modeSelection.hidden, false);
  window.document.querySelector('[data-clash-mode="online"]').click();
  assert.equal(modeSelection.hidden, true);
  assert.equal(continueButton.textContent, 'CREATE ONLINE CLASH');
  assert.equal(continueButton.disabled, false);
  continueButton.click();
  await waitForTasks();
  await waitForTasks();

  assert.equal(navigationPath, '/olings/clash/ABC-123');
  assert.deepEqual(splashTransition, {
    destination: '/olings/clash/ABC-123',
    splashScreen: '/images/splash-screens/olings/clash/settings.png'
  });
  assert.equal(
    requests.some(
      (request) =>
        request.url === '/api/olings/clashes' && request.method === 'POST'
    ),
    true
  );
  const createRequest = requests.find(
    (request) => request.url === '/api/olings/clashes'
  );
  assert.deepEqual(JSON.parse(createRequest.body).olingIds, [
    'oling-1',
    'oling-2',
    'oling-3'
  ]);

  dom.window.close();
});

test('Clash settings starts an AI match before opening the offline route', async () => {
  const dom = new JSDOM(pageSource, {
    runScripts: 'outside-only',
    url: 'https://overexposed.app/olings/clash/settings'
  });
  const { window } = dom;
  const account = { id: 'account-1', username: 'HOST' };
  const olings = createOwnedOlings(3);
  const requests = [];
  let navigationPath = '';
  let splashTransition = null;
  const host = {
    accountId: account.id,
    slot: 'player-one',
    team: olings.map((oling, teamSlot) => ({
      playerOlingId: oling.id,
      teamSlot
    }))
  };

  window.localStorage.setItem(
    'olings-clash-team',
    JSON.stringify(olings.map((oling) => oling.id))
  );
  window.addEventListener('olings-clash:navigate', (event) => {
    navigationPath = event.detail?.path || '';
  });
  window.transitionSplashScreen = (destination, splashScreen) => {
    splashTransition = { destination, splashScreen };
  };
  window.Ready = { isReady: () => true };
  window.SetScriptLoaded = () => {};
  window.fetch = async (url, options = {}) => {
    requests.push({ method: options.method || 'GET', url });
    if (url === '/api/accounts/me') return createJsonResponse({ account });
    if (url === '/api/olings/mine') return createJsonResponse({ olings });
    if (url === '/api/olings/clashes') {
      return createJsonResponse({
        match: { matchCode: 'AI1-234', status: 'waiting', players: [host] }
      });
    }
    if (String(url).endsWith('/ai-opponent')) {
      return createJsonResponse({
        match: {
          matchCode: 'AI1-234',
          status: 'ready',
          players: [
            host,
            {
              accountId: 'ai',
              username: 'CIRCUIT',
              slot: 'player-two',
              isAi: true,
              aiDifficulty: 0.45,
              ready: true
            }
          ]
        }
      });
    }
    if (String(url).endsWith('/start')) {
      return createJsonResponse({
        match: { matchCode: 'AI1-234', status: 'active', players: [] }
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  window.eval(scriptSource);
  await waitForTasks();
  await waitForTasks();
  window.document.querySelector('[data-clash-mode="ai"]').click();
  await waitForTasks();
  await waitForTasks();
  const startButton = window.document.querySelector('[data-clash-ready]');
  const matchupTab = window.document.querySelector('[data-clash-tab="online"]');
  const shareControls = window.document.querySelector(
    '[data-clash-share-controls]'
  );
  const aiControls = window.document.querySelector('[data-clash-ai-controls]');
  assert.equal(matchupTab.hidden, false);
  assert.equal(shareControls.hidden, true);
  assert.equal(aiControls.hidden, false);
  assert.equal(startButton.textContent, 'START AI CLASH');
  startButton.click();
  await waitForTasks();
  await waitForTasks();

  assert.equal(navigationPath, '/olings/clash');
  assert.deepEqual(splashTransition, {
    destination: '/olings/clash',
    splashScreen: '/images/splash-screens/olings/clash/game.png'
  });
  assert.equal(
    window.sessionStorage.getItem('olings-clash-offline-match'),
    'AI1-234'
  );
  assert.deepEqual(
    requests.filter(({ method }) => method === 'POST').map(({ url }) => url),
    [
      '/api/olings/clashes',
      '/api/olings/clashes/AI1-234/ai-opponent',
      '/api/olings/clashes/AI1-234/start'
    ]
  );

  dom.window.close();
});

test('Clash QR opens in a separate Party Games style dialog', async () => {
  const dom = new JSDOM(pageSource, {
    runScripts: 'outside-only',
    url: 'https://overexposed.app/olings/clash/ABC-123'
  });
  const { window } = dom;

  window.Ready = { isReady: () => true };
  window.SetScriptLoaded = () => {};
  window.fetch = async () => createJsonResponse({ olings: [] });

  window.eval(scriptSource);
  await waitForTasks();
  window.OlingsClashLobby.syncMatch({
    matchCode: 'ABC-123',
    status: 'waiting',
    players: [{ accountId: 'account-1' }]
  });

  const lobby = window.document.querySelector('.olings-clash-lobby');
  const gate = window.document.querySelector('[data-clash-gate]');
  const qrButton = window.document.querySelector('[data-clash-qr-code]');
  const qrDialog = window.document.querySelector('[data-clash-qr-dialog]');
  qrButton.focus();
  qrButton.click();

  assert.equal(qrDialog.hidden, false);
  assert.equal(qrDialog.getAttribute('aria-hidden'), 'false');
  assert.equal(lobby.inert, true);
  assert.equal(lobby.classList.contains('is-gated'), false);
  assert.equal(gate.hidden, true);
  assert.match(
    qrDialog.querySelector('[data-clash-qr-image]').src,
    /\/api\/party-qr\/ABC-123/
  );
  assert.equal(
    qrDialog.querySelector('[data-clash-qr-url]').textContent,
    'https://overexposed.app/olings/clash/ABC-123'
  );

  qrDialog.click();
  assert.equal(qrDialog.hidden, true);
  assert.equal(lobby.inert, false);
  assert.equal(window.document.activeElement, qrButton);

  dom.window.close();
});

test('Clash creator can fill the opponent slot with a generated AI player', async () => {
  const dom = new JSDOM(pageSource, {
    runScripts: 'outside-only',
    url: 'https://overexposed.app/olings/clash/ABC-123'
  });
  const { window } = dom;
  const requests = [];
  const account = { id: 'account-1', username: 'HOST', gameData: { level: 8 } };
  const host = {
    accountId: 'account-1',
    username: 'HOST',
    level: 8,
    slot: 'player-one',
    isAi: false,
    team: [],
    ready: false
  };
  const createMatch = (players) => ({
    matchCode: 'ABC-123',
    status: 'waiting',
    players
  });

  window.Ready = { isReady: () => true };
  window.SetScriptLoaded = () => {};
  window.parseCustomisationString = (value) => {
    const [colour, head, eyes, mouth] = value.split(':');
    return { colour, head, eyes, mouth };
  };
  window.getFilePathByCustomisationId = (id) => `/oe/${id}.svg`;
  window.fetch = async (url, options = {}) => {
    requests.push({
      url,
      method: options.method || 'GET',
      body: options.body ? JSON.parse(options.body) : null
    });
    if (url === '/api/accounts/me') return createJsonResponse({ account });
    if (url === '/api/olings/mine') {
      return createJsonResponse({ olings: createOwnedOlings(3) });
    }
    if (String(url).endsWith('/join')) {
      return createJsonResponse({ match: createMatch([host]) });
    }
    if (String(url).endsWith('/ai-opponent/difficulty')) {
      return createJsonResponse({
        match: createMatch([
          host,
          {
            accountId: 'ai-account',
            username: 'CIRCUIT',
            level: 12,
            oeIcon: '0400:0500:0200:0300',
            slot: 'player-two',
            isAi: true,
            aiDifficulty: options.body
              ? JSON.parse(options.body).difficulty
              : 0.45,
            ready: true,
            team: [{}, {}, {}]
          }
        ])
      });
    }
    if (String(url).endsWith('/ai-opponent')) {
      return createJsonResponse({
        match: createMatch([
          host,
          {
            accountId: 'ai-account',
            username: 'CIRCUIT',
            level: 12,
            oeIcon: '0400:0500:0200:0300',
            slot: 'player-two',
            isAi: true,
            aiDifficulty: 0.45,
            ready: true,
            team: [{}, {}, {}]
          }
        ])
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  window.eval(scriptSource);
  await waitForTasks();
  await waitForTasks();
  const addAiButton = window.document.querySelector(
    '[data-clash-opponent-slot]'
  );
  assert.equal(addAiButton.disabled, false);
  addAiButton.click();
  await waitForTasks();
  await waitForTasks();

  const opponentCard = window.document.querySelector(
    '[data-clash-player="opponent"]'
  );
  assert.equal(
    requests.some(
      (request) =>
        request.url === '/api/olings/clashes/ABC-123/ai-opponent' &&
        request.method === 'POST'
    ),
    true
  );
  assert.equal(
    opponentCard.querySelector('[data-clash-player-type]').textContent,
    'AI'
  );
  assert.equal(
    opponentCard.querySelector('[data-clash-player-name]').textContent,
    'CIRCUIT'
  );
  assert.equal(
    opponentCard.querySelector('[data-clash-player-ready]').textContent,
    'READY'
  );
  assert.equal(
    opponentCard
      .querySelector('[data-clash-player-ready]')
      .classList.contains('is-ready'),
    true
  );
  assert.equal(
    opponentCard.querySelectorAll('[data-clash-player-oe] img').length,
    4
  );
  assert.equal(addAiButton.hidden, true);

  const shareControls = window.document.querySelector(
    '[data-clash-share-controls]'
  );
  const aiControls = window.document.querySelector('[data-clash-ai-controls]');
  const difficulty = window.document.querySelector(
    '[data-clash-ai-difficulty]'
  );
  const playerCount = window.document.querySelector(
    '[data-clash-player-count]'
  );
  assert.equal(shareControls.hidden, true);
  assert.equal(aiControls.hidden, false);
  assert.equal(difficulty.value, '0.45');
  assert.equal(playerCount.textContent, 'SOLO CLASH');

  difficulty.value = '0.75';
  difficulty.dispatchEvent(new window.Event('change', { bubbles: true }));
  await waitForTasks();
  await waitForTasks();
  assert.equal(
    requests.some(
      (request) =>
        request.url === '/api/olings/clashes/ABC-123/ai-opponent/difficulty' &&
        request.method === 'POST' &&
        request.body?.difficulty === 0.75
    ),
    true
  );
  assert.equal(
    opponentCard.querySelector('[data-clash-ai-level]').textContent,
    'HARD AI'
  );

  dom.window.close();
});

test('Clash coded URL shows a not-found prompt when the lobby is missing', async () => {
  const dom = new JSDOM(pageSource, {
    runScripts: 'outside-only',
    url: 'https://overexposed.app/olings/clash/ZZZ-999'
  });
  const { window } = dom;

  window.Ready = { isReady: () => true };
  window.SetScriptLoaded = () => {};
  window.fetch = async (url) => {
    if (url === '/api/accounts/me') {
      return createJsonResponse({
        account: { id: 'account-2', username: 'JOINER' }
      });
    }
    if (url === '/api/olings/mine') {
      return createJsonResponse({ olings: createOwnedOlings(3) });
    }
    return createJsonResponse(
      {
        success: false,
        error: {
          code: 'oling_clash_not_found',
          message: 'That Oling Clash could not be found.'
        }
      },
      { ok: false, status: 404 }
    );
  };

  window.eval(scriptSource);
  await waitForTasks();
  await waitForTasks();

  assert.equal(
    window.document.querySelector('[data-clash-gate-title]').textContent,
    'CLASH NOT FOUND'
  );
  assert.equal(
    window.document.querySelector('[data-clash-gate-secondary]').textContent,
    'CREATE CLASH'
  );

  dom.window.close();
});

test('Clash eligibility blocks online requests when fewer than three Olings are owned', async () => {
  const dom = new JSDOM(pageSource, {
    runScripts: 'outside-only',
    url: 'https://overexposed.app/olings/clash/ABC-123'
  });
  const { window } = dom;
  const requests = [];

  window.Ready = { isReady: () => true };
  window.SetScriptLoaded = () => {};
  window.fetch = async (url) => {
    requests.push(url);
    if (url === '/api/accounts/me') {
      return createJsonResponse({
        account: { id: 'account-3', username: 'NEW PLAYER' }
      });
    }
    return createJsonResponse({ olings: createOwnedOlings(2) });
  };

  window.eval(scriptSource);
  await waitForTasks();
  await waitForTasks();

  assert.equal(
    window.document.querySelector('[data-clash-gate-title]').textContent,
    '3 OLINGS REQUIRED'
  );
  assert.match(
    window.document.querySelector('[data-clash-gate-message]').textContent,
    /currently have 2/
  );
  assert.equal(
    requests.some((url) => String(url).includes('/api/olings/clashes')),
    false
  );

  dom.window.close();
});

test('Clash host starts after the guest readies without readying themself', async () => {
  const dom = new JSDOM(pageSource, {
    runScripts: 'outside-only',
    url: 'https://overexposed.app/olings/clash/ABC-123'
  });
  const { window } = dom;
  const requests = [];
  let startedMatch = null;
  const account = { id: 'host-account', username: 'HOST' };
  const olings = createOwnedOlings(3);
  window.localStorage.setItem(
    'olings-clash-team',
    JSON.stringify(olings.map((oling) => oling.id))
  );
  window.addEventListener('olings-clash:match-started', (event) => {
    event.preventDefault();
    startedMatch = event.detail?.match || null;
  });
  const waitingMatch = {
    matchCode: 'ABC-123',
    status: 'ready',
    players: [
      {
        accountId: account.id,
        username: 'HOST',
        slot: 'player-one',
        ready: false,
        team: olings.map((oling, teamSlot) => ({
          playerOlingId: oling.id,
          teamSlot
        }))
      },
      {
        accountId: 'guest-account',
        username: 'GUEST',
        slot: 'player-two',
        ready: true,
        team: [{}, {}, {}]
      }
    ]
  };

  window.Ready = { isReady: () => true };
  window.SetScriptLoaded = () => {};
  window.fetch = async (url, options = {}) => {
    requests.push({ url, method: options.method || 'GET' });
    if (url === '/api/accounts/me') return createJsonResponse({ account });
    if (url === '/api/olings/mine') return createJsonResponse({ olings });
    if (String(url).endsWith('/join')) {
      return createJsonResponse({ match: waitingMatch });
    }
    if (String(url).endsWith('/start')) {
      return createJsonResponse({
        match: {
          ...waitingMatch,
          status: 'active',
          phase: 'selection',
          round: 1
        }
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  window.eval(scriptSource);
  await waitForTasks();
  await waitForTasks();

  const startButton = window.document.querySelector('[data-clash-ready]');
  assert.equal(startButton.textContent, 'START CLASH');
  assert.equal(startButton.disabled, false);
  startButton.click();
  await waitForTasks();
  await waitForTasks();

  assert.equal(
    requests.some(
      (request) =>
        request.url === '/api/olings/clashes/ABC-123/start' &&
        request.method === 'POST'
    ),
    true
  );
  assert.equal(startedMatch?.status, 'active');
  assert.equal(window.document.querySelector('[data-clash-game]'), null);

  dom.window.close();
});
