const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const utilsSource = fs.readFileSync(
  path.join(__dirname, '../../public/scripts/general/utils/utils.js'),
  'utf8'
);
const overlaySource = fs.readFileSync(
  path.join(
    __dirname,
    '../../public/scripts/general/overlay-and-toggle/overlay-and-toggle.js'
  ),
  'utf8'
);

function createOverlayDom() {
  const dom = new JSDOM(
    '<!doctype html><body><section id="game-over"></section><section id="account"></section></body>',
    { runScripts: 'outside-only' }
  );

  dom.window.eval(`
    var elementClassArray = [];
    var popUpClassArray = [];
    var settingsElementClassArray = [];
    var permanantElementClassArray = [];
    var backButton = null;
    var headerExtraMenuButton = null;
    var extraMenuContainer = null;
    var headerSettingsButton = null;
    var settingsBox = null;
    var headerHelpButton = null;
    var helpContainer = null;
    var accountIconButton = null;
    var accountContainer = null;
    var playedContainerSounds = [];
    function playSoundEffect(soundKey) {
      playedContainerSounds.push(soundKey);
    }
  `);
  dom.window.eval(utilsSource);
  dom.window.eval(overlaySource);
  return dom;
}

test('a dismissible settings layer suspends and restores a permanent layer', () => {
  const dom = createOverlayDom();
  const gameOver = dom.window.document.getElementById('game-over');
  const account = dom.window.document.getElementById('account');

  dom.window.addElementIfNotExists(
    dom.window.permanantElementClassArray,
    gameOver,
    { sound: false }
  );
  assert.equal(gameOver.classList.contains('is-visible'), true);
  assert.equal(dom.window.overlayText.hidden, true);

  dom.window.addElementIfNotExists(
    dom.window.settingsElementClassArray,
    account
  );
  assert.equal(gameOver.classList.contains('is-visible'), false);
  assert.equal(account.classList.contains('is-visible'), true);
  assert.equal(dom.window.overlayText.hidden, false);

  dom.window.toggleOverlay(false);
  assert.equal(account.classList.contains('is-visible'), false);
  assert.equal(gameOver.classList.contains('is-visible'), true);
  assert.equal(dom.window.overlayText.hidden, true);
  assert.deepEqual(Array.from(dom.window.playedContainerSounds), [
    'containerOpen',
    'containerClose'
  ]);
});

test('managed containers use default transition sounds only for real actions', () => {
  const dom = createOverlayDom();
  const account = dom.window.document.getElementById('account');

  dom.window.addElementIfNotExists(
    dom.window.settingsElementClassArray,
    account
  );
  dom.window.addElementIfNotExists(
    dom.window.settingsElementClassArray,
    account
  );
  dom.window.toggleOverlay(false);
  dom.window.toggleOverlay(false);

  assert.deepEqual(Array.from(dom.window.playedContainerSounds), [
    'containerOpen',
    'containerClose'
  ]);
});

test('managed containers support custom and silent transition sounds', () => {
  const dom = createOverlayDom();
  const account = dom.window.document.getElementById('account');
  const gameOver = dom.window.document.getElementById('game-over');

  account.dataset.containerOpenSound = 'accountOpen';
  account.dataset.containerCloseSound = 'accountClose';
  dom.window.addElementIfNotExists(
    dom.window.settingsElementClassArray,
    account
  );
  dom.window.toggleOverlay(false);

  gameOver.dataset.containerOpenSound = 'none';
  gameOver.dataset.containerCloseSound = 'none';
  dom.window.addElementIfNotExists(dom.window.elementClassArray, gameOver);
  dom.window.toggleOverlay(false);

  assert.deepEqual(Array.from(dom.window.playedContainerSounds), [
    'accountOpen',
    'accountClose'
  ]);
});

test('suspending and restoring an underlying container does not replay sounds', () => {
  const dom = createOverlayDom();
  const gameOver = dom.window.document.getElementById('game-over');
  const account = dom.window.document.getElementById('account');

  dom.window.addElementIfNotExists(
    dom.window.permanantElementClassArray,
    gameOver,
    { sound: false }
  );
  dom.window.addElementIfNotExists(
    dom.window.settingsElementClassArray,
    account
  );
  dom.window.toggleOverlay(false);

  assert.equal(gameOver.classList.contains('is-visible'), true);
  assert.deepEqual(Array.from(dom.window.playedContainerSounds), [
    'containerOpen',
    'containerClose'
  ]);
});

test('loading the overlay script again reuses the single backdrop', () => {
  const dom = createOverlayDom();

  dom.window.eval(overlaySource);

  assert.equal(dom.window.document.querySelectorAll('#overlay').length, 1);
  assert.equal(dom.window.document.querySelectorAll('.overlay-text').length, 1);
});
