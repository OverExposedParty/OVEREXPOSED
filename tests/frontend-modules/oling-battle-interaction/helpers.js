const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const battleScript = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    '..',
    '..',
    'public',
    'scripts',
    'olings',
    'battle',
    'battle-olings.js'
  ),
  'utf8'
);
const battleModuleScripts = [
  'audio.js',
  'layout.js',
  'timing.js',
  'interaction.js'
].map((filename) =>
  fs.readFileSync(
    path.join(
      __dirname,
      '..',
      '..',
      '..',
      'public',
      'scripts',
      'olings',
      'battle',
      'runtime',
      filename
    ),
    'utf8'
  )
);
const battleDemoOlingsScript = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    '..',
    '..',
      'public',
      'scripts',
      'olings',
      'battle',
      'battle-olings-demo-olings.js'
  ),
  'utf8'
);
const battleLobbyScript = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    '..',
    '..',
      'public',
      'scripts',
      'olings',
      'battle',
      'battle-olings-lobby.js'
  ),
  'utf8'
);
const battleLobbyModuleScripts = [
  'context.js',
  'visuals.js',
  'controls.js',
  'api.js',
  'match-sync.js'
].map((filename) =>
  fs.readFileSync(
    path.join(
      __dirname,
      '..',
      '..',
      '..',
      'public',
      'scripts',
      'olings',
      'battle',
      'lobby',
      filename
    ),
    'utf8'
  )
);
const battleLobbySource = [battleLobbyScript, ...battleLobbyModuleScripts].join(
  '\n'
);
const battleStylesPath = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'public',
  'css',
  'olings',
  'battle',
  'battle-olings.css'
);
const battleStylesEntry = fs.readFileSync(battleStylesPath, 'utf8');
const battleStyles = [
  battleStylesEntry,
  ...[...battleStylesEntry.matchAll(/@import url\('\.\/([^']+)'\);/g)].map(
    (match) =>
      fs.readFileSync(
        path.join(path.dirname(battleStylesPath), match[1]),
        'utf8'
      )
  )
].join('\n');

function createBattleDom(body, options = {}) {
  return new JSDOM(
    `<!doctype html>
      <html>
        <body>${body}</body>
      </html>`,
    {
      runScripts: 'dangerously',
      pretendToBeVisual: true,
      ...options
    }
  );
}

function loadBattleScripts(window) {
  window.eval(battleDemoOlingsScript);
  battleLobbyModuleScripts.forEach((script) => window.eval(script));
  window.eval(battleLobbyScript);
  battleModuleScripts.forEach((script) => window.eval(script));
  window.eval(battleScript);
}

function getSproutOling() {
  return {
    id: 'oling-1',
    name: 'Sprout',
    level: 3,
    eggKey: 'base-egg',
    personalityKey: 'friendly',
    care: { energy: 80, maxEnergy: 100 },
    build: {
      flight: 'moss-wings',
      body: 'moss-body',
      eyes: 'moss-eyes',
      mouth: 'moss-mouth'
    },
    traits: {
      flight: {
        name: 'Moss Wings',
        assets: { image: '/flight.svg' }
      },
      body: {
        name: 'Moss Body',
        assets: { image: '/body.svg' },
        body: { health: 118 }
      },
      eyes: { name: 'Moss Eyes', assets: { image: '/eyes.svg' } },
      mouth: { name: 'Moss Mouth', assets: { image: '/mouth.svg' } }
    }
  };
}

function getWaitingMatch(oling = getSproutOling()) {
  return {
    matchCode: 'ABC-123',
    status: 'waiting',
    state: { phase: 'waiting' },
    players: [
      {
        accountId: 'account-1',
        slot: 'player-one',
        ready: false,
        connected: true,
        maxHealth: 118,
        currentHealth: 118,
        olingSnapshot: oling
      }
    ]
  };
}

function createChooseOlingLobbyDom() {
  return createBattleDom(
    `<main class="battle-olings-page">
      <section class="oling-battle-shell is-lobby" data-match-length="30">
        <div class="oling-battle-timer" data-match-length="30"></div>
        <section class="oling-battle-arena" aria-hidden="true"></section>
        <footer class="oling-battle-command-panel"></footer>
        <section class="oling-battle-lobby-screen">
          <div class="oling-battle-lobby-matchup">
            <div class="oling-battle-screen-upper-half">
              <div class="oling-battle-lobby-party is-players">
                <button class="oling-battle-lobby-player-select-trigger" type="button"></button>
                <button class="oling-battle-lobby-player-oling" type="button"></button>
                <div class="oling-battle-lobby-oe"></div>
                <div class="oling-battle-lobby-side-label"><span class="username"></span><span class="checkmark"></span></div>
                <div class="oling-battle-lobby-oling-picker" hidden>
                  <button class="oling-battle-lobby-oling-arrow is-previous" type="button"></button>
                  <div class="oling-battle-lobby-oling-picker-preview"></div>
                  <button class="oling-battle-lobby-oling-arrow is-next" type="button"></button>
                </div>
              </div>
            </div>
            <div class="oling-battle-screen-lower-half">
              <div class="oling-battle-lobby-party is-enemies is-waiting-for-player">
                <div class="oling-battle-lobby-waiting"><span>WAITING FOR PLAYER</span></div>
                <button class="oling-battle-lobby-enemy-select-trigger" type="button"></button>
                <button class="close-btn oling-battle-lobby-kick" type="button" hidden></button>
                <button class="oling-battle-lobby-enemy-oling" type="button"></button>
                <div class="oling-battle-lobby-oe"></div>
                <div class="oling-battle-lobby-side-label"><span class="username"></span><span class="checkmark"></span></div>
              </div>
              <article class="oling-battle-lobby-oling-description oling-battle-lobby-player-description" hidden>
                <dl class="oling-battle-lobby-description-stats"></dl>
              </article>
            </div>
          </div>
        </section>
        <footer class="oling-battle-lobby-footer">
          <div class="oling-battle-lobby-actions">
            <div class="oling-battle-lobby-share-row">
              <input class="oling-battle-lobby-code" />
              <button class="oling-battle-lobby-copy" type="button"></button>
              <button class="oling-battle-lobby-qr" type="button"></button>
            </div>
            <div class="oling-battle-lobby-energy" hidden>
              <span class="oling-battle-lobby-energy-fill"></span>
              <strong class="oling-battle-lobby-energy-value"></strong>
            </div>
            <button class="oling-battle-lobby-ready" type="button">READY UP</button>
          </div>
        </footer>
      </section>
      <section class="oling-battle-no-oling" tabindex="-1" hidden></section>
    </main>`,
    { url: 'https://overexposed.app/olings/battle' }
  );
}

module.exports = {
  battleLobbySource,
  battleStyles,
  createBattleDom,
  createChooseOlingLobbyDom,
  getSproutOling,
  getWaitingMatch,
  loadBattleScripts
};
