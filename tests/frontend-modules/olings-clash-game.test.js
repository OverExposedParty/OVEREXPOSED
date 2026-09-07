const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const createOlingClashPicker = require('../../public/scripts/olings/clash/game/renderers/picker');
const createOlingClashResolution = require('../../public/scripts/olings/clash/game/resolution');

const gameScript = [
  '../../public/scripts/olings/clash/game/online/match-normalizer.js',
  '../../public/scripts/olings/clash/clash-game.js'
]
  .map((relativePath) =>
    fs.readFileSync(path.join(__dirname, relativePath), 'utf8')
  )
  .join('\n');

function createGameDom({
  catalogAbilities = null,
  cleanse = false,
  online = false,
  overlaySystem = false,
  orientationBlocked = false,
  playbackSpies = false,
  reinforce = false,
  scheduledSteps = null,
  tutorial = false,
  transfusion = false,
  withFlow = false
} = {}) {
  const dom = new JSDOM(
    `
      <aside class="extra-menu-container">
        <button data-clash-menu-action hidden>FORFEIT CLASH</button>
      </aside>
      <main data-clash-game ${online ? 'data-clash-online' : ''}>
        <button data-clash-last-ability="local" hidden></button>
        <button data-clash-last-ability="opponent" hidden></button>
        <section data-clash-phase data-phase="choose-action"></section>
        <span data-clash-timer></span>
        <section data-clash-roster="local">
          <article
            data-clash-roster-slot="active"
            data-move-attack="MEND"
            data-move-draw="CANOPY"
            data-move-guard="CLEANSE"
            data-move-skill="WILD GROWTH"
          >
            <div class="olings-clash-roster-slot__icon">
              <img class="olings-clash-oling-layer is-flight" src="/moss-wings.svg">
              <img class="olings-clash-oling-layer is-body" src="/moss-body.svg">
              <img class="olings-clash-oling-layer is-eyes" src="/moss-eyes.svg">
              <img class="olings-clash-oling-layer is-mouth" src="/moss-mouth.svg">
            </div>
            <div class="olings-clash-roster-slot__status">
              <strong>MOSSY</strong>
              <div
                data-clash-health
                data-heart-units="6"
                data-overgrowth-units="0"
                data-shield-count="0"
              ></div>
              <div data-clash-effects aria-label="Mossy active effects"></div>
            </div>
          </article>
          <article
            data-clash-roster-slot="bench-1"
            data-move-attack="CRUSH"
            data-move-draw="HARDEN"
            data-move-guard="FORTIFY"
            data-move-skill="REINFORCE"
          >
            <div class="olings-clash-roster-slot__icon">
              <img class="olings-clash-oling-layer is-flight" src="/stone-wings.svg">
              <img class="olings-clash-oling-layer is-body" src="/stone-body.svg">
              <img class="olings-clash-oling-layer is-eyes" src="/stone-eyes.svg">
              <img class="olings-clash-oling-layer is-mouth" src="/stone-mouth.svg">
            </div>
            <div class="olings-clash-roster-slot__status">
              <strong>PEBBLE</strong>
              <div
                data-clash-health
                data-heart-units="6"
                data-overgrowth-units="0"
                data-shield-count="0"
              ></div>
              <div data-clash-effects aria-label="Pebble active effects"></div>
            </div>
          </article>
        </section>
        <section data-clash-actions>
          <div data-clash-action-summary aria-hidden="true"></div>
          <button data-clash-action="attack">ATTACK</button>
          <button data-clash-action="guard">GUARD</button>
          <button data-clash-action="skill">SKILL</button>
          <button data-clash-action="draw" data-clash-passive>DRAW</button>
          <button data-clash-action-confirm disabled>CONFIRM</button>
        </section>
        <section>
          <article data-clash-fighter="local">
            <div class="olings-clash-fighter__art" aria-hidden="true"></div>
          </article>
          <article data-clash-fighter="opponent">
            <div
              class="olings-clash-fighter__art"
              role="button"
              tabindex="-1"
              aria-disabled="true"
              data-clash-action-confirm-target
            ></div>
          </article>
        </section>
        <section data-clash-roster="opponent">
          <article data-clash-roster-slot="active">
            <div
              data-clash-health
              data-heart-units="6"
              data-overgrowth-units="0"
              data-shield-count="0"
            ></div>
          </article>
          <article data-clash-roster-slot="bench-1">
            <div
              data-clash-health
              data-heart-units="6"
              data-overgrowth-units="0"
              data-shield-count="0"
            ></div>
          </article>
          <article data-clash-roster-slot="bench-2">
            <div class="olings-clash-roster-slot__icon">
              <img class="olings-clash-oling-layer is-flight" src="/bone-wings.svg">
              <img class="olings-clash-oling-layer is-body" src="/bone-body.svg">
              <img class="olings-clash-oling-layer is-eyes" src="/bone-eyes.svg">
              <img class="olings-clash-oling-layer is-mouth" src="/bone-mouth.svg">
            </div>
            <div class="olings-clash-roster-slot__status">
              <strong>MARROW</strong>
              <div
                data-clash-health
                data-heart-units="6"
                data-overgrowth-units="0"
                data-shield-count="0"
              ></div>
              <div data-clash-effects aria-label="Marrow active effects"></div>
            </div>
          </article>
        </section>
        <button data-clash-tag-button data-team-slot="1" disabled>
          <img class="olings-clash-tag__icon" src="/tag.svg" alt="">
        </button>
        <button data-clash-tag-button data-team-slot="2" disabled>
          <img class="olings-clash-tag__icon" src="/tag.svg" alt="">
        </button>
        <section data-clash-end-game hidden>
          <article data-clash-end-player="local">
            <div data-clash-end-player-oe></div>
            <span data-clash-end-player-name></span>
          </article>
          <strong data-clash-end-result></strong>
          <small data-clash-end-detail></small>
          <article data-clash-end-player="opponent">
            <div data-clash-end-player-oe></div>
            <span data-clash-end-player-name></span>
          </article>
          <section data-clash-match-controls hidden>
            <button data-clash-rematch>REMATCH</button>
            <button data-clash-back-lobby>BACK TO LOBBY</button>
          </section>
        </section>
        <section data-clash-picker hidden>
          <h2 data-clash-picker-title></h2>
          <p data-clash-picker-description hidden></p>
          <div data-clash-picker-options></div>
          <div data-clash-picker-choices hidden></div>
          <button data-clash-picker-confirm></button>
        </section>
      </main>
      <section
        role="alertdialog"
        aria-modal="true"
        data-clash-forfeit-dialog
        hidden
      >
        <p data-clash-forfeit-eyebrow></p>
        <h2 data-clash-forfeit-title></h2>
        <p data-clash-forfeit-copy></p>
        <p data-clash-forfeit-status hidden></p>
        <button data-clash-forfeit-cancel>CANCEL</button>
        <button data-clash-forfeit-confirm>FORFEIT CLASH</button>
      </section>
    `,
    {
      runScripts: 'outside-only',
      url: tutorial
        ? 'https://overexposed.app/olings/clash/tutorial'
        : 'https://overexposed.app/olings/clash'
    }
  );

  dom.window.createOlingClashHealthRenderer = () => ({
    initialize() {},
    renderHealth() {}
  });
  dom.window.createOlingClashEffectRenderer = () => ({
    resolveIconPath(effect = {}) {
      return effect.key ? `/effects/${effect.key}.svg` : null;
    }
  });
  if (catalogAbilities) {
    dom.window.createOlingClashInspector = () => ({
      getAbility(_oling, partKey) {
        return catalogAbilities[partKey] || null;
      },
      loadAbilityCatalog() {
        return Promise.resolve(Object.keys(catalogAbilities).length);
      },
      isOpen() {
        return false;
      },
      open(_root, context) {
        dom.window.openedInspectorContext = context;
        return context;
      },
      render() {},
      close() {},
      selectAbility() {}
    });
  }
  dom.window.createOlingClashPicker = createOlingClashPicker;
  dom.window.createOlingClashPhaseRenderer = () => ({
    renderPhase(container, phase) {
      const normalizedPhase = String(phase || '').toLowerCase();
      dom.window.renderedPhases ||= [];
      dom.window.renderedPhases.push(normalizedPhase);
      container.dataset.phase = normalizedPhase;
      return { phase: normalizedPhase };
    },
    renderResult() {
      return { result: 'DRAW' };
    }
  });
  dom.window.clashTimerCalls = [];
  dom.window.createOlingClashTimer = () => ({
    start(_container, options) {
      dom.window.clashTimerCalls.push({ method: 'start', options });
    },
    stop(options) {
      dom.window.clashTimerCalls.push({ method: 'stop', options });
    }
  });
  dom.window.createOlingClashTagMotion = () => ({
    clear() {},
    play(_root, options) {
      dom.window.playedTag = options;
    },
    prepare(_root, options) {
      dom.window.preparedTag = options;
    }
  });
  dom.window.OlingClashOeLayers = {
    createLayers(oeIcon) {
      const layer = dom.window.document.createElement('img');
      layer.dataset.oeIcon = oeIcon;
      return [layer];
    }
  };
  if (Array.isArray(scheduledSteps)) {
    dom.window.setTimeout = (callback, delay) => {
      scheduledSteps.push({ callback, delay });
      return scheduledSteps.length;
    };
    dom.window.clearTimeout = () => {};
  }
  if (withFlow) {
    const state = {
      phase: 'waiting',
      playerEffects: { local: [], opponent: [] },
      selections: {
        localAction: null,
        localEffectChoice: null,
        localTagSlot: null
      },
      teams: {
        local: [
          {
            effects: cleanse
              ? [{ key: 'burn', name: 'Burn', type: 'negative' }]
              : [],
            health: { heartUnits: 4, maxHeartUnits: 6 },
            moves: {
              guard: cleanse ? 'CLEANSE' : 'GUARD',
              skill: reinforce
                ? 'REINFORCE'
                : transfusion
                  ? 'TRANSFUSION'
                  : 'SKILL'
            },
            name: 'FANG',
            parts: {}
          },
          {
            effects: cleanse
              ? [
                  {
                    key: 'suppressed',
                    name: 'Suppressed',
                    type: 'negative'
                  }
                ]
              : [],
            health: { heartUnits: 3, maxHeartUnits: 6 },
            name: 'MARROW',
            parts: {}
          },
          {
            effects: [],
            health: { heartUnits: 6, maxHeartUnits: 6 },
            name: 'SCRAP',
            parts: {}
          }
        ],
        opponent: [{ health: { heartUnits: 6 } }]
      }
    };
    dom.window.createOlingClashState = () => ({
      getAvailableBenchSlots: () => [1, 2],
      state
    });
    dom.window.createOlingClashResolution = createOlingClashResolution;
    dom.window.createOlingClashDemoOpponent = () => ({});
    dom.window.createOlingClashMatchRenderer = (options = {}) => {
      dom.window.resolveClashAbility = options.resolveAbility;
      return {
        render() {},
        renderAbilityReveal(_root, _state, details) {
          dom.window.lastAbilityReveal = details;
        },
        renderActionSummary(_root, _oling, action, options) {
          dom.window.lastActionSummaryRender = {
            action,
            phase: options.phase
          };
        },
        renderActions(
          _root,
          activeOling,
          selectedAction,
          playerEffects,
          result,
          tagQueued
        ) {
          dom.window.lastActionsRender = {
            activeOling,
            playerEffects,
            result,
            selectedAction,
            tagQueued
          };
        }
      };
    };
    dom.window.createOlingClashFlow = ({ hooks }) => ({
      pause() {
        return true;
      },
      resume() {
        return false;
      },
      selectAction(action, effectChoice) {
        dom.window.confirmedAction = action;
        dom.window.confirmedEffectChoice = effectChoice;
        state.selections.localAction = action;
        state.selections.localEffectChoice = effectChoice || null;
        hooks.onRender(state);
        state.phase = 'locked';
        hooks.onPhase({ durationMs: 0, phase: 'locked', phaseEndsAt: null });
        return true;
      },
      selectTag(slot, options) {
        dom.window.selectedFlowTag = { options, slot };
        state.selections.localTagSlot = slot;
        hooks.onRender(state);
        return true;
      },
      setOpponentAction(action) {
        dom.window.forcedOpponentAction = action;
        return true;
      },
      setOpponentQueuedTag(slot) {
        dom.window.queuedOpponentTagSlot = slot;
        return true;
      },
      setOpponentTag(slot) {
        dom.window.forcedOpponentTagSlot = slot;
        return true;
      },
      start() {
        state.phase = 'choose-action';
        hooks.onPhase({
          durationMs: 15000,
          phase: 'choose-action',
          phaseEndsAt: Date.now() + 15000
        });
      },
      state,
      stop() {}
    });
    dom.window.clashFlowHooks = null;
    const originalCreateFlow = dom.window.createOlingClashFlow;
    dom.window.createOlingClashFlow = (options) => {
      dom.window.clashFlowHooks = options.hooks;
      return originalCreateFlow(options);
    };
  }
  if (playbackSpies) {
    dom.window.revealSounds = [];
    dom.window.combatPlays = [];
    dom.window.createOlingClashAudio = () => ({
      playChooseAction() {},
      playReveal(winner) {
        dom.window.revealSounds.push(winner);
      },
      register() {}
    });
    dom.window.createOlingClashCombatMotion = () => ({
      play(_root, options) {
        dom.window.combatPlays.push(options);
      },
      renderPhase() {}
    });
  }
  if (overlaySystem) {
    dom.window.permanantElementClassArray = [];
    dom.window.addElementIfNotExists = (elements, element) => {
      if (!elements.includes(element)) elements.push(element);
      element.classList.add('is-visible');
      return true;
    };
    dom.window.removeElementIfExists = (elements, element) => {
      const index = elements.indexOf(element);
      if (index === -1) return false;
      elements.splice(index, 1);
      return true;
    };
  }
  if (orientationBlocked) {
    let releaseOrientation;
    dom.window.OERotateDevice = {
      blocked: true,
      waitUntilAllowed() {
        return new Promise((resolve) => {
          releaseOrientation = () => {
            dom.window.OERotateDevice.blocked = false;
            resolve();
          };
        });
      }
    };
    dom.window.releaseOrientation = () => releaseOrientation?.();
  }
  dom.window.eval(gameScript);
  return dom;
}

