const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const navigationPath = path.join(
  __dirname,
  '../../public/scripts/general/account-container/account-container-navigation.js'
);
const navigationSource = fs.readFileSync(navigationPath, 'utf8');
const autosuggestionSource = fs.readFileSync(
  path.join(
    __dirname,
    '../../public/scripts/general/input-autosuggestions/input-autosuggestions.js'
  ),
  'utf8'
);

function createSettingsContext({ authorized = true } = {}) {
  const dom = new JSDOM(
    '<!doctype html><body><div id="account-expanded-content"></div></body>',
    {
      runScripts: 'outside-only',
      url: 'https://overexposed.app/'
    }
  );
  const context = dom.getInternalVMContext();
  const setters = [];
  const hints = [];
  let status = {
    filter: 'audio',
    minimumLevel: 'info',
    enabled: true,
    historySize: 12,
    historyLimit: 250
  };
  let statusListener = null;
  let unsubscribeCount = 0;

  context.accountExpandedContent = dom.window.document.getElementById(
    'account-expanded-content'
  );
  context.getStoredAccount = () => ({ username: 'developer' });
  context.canAccountAccessSettingsConsole = () => authorized;
  context.accountFooterHintController = {
    setHint: (hint) => hints.push(hint),
    clearHint() {}
  };
  context.OEDebug = {
    getStatus: () => status,
    setFilter(filter) {
      setters.push(['filter', filter]);
      if (filter === 'invalid filter') return false;
      status = { ...status, filter };
      statusListener?.(status);
      return status;
    },
    setMinimumLevel(minimumLevel) {
      setters.push(['level', minimumLevel]);
      status = { ...status, minimumLevel };
      statusListener?.(status);
      return status;
    },
    subscribeStatus(listener) {
      statusListener = listener;
      listener(status);
      return () => {
        unsubscribeCount += 1;
        statusListener = null;
      };
    },
    filterSuggestions: ['all', 'off', 'audio', 'audio.playback']
  };

  vm.runInContext(autosuggestionSource, context, {
    filename: 'input-autosuggestions.js'
  });
  vm.runInContext(navigationSource, context, {
    filename: 'account-container-navigation.js'
  });

  return {
    context,
    dom,
    emitStatus(nextStatus) {
      status = { ...status, ...nextStatus };
      statusListener?.(status);
    },
    hints,
    setters,
    getUnsubscribeCount: () => unsubscribeCount
  };
}

test('advanced debugging settings use the service and follow status changes', () => {
  const fixture = createSettingsContext();
  const { context, dom, setters, hints } = fixture;

  vm.runInContext('renderAccountSettingsPanel()', context);

  const content = dom.window.document.getElementById(
    'account-expanded-content'
  );
  const sectionTitles = [
    ...content.querySelectorAll('.settings-section-title')
  ].map((title) => title.textContent);
  const filter = content.querySelector('#settings-debug-filter');
  const level = content.querySelector('#settings-debug-minimum-level');
  const history = content.querySelector('#settings-debug-history-usage');

  assert.ok(sectionTitles.includes('Advanced debugging'));
  assert.ok(filter.closest('.input-autosuggestion-shell'));
  assert.equal(filter.value, 'audio');
  assert.equal(level.value, 'info');
  assert.equal(history.textContent, '12 / 250 entries');

  filter.value = 'network.requests';
  filter.dispatchEvent(new dom.window.Event('change'));
  level.value = 'error';
  level.dispatchEvent(new dom.window.Event('change'));
  assert.deepEqual(setters, [
    ['filter', 'network.requests'],
    ['level', 'error']
  ]);
  assert.deepEqual(hints, [
    'Debug filter set to network.requests',
    'Minimum debug level set to error'
  ]);

  fixture.emitStatus({ historySize: 13 });
  assert.equal(history.textContent, '13 / 250 entries');

  filter.value = 'invalid filter';
  filter.dispatchEvent(new dom.window.Event('change'));
  assert.equal(filter.value, 'network.requests');
  assert.equal(hints.at(-1), 'Use off, all, or a dotted debug category');

  vm.runInContext('renderAccountSettingsPanel()', context);
  assert.equal(fixture.getUnsubscribeCount(), 1);

  dom.window.close();
});

test('advanced debugging settings reuse console access authorization', () => {
  const { context, dom } = createSettingsContext({ authorized: false });

  vm.runInContext('renderAccountSettingsPanel()', context);

  const content = dom.window.document.getElementById(
    'account-expanded-content'
  );
  assert.equal(content.querySelector('#settings-console'), null);
  assert.equal(content.querySelector('#settings-debug-filter'), null);
  assert.equal(content.textContent.includes('Advanced debugging'), false);

  dom.window.close();
});

test('advanced debugging UI leaves device storage to the debug service', () => {
  assert.doesNotMatch(
    navigationSource,
    /localStorage/,
    'the account debugging UI should only use the debug service API'
  );
});
