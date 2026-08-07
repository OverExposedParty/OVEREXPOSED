const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const visualizerScript = fs.readFileSync(
  path.join(
    __dirname,
    '../../public/scripts/oe-panel/party-games/room-visualizer.js'
  ),
  'utf8'
);
const partyGamesHydratorScript = fs.readFileSync(
  path.join(
    __dirname,
    '../../public/scripts/oe-panel/section-hydrator/oe-panel-section-hydrator-insights/party-games.js'
  ),
  'utf8'
);

test('room visualizer replaces the rooms grid and restores it on back', () => {
  const dom = new JSDOM(
    '<!doctype html><section data-oe-panel-grid="party-games-grid-1" aria-label="Series"><div id="table-view">Table</div><button class="oe-panel-grid-expand-button"></button></section>',
    { runScripts: 'dangerously' }
  );
  const { window } = dom;

  try {
    window.parseCustomisationString = (value) => {
      const [colour, head, eyes, mouth] = value.split(':');
      return { colour, head, eyes, mouth };
    };
    window.getFilePathByCustomisationId = (id) => `/oe/${id}.svg`;
    window.CreateImageStack = (customisation) => {
      const stack = window.document.createElement('div');
      stack.className = 'image-stack';
      Object.values(customisation).forEach((source) => {
        const image = window.document.createElement('img');
        image.src = source;
        stack.appendChild(image);
      });
      return stack;
    };
    window.OE_PANEL_PALETTES = {
      get(type, value) {
        if (type !== 'gamemode' || value !== 'truth-or-dare') return null;
        return { primary: '#66CCFF', secondary: '#427BB9' };
      }
    };
    window.eval(visualizerScript);

    const container = window.document.querySelector(
      '[data-oe-panel-grid="party-games-grid-1"]'
    );
    const tableView = window.document.getElementById('table-view');
    window.OE_PANEL_ROOM_VISUALIZER.render(container, {
      roomCode: 'ABCD',
      gameId: 'GAME-ONE',
      gamemode: 'truth-or-dare',
      roomStatus: 'Archived',
      playerCount: '2',
      hostUser: 'Alex',
      gameModeVersion: '2.1.0',
      releaseId: 'truth-or-dare@2.1.0+release-id',
      runtimeBuild: 'build-created',
      contentHash: 'content-hash-value',
      releaseCapturedAt: '2026-08-06T12:00:00.000Z',
      roomVisual: {
        players: [
          {
            username: 'Alex',
            userIcon: '1000:1100:1200:1300',
            isHost: true,
            accountType: 'Account',
            connectionStatus: 'Archived snapshot'
          },
          {
            username: 'Guest',
            userIcon: '0000:0100:0200:0300',
            accountType: 'Guest',
            connectionStatus: 'Archived snapshot'
          }
        ],
        selectedPacks: ['ice-breaker'],
        selectedPackDetails: [
          {
            key: 'ice-breaker',
            title: 'Ice Breaker',
            difficulty: 'cheeky, funny',
            restriction: 'sfw',
            colour: '#66CCFF',
            secondaryColour: '#427BB9'
          }
        ],
        gameRules: { rounds: 10, anonymousQuestions: true },
        gameRuleDetails: [
          {
            key: 'rounds',
            title: 'Rounds',
            buttonType: 'Increment',
            colour: 'var(--primarypagecolour)',
            secondaryColour: 'var(--secondarypagecolour)'
          },
          {
            key: 'anonymousQuestions',
            title: 'Anonymous Questions',
            buttonType: 'Toggle',
            colour: 'var(--primarypagecolour)',
            secondaryColour: 'var(--secondarypagecolour)'
          }
        ],
        roleCounts: {}
      },
      errors: [
        {
          message: 'Action failed',
          source: 'server',
          code: 'action_failed',
          phase: 'voting',
          gameModeVersion: '2.1.0',
          runtimeBuild: 'build-error',
          buildChanged: true
        }
      ]
    });

    assert.equal(tableView.isConnected, false);
    assert.equal(
      container.style.getPropertyValue('--oe-panel-widget-primary-colour'),
      '#66CCFF'
    );
    assert.equal(
      container.style.getPropertyValue('--oe-panel-widget-secondary-colour'),
      '#427BB9'
    );
    assert.equal(
      container.querySelector('.oe-panel-room-title').textContent,
      'Room ABCD'
    );
    assert.equal(
      container
        .querySelector('.oe-panel-room-back-button')
        .getAttribute('aria-label'),
      'Back to Rooms'
    );
    assert.equal(
      container.querySelector('.oe-panel-room-back-button').textContent,
      ''
    );
    assert.equal(
      container.querySelector('.oe-panel-room-title').nextElementSibling,
      container.querySelector('.oe-panel-room-status')
    );
    assert.deepEqual(
      [...container.querySelectorAll('.oe-panel-room-player-name')].map(
        (element) => element.textContent
      ),
      ['Alex', 'Guest']
    );
    assert.equal(container.querySelectorAll('.image-stack img').length, 8);
    assert.match(container.textContent, /Ice Breaker/);
    assert.equal(
      container.querySelector('.oe-panel-room-pack-button').disabled,
      true
    );
    assert.deepEqual(
      [
        ...container.querySelectorAll('.oe-panel-room-pack-difficulty-icon')
      ].map((image) => image.alt),
      ['Cheeky', 'Funny']
    );
    assert.match(container.textContent, /Rounds/);
    assert.equal(
      container.querySelector('.oe-panel-room-rule-count-value').textContent,
      '10'
    );
    assert.equal(
      container.querySelectorAll('.oe-panel-room-rule-count-button:disabled')
        .length,
      2
    );
    assert.equal(
      container.querySelector('.oe-panel-room-rule-toggle').disabled,
      true
    );
    assert.equal(
      container
        .querySelector('.oe-panel-room-rule-toggle')
        .classList.contains('is-active'),
      true
    );
    assert.match(container.textContent, /Build changed during game/);
    assert.equal(
      container
        .querySelector('.oe-panel-room-error')
        .classList.contains('is-build-changed'),
      true
    );
    assert.match(container.textContent, /Version2\.1\.0/);
    assert.equal(
      container.querySelector('[title="truth-or-dare@2.1.0+release-id"]')
        .textContent,
      'truth-or-dar…lease-id'
    );
    assert.doesNotMatch(container.textContent, /Role Counts/);
    assert.equal(
      container
        .querySelector('.oe-panel-room-meta-grid')
        .closest('.oe-panel-room-section')
        .querySelector('.oe-panel-room-section-title').textContent,
      'Room Details'
    );

    container.querySelector('.oe-panel-room-back-button').click();
    assert.equal(tableView.isConnected, true);
    assert.equal(container.getAttribute('aria-label'), 'Series');
    assert.equal(container.querySelector('.oe-panel-room-visualizer'), null);
    assert.equal(
      container.style.getPropertyValue('--oe-panel-widget-primary-colour'),
      ''
    );
  } finally {
    dom.window.close();
  }
});