function createOnlineTeam(prefix) {
  return Array.from({ length: 3 }, (_, teamSlot) => ({
    teamSlot,
    playerOlingId: `${prefix}-${teamSlot}`,
    heartUnits: 6,
    maxHeartUnits: 6,
    snapshot: {
      name: `${prefix.toUpperCase()} ${teamSlot + 1}`,
      abilities: [],
      build: {
        body: 'moss-body',
        eyes: 'moss-eyes',
        flight: 'moss-wings',
        mouth: 'moss-mouth'
      },
      traits: {}
    },
    statuses: []
  }));
}

test('Offline Clash waits for landscape before starting its first round', async () => {
  const dom = createGameDom({ orientationBlocked: true, withFlow: true });

  assert.equal(dom.window.OlingClashGame.state.phase, 'waiting');
  assert.equal(
    dom.window.clashTimerCalls.some(({ method }) => method === 'start'),
    false
  );

  dom.window.releaseOrientation();
  await Promise.resolve();

  assert.equal(dom.window.OlingClashGame.state.phase, 'choose-action');
  assert.equal(dom.window.clashTimerCalls.at(-1).method, 'start');
  dom.window.close();
});

test('Clash menu offers a confirmed tutorial exit without showing Forfeit', () => {
  const dom = createGameDom({ tutorial: true, withFlow: true });
  const menuAction = dom.window.document.querySelector(
    '[data-clash-menu-action]'
  );
  const dialog = dom.window.document.querySelector(
    '[data-clash-forfeit-dialog]'
  );

  assert.equal(menuAction.hidden, false);
  assert.equal(menuAction.textContent, 'EXIT TUTORIAL');
  assert.equal(menuAction.classList.contains('is-clash-forfeit'), false);
  menuAction.click();
  assert.equal(dialog.hidden, false);
  assert.equal(
    dialog.querySelector('[data-clash-forfeit-title]').textContent,
    'EXIT THIS TUTORIAL?'
  );
  assert.equal(
    dialog.querySelector('[data-clash-forfeit-confirm]').textContent,
    'EXIT TUTORIAL'
  );
  dialog.querySelector('[data-clash-forfeit-cancel]').click();
  assert.equal(dialog.hidden, true);

  dom.window.close();
});

test('Online Clash Forfeit awards the opponent and preserves the rematch lobby', async () => {
  const dom = createGameDom({ online: true, withFlow: true });
  const game = dom.window.OlingClashGame;
  const requests = [];
  const players = [
    {
      accountId: 'host-account',
      username: 'HOST',
      oeIcon: 'host-oe',
      slot: 'player-one',
      activeTeamSlot: 0,
      selectionCommitted: false,
      statuses: [],
      team: createOnlineTeam('host')
    },
    {
      accountId: 'guest-account',
      username: 'GUEST',
      oeIcon: 'guest-oe',
      slot: 'player-two',
      activeTeamSlot: 0,
      selectionCommitted: false,
      statuses: [],
      team: createOnlineTeam('guest')
    }
  ];
  const activeMatch = {
    gameId: 'OCL-FORFEIT',
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 3,
    players
  };
  const resolvedMatch = {
    ...activeMatch,
    status: 'completed',
    phase: 'complete',
    endReason: 'surrender',
    winnerAccountId: 'guest-account'
  };
  const rematchMatch = {
    ...activeMatch,
    gameId: 'OCL-REMATCH',
    status: 'waiting',
    phase: 'waiting',
    round: 0
  };
  dom.window.fetch = async (url, options) => {
    requests.push({ options, url });
    return {
      ok: true,
      async json() {
        return {
          archiveId: 'archive-forfeit',
          forfeitResult: {
            defeatedPlayerSlots: ['player-one'],
            endReason: 'surrender',
            forfeitedPlayerSlot: 'player-one',
            winnerSlot: 'player-two'
          },
          match: rematchMatch,
          resolvedMatch
        };
      }
    };
  };

  game.useOnlineMatch(activeMatch, 'host-account');
  const menuAction = dom.window.document.querySelector(
    '[data-clash-menu-action]'
  );
  const dialog = dom.window.document.querySelector(
    '[data-clash-forfeit-dialog]'
  );
  assert.equal(menuAction.hidden, false);
  assert.equal(menuAction.textContent, 'FORFEIT CLASH');
  assert.equal(menuAction.classList.contains('is-clash-forfeit'), true);

  menuAction.click();
  assert.equal(dialog.hidden, false);
  assert.equal(
    dialog.querySelector('[data-clash-forfeit-confirm]').textContent,
    'FORFEIT CLASH'
  );
  dialog.querySelector('[data-clash-forfeit-confirm]').click();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/olings/clashes/ABC-123/forfeit');
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(dialog.hidden, true);
  assert.equal(menuAction.hidden, true);
  assert.equal(
    dom.window.document.querySelector('[data-clash-end-result]').textContent,
    'DEFEAT'
  );
  assert.equal(
    dom.window.document.querySelector('[data-clash-end-detail]').textContent,
    'YOU FORFEITED THE CLASH'
  );
  assert.equal(
    dom.window.document.querySelector('[data-clash-match-controls]').hidden,
    false
  );

  dom.window.close();
});

test('Online Clash always maps the current player to the local left side', () => {
  const dom = createGameDom({ online: true, withFlow: true });
  const game = dom.window.OlingClashGame;
  const guestTeam = createOnlineTeam('guest');
  guestTeam[0].snapshot.abilities = [
    {
      imagePath: '/images/olings/clash/abilities/moss/wild-growth.svg',
      layer: 'flight',
      name: 'Wild Growth'
    }
  ];

  game.useOnlineMatch(
    {
      gameId: 'OCL-ONLINE',
      matchCode: 'ABC-123',
      status: 'active',
      phase: 'selection',
      round: 1,
      players: [
        {
          accountId: 'host-account',
          slot: 'player-one',
          activeTeamSlot: 0,
          selectionCommitted: false,
          statuses: [],
          team: createOnlineTeam('host')
        },
        {
          accountId: 'guest-account',
          slot: 'player-two',
          activeTeamSlot: 0,
          selectionCommitted: false,
          statuses: [],
          team: guestTeam
        }
      ]
    },
    'guest-account'
  );

  assert.equal(game.state.teams.local[0].name, 'GUEST 1');
  assert.equal(game.state.teams.opponent[0].name, 'HOST 1');
  assert.equal(game.state.phase, 'choose-action');
  assert.equal(
    dom.window.resolveClashAbility(game.state.teams.local[0], 'flight')
      .imagePath,
    '/images/olings/clash/abilities/moss/wild-growth.svg'
  );

  dom.window.close();
});

test('Last-round ability tiles open the Oling that played them', () => {
  const dom = createGameDom({
    catalogAbilities: {},
    online: true,
    withFlow: true
  });
  const game = dom.window.OlingClashGame;
  game.useOnlineMatch(
    {
      gameId: 'OCL-LAST-ABILITY',
      matchCode: 'ABC-123',
      status: 'active',
      phase: 'selection',
      round: 2,
      players: [
        {
          accountId: 'host',
          slot: 'player-one',
          activeTeamSlot: 0,
          selectionCommitted: false,
          statuses: [],
          team: createOnlineTeam('host')
        },
        {
          accountId: 'guest',
          slot: 'player-two',
          activeTeamSlot: 0,
          selectionCommitted: false,
          statuses: [],
          team: createOnlineTeam('guest')
        }
      ]
    },
    'host'
  );
  const tile = dom.window.document.querySelector(
    '[data-clash-last-ability="local"]'
  );
  tile.dataset.teamSlot = '1';
  tile.hidden = false;
  tile.click();

  assert.equal(dom.window.openedInspectorContext.side, 'local');
  assert.equal(dom.window.openedInspectorContext.index, 1);
  assert.equal(dom.window.openedInspectorContext.oling.name, 'HOST 2');
  assert.equal(dom.window.openedInspectorContext.returnFocus, tile);
  dom.window.close();
});

test('Roster inspection remains bound to each Oling after Tags and knockouts reorder the team', () => {
  const dom = createGameDom({
    catalogAbilities: {},
    online: true,
    withFlow: true
  });
  const game = dom.window.OlingClashGame;
  const localTeam = createOnlineTeam('host');
  localTeam[0] = {
    ...localTeam[0],
    defeated: true,
    heartUnits: 0
  };
  game.useOnlineMatch(
    {
      gameId: 'OCL-INSPECT-IDENTITY',
      matchCode: 'ABC-123',
      status: 'active',
      phase: 'selection',
      round: 4,
      players: [
        {
          accountId: 'host',
          slot: 'player-one',
          activeTeamSlot: 2,
          selectionCommitted: false,
          statuses: [],
          team: localTeam
        },
        {
          accountId: 'guest',
          slot: 'player-two',
          activeTeamSlot: 0,
          selectionCommitted: false,
          statuses: [],
          team: createOnlineTeam('guest')
        }
      ]
    },
    'host'
  );

  const triggers = [
    ...dom.window.document.querySelectorAll(
      '[data-clash-roster="local"] .olings-clash-roster-slot__icon'
    )
  ];
  triggers[0].dataset.clashInspectSide = 'local';
  triggers[0].dataset.olingId = 'host-2';
  triggers[0].dataset.teamSlot = '2';
  triggers[1].dataset.clashInspectSide = 'local';
  triggers[1].dataset.olingId = 'host-0';
  triggers[1].dataset.teamSlot = '0';
  assert.deepEqual(
    triggers.map((trigger) => trigger.dataset.olingId),
    ['host-2', 'host-0']
  );
  assert.deepEqual(
    triggers.map((trigger) => trigger.dataset.teamSlot),
    ['2', '0']
  );

  game.state.teams.local.sort(
    (left, right) => Number(left.teamSlot) - Number(right.teamSlot)
  );
  triggers[0].click();
  assert.equal(dom.window.openedInspectorContext.oling.id, 'host-2');
  assert.equal(dom.window.openedInspectorContext.index, 2);

  triggers[1].click();
  assert.equal(dom.window.openedInspectorContext.oling.id, 'host-0');
  assert.equal(dom.window.openedInspectorContext.index, 0);
  dom.window.close();
});

