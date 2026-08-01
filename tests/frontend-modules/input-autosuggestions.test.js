const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const autosuggestionPath = path.join(
  __dirname,
  '../../public/scripts/general/input-autosuggestions/input-autosuggestions.js'
);
const autosuggestionSource = fs.readFileSync(autosuggestionPath, 'utf8');

function createAutosuggestionContext() {
  const dom = new JSDOM(
    '<!doctype html><body><div id="host"><input id="target"></div></body>',
    {
      runScripts: 'outside-only',
      url: 'https://overexposed.app/'
    }
  );
  const context = dom.getInternalVMContext();
  vm.runInContext(autosuggestionSource, context, {
    filename: 'input-autosuggestions.js'
  });
  return { context, dom, input: dom.window.document.getElementById('target') };
}

function settleSuggestions() {
  return new Promise((resolve) => setImmediate(resolve));
}

test('inline autosuggestions support keyboard acceptance and commits', async () => {
  const { context, dom, input } = createAutosuggestionContext();
  const commits = [];
  const controller = context.OEInputAutosuggestions.bind(input, {
    suggestions: [
      'all',
      'audio',
      'audio.errors',
      'audio.playback',
      'loader.scripts',
      'party.chat'
    ],
    onCommit: (value) => commits.push(value)
  });
  const suggestion = dom.window.document.querySelector(
    '.input-autosuggestion-value'
  );

  input.focus();
  input.value = 'au';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  await settleSuggestions();
  assert.equal(suggestion.hidden, false);
  assert.equal(suggestion.textContent, 'audio');
  assert.equal(input.getAttribute('aria-autocomplete'), 'inline');

  const tabEvent = new dom.window.KeyboardEvent('keydown', {
    key: 'Tab',
    bubbles: true,
    cancelable: true
  });
  input.dispatchEvent(tabEvent);
  assert.equal(tabEvent.defaultPrevented, true);
  assert.equal(input.value, 'audio');
  assert.deepEqual(commits, []);

  input.blur();
  assert.deepEqual(commits, ['audio']);

  input.focus();
  input.value = 'party.c';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  await settleSuggestions();
  input.dispatchEvent(
    new dom.window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true
    })
  );
  assert.equal(input.value, 'party.chat');
  assert.deepEqual(commits, ['audio', 'party.chat']);

  input.value = 'custom.branch';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  await settleSuggestions();
  assert.equal(suggestion.hidden, true);
  input.blur();
  assert.deepEqual(commits, ['audio', 'party.chat', 'custom.branch']);

  controller.destroy();
  assert.equal(
    dom.window.document.querySelector('.input-autosuggestion-shell'),
    null
  );
  assert.equal(input.parentElement.id, 'host');
  dom.window.close();
});

test('inline autosuggestions dismiss with Escape and ignore stale providers', async () => {
  const { context, dom, input } = createAutosuggestionContext();
  const pending = new Map();
  context.OEInputAutosuggestions.bind(input, {
    suggestions(value) {
      return new Promise((resolve) => pending.set(value, resolve));
    }
  });
  const suggestion = dom.window.document.querySelector(
    '.input-autosuggestion-value'
  );

  input.focus();
  input.value = 'a';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  input.value = 'au';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  pending.get('au')(['audio']);
  await settleSuggestions();
  assert.equal(suggestion.textContent, 'audio');

  pending.get('a')(['all']);
  await settleSuggestions();
  assert.equal(suggestion.textContent, 'audio');

  input.dispatchEvent(
    new dom.window.KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true
    })
  );
  assert.equal(suggestion.hidden, true);

  input.value = 'aud';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  pending.get('aud')(['audio']);
  await settleSuggestions();
  assert.equal(suggestion.hidden, false);
  assert.equal(suggestion.textContent, 'audio');
  dom.window.close();
});

test('autosuggestion utility loads before account settings and has shared styles', () => {
  const registry = fs.readFileSync(
    path.join(
      __dirname,
      '../../public/scripts/html-templates/core-template/registry.js'
    ),
    'utf8'
  );
  const styles = fs.readFileSync(
    path.join(
      __dirname,
      '../../public/css/general/settings/settings-controls.css'
    ),
    'utf8'
  );
  const autosuggestionIndex = registry.indexOf(
    '/scripts/general/input-autosuggestions/input-autosuggestions.js'
  );
  const accountIndex = registry.indexOf(
    '/scripts/general/account-container/account-container-core.js'
  );

  assert.ok(autosuggestionIndex >= 0);
  assert.ok(autosuggestionIndex < accountIndex);
  assert.match(styles, /\.input-autosuggestion-shell/);
  assert.match(styles, /\.input-autosuggestion-value/);
});