test('party games hydrator adds readonly settings metadata to rooms', async () => {
  const dom = new JSDOM('<!doctype html>', { runScripts: 'dangerously' });
  const { window } = dom;

  try {
    window.OE_PANEL_PALETTES = { indexRows() {} };
    window.eval(partyGamesHydratorScript);
    const hydrator = window.createOePanelPartyGamesInsightsHydrator({
      panelData: {
        async fetchPartyRoomsData() {
          return {
            rooms: [
              {
                roomCode: 'ABCD',
                gamemode: 'truth-or-dare',
                roomVisual: {
                  selectedPacks: ['ice-breaker'],
                  gameRules: { rounds: 10 }
                }
              }
            ],
            packs: [
              {
                key: 'truth-or-dare:ice-breaker',
                slug: 'ice-breaker',
                packKey: 'truth-or-dare:ice-breaker',
                title: 'Ice Breaker',
                difficulty: 'cheeky, funny',
                restriction: 'sfw',
                details: {
                  colour: '#66CCFF',
                  secondaryColour: '#427BB9'
                }
              }
            ],
            rules: [
              {
                key: 'truth-or-dare:rounds',
                ruleKey: 'rounds',
                rule: 'Rounds',
                buttonType: 'Increment',
                colour: '#66CCFF',
                secondaryColour: '#427BB9'
              }
            ]
          };
        },
        async fetchDashboardActivityData() {
          return {};
        }
      }
    });
    const config = [
      {
        id: 'party-games-grid-1',
        tableSeries: [{ dataSource: 'partyRooms', rows: [] }]
      }
    ];

    assert.equal(await hydrator.hydrateSection('Party Games', config), true);
    assert.deepEqual(
      JSON.parse(
        JSON.stringify(
          config[0].tableSeries[0].rows[0].roomVisual.selectedPackDetails
        )
      ),
      [
        {
          key: 'ice-breaker',
          title: 'Ice Breaker',
          difficulty: 'cheeky, funny',
          restriction: 'sfw',
          colour: '#66CCFF',
          secondaryColour: '#427BB9'
        }
      ]
    );
    assert.deepEqual(
      JSON.parse(
        JSON.stringify(
          config[0].tableSeries[0].rows[0].roomVisual.gameRuleDetails
        )
      ),
      [
        {
          key: 'rounds',
          title: 'Rounds',
          buttonType: 'Increment',
          colour: '#66CCFF',
          secondaryColour: '#427BB9'
        }
      ]
    );
  } finally {
    dom.window.close();
  }
});

test('room visualizer gives errors their own row when role counts are present', () => {
  const dom = new JSDOM(
    '<!doctype html><section data-oe-panel-grid="party-games-grid-1"><div>Table</div></section>',
    { runScripts: 'dangerously' }
  );
  const { window } = dom;

  try {
    window.OE_PANEL_PALETTES = { get() {} };
    window.eval(visualizerScript);
    const container = window.document.querySelector(
      '[data-oe-panel-grid="party-games-grid-1"]'
    );

    window.OE_PANEL_ROOM_VISUALIZER.render(container, {
      roomCode: 'ROLES',
      roomVisual: {
        roleCounts: { detective: 1, civilian: 4 }
      },
      errors: []
    });

    const sections = [...container.querySelectorAll('.oe-panel-room-section')];
    const sectionByTitle = (title) =>
      sections.find(
        (section) =>
          section.querySelector('.oe-panel-room-section-title')?.textContent ===
          title
      );

    assert.ok(sectionByTitle('Role Counts'));
    assert.equal(
      sectionByTitle('Errors').classList.contains('oe-panel-room-section-wide'),
      true
    );
    assert.equal(
      sectionByTitle('Room State').classList.contains(
        'oe-panel-room-section-wide'
      ),
      false
    );
  } finally {
    dom.window.close();
  }
});