test('Online Clash swaps only the incoming and outgoing roster positions', () => {
  const dom = createGameDom({
    catalogAbilities: {},
    online: true,
    withFlow: true
  });
  const game = dom.window.OlingClashGame;
  const createMatch = (activeTeamSlot, round) => ({
    gameId: 'OCL-ROSTER-SWAP',
    matchCode: 'SWP-123',
    status: 'active',
    phase: 'selection',
    round,
    players: [
      {
        accountId: 'host',
        slot: 'player-one',
        activeTeamSlot,
        selectionCommitted: false,
        statuses: [],
        team: createOnlineTeam('host')
      },
      {
        accountId: 'guest',
        slot: 'player-two',
        activeTeamSlot: 0,
        selectionCommitted: false,
        statuses: [],
        team: createOnlineTeam('guest')
      }
    ]
  });

  game.useOnlineMatch(createMatch(0, 1), 'host');
  assert.equal(
    game.state.teams.local.map((oling) => oling.teamSlot).join(','),
    '0,1,2'
  );
  game.useOnlineMatch(createMatch(2, 2), 'host');
  assert.equal(
    game.state.teams.local.map((oling) => oling.teamSlot).join(','),
    '2,1,0'
  );

  dom.window.close();
});

test('Clash updates matching presentation copy without replacing snapshot mechanics', () => {
  const currentDescription = 'Every second survived Draw, gain 1 Shield.';
  const dom = createGameDom({
    catalogAbilities: {
      eyes: {
        cadence: {
          consumeWhenPrevented: true,
          every: 2,
          mode: 'cumulative',
          retainWhileBenched: true
        },
        description: currentDescription,
        imagePath: '/images/olings/clash/abilities/stone/harden.svg',
        key: 'stone-harden',
        name: 'Harden',
        revision: 2
      }
    },
    withFlow: true
  });
  const staleSnapshot = {
    snapshot: {
      abilities: [
        {
          description: 'Gain 1 Shield.',
          key: 'stone-harden',
          layer: 'eyes',
          name: 'Harden',
          revision: 2
        }
      ]
    }
  };

  const currentAbility = dom.window.resolveClashAbility(staleSnapshot, 'eyes');
  assert.equal(currentAbility.description, currentDescription);
  assert.equal(currentAbility.cadence, undefined);

  staleSnapshot.snapshot.abilities[0].cadence = { every: 3 };
  assert.deepEqual(
    dom.window.resolveClashAbility(staleSnapshot, 'eyes').cadence,
    { every: 3 }
  );

  staleSnapshot.snapshot.abilities[0].revision = 1;
  assert.equal(
    dom.window.resolveClashAbility(staleSnapshot, 'eyes').description,
    'Gain 1 Shield.'
  );
  assert.deepEqual(
    dom.window.resolveClashAbility(staleSnapshot, 'eyes').cadence,
    { every: 3 }
  );

  dom.window.close();
});

test('Online Clash preserves an unconfirmed local draft when the opponent commits', () => {
  const dom = createGameDom({ online: true, withFlow: true });
  const game = dom.window.OlingClashGame;
  const createPlayer = (accountId, slot, selectionCommitted = false) => ({
    accountId,
    slot,
    activeTeamSlot: 0,
    selection: null,
    selectionCommitted,
    statuses: [],
    team: createOnlineTeam(accountId)
  });
  const initialMatch = {
    gameId: 'OCL-DRAFT',
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    players: [
      createPlayer('host', 'player-one'),
      createPlayer('guest', 'player-two')
    ]
  };
  const skillButton = dom.window.document.querySelector(
    '[data-clash-action="skill"]'
  );
  const confirmButton = dom.window.document.querySelector(
    '[data-clash-action-confirm]'
  );
  const tagButton = dom.window.document.querySelector(
    '[data-clash-tag-button][data-team-slot="1"]'
  );

  game.useOnlineMatch(initialMatch, 'host');
  skillButton.click();
  tagButton.click();
  game.useOnlineMatch(
    {
      ...initialMatch,
      players: [
        createPlayer('host', 'player-one'),
        createPlayer('guest', 'player-two', true)
      ]
    },
    'host'
  );

  assert.equal(game.state.phase, 'choose-action');
  assert.equal(skillButton.classList.contains('is-selected'), true);
  assert.equal(confirmButton.disabled, false);
  assert.equal(game.getSelectedTagTeamSlot(), '1');

  game.useOnlineMatch(
    {
      ...initialMatch,
      round: 2,
      players: [
        createPlayer('host', 'player-one'),
        createPlayer('guest', 'player-two')
      ]
    },
    'host'
  );

  assert.equal(skillButton.classList.contains('is-selected'), false);
  assert.equal(confirmButton.disabled, true);
  assert.equal(game.getSelectedTagTeamSlot(), null);

  dom.window.close();
});

