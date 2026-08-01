const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const publicDirectory = path.join(__dirname, '..', '..', 'public');
const templateDirectory = path.join(
  publicDirectory,
  'scripts',
  'html-templates'
);
const modulePaths = [
  '/scripts/html-templates/core-template/bootstrap.js',
  '/scripts/general/debug/debug-service.js',
  '/scripts/html-templates/core-template/registry.js',
  '/scripts/html-templates/core-template/assets.js',
  '/scripts/html-templates/core-template/loader.js',
  '/scripts/html-templates/core-template/lifecycle.js',
  '/scripts/html-templates/core-template/observer.js'
];

test('core template bootstrap loads ordered support modules with its version', async () => {
  const loadedScripts = [];
  const context = {
    Promise,
    URL,
    encodeURIComponent,
    console,
    window: null,
    document: {
      currentScript: {
        getAttribute: () =>
          '/scripts/html-templates/core-template/core-template.js?v=test-1'
      },
      createElement: () => ({}),
      head: {
        appendChild(script) {
          loadedScripts.push(script.src);
          script.onload();
        }
      }
    }
  };
  context.window = context;
  context.window.location = { origin: 'https://overexposed.test' };

  vm.runInNewContext(
    fs.readFileSync(
      path.join(templateDirectory, 'core-template', 'core-template.js'),
      'utf8'
    ),
    context,
    { filename: 'core-template.js' }
  );
  await context.OECoreTemplateReady;

  assert.deepEqual(
    loadedScripts,
    modulePaths.map((pathname) => `${pathname}?v=test-1`)
  );
  assert.equal(context.__OECoreTemplateInitialAssetVersion, 'test-1');
});

test('core template support modules are present', () => {
  modulePaths.forEach((pathname) => {
    assert.ok(fs.existsSync(path.join(publicDirectory, pathname.slice(1))));
  });
});

test('active containers play explicit open sounds only when newly shown', () => {
  const lifecycleSource = fs.readFileSync(
    path.join(templateDirectory, 'core-template', 'lifecycle.js'),
    'utf8'
  );
  const playedTransitions = [];

  function createContainer(openSound) {
    const classes = new Set();
    return {
      classList: {
        add(className) {
          classes.add(className);
        },
        contains(className) {
          return classes.has(className);
        },
        remove(className) {
          classes.delete(className);
        }
      },
      dataset: openSound ? { containerOpenSound: openSound } : {}
    };
  }

  const playerMenu = createContainer('partyGamePlayerSelect');
  const otherContainer = createContainer();
  const window = {
    fetch: () => Promise.resolve(),
    setTimeout
  };
  window.window = window;

  const context = vm.createContext({
    Date,
    Promise,
    Request,
    document: {
      addEventListener() {},
      querySelector() {
        return null;
      },
      scripts: []
    },
    gameContainers: [playerMenu, otherContainer],
    hideContainer(container) {
      container.classList.remove('is-visible');
    },
    performance,
    playContainerTransitionSound(container, transition) {
      playedTransitions.push({
        sound: container.dataset.containerOpenSound,
        transition
      });
    },
    reportOEDebug() {},
    setTimeout,
    showContainer(container) {
      container.classList.add('is-visible');
    },
    stripQuery(value) {
      return value;
    },
    versionAssetUrl(value) {
      return value;
    },
    window
  });

  vm.runInContext(lifecycleSource, context, {
    filename: 'lifecycle.js'
  });

  context.setActiveContainers(playerMenu);
  context.setActiveContainers(playerMenu);
  context.setActiveContainers(otherContainer);
  context.setActiveContainers(playerMenu);

  assert.deepEqual(playedTransitions, [
    { sound: 'partyGamePlayerSelect', transition: 'open' },
    { sound: 'partyGamePlayerSelect', transition: 'open' }
  ]);
});

test('loader owns helpers needed during its initial execution', () => {
  const loader = fs.readFileSync(
    path.join(templateDirectory, 'core-template', 'loader.js'),
    'utf8'
  );

  assert.match(loader, /function stripQuery\(url\)/);
});

test('bootstrap debug reporting prefers the service and keeps a native fallback', () => {
  const bootstrap = fs.readFileSync(
    path.join(templateDirectory, 'core-template', 'bootstrap.js'),
    'utf8'
  );

  assert.match(bootstrap, /const logger = window\.OEDebug\?\.\[level\]/);
  assert.match(bootstrap, /fallback\.call\(console, prefix/);
  assert.match(bootstrap, /window\.reportOEDebug = reportOEDebug/);
});

test('structured debug service loads before loader modules and sound', () => {
  const coreTemplate = fs.readFileSync(
    path.join(templateDirectory, 'core-template', 'core-template.js'),
    'utf8'
  );
  const registry = fs.readFileSync(
    path.join(templateDirectory, 'core-template', 'registry.js'),
    'utf8'
  );
  const debugIndex = coreTemplate.indexOf(
    '/scripts/general/debug/debug-service.js'
  );
  const loaderIndex = coreTemplate.indexOf(
    '/scripts/html-templates/core-template/loader.js'
  );
  const soundIndex = registry.indexOf('/scripts/general/sound/sound.js');

  assert.ok(debugIndex >= 0, 'debug service should be a bootstrap module');
  assert.ok(
    debugIndex < loaderIndex,
    'debug service should load before loader.js'
  );
  assert.equal(
    registry.includes('/scripts/general/debug/debug-service.js'),
    false,
    'debug service should not be loaded again by the registry'
  );
  assert.ok(soundIndex >= 0, 'sound.js should remain registered');
});

test('loader diagnostics use hierarchical debug categories', () => {
  const loaderSources = ['loader.js', 'lifecycle.js', 'observer.js'].map(
    (filename) =>
      fs.readFileSync(
        path.join(templateDirectory, 'core-template', filename),
        'utf8'
      )
  );
  const combinedSource = loaderSources.join('\n');

  [
    'loader.scripts',
    'loader.lifecycle',
    'loader.ready',
    'loader.diagnostics'
  ].forEach((category) => {
    assert.match(
      combinedSource,
      new RegExp(`['"]${category.replace('.', '\\.')}['"]`)
    );
  });
  assert.doesNotMatch(
    combinedSource,
    /console\.(?:log|debug|info|warn|error|groupCollapsed|groupEnd)/
  );
});

test('captured application diagnostics use debug-service categories', () => {
  const activeLobbySource = fs.readFileSync(
    path.join(
      publicDirectory,
      'scripts/general/popup-feed/popup-feed-lobby-notifications.js'
    ),
    'utf8'
  );
  const partyChatSource = fs.readFileSync(
    path.join(publicDirectory, 'scripts/party-games/chat/party-chat-panel.js'),
    'utf8'
  );

  assert.match(activeLobbySource, /['"]notifications\.active-lobby['"]/);
  assert.match(partyChatSource, /['"]party\.chat['"]/);
  [activeLobbySource, partyChatSource].forEach((source) => {
    assert.doesNotMatch(
      source,
      /console\.(?:log|debug|info|warn|error|groupCollapsed|groupEnd)/
    );
  });
});