test('Online Clash keeps a local confirmation locked across a stale room update', async () => {
  const dom = createGameDom({ online: true, withFlow: true });
  const game = dom.window.OlingClashGame;
  let finishRequest;
  const createPlayer = (
    accountId,
    slot,
    { selection = null, selectionCommitted = false } = {}
  ) => ({
    accountId,
    slot,
    activeTeamSlot: 0,
    selection,
    selectionCommitted,
    statuses: [],
    team: createOnlineTeam(accountId)
  });
  const initialMatch = {
    gameId: 'OCL-PENDING-DRAFT',
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    players: [
      createPlayer('host', 'player-one'),
      createPlayer('guest', 'player-two')
    ]
  };
  dom.window.fetch = () =>
    new Promise((resolve) => {
      finishRequest = resolve;
    });

  game.useOnlineMatch(initialMatch, 'host');
  game.toggleAction('attack');
  game.confirmAction();
  game.useOnlineMatch(
    {
      ...initialMatch,
      players: [
        createPlayer('host', 'player-one'),
        createPlayer('guest', 'player-two', { selectionCommitted: true })
      ]
    },
    'host'
  );

  const attackButton = dom.window.document.querySelector(
    '[data-clash-action="attack"]'
  );
  assert.equal(game.state.phase, 'waiting');
  assert.equal(attackButton.classList.contains('is-selected'), true);

  finishRequest({
    ok: true,
    async json() {
      return {
        match: {
          ...initialMatch,
          players: [
            createPlayer('host', 'player-one', {
              selection: { action: 'attack', tagTeamSlot: null },
              selectionCommitted: true
            }),
            createPlayer('guest', 'player-two', {
              selectionCommitted: true
            })
          ]
        }
      };
    }
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(game.state.phase, 'waiting');
  assert.equal(attackButton.classList.contains('is-selected'), true);

  dom.window.close();
});

test('Clash tutorial starts its scripted teams, health and Extras', () => {
  const dom = createGameDom({ tutorial: true });
  const activeLocal = dom.window.document.querySelector(
    '[data-clash-roster="local"] [data-clash-roster-slot="active"]'
  );
  const firstLocalBench = dom.window.document.querySelector(
    '[data-clash-roster="local"] [data-clash-roster-slot="bench-1"]'
  );
  const activeLocalHealth = dom.window.document.querySelector(
    '[data-clash-roster="local"] [data-clash-roster-slot="active"] [data-clash-health]'
  );
  const activeEnemyHealth = dom.window.document.querySelector(
    '[data-clash-roster="opponent"] [data-clash-roster-slot="active"] [data-clash-health]'
  );
  const secondEnemyHealth = dom.window.document.querySelector(
    '[data-clash-roster="opponent"] [data-clash-roster-slot="bench-1"] [data-clash-health]'
  );
  const thirdEnemy = dom.window.document.querySelector(
    '[data-clash-roster="opponent"] [data-clash-roster-slot="bench-2"]'
  );
  const thirdEnemyHealth = thirdEnemy.querySelector('[data-clash-health]');

  assert.equal(
    activeLocal.querySelector('.olings-clash-roster-slot__status > strong')
      .textContent,
    'PEBBLE'
  );
  assert.match(
    activeLocal.querySelector('.olings-clash-oling-layer.is-body').src,
    /stone-body\.svg$/
  );
  assert.equal(activeLocal.dataset.moveAttack, 'CRUSH');
  assert.equal(activeLocalHealth.dataset.heartUnits, '1');
  assert.equal(activeLocalHealth.dataset.overgrowthUnits, '0');
  assert.equal(activeLocalHealth.dataset.shieldCount, '0');
  assert.equal(
    firstLocalBench.querySelector('.olings-clash-roster-slot__status > strong')
      .textContent,
    'MOSSY'
  );
  assert.match(
    firstLocalBench.querySelector('.olings-clash-oling-layer.is-body').src,
    /moss-body\.svg$/
  );
  assert.equal(firstLocalBench.dataset.moveAttack, 'MEND');
  assert.equal(
    firstLocalBench.querySelector('[data-clash-health]').dataset.heartUnits,
    '6'
  );
  assert.equal(activeEnemyHealth.dataset.heartUnits, '6');
  assert.equal(activeEnemyHealth.dataset.overgrowthUnits, '0');
  assert.equal(activeEnemyHealth.dataset.shieldCount, '0');
  assert.equal(secondEnemyHealth.dataset.overgrowthUnits, '0');
  assert.equal(secondEnemyHealth.dataset.heartUnits, '6');
  assert.equal(secondEnemyHealth.dataset.shieldCount, '0');
  assert.equal(thirdEnemyHealth.dataset.overgrowthUnits, '2');
  assert.equal(thirdEnemyHealth.dataset.shieldCount, '0');
  assert.equal(
    thirdEnemy.querySelector('.olings-clash-roster-slot__status > strong')
      .textContent,
    'MOSS'
  );
  assert.match(
    thirdEnemy.querySelector('.olings-clash-oling-layer.is-body').src,
    /moss-body\.svg$/
  );
  assert.equal(thirdEnemy.dataset.moveSkill, 'WILD GROWTH');
});

test('Online Clash replays server rounds with the original phase timings', () => {
  const scheduledSteps = [];
  const dom = createGameDom({
    online: true,
    scheduledSteps,
    withFlow: true
  });
  const game = dom.window.OlingClashGame;
  const createPlayer = (accountId, slot, activeTeamSlot = 0) => ({
    accountId,
    username: accountId.toUpperCase(),
    oeIcon: `${accountId}-oe`,
    slot,
    activeTeamSlot,
    selectionCommitted: false,
    statuses: [],
    team: createOnlineTeam(accountId)
  });
  const initialMatch = {
    gameId: 'OCL-TIMED',
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    phaseEndsAt: new Date(Date.now() + 15000).toISOString(),
    round: 1,
    players: [
      createPlayer('host', 'player-one'),
      createPlayer('guest', 'player-two')
    ]
  };
  const resolvedMatch = {
    ...initialMatch,
    phaseEndsAt: new Date(Date.now() + 22200).toISOString(),
    round: 2,
    players: [
      createPlayer('host', 'player-one', 1),
      createPlayer('guest', 'player-two')
    ]
  };
  game.useOnlineMatch(initialMatch, 'host');
  const queuedTagButton = dom.window.document.querySelector(
    '[data-clash-tag-button][data-team-slot="1"]'
  );
  const queuedTagIcon = queuedTagButton.querySelector(
    '.olings-clash-tag__icon'
  );
  queuedTagButton.click();
  assert.equal(queuedTagButton.classList.contains('is-tag-spinning'), true);

  game.handleOnlineRoundResult({
    gameId: initialMatch.gameId,
    match: resolvedMatch,
    result: {
      actions: { 'player-one': 'attack', 'player-two': 'skill' },
      damage: [],
      effects: [],
      outcome: 'decisive',
      responseDelayMs: 1100,
      round: 1,
      tagChargeUpdates: [
        {
          charges: 1,
          decisiveClashesPerCharge: 3,
          maximumCharges: 2,
          playerSlot: 'player-one',
          rechargeProgress: 0,
          restoredCharges: 0
        }
      ],
      tags: [
        {
          incomingTeamSlot: 1,
          playerSlot: 'player-one',
          previousTeamSlot: 0,
          reason: 'tag'
        }
      ],
      triggeredStatuses: [],
      winnerSlot: 'player-one'
    }
  });
  const runNextStep = (expectedDelay) => {
    const step = scheduledSteps.shift();
    assert.equal(step.delay, expectedDelay);
    step.callback();
  };

  assert.equal(game.state.phase, 'waiting');
  runNextStep(1100);
  assert.equal(game.state.phase, 'locked');
  runNextStep(1500);
  assert.equal(game.state.phase, 'reveal');
  runNextStep(2500);
  assert.equal(game.state.phase, 'resolving');
  assert.equal(game.state.lastOutcome, 'ATTACK WINS');
  assert.equal(game.state.tagResources.local.charges, 1);
  assert.equal(game.state.tagResources.local.rechargeProgress, 0);
  assert.equal(queuedTagButton.disabled, true);
  assert.equal(queuedTagButton.classList.contains('is-selected'), false);
  assert.equal(queuedTagButton.classList.contains('is-tag-spinning'), true);
  runNextStep(5000);
  assert.equal(game.state.phase, 'tagged');
  assert.equal(dom.window.preparedTag.selectedSlot, 1);
  assert.equal(queuedTagButton.classList.contains('is-tag-spinning'), true);
  runNextStep(1400);
  assert.equal(game.state.phase, 'choose-action');
  assert.equal(game.state.round, 2);
  assert.equal(game.state.lastOutcome, 'ATTACK WINS');
  assert.equal(game.isResolvingOnlineRound(), false);
  assert.equal(
    queuedTagButton.classList.contains('is-tag-finishing-spin'),
    true
  );
  assert.equal(queuedTagButton.classList.contains('is-tag-spinning'), true);
  queuedTagIcon.dispatchEvent(new dom.window.Event('animationiteration'));
  assert.equal(queuedTagButton.classList.contains('is-tag-spinning'), false);

  dom.window.close();
});

test('Online Clash refreshes action cadence state when the collision result appears', () => {
  const scheduledSteps = [];
  const dom = createGameDom({
    online: true,
    scheduledSteps,
    withFlow: true
  });
  const game = dom.window.OlingClashGame;
  const createPlayer = (accountId, slot) => {
    const team = createOnlineTeam(accountId);
    if (slot === 'player-one') {
      team[0].snapshot.abilities = [
        {
          cadence: { every: 2, mode: 'cumulative' },
          description: 'Every second survived Draw, gain 1 Shield.',
          imagePath: '/images/olings/clash/abilities/stone/harden.svg',
          key: 'stone-harden',
          layer: 'eyes',
          name: 'Harden',
          revision: 2
        }
      ];
    }
    return {
      accountId,
      activeTeamSlot: 0,
      selectionCommitted: false,
      slot,
      statuses: [],
      team
    };
  };
  const match = {
    gameId: 'OCL-CADENCE-PIPS',
    matchCode: 'ABC-123',
    phase: 'selection',
    round: 1,
    status: 'active',
    players: [
      createPlayer('host', 'player-one'),
      createPlayer('guest', 'player-two')
    ]
  };
  game.useOnlineMatch(match, 'host');
  assert.equal(dom.window.lastActionsRender, undefined);

  game.handleOnlineRoundResult({
    gameId: match.gameId,
    match: { ...match, phase: 'selection', round: 2 },
    result: {
      actions: { 'player-one': 'draw', 'player-two': 'draw' },
      damage: [],
      effects: [
        {
          abilityKey: 'stone-harden',
          activationThreshold: 2,
          afterActivationCount: 1,
          beforeActivationCount: 0,
          playerSlot: 'player-one',
          status: 'progressed',
          triggered: false
        }
      ],
      outcome: 'draw',
      round: 1,
      tags: [],
      triggeredStatuses: []
    }
  });

  scheduledSteps.shift().callback();
  scheduledSteps.shift().callback();

  assert.equal(game.state.phase, 'resolving');
  assert.equal(dom.window.lastActionsRender.selectedAction, 'draw');
  assert.equal(dom.window.lastActionsRender.activeOling.name, 'HOST 1');
  const cadenceEffect = dom.window.lastActionsRender.result.effects[0];
  assert.equal(cadenceEffect.abilityKey, 'stone-harden');
  assert.equal(cadenceEffect.playerSlot, 'local');
  assert.equal(cadenceEffect.status, 'progressed');
  assert.equal(cadenceEffect.afterActivationCount, 1);
  assert.equal(cadenceEffect.triggered, false);
  dom.window.close();
});

test('Online Clash asks a defeated human to choose and animates the replacement', async () => {
  const scheduledSteps = [];
  const dom = createGameDom({
    online: true,
    overlaySystem: true,
    scheduledSteps,
    withFlow: true
  });
  const game = dom.window.OlingClashGame;
  const localTeam = createOnlineTeam('host');
  localTeam[0] = {
    ...localTeam[0],
    defeated: true,
    heartUnits: 0
  };
  const createPlayer = (accountId, slot, team, activeTeamSlot = 0) => ({
    accountId,
    username: accountId.toUpperCase(),
    oeIcon: `${accountId}-oe`,
    slot,
    activeTeamSlot,
    selectionCommitted: false,
    statuses: [],
    team
  });
  const replacementMatch = {
    gameId: 'OCL-REPLACEMENT',
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'replacement',
    phaseEndsAt: null,
    round: 1,
    players: [
      createPlayer('host', 'player-one', localTeam),
      createPlayer('guest', 'player-two', createOnlineTeam('guest'))
    ]
  };
  const selectedMatch = {
    ...replacementMatch,
    phase: 'selection',
    phaseEndsAt: new Date(Date.now() + 15000).toISOString(),
    round: 2,
    players: [
      createPlayer('host', 'player-one', localTeam, 2),
      createPlayer('guest', 'player-two', createOnlineTeam('guest'))
    ]
  };
  const requests = [];
  dom.window.fetch = async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      async json() {
        return {
          success: true,
          match: selectedMatch,
          replacement: {
            playerSlot: 'player-one',
            previousTeamSlot: 0,
            incomingTeamSlot: 2,
            reason: 'defeat-replacement',
            tagEffectsActivate: false
          }
        };
      }
    };
  };

  game.useOnlineMatch(replacementMatch, 'host');

  const picker = dom.window.document.querySelector('[data-clash-picker]');
  const choices = [...picker.querySelectorAll('[data-clash-picker-option]')];
  assert.equal(game.state.phase, 'choose-tag');
  assert.equal(picker.hidden, false);
  assert.equal(picker.dataset.pickerMode, 'tag');
  assert.equal(picker.parentElement, dom.window.document.body);
  assert.equal(picker.classList.contains('is-clash-permanent-overlay'), true);
  assert.equal(dom.window.permanantElementClassArray.includes(picker), true);
  assert.equal(
    picker.querySelector('[data-clash-picker-title]').textContent,
    'CHOOSE YOUR NEXT OLING'
  );
  assert.equal(choices[0].disabled, true);
  assert.equal(choices[1].disabled, false);
  assert.equal(choices[2].disabled, false);

  choices[2].click();
  picker.querySelector('[data-clash-picker-confirm]').click();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(dom.window.permanantElementClassArray.includes(picker), false);
  assert.equal(
    picker.parentElement,
    dom.window.document.querySelector('[data-clash-game]')
  );
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/olings/clashes/ABC-123/replacement');
  assert.deepEqual(JSON.parse(requests[0].options.body), { teamSlot: 2 });
  assert.equal(game.state.phase, 'tagged');
  assert.equal(dom.window.preparedTag.forced, true);
  assert.equal(dom.window.preparedTag.selectedSlot, 2);
  assert.equal(dom.window.preparedTag.side, 'local');
  assert.equal(dom.window.playedTag.durationMs, 1400);

  const tagStep = scheduledSteps.shift();
  assert.equal(tagStep.delay, 1400);
  tagStep.callback();
  assert.equal(game.state.phase, 'choose-action');
  assert.equal(game.state.round, 2);
  assert.equal(game.state.teams.local[0].teamSlot, 2);
  assert.equal(picker.hidden, true);

  dom.window.close();
});

test('Online Clash keeps results hidden until the resolving phase', () => {
  const scheduledSteps = [];
  const dom = createGameDom({
    online: true,
    scheduledSteps,
    withFlow: true
  });
  const game = dom.window.OlingClashGame;
  const createPlayer = (accountId, slot, team, selection = null) => ({
    accountId,
    slot,
    activeTeamSlot: 0,
    selection,
    selectionCommitted: Boolean(selection),
    statuses: [],
    team
  });
  const localTeam = createOnlineTeam('host');
  const opponentTeam = createOnlineTeam('guest');
  const initialMatch = {
    gameId: 'OCL-HIDDEN-RESULT',
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    players: [
      createPlayer('host', 'player-one', localTeam, { action: 'guard' }),
      createPlayer('guest', 'player-two', opponentTeam)
    ]
  };
  const defeatedLocalTeam = createOnlineTeam('host');
  defeatedLocalTeam[0] = {
    ...defeatedLocalTeam[0],
    defeated: true,
    heartUnits: 0
  };
  const resolvedMatch = {
    ...initialMatch,
    round: 2,
    players: [
      createPlayer('host', 'player-one', defeatedLocalTeam),
      createPlayer('guest', 'player-two', opponentTeam)
    ]
  };
  const runNextStep = (expectedDelay) => {
    const step = scheduledSteps.shift();
    assert.equal(step.delay, expectedDelay);
    step.callback();
  };

  game.useOnlineMatch(initialMatch, 'host');
  game.handleOnlineRoundResult({
    gameId: initialMatch.gameId,
    match: resolvedMatch,
    result: {
      actions: { 'player-one': 'guard', 'player-two': 'guard' },
      damage: [],
      effects: [],
      outcome: 'draw',
      responseDelayMs: 500,
      round: 1,
      tags: [],
      triggeredStatuses: [],
      winnerSlot: null
    }
  });

  assert.equal(game.state.phase, 'waiting');
  assert.equal(game.state.lastOutcome, 'NO RESULT');
  assert.equal(game.state.teams.local[0].health.heartUnits, 6);
  assert.equal(dom.window.lastActionSummaryRender.action, 'guard');
  runNextStep(500);
  assert.equal(game.state.phase, 'locked');
  assert.equal(game.state.teams.local[0].health.heartUnits, 6);
  assert.equal(dom.window.lastActionSummaryRender.action, 'guard');
  runNextStep(1500);
  assert.equal(game.state.phase, 'reveal');
  assert.equal(game.state.teams.local[0].health.heartUnits, 6);
  assert.equal(dom.window.lastActionSummaryRender.action, 'guard');
  assert.equal(dom.window.lastAbilityReveal.winner, 'draw');
  assert.equal(dom.window.lastAbilityReveal.result, undefined);
  runNextStep(2500);
  assert.equal(game.state.phase, 'resolving');
  assert.equal(game.state.lastOutcome, 'DRAW');
  assert.equal(game.state.teams.local[0].health.heartUnits, 0);
  assert.equal(dom.window.lastActionSummaryRender.action, 'draw');
  assert.equal(dom.window.lastAbilityReveal.result.winner, 'draw');

  dom.window.close();
});

test('Online Clash restores the last-round result from compact match state', () => {
  const dom = createGameDom({ online: true, withFlow: true });
  const game = dom.window.OlingClashGame;
  const createPlayer = (accountId, slot) => ({
    accountId,
    slot,
    activeTeamSlot: 0,
    selectionCommitted: false,
    statuses: [],
    team: createOnlineTeam(accountId)
  });

  game.useOnlineMatch(
    {
      latestRoundResult: {
        actions: {
          'player-one': 'skill',
          'player-two': 'guard'
        },
        outcome: 'decisive',
        round: 21,
        winnerSlot: 'player-one'
      },
      gameId: 'OCL-RESTORED-RESULT',
      matchCode: 'ABC-123',
      status: 'active',
      phase: 'selection',
      round: 22,
      players: [
        createPlayer('host', 'player-one'),
        createPlayer('guest', 'player-two')
      ]
    },
    'host'
  );

  assert.equal(game.state.round, 22);
  assert.equal(game.state.lastOutcome, 'SKILL WINS');
  assert.equal(game.state.lastResult.localAction, 'skill');
  assert.equal(game.state.lastResult.opponentAction, 'guard');

  dom.window.close();
});

test('Online Clash restores each Oling most recent move from compact summaries', () => {
  const dom = createGameDom({ online: true, withFlow: true });
  const game = dom.window.OlingClashGame;
  const createPlayer = (accountId, slot, activeTeamSlot) => ({
    accountId,
    slot,
    activeTeamSlot,
    selectionCommitted: false,
    statuses: [],
    lastMoves:
      slot === 'player-one'
        ? [
            {
              teamSlot: 1,
              action: 'draw',
              activationStatus: 'revealed',
              outcome: 'draw',
              round: 3
            },
            {
              teamSlot: 0,
              action: 'guard',
              activationStatus: 'revealed',
              outcome: 'win',
              round: 2
            }
          ]
        : [],
    team: createOnlineTeam(accountId)
  });

  game.useOnlineMatch(
    {
      gameId: 'OCL-PER-OLING-HISTORY',
      matchCode: 'ABC-123',
      status: 'active',
      phase: 'selection',
      round: 4,
      players: [
        createPlayer('host', 'player-one', 1),
        createPlayer('guest', 'player-two', 0)
      ]
    },
    'host'
  );

  const active = game.state.teams.local.find((oling) => oling.teamSlot === 1);
  const taggedOut = game.state.teams.local.find(
    (oling) => oling.teamSlot === 0
  );
  assert.deepEqual(
    {
      action: active.lastMove.action,
      outcome: active.lastMove.outcome,
      round: active.lastMove.round
    },
    { action: 'draw', outcome: 'draw', round: 3 }
  );
  assert.deepEqual(
    {
      action: taggedOut.lastMove.action,
      outcome: taggedOut.lastMove.outcome,
      round: taggedOut.lastMove.round
    },
    { action: 'guard', outcome: 'win', round: 2 }
  );

  dom.window.close();
});

test('Online Clash privately drafts a highlighted action and does not mutate on expiry', async () => {
  const dom = createGameDom({ online: true, withFlow: true });
  const game = dom.window.OlingClashGame;
  const requests = [];
  const match = {
    gameId: 'OCL-TIMEOUT',
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    phaseEndsAt: new Date(Date.now() + 15000).toISOString(),
    round: 1,
    players: [
      {
        accountId: 'host',
        slot: 'player-one',
        activeTeamSlot: 0,
        selectionCommitted: false,
        statuses: [],
        team: createOnlineTeam('host')
      },
      {
        accountId: 'guest',
        slot: 'player-two',
        activeTeamSlot: 0,
        selectionCommitted: false,
        statuses: [],
        team: createOnlineTeam('guest')
      }
    ]
  };
  dom.window.fetch = async (url, options) => {
    requests.push({ options, url });
    return {
      ok: true,
      async json() {
        return {
          match: {
            ...match,
            players: match.players.map((player) => ({
              ...player,
              selectionCommitted: player.accountId === 'host'
            }))
          }
        };
      }
    };
  };
  game.useOnlineMatch(match, 'host');
  game.toggleAction('guard');
  await new Promise((resolve) => setImmediate(resolve));

  dom.window.document
    .querySelector('[data-clash-timer]')
    .dispatchEvent(
      new dom.window.CustomEvent('oling-clash:timer-expired', { bubbles: true })
    );
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/olings/clashes/ABC-123/action-draft');
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    action: 'guard',
    effectChoice: null,
    tagTeamSlot: null
  });
  assert.equal(game.state.phase, 'locking-in');

  dom.window.close();
});

test('Online Clash cancels its read-only deadline watchdog when the round changes', async () => {
  const scheduledSteps = [];
  const dom = createGameDom({
    online: true,
    scheduledSteps,
    withFlow: true
  });
  const game = dom.window.OlingClashGame;
  const requests = [];
  const match = {
    gameId: 'OCL-TIMEOUT-RETRY',
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    phaseEndsAt: new Date(Date.now() + 15000).toISOString(),
    round: 1,
    players: [
      {
        accountId: 'host',
        slot: 'player-one',
        activeTeamSlot: 0,
        selectionCommitted: false,
        statuses: [],
        team: createOnlineTeam('host')
      },
      {
        accountId: 'guest',
        slot: 'player-two',
        activeTeamSlot: 0,
        selectionCommitted: false,
        statuses: [],
        team: createOnlineTeam('guest')
      }
    ]
  };
  dom.window.fetch = async (url, options) => {
    requests.push({ options, url });
    return {
      ok: false,
      async json() {
        return {
          success: false,
          error: {
            code: 'oling_clash_timeout_not_reached',
            details: { retryAfterMs: 500 },
            message: 'The round is still accepting choices.'
          }
        };
      }
    };
  };
  game.useOnlineMatch(match, 'host');

  dom.window.document
    .querySelector('[data-clash-timer]')
    .dispatchEvent(
      new dom.window.CustomEvent('oling-clash:timer-expired', { bubbles: true })
    );
  await new Promise((resolve) => setImmediate(resolve));

  const retry = scheduledSteps.find(({ delay }) => delay === 1250);
  assert.ok(retry);
  assert.equal(requests.length, 0);

  game.useOnlineMatch(
    {
      ...match,
      phaseEndsAt: new Date(Date.now() + 30000).toISOString(),
      round: 2
    },
    'host'
  );
  retry.callback();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(requests.length, 0);

  dom.window.close();
});

test('Online Clash deadline watchdog only fetches authoritative state', async () => {
  const scheduledSteps = [];
  const dom = createGameDom({ online: true, scheduledSteps, withFlow: true });
  const game = dom.window.OlingClashGame;
  const requests = [];
  const player = (accountId, slot) => ({
    accountId,
    activeTeamSlot: 0,
    selectionCommitted: false,
    slot,
    statuses: [],
    team: createOnlineTeam(accountId)
  });
  const match = {
    gameId: 'OCL-DEADLINE-WATCHDOG',
    matchCode: 'ABC-123',
    phase: 'selection',
    phaseEndsAt: new Date(Date.now() - 100).toISOString(),
    players: [player('host', 'player-one'), player('guest', 'player-two')],
    round: 1,
    status: 'active'
  };
  const nextMatch = {
    ...match,
    phaseEndsAt: new Date(Date.now() + 15000).toISOString(),
    round: 2
  };
  dom.window.fetch = async (url, options = {}) => {
    requests.push({ options, url });
    return {
      ok: true,
      async json() {
        return { match: nextMatch, success: true };
      }
    };
  };

  game.useOnlineMatch(match, 'host');
  dom.window.document
    .querySelector('[data-clash-timer]')
    .dispatchEvent(
      new dom.window.CustomEvent('oling-clash:timer-expired', { bubbles: true })
    );
  const watchdog = scheduledSteps.find(({ delay }) => delay === 1250);
  assert.ok(watchdog);
  await watchdog.callback();

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/olings/clashes/ABC-123');
  assert.equal(requests[0].options.method, 'GET');
  assert.equal(requests[0].options.cache, 'no-store');
  assert.equal(game.state.round, 2);
  assert.equal(game.state.phase, 'choose-action');
  dom.window.close();
});

test('Online Clash expiry waits for the server without posting a stale action', async () => {
  const dom = createGameDom({ online: true, withFlow: true });
  const game = dom.window.OlingClashGame;
  const requests = [];
  const createPlayer = (accountId, slot) => ({
    accountId,
    activeTeamSlot: 0,
    selectionCommitted: false,
    slot,
    statuses: [],
    team: createOnlineTeam(accountId)
  });
  const roundOne = {
    gameId: 'OCL-STALE-TIMEOUT',
    matchCode: 'ABC-123',
    phase: 'selection',
    phaseEndsAt: new Date(Date.now() - 100).toISOString(),
    players: [
      createPlayer('host', 'player-one'),
      createPlayer('guest', 'player-two')
    ],
    round: 1,
    status: 'active'
  };
  const roundTwo = {
    ...roundOne,
    phaseEndsAt: new Date(Date.now() + 15000).toISOString(),
    round: 2
  };
  dom.window.fetch = async (url, options = {}) => {
    requests.push({ options, url });
    if (options.method === 'POST') {
      return {
        ok: false,
        async json() {
          return {
            error: {
              code: 'oling_clash_timeout_stale',
              details: {
                gameId: roundTwo.gameId,
                phaseEndsAt: roundTwo.phaseEndsAt,
                round: roundTwo.round
              },
              message: 'That timeout belongs to an earlier Clash round.'
            },
            success: false
          };
        }
      };
    }
    return {
      ok: true,
      async json() {
        return { match: roundTwo, success: true };
      }
    };
  };

  game.useOnlineMatch(roundOne, 'host');
  dom.window.document
    .querySelector('[data-clash-timer]')
    .dispatchEvent(
      new dom.window.CustomEvent('oling-clash:timer-expired', { bubbles: true })
    );
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(requests.length, 0);
  assert.equal(game.state.round, 1);
  assert.equal(game.state.phase, 'locking-in');
  dom.window.close();
});

test('Online Clash unselected expiry is also passive', async () => {
  const dom = createGameDom({ online: true, withFlow: true });
  const game = dom.window.OlingClashGame;
  const requests = [];
  const createPlayer = (accountId, slot) => ({
    accountId,
    activeTeamSlot: 0,
    selectionCommitted: false,
    slot,
    statuses: [],
    team: createOnlineTeam(accountId)
  });
  const match = {
    gameId: 'OCL-COMMITTED-TIMEOUT',
    matchCode: 'ABC-123',
    phase: 'selection',
    phaseEndsAt: new Date(Date.now() - 100).toISOString(),
    players: [
      createPlayer('host', 'player-one'),
      createPlayer('guest', 'player-two')
    ],
    round: 4,
    status: 'active'
  };
  const committedMatch = {
    ...match,
    players: match.players.map((player) => ({
      ...player,
      selectionCommitted: player.accountId === 'host'
    }))
  };
  dom.window.fetch = async (url, options = {}) => {
    requests.push({ options, url });
    if (options.method === 'POST') {
      return {
        ok: false,
        async json() {
          return {
            error: {
              code: 'oling_clash_selection_committed',
              message: 'Your action for this round is already committed.'
            },
            success: false
          };
        }
      };
    }
    return {
      ok: true,
      async json() {
        return { match: committedMatch, success: true };
      }
    };
  };

  game.useOnlineMatch(match, 'host');
  dom.window.document
    .querySelector('[data-clash-timer]')
    .dispatchEvent(
      new dom.window.CustomEvent('oling-clash:timer-expired', { bubbles: true })
    );
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(requests.length, 0);
  assert.equal(game.state.phase, 'locking-in');

  dom.window.document
    .querySelector('[data-clash-timer]')
    .dispatchEvent(
      new dom.window.CustomEvent('oling-clash:timer-expired', { bubbles: true })
    );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests.length, 0);

  dom.window.close();
});

test('Online Clash repeated expiry events never submit timeout mutations', async () => {
  const dom = createGameDom({ online: true, withFlow: true });
  const game = dom.window.OlingClashGame;
  const requests = [];
  const expiredMatch = {
    gameId: 'OCL-STALE-TIMEOUT-LOOP',
    matchCode: 'ABC-123',
    phase: 'selection',
    phaseEndsAt: new Date(Date.now() - 100).toISOString(),
    players: [
      {
        accountId: 'host',
        activeTeamSlot: 0,
        selectionCommitted: false,
        slot: 'player-one',
        statuses: [],
        team: createOnlineTeam('host')
      },
      {
        accountId: 'guest',
        activeTeamSlot: 0,
        selectionCommitted: false,
        slot: 'player-two',
        statuses: [],
        team: createOnlineTeam('guest')
      }
    ],
    round: 3,
    status: 'active'
  };
  dom.window.fetch = async (url, options = {}) => {
    requests.push({ options, url });
    if (options.method === 'POST') {
      return {
        ok: false,
        async json() {
          return {
            error: {
              code: 'oling_clash_timeout_stale',
              details: {
                gameId: expiredMatch.gameId,
                phaseEndsAt: expiredMatch.phaseEndsAt,
                round: expiredMatch.round
              },
              message: 'That timeout belongs to an earlier Clash round.'
            },
            success: false
          };
        }
      };
    }
    return {
      ok: true,
      async json() {
        return { match: expiredMatch, success: true };
      }
    };
  };

  game.useOnlineMatch(expiredMatch, 'host');
  dom.window.document
    .querySelector('[data-clash-timer]')
    .dispatchEvent(
      new dom.window.CustomEvent('oling-clash:timer-expired', { bubbles: true })
    );
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(requests.length, 0);
  assert.equal(game.state.phase, 'locking-in');
  dom.window.close();
});

test('Online Clash end game shows the viewer on the left with both player OEs', () => {
  const dom = createGameDom({ online: true, withFlow: true });
  const game = dom.window.OlingClashGame;
  game.useOnlineMatch(
    {
      gameId: 'OCL-RESULT',
      matchCode: 'ABC-123',
      status: 'active',
      phase: 'selection',
      round: 4,
      players: [
        {
          accountId: 'host-account',
          username: 'HOST',
          oeIcon: 'host-oe',
          slot: 'player-one',
          isAi: true,
          activeTeamSlot: 0,
          selectionCommitted: false,
          statuses: [],
          team: createOnlineTeam('host')
        },
        {
          accountId: 'guest-account',
          username: 'GUEST',
          oeIcon: 'guest-oe',
          slot: 'player-two',
          activeTeamSlot: 0,
          selectionCommitted: false,
          statuses: [],
          team: createOnlineTeam('guest')
        }
      ]
    },
    'guest-account'
  );

  game.showOnlineEndGame({ defeatedPlayerSlots: ['player-one'] });

  const result = dom.window.document.querySelector('[data-clash-end-game]');
  const local = result.querySelector('[data-clash-end-player="local"]');
  const opponent = result.querySelector('[data-clash-end-player="opponent"]');
  assert.equal(result.hidden, false);
  assert.equal(
    local.querySelector('[data-clash-end-player-name]').textContent,
    'YOU'
  );
  assert.equal(
    local.querySelector('[data-clash-end-player-oe] img').dataset.oeIcon,
    'guest-oe'
  );
  assert.equal(
    opponent.querySelector('[data-clash-end-player-name]').textContent,
    'HOST'
  );
  assert.equal(
    opponent.querySelector('[data-clash-end-player-oe] img').dataset.oeIcon,
    'host-oe'
  );
  assert.equal(
    dom.window.document.querySelector('[data-clash-end-result]').textContent,
    'VICTORY'
  );
  assert.equal(
    dom.window.document.querySelector('[data-clash-end-detail]').textContent,
    'ALL OPPOSING OLINGS DEFEATED'
  );
  assert.equal(local.classList.contains('is-winner'), true);
  assert.equal(opponent.classList.contains('is-loser'), true);

  dom.window.close();
});

test('Online Clash rematch waits for a human opponent and can return to lobby', async () => {
  const dom = createGameDom({ online: true, withFlow: true });
  const game = dom.window.OlingClashGame;
  const requests = [];
  const createMatch = (rematchAccepted) => ({
    gameId: 'OCL-REMATCH',
    matchCode: 'ABC-123',
    status: 'waiting',
    phase: 'waiting',
    round: 0,
    players: [
      {
        accountId: 'host-account',
        username: 'HOST',
        oeIcon: 'host-oe',
        slot: 'player-one',
        activeTeamSlot: 0,
        rematchAccepted,
        selectionCommitted: false,
        statuses: [],
        team: createOnlineTeam('host')
      },
      {
        accountId: 'guest-account',
        username: 'GUEST',
        oeIcon: 'guest-oe',
        slot: 'player-two',
        activeTeamSlot: 0,
        rematchAccepted: false,
        selectionCommitted: false,
        statuses: [],
        team: createOnlineTeam('guest')
      }
    ]
  });
  const activeMatch = { ...createMatch(false), status: 'active', round: 4 };
  dom.window.fetch = async (url, options) => {
    const accepted = JSON.parse(options.body).accepted;
    requests.push({ accepted, url });
    return {
      ok: true,
      async json() {
        return { match: createMatch(accepted) };
      }
    };
  };
  game.useOnlineMatch(activeMatch, 'host-account');
  game.showOnlineEndGame({ defeatedPlayerSlots: ['player-two'] });

  const overlay = dom.window.document.querySelector('[data-clash-end-game]');
  const rematch = overlay.querySelector('[data-clash-rematch]');
  const backToLobby = overlay.querySelector('[data-clash-back-lobby]');
  rematch.click();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(requests[0].accepted, true);
  assert.equal(rematch.disabled, true);
  assert.equal(rematch.textContent, 'WAITING FOR OPPONENT');
  assert.equal(overlay.hidden, false);

  backToLobby.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests[1].accepted, false);
  assert.equal(overlay.hidden, true);

  dom.window.close();
});

test('Clash Tag buttons queue, transfer and cancel during a round', () => {
  const dom = createGameDom();
  const game = dom.window.OlingClashGame;
  const root = dom.window.document.querySelector('[data-clash-game]');
  const buttons = [...root.querySelectorAll('[data-clash-tag-button]')];
  const selections = [];

  root.addEventListener('oling-clash:tag-selection-change', (event) => {
    selections.push(event.detail.teamSlot);
  });
  dom.window.OlingClashGame.updatePhase({ phase: 'choose-action' });

  assert.equal(buttons[0].disabled, false);
  buttons[0].click();
  assert.equal(buttons[0].getAttribute('aria-pressed'), 'true');
  assert.equal(buttons[0].classList.contains('is-selected'), true);
  assert.equal(buttons[0].classList.contains('is-tag-spinning'), true);
  assert.equal(game.getSelectedTagTeamSlot(), '1');

  buttons[1].click();
  assert.equal(buttons[0].getAttribute('aria-pressed'), 'false');
  assert.equal(buttons[1].getAttribute('aria-pressed'), 'true');
  assert.equal(buttons[0].classList.contains('is-tag-spinning'), true);
  assert.equal(buttons[0].classList.contains('is-tag-finishing-spin'), true);
  assert.equal(buttons[1].classList.contains('is-tag-spinning'), true);
  buttons[0]
    .querySelector('.olings-clash-tag__icon')
    .dispatchEvent(new dom.window.Event('animationiteration'));
  assert.equal(buttons[0].classList.contains('is-tag-spinning'), false);
  assert.equal(game.getSelectedTagTeamSlot(), '2');

  buttons[1].click();
  assert.equal(buttons[1].getAttribute('aria-pressed'), 'false');
  assert.equal(buttons[1].classList.contains('is-tag-spinning'), true);
  assert.equal(buttons[1].classList.contains('is-tag-finishing-spin'), true);
  buttons[1]
    .querySelector('.olings-clash-tag__icon')
    .dispatchEvent(new dom.window.Event('animationiteration'));
  assert.equal(buttons[1].classList.contains('is-tag-spinning'), false);
  assert.equal(game.getSelectedTagTeamSlot(), null);
  assert.deepEqual(selections, ['1', '2', null]);
});

test('Online Clash disables voluntary Tags when the local player has no charges', () => {
  const dom = createGameDom({ online: true, withFlow: true });
  const game = dom.window.OlingClashGame;
  const buttons = [
    ...dom.window.document.querySelectorAll('[data-clash-tag-button]')
  ];

  const state = game.useOnlineMatch(
    {
      gameId: 'OCL-NO-TAGS',
      matchCode: 'NO-TAG',
      status: 'active',
      phase: 'selection',
      round: 2,
      ruleset: {
        snapshot: {
          tagging: {
            decisiveClashesPerCharge: 3,
            maximumCharges: 2
          }
        }
      },
      players: [
        {
          accountId: 'host-account',
          slot: 'player-one',
          activeTeamSlot: 0,
          selectionCommitted: false,
          statuses: [],
          tagCharges: 0,
          tagRechargeProgress: 2,
          team: createOnlineTeam('host')
        },
        {
          accountId: 'guest-account',
          slot: 'player-two',
          activeTeamSlot: 0,
          selectionCommitted: false,
          statuses: [],
          tagCharges: 1,
          tagRechargeProgress: 1,
          team: createOnlineTeam('guest')
        }
      ]
    },
    'host-account'
  );

  assert.deepEqual(JSON.parse(JSON.stringify(state.tagResources)), {
    local: {
      charges: 0,
      decisiveClashesPerCharge: 3,
      maximumCharges: 2,
      rechargeProgress: 2
    },
    opponent: {
      charges: 1,
      decisiveClashesPerCharge: 3,
      maximumCharges: 2,
      rechargeProgress: 1
    }
  });
  assert.equal(
    buttons.every((button) => button.disabled),
    true
  );
  buttons[0].click();
  assert.equal(game.getSelectedTagTeamSlot(), null);

  dom.window.close();
});

test('Clash abilities toggle before Confirm submits the action', () => {
  const dom = createGameDom({ withFlow: true });
  const root = dom.window.document.querySelector('[data-clash-game]');
  const attack = root.querySelector('[data-clash-action="attack"]');
  const guard = root.querySelector('[data-clash-action="guard"]');
  const draw = root.querySelector('[data-clash-action="draw"]');
  const confirm = root.querySelector('[data-clash-action-confirm]');
  const actions = root.querySelector('[data-clash-actions]');

  assert.equal(confirm.disabled, true);
  assert.equal(actions.classList.contains('is-confirm-ready'), false);
  draw.click();
  assert.equal(draw.hasAttribute('aria-pressed'), false);
  assert.equal(draw.classList.contains('is-selected'), false);
  assert.equal(confirm.disabled, true);
  assert.equal(dom.window.confirmedAction, undefined);
  assert.deepEqual(dom.window.lastActionSummaryRender, {
    action: 'draw',
    phase: 'choose-action'
  });

  attack.click();
  assert.equal(attack.getAttribute('aria-pressed'), 'true');
  assert.equal(confirm.disabled, false);
  assert.equal(actions.classList.contains('is-confirm-ready'), true);
  assert.equal(dom.window.confirmedAction, undefined);
  assert.deepEqual(dom.window.lastActionSummaryRender, {
    action: 'attack',
    phase: 'choose-action'
  });

  attack.click();
  assert.equal(attack.getAttribute('aria-pressed'), 'false');
  assert.equal(confirm.disabled, true);
  assert.equal(actions.classList.contains('is-confirm-ready'), false);

  guard.click();
  assert.equal(guard.getAttribute('aria-pressed'), 'true');
  assert.equal(actions.classList.contains('is-confirm-ready'), true);
  confirm.click();
  assert.equal(dom.window.confirmedAction, 'guard');
  assert.equal(guard.getAttribute('aria-pressed'), 'true');
  assert.equal(guard.classList.contains('is-selected'), true);
  assert.equal(confirm.disabled, true);
  assert.equal(actions.classList.contains('is-confirm-ready'), false);
  assert.equal(attack.disabled, true);
  assert.equal(guard.disabled, true);
  assert.deepEqual(dom.window.lastActionSummaryRender, {
    action: 'guard',
    phase: 'locked'
  });

  dom.window.OlingClashGame.state.phase = 'reveal';
  dom.window.clashFlowHooks.onPhase({
    durationMs: 2500,
    phase: 'reveal',
    phaseEndsAt: Date.now() + 2500
  });
  dom.window.clashFlowHooks.onReveal({
    durationMs: 2500,
    localAction: 'guard',
    opponentAction: 'attack',
    winner: 'local'
  });
  assert.equal(guard.classList.contains('is-selected'), true);
  assert.equal(guard.classList.contains('is-unsuccessful'), false);
  assert.equal(draw.classList.contains('is-selected'), false);
  assert.equal(actions.classList.contains('is-fight-active'), true);

  dom.window.clashFlowHooks.onReveal({
    durationMs: 2500,
    localAction: 'guard',
    opponentAction: 'skill',
    winner: 'opponent'
  });
  assert.equal(guard.classList.contains('is-selected'), true);
  assert.equal(guard.classList.contains('is-unsuccessful'), false);
  assert.equal(dom.window.lastAbilityReveal.localAction, 'guard');
  assert.equal(dom.window.lastAbilityReveal.opponentAction, 'skill');
  assert.equal(dom.window.lastAbilityReveal.winner, 'opponent');

  dom.window.clashFlowHooks.onReveal({
    durationMs: 2500,
    localAction: 'guard',
    opponentAction: 'guard',
    winner: 'draw'
  });
  assert.equal(guard.classList.contains('is-selected'), true);
  assert.equal(guard.classList.contains('is-unsuccessful'), false);
  assert.equal(draw.classList.contains('is-selected'), false);
  assert.equal(draw.classList.contains('is-unsuccessful'), false);

  dom.window.OlingClashGame.updatePhase({ phase: 'choose-action' });
  assert.equal(actions.classList.contains('is-fight-active'), false);
  assert.equal(guard.classList.contains('is-unsuccessful'), false);
});

test('Clash tutorial plays its result sound before deferring combat motion', () => {
  const dom = createGameDom({
    playbackSpies: true,
    tutorial: true,
    withFlow: true
  });
  const root = dom.window.document.querySelector('[data-clash-game]');
  let resumeRevealPlayback = null;
  const impactFallbacks = [];
  const resolveAtImpact = () => {};

  root.addEventListener('olings-clash:tutorial-abilities-revealed', (event) => {
    event.preventDefault();
    resumeRevealPlayback = event.detail.resumeRevealPlayback;
  });

  dom.window.clashFlowHooks.onReveal({
    durationMs: 2500,
    localAction: 'guard',
    opponentAction: 'attack',
    resolveAtImpact,
    setImpactFallback(durationMs) {
      impactFallbacks.push(durationMs);
    },
    winner: 'local'
  });

  assert.equal(typeof resumeRevealPlayback, 'function');
  assert.deepEqual(dom.window.revealSounds, ['local']);
  assert.deepEqual(dom.window.combatPlays, []);

  assert.equal(resumeRevealPlayback(), true);
  assert.deepEqual(dom.window.revealSounds, ['local']);
  assert.equal(dom.window.combatPlays.length, 1);
  assert.equal(dom.window.combatPlays[0].durationMs, 3200);
  assert.equal(dom.window.combatPlays[0].onCollision, resolveAtImpact);
  assert.equal(dom.window.combatPlays[0].winner, 'local');
  assert.deepEqual(impactFallbacks, [3200]);
  assert.equal(resumeRevealPlayback(), false);
  assert.deepEqual(dom.window.revealSounds, ['local']);
  assert.equal(dom.window.combatPlays.length, 1);
});

test('Clash tutorial enables guided action input without advancing its flow', () => {
  const dom = createGameDom({ tutorial: true, withFlow: true });
  const root = dom.window.document.querySelector('[data-clash-game]');
  const attack = root.querySelector('[data-clash-action="attack"]');
  const guard = root.querySelector('[data-clash-action="guard"]');
  const passive = root.querySelector('[data-clash-passive]');
  const actionConfirm = root.querySelector('[data-clash-action-confirm]');
  const opponentTarget = root.querySelector(
    '[data-clash-action-confirm-target]'
  );

  dom.window.OlingClashGame.pauseTutorial();
  dom.window.OlingClashGame.setTutorialActionInput(true);

  assert.equal(attack.disabled, false);
  assert.equal(passive.disabled, true);
  assert.equal(actionConfirm.disabled, true);
  assert.equal(
    dom.window.OlingClashGame.setTutorialSelectedAction('guard'),
    true
  );
  assert.equal(guard.getAttribute('aria-pressed'), 'true');
  assert.equal(actionConfirm.disabled, false);
  assert.equal(
    root
      .querySelector('[data-clash-actions]')
      .classList.contains('is-confirm-ready'),
    true
  );
  assert.equal(
    dom.window.OlingClashGame.setTutorialConfirmSuppressed(true),
    true
  );
  assert.equal(
    root
      .querySelector('[data-clash-actions]')
      .classList.contains('is-confirm-ready'),
    false
  );
  assert.equal(
    dom.window.OlingClashGame.setTutorialConfirmSuppressed(false),
    false
  );
  assert.equal(
    root
      .querySelector('[data-clash-actions]')
      .classList.contains('is-confirm-ready'),
    true
  );
  attack.click();
  assert.equal(attack.getAttribute('aria-pressed'), 'true');
  assert.equal(actionConfirm.disabled, false);
  assert.equal(opponentTarget.getAttribute('aria-disabled'), 'false');
  assert.equal(dom.window.lastActionSummaryRender.action, null);

  dom.window.OlingClashGame.configureTutorialGameplay({
    abilityInformation: true
  });
  assert.equal(dom.window.lastActionSummaryRender.action, 'attack');
  dom.window.OlingClashGame.configureTutorialGameplay({
    abilityInformation: false
  });

  assert.equal(dom.window.OlingClashGame.setTutorialOpponentToLose(), true);
  assert.equal(dom.window.forcedOpponentAction, 'skill');
  assert.equal(dom.window.OlingClashGame.setTutorialOpponentToWin(), true);
  assert.equal(dom.window.forcedOpponentAction, 'guard');
  assert.equal(
    dom.window.OlingClashGame.setTutorialOpponentQueuedTagSlot(2),
    true
  );
  assert.equal(dom.window.queuedOpponentTagSlot, 2);
  assert.equal(dom.window.OlingClashGame.setTutorialOpponentTagSlot(1), true);
  assert.equal(dom.window.forcedOpponentTagSlot, 1);

  opponentTarget.click();
  assert.equal(dom.window.confirmedAction, undefined);
  actionConfirm.click();
  assert.equal(dom.window.confirmedAction, undefined);
  dom.window.OlingClashGame.setTutorialActionInput(false);
  dom.window.OlingClashGame.resumeTutorial();
  dom.window.OlingClashGame.confirmAction();
  assert.equal(dom.window.confirmedAction, 'attack');
});

test('Clash tutorial can queue a Tag while its round is paused', () => {
  const dom = createGameDom({ tutorial: true, withFlow: true });
  const game = dom.window.OlingClashGame;
  const buttons = [
    ...dom.window.document.querySelectorAll('[data-clash-tag-button]')
  ];

  game.pauseTutorial();
  assert.equal(game.setTutorialTagInput(true), true);
  assert.equal(buttons[0].disabled, false);
  assert.equal(buttons[1].disabled, false);

  buttons[0].click();
  assert.equal(buttons[0].getAttribute('aria-pressed'), 'true');
  assert.equal(dom.window.selectedFlowTag.slot, '1');
  assert.equal(dom.window.selectedFlowTag.options.allowWhilePaused, true);
  assert.equal(game.state.selections.localTagSlot, '1');

  assert.equal(game.setTutorialTagInput(false), false);
  assert.equal(buttons[0].disabled, true);
});

test('Clash hides and swaps the local action panel across a Tag animation', () => {
  const scheduledSteps = [];
  const dom = createGameDom({ scheduledSteps, withFlow: true });
  const root = dom.window.document.querySelector('[data-clash-game]');
  const actions = root.querySelector('[data-clash-actions]');
  actions.style.transitionDuration = '480ms';
  actions.style.transitionProperty = 'transform';

  const tagStart = dom.window.clashFlowHooks.onTagStart({
    forced: false,
    selectedSlot: 1,
    side: 'local'
  });

  assert.equal(tagStart.delayMs, 480);
  assert.equal(actions.classList.contains('is-tag-switching'), true);
  assert.equal(actions.getAttribute('aria-hidden'), 'true');
  assert.deepEqual(JSON.parse(JSON.stringify(dom.window.preparedTag)), {
    forced: false,
    selectedSlot: 1,
    side: 'local'
  });

  dom.window.clashFlowHooks.onTag({
    durationMs: 1400,
    incomingOling: { name: 'PEBBLE' },
    side: 'local'
  });
  assert.equal(actions.classList.contains('is-tag-switching'), true);
  assert.deepEqual(JSON.parse(JSON.stringify(dom.window.playedTag)), {
    durationMs: 1400
  });

  const panelEntry = scheduledSteps.find((step) => step.delay === 1400);
  assert.ok(panelEntry);
  panelEntry.callback();
  assert.equal(actions.classList.contains('is-tag-switching'), false);
  assert.equal(actions.hasAttribute('aria-hidden'), false);

  dom.window.close();
});

test('Clash hides the action panel as soon as the local Oling is knocked out', () => {
  const dom = createGameDom({ withFlow: true });
  const root = dom.window.document.querySelector('[data-clash-game]');
  const actions = root.querySelector('[data-clash-actions]');
  actions.style.transitionDuration = '480ms';
  actions.style.transitionProperty = 'transform';
  dom.window.OlingClashGame.state.teams.local[0].health.heartUnits = 0;

  dom.window.clashFlowHooks.onResult({
    localAction: 'guard',
    opponentAction: 'skill',
    winner: 'opponent'
  });

  assert.equal(actions.classList.contains('is-tag-switching'), true);
  assert.equal(actions.getAttribute('aria-hidden'), 'true');

  dom.window.OlingClashGame.updatePhase({ phase: 'complete' });
  assert.equal(actions.classList.contains('is-tag-switching'), true);

  dom.window.close();
});

test('Clicking the active opponent confirms the selected ability', () => {
  const dom = createGameDom({ withFlow: true });
  const root = dom.window.document.querySelector('[data-clash-game]');
  const attack = root.querySelector('[data-clash-action="attack"]');
  const opponent = root.querySelector('[data-clash-action-confirm-target]');

  opponent.click();
  assert.equal(dom.window.confirmedAction, undefined);
  assert.equal(opponent.getAttribute('aria-disabled'), 'true');
  assert.equal(opponent.tabIndex, -1);

  attack.click();
  assert.equal(opponent.getAttribute('aria-disabled'), 'false');
  assert.equal(opponent.tabIndex, 0);
  assert.equal(opponent.classList.contains('is-confirm-ready'), true);

  opponent.click();
  assert.equal(dom.window.confirmedAction, 'attack');
  assert.equal(opponent.getAttribute('aria-disabled'), 'true');
  assert.equal(opponent.tabIndex, -1);
  assert.equal(opponent.classList.contains('is-confirm-ready'), false);
});

test('Clash Tag selection resets and disables during forced replacement', () => {
  const dom = createGameDom();
  const game = dom.window.OlingClashGame;
  const buttons = [
    ...dom.window.document.querySelectorAll('[data-clash-tag-button]')
  ];

  game.updatePhase({ phase: 'choose-action' });
  buttons[0].click();
  game.updatePhase({ phase: 'choose-tag' });

  assert.equal(game.getSelectedTagTeamSlot(), null);
  assert.equal(buttons[0].getAttribute('aria-pressed'), 'false');
  assert.equal(
    buttons.every((button) => button.disabled),
    true
  );
});

test('Clash only shows the countdown while choosing an action', () => {
  const dom = createGameDom();
  const game = dom.window.OlingClashGame;

  dom.window.clashTimerCalls.length = 0;
  game.updatePhase({
    phase: 'choose-action',
    phaseDurationMs: 15000,
    phaseEndsAt: Date.now() + 15000
  });
  assert.equal(dom.window.clashTimerCalls.at(-1).method, 'start');

  game.updatePhase({
    phase: 'locked',
    phaseDurationMs: 1500,
    phaseEndsAt: Date.now() + 1500
  });
  assert.equal(dom.window.clashTimerCalls.at(-1).method, 'stop');
  assert.equal(dom.window.clashTimerCalls.at(-1).options.hide, true);
});

test('Clash Tag buttons disable after lock-in until the next decision', () => {
  const dom = createGameDom();
  const game = dom.window.OlingClashGame;
  const buttons = [
    ...dom.window.document.querySelectorAll('[data-clash-tag-button]')
  ];

  game.updatePhase({ phase: 'choose-action' });
  buttons[0].click();
  assert.equal(game.getSelectedTagTeamSlot(), '1');

  [
    'waiting',
    'locked',
    'reveal',
    'resolving',
    'tagged',
    'opponent-tag',
    'complete'
  ].forEach((phase) => {
    game.updatePhase({ phase });
    assert.equal(
      buttons.every((button) => button.disabled),
      true,
      `${phase} should disable Tag buttons`
    );
    buttons[1].click();
    assert.equal(game.getSelectedTagTeamSlot(), '1');
  });

  game.updatePhase({ phase: 'choose-action' });
  assert.equal(
    buttons.every((button) => !button.disabled),
    true
  );
  buttons[1].click();
  assert.equal(game.getSelectedTagTeamSlot(), '2');
});

test('Clash only disables action buttons when gameplay effects prevent them', () => {
  const dom = createGameDom();
  const game = dom.window.OlingClashGame;
  const root = dom.window.document.querySelector('[data-clash-game]');
  const attack = root.querySelector('[data-clash-action="attack"]');
  const guard = root.querySelector('[data-clash-action="guard"]');
  const draw = root.querySelector('[data-clash-action="draw"]');
  attack.dataset.actionLocked = 'true';

  game.updatePhase({ phase: 'choose-action' });

  assert.equal(attack.disabled, true);
  assert.equal(guard.disabled, false);
  assert.equal(draw.disabled, false);
});

test('Transfusion confirmation requires a bench target and direction', () => {
  const dom = createGameDom({ transfusion: true, withFlow: true });
  const root = dom.window.document.querySelector('[data-clash-game]');
  const skill = root.querySelector('[data-clash-action="skill"]');
  const actionConfirm = root.querySelector('[data-clash-action-confirm]');

  skill.click();
  actionConfirm.click();

  const picker = root.querySelector('[data-clash-picker]');
  assert.equal(root.querySelector('[data-clash-picker-close]'), null);
  root.dispatchEvent(
    new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })
  );
  assert.equal(picker.hidden, true);

  actionConfirm.click();
  const targets = [...root.querySelectorAll('[data-clash-picker-option]')];
  const choices = [...root.querySelectorAll('[data-clash-picker-choice]')];
  const transferConfirm = root.querySelector('[data-clash-picker-confirm]');
  assert.equal(picker.hidden, false);
  assert.equal(dom.window.confirmedAction, undefined);
  assert.equal(targets[0].disabled, true);

  targets[1].click();
  choices[0].click();
  transferConfirm.click();

  assert.equal(dom.window.confirmedAction, 'skill');
  assert.deepEqual(
    JSON.parse(JSON.stringify(dom.window.confirmedEffectChoice)),
    {
      abilityKey: 'vampire-transfusion',
      targetTeamSlot: 1,
      optionKey: 'self-to-bench'
    }
  );
  assert.equal(picker.hidden, true);
});

test('Cleanse confirmation requires a teammate and their Negative Status', () => {
  const dom = createGameDom({ cleanse: true, withFlow: true });
  const root = dom.window.document.querySelector('[data-clash-game]');
  const guard = root.querySelector('[data-clash-action="guard"]');
  const actionConfirm = root.querySelector('[data-clash-action-confirm]');

  guard.click();
  actionConfirm.click();

  const picker = root.querySelector('[data-clash-picker]');
  const targets = [...root.querySelectorAll('[data-clash-picker-option]')];
  const choices = [...root.querySelectorAll('[data-clash-picker-choice]')];
  const cleanseConfirm = root.querySelector('[data-clash-picker-confirm]');
  assert.equal(picker.hidden, false);
  assert.equal(
    root
      .querySelector('[data-clash-picker-choices]')
      .classList.contains('is-icon-only'),
    false
  );
  assert.equal(
    choices.every(
      (choice) =>
        choice.querySelector('.olings-clash-effect__icon') &&
        choice.querySelector('strong')
    ),
    true
  );
  assert.equal(targets[0].disabled, false);
  assert.equal(targets[1].disabled, false);
  assert.equal(targets[2].disabled, true);

  targets[1].click();
  const burn = choices.find((choice) => choice.dataset.choiceKey === 'burn');
  const suppressed = choices.find(
    (choice) => choice.dataset.choiceKey === 'suppressed'
  );
  assert.equal(burn.disabled, true);
  assert.equal(suppressed.disabled, false);
  assert.equal(suppressed.getAttribute('aria-checked'), 'true');
  cleanseConfirm.click();

  assert.equal(dom.window.confirmedAction, 'guard');
  assert.deepEqual(
    JSON.parse(JSON.stringify(dom.window.confirmedEffectChoice)),
    {
      abilityKey: 'moss-cleanse',
      targetTeamSlot: 1,
      optionKey: 'suppressed'
    }
  );
  assert.equal(picker.hidden, true);
});

test('Cleanse skips its picker when only one valid status can be removed', () => {
  const dom = createGameDom({ cleanse: true, withFlow: true });
  const root = dom.window.document.querySelector('[data-clash-game]');
  const game = dom.window.OlingClashGame;
  game.state.teams.local[0].effects = [];

  root.querySelector('[data-clash-action="guard"]').click();
  root.querySelector('[data-clash-action-confirm]').click();

  assert.equal(root.querySelector('[data-clash-picker]').hidden, true);
  assert.equal(dom.window.confirmedAction, 'guard');
  assert.deepEqual(
    JSON.parse(JSON.stringify(dom.window.confirmedEffectChoice)),
    {
      abilityKey: 'moss-cleanse',
      targetTeamSlot: 1,
      optionKey: 'suppressed'
    }
  );
});

test('Cleanse opens directly on statuses when only one Oling is eligible', () => {
  const dom = createGameDom({ cleanse: true, withFlow: true });
  const root = dom.window.document.querySelector('[data-clash-game]');
  const game = dom.window.OlingClashGame;
  game.state.teams.local[0].effects = [];
  game.state.teams.local[1].effects.push({
    key: 'burn',
    name: 'Burn',
    type: 'negative'
  });

  root.querySelector('[data-clash-action="guard"]').click();
  root.querySelector('[data-clash-action-confirm]').click();

  const picker = root.querySelector('[data-clash-picker]');
  const choices = [...picker.querySelectorAll('[data-clash-picker-choice]')];
  assert.equal(picker.hidden, false);
  assert.equal(
    picker.querySelector('[data-clash-picker-options]').hidden,
    true
  );
  assert.equal(choices.length, 2);
  assert.equal(
    picker
      .querySelector('[data-clash-picker-choices]')
      .classList.contains('is-icon-only'),
    false
  );
});

test('Reinforce presents the active Oling abilities in one protection row', () => {
  const catalogAbilities = Object.fromEntries(
    [
      ['mouth', 'Crush', 'attack'],
      ['body', 'Fortify', 'guard'],
      ['flight', 'Reinforce', 'skill'],
      ['eyes', 'Harden', 'draw']
    ].map(([part, name, action]) => [
      part,
      {
        imagePath: `/abilities/${part}.svg`,
        key: `stone-${name.toLowerCase()}`,
        name,
        revision: 1,
        action
      }
    ])
  );
  const dom = createGameDom({
    catalogAbilities,
    reinforce: true,
    withFlow: true
  });
  const root = dom.window.document.querySelector('[data-clash-game]');
  const skill = root.querySelector('[data-clash-action="skill"]');
  const actionConfirm = root.querySelector('[data-clash-action-confirm]');

  skill.click();
  actionConfirm.click();

  const picker = root.querySelector('[data-clash-picker]');
  const targets = [...root.querySelectorAll('[data-clash-picker-option]')];
  const choices = [...root.querySelectorAll('[data-clash-picker-choice]')];
  const reinforceConfirm = root.querySelector('[data-clash-picker-confirm]');
  assert.equal(picker.hidden, false);
  assert.equal(picker.dataset.pickerMode, 'ability-protect');
  assert.equal(
    root.querySelector('[data-clash-picker-title]').textContent,
    'CHOOSE AN ABILITY TO PROTECT'
  );
  assert.equal(
    root.querySelector('[data-clash-picker-description]').textContent,
    'Prevent this ability from being disabled once. The Ward is consumed when triggered.'
  );
  assert.equal(root.querySelector('[data-clash-picker-options]').hidden, true);
  assert.equal(targets.length, 1);
  assert.equal(targets[0].disabled, false);
  assert.deepEqual(
    choices.map((choice) => choice.dataset.choiceKey),
    ['mouth', 'body', 'flight', 'eyes']
  );
  assert.deepEqual(
    choices.map((choice) => choice.querySelector('strong').textContent),
    ['CRUSH', 'FORTIFY', 'REINFORCE', 'HARDEN']
  );
  assert.deepEqual(
    choices.map((choice) => choice.querySelector('span').textContent),
    ['MOUTH · ATTACK', 'BODY · GUARD', 'WINGS · SKILL', 'EYES · DRAW']
  );
  assert.equal(reinforceConfirm.disabled, true);
  assert.equal(reinforceConfirm.textContent, 'CHOOSE AN ABILITY');

  choices[2].click();
  assert.equal(reinforceConfirm.disabled, false);
  assert.equal(reinforceConfirm.textContent, 'PROTECT REINFORCE');
  reinforceConfirm.click();

  assert.equal(dom.window.confirmedAction, 'skill');
  assert.deepEqual(
    JSON.parse(JSON.stringify(dom.window.confirmedEffectChoice)),
    {
      abilityKey: 'stone-reinforce',
      targetTeamSlot: 0,
      optionKey: 'flight'
    }
  );
  assert.equal(picker.hidden, true);
});

test('Reinforce timeout closes its picker and chooses a valid ability', () => {
  const dom = createGameDom({ reinforce: true, withFlow: true });
  const root = dom.window.document.querySelector('[data-clash-game]');
  root.querySelector('[data-clash-action="skill"]').click();
  root.querySelector('[data-clash-action-confirm]').click();

  const picker = root.querySelector('[data-clash-picker]');
  assert.equal(picker.hidden, false);

  const timeoutSelection = dom.window.clashFlowHooks.onActionTimeout();
  assert.equal(picker.hidden, true);
  assert.equal(timeoutSelection.action, 'skill');
  assert.equal(timeoutSelection.effectChoice.abilityKey, 'stone-reinforce');
  assert.equal(timeoutSelection.effectChoice.targetTeamSlot, 0);
  assert.equal(
    ['mouth', 'body', 'flight', 'eyes'].includes(
      timeoutSelection.effectChoice.optionKey
    ),
    true
  );
});
