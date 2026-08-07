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
const modeSelectionSource = fs.readFileSync(
  path.join(
    __dirname,
    '../../public/scripts/html-templates/gamemode-settings/mode-selection-template.js'
  ),
  'utf8'
);
const playModeSelectionSource = fs.readFileSync(
  path.join(
    __dirname,
    '../../public/scripts/party-games/gamemode-settings/play-mode-selection.js'
  ),
  'utf8'
);

const svgSources = new Map(
  ['online', 'offline'].flatMap((mode) =>
    ['artwork', 'content'].map((layer) => {
      const publicPath = `/images/party-games/mode-selection/${mode}/${layer}.svg`;
      const filePath = path.join(
        __dirname,
        `../../public/images/party-games/mode-selection/${mode}/${layer}.svg`
      );
      return [publicPath, fs.readFileSync(filePath, 'utf8')];
    })
  )
);
svgSources.set(
  '/images/party-games/mode-selection/party-active.svg',
  fs.readFileSync(
    path.join(
      __dirname,
      '../../public/images/party-games/mode-selection/party-active.svg'
    ),
    'utf8'
  )
);
svgSources.set(
  '/images/icons/oe-help-icon.svg',
  fs.readFileSync(
    path.join(__dirname, '../../public/images/icons/oe-help-icon.svg'),
    'utf8'
  )
);

function createModeSelectionDom({
  onlineResult = true,
  toggleOnlineMode = null,
  url = 'https://overexposed.app/truth-or-dare/settings'
} = {}) {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'outside-only',
    url
  });

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
    var partyGameMode = 'truth-or-dare';
    var partyGamesInformation = {
      'truth-or-dare': { forceOnline: false }
    };
    function playSoundEffect() {}
  `);

  dom.window.fetch = async (publicPath) => ({
    ok: svgSources.has(publicPath),
    text: async () => svgSources.get(publicPath)
  });
  dom.window.toggleOnlineModeCalls = [];
  dom.window.ToggleOnlineMode = async (enabled, options = {}) => {
    dom.window.toggleOnlineModeCalls.push(enabled);
    if (typeof toggleOnlineMode === 'function') {
      return toggleOnlineMode(enabled, options);
    }
    return onlineResult;
  };
  dom.window.offlineSwitcherModes = [];
  dom.window.syncOfflinePartyGameSwitcherButton = (gamemode) => {
    dom.window.offlineSwitcherModes.push(gamemode);
  };

  dom.window.eval(utilsSource);
  dom.window.eval(overlaySource);
  dom.window.eval(modeSelectionSource);
  dom.window.eval(playModeSelectionSource);
  return dom;
}

test('mode buttons use themed artwork and content inline SVG layers', async () => {
  const dom = createModeSelectionDom();
  const container = await dom.window.initializeModeSelection();
  const options = container.querySelectorAll('.mode-selection-option');
  const buttons = container.querySelectorAll('.mode-selection-button');
  const helpButtons = container.querySelectorAll('.mode-selection-help-button');
  const separator = container.querySelector('.mode-selection-separator');
  const headerTitle = container.querySelector('.mode-selection-header-title');

  assert.equal(options.length, 2);
  assert.equal(buttons.length, 2);
  assert.equal(helpButtons.length, 2);
  assert.equal(headerTitle.textContent, 'ONE DEVICE OR MANY');
  assert.equal(container.getAttribute('aria-labelledby'), headerTitle.id);
  assert.equal(separator.textContent, 'OR');
  assert.equal(separator.getAttribute('aria-hidden'), 'true');
  const progress = container.querySelector('.mode-selection-progress');
  assert.ok(progress);
  assert.equal(progress.hidden, true);
  assert.equal(progress.getAttribute('role'), 'progressbar');
  buttons.forEach((button) => {
    const artboard = button.querySelector(':scope > .mode-selection-artboard');
    const layers = artboard.querySelectorAll(':scope > svg');
    assert.equal(button.getAttribute('aria-pressed'), 'false');
    assert.equal(artboard.getAttribute('aria-hidden'), 'true');
    assert.equal(layers.length, button.dataset.mode === 'online' ? 3 : 2);
    assert.equal(
      layers[0].classList.contains('mode-selection-svg--artwork'),
      true
    );
    assert.equal(
      layers[1].classList.contains('mode-selection-svg--content'),
      true
    );

    const artworkStyles = Array.from(
      layers[0].querySelectorAll('style'),
      (style) => style.textContent
    ).join(' ');
    const contentStyles = Array.from(
      layers[1].querySelectorAll('style'),
      (style) => style.textContent
    ).join(' ');
    assert.match(artworkStyles, /var\(--primarypagecolour\)/);
    assert.match(artworkStyles, /var\(--secondarypagecolour\)/);
    assert.doesNotMatch(artworkStyles, /#(?:66ccff|6cf)(?![0-9a-f])/i);
    assert.doesNotMatch(artworkStyles, /#427bb9/i);
    assert.doesNotMatch(contentStyles, /var\(--primarypagecolour\)/);
    assert.doesNotMatch(contentStyles, /var\(--secondarypagecolour\)/);

    if (button.dataset.mode === 'online') {
      const partyActiveStyles = Array.from(
        layers[2].querySelectorAll('style'),
        (style) => style.textContent
      ).join(' ');
      assert.equal(
        layers[2].classList.contains('mode-selection-svg--party-active'),
        true
      );
      assert.match(partyActiveStyles, /var\(--primarypagecolour\)/);
      assert.doesNotMatch(partyActiveStyles, /#(?:66ccff|6cf)(?![0-9a-f])/i);
      assert.ok(
        artboard.querySelector('.mode-selection-party-active-backdrop')
      );
    }
  });

  options.forEach((option) => {
    const modeButton = option.querySelector(':scope > .mode-selection-button');
    const helpButton = option.querySelector(
      ':scope > .mode-selection-help-anchor > .mode-selection-help-button'
    );
    const helpIcon = helpButton.querySelector('.mode-selection-help-icon');

    assert.equal(helpButton.dataset.modeHelp, modeButton.dataset.mode);
    assert.equal(
      helpButton.getAttribute('aria-label'),
      `Help with ${
        modeButton.dataset.mode === 'online' ? 'Online' : 'Offline'
      } mode`
    );
    const helpIconStyles = Array.from(
      helpIcon.querySelectorAll('style'),
      (style) => style.textContent
    ).join(' ');
    assert.equal(helpIcon.tagName.toLowerCase(), 'svg');
    assert.match(helpIconStyles, /var\(--mode-selection-help-colour\)/);
    assert.doesNotMatch(helpIconStyles, /#fd6a6a/i);
    assert.match(helpIconStyles, /#202020/i);
    assert.equal(helpIcon.getAttribute('aria-hidden'), 'true');
    assert.equal(modeButton.querySelector('.mode-selection-help-button'), null);
  });
});

test('help buttons open one card help panel without selecting a mode', async () => {
  const dom = createModeSelectionDom();
  const container = await dom.window.initializeModeSelection();
  const onlineOption = container.querySelector(
    '.mode-selection-option--online'
  );
  const offlineOption = container.querySelector(
    '.mode-selection-option--offline'
  );
  const onlineHelpButton = onlineOption.querySelector(
    '.mode-selection-help-button'
  );
  const offlineHelpButton = offlineOption.querySelector(
    '.mode-selection-help-button'
  );

  onlineHelpButton.dispatchEvent(
    new dom.window.MouseEvent('click', { bubbles: true })
  );

  const onlinePanel = onlineOption.querySelector('.mode-selection-help-panel');
  assert.equal(onlineOption.classList.contains('is-help-open'), true);
  assert.equal(onlinePanel.hidden, false);
  assert.equal(onlinePanel.getAttribute('aria-hidden'), 'false');
  assert.equal(onlineHelpButton.getAttribute('aria-expanded'), 'true');
  assert.equal(
    onlinePanel.querySelector('.mode-selection-help-title').textContent,
    'Online'
  );
  assert.equal(
    onlinePanel.querySelector('.mode-selection-help-description').textContent,
    'Everyone plays on their own device'
  );
  assert.equal(
    onlineOption.querySelector('.mode-selection-button').disabled,
    true
  );

  offlineHelpButton.dispatchEvent(
    new dom.window.MouseEvent('click', { bubbles: true })
  );

  const offlinePanel = offlineOption.querySelector(
    '.mode-selection-help-panel'
  );
  assert.equal(onlineOption.classList.contains('is-help-open'), false);
  assert.equal(onlinePanel.hidden, true);
  assert.equal(offlineOption.classList.contains('is-help-open'), true);
  assert.equal(offlinePanel.hidden, false);

  offlinePanel
    .querySelector('.mode-selection-help-back')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

  assert.equal(offlineOption.classList.contains('is-help-open'), false);
  assert.equal(offlinePanel.hidden, true);
  assert.equal(offlineHelpButton.getAttribute('aria-expanded'), 'false');
  assert.equal(
    offlineOption.querySelector('.mode-selection-button').disabled,
    false
  );
  assert.equal(container.classList.contains('is-visible'), true);
  assert.deepEqual(Array.from(dom.window.toggleOnlineModeCalls), []);
  container.querySelectorAll('.mode-selection-button').forEach((button) => {
    assert.equal(button.classList.contains('is-selected'), false);
    assert.equal(button.getAttribute('aria-pressed'), 'false');
  });
});

test('mode selection ignores backdrop dismissal and closes from either button', async () => {
  for (const mode of ['online', 'offline']) {
    const dom = createModeSelectionDom();
    const container = await dom.window.initializeModeSelection();

    assert.equal(
      dom.window.permanantElementClassArray.includes(container),
      true
    );
    assert.equal(container.classList.contains('is-visible'), true);
    assert.equal(
      dom.window.overlay.classList.contains('mode-selection-overlay-blur'),
      true
    );

    dom.window.toggleOverlay(false);
    assert.equal(container.classList.contains('is-visible'), true);

    const selectedButton = container.querySelector(
      `.mode-selection-button--${mode}`
    );
    selectedButton.dispatchEvent(
      new dom.window.MouseEvent('click', { bubbles: true })
    );

    assert.equal(selectedButton.classList.contains('is-selected'), true);
    assert.equal(selectedButton.getAttribute('aria-pressed'), 'true');
    assert.equal(container.classList.contains('is-visible'), true);
    assert.deepEqual(
      Array.from(dom.window.toggleOnlineModeCalls),
      mode === 'online' ? [true] : []
    );

    if (mode === 'online') {
      await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
      const progress = selectedButton.querySelector('.mode-selection-progress');
      assert.equal(progress.getAttribute('aria-valuenow'), '100');
      assert.equal(container.classList.contains('is-visible'), true);

      const transitionEnd = new dom.window.Event('transitionend', {
        bubbles: true
      });
      Object.defineProperty(transitionEnd, 'propertyName', {
        value: '--mode-selection-online-progress'
      });
      progress.dispatchEvent(transitionEnd);
      await new Promise((resolve) => dom.window.setTimeout(resolve, 430));
    } else {
      await new Promise((resolve) => dom.window.setTimeout(resolve, 240));
    }
    assert.equal(
      dom.window.permanantElementClassArray.includes(container),
      false
    );
    assert.equal(container.classList.contains('is-visible'), false);
    assert.equal(
      dom.window.overlay.classList.contains('mode-selection-overlay-blur'),
      false
    );
  }
});

test('choosing offline enables the offline game switcher', async () => {
  const dom = createModeSelectionDom();
  const container = await dom.window.initializeModeSelection();

  container
    .querySelector('.mode-selection-button--offline')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 240));

  assert.deepEqual(Array.from(dom.window.offlineSwitcherModes), [
    'truth-or-dare'
  ]);
});

test('offline switch navigation skips mode selection and consumes its URL handoff', async () => {
  const dom = createModeSelectionDom({
    url: 'https://overexposed.app/truth-or-dare/settings?playMode=offline'
  });

  const container = await dom.window.initializeModeSelection();

  assert.equal(container, null);
  assert.equal(
    dom.window.document.querySelector('.mode-selection-container'),
    null
  );
  assert.equal(dom.window.location.search, '');
  assert.deepEqual(Array.from(dom.window.offlineSwitcherModes), [
    'truth-or-dare'
  ]);
});

test('failed online creation leaves the mode selection open and reusable', async () => {
  const dom = createModeSelectionDom({ onlineResult: false });
  const container = await dom.window.initializeModeSelection();
  const onlineButton = container.querySelector(
    '.mode-selection-button--online'
  );

  onlineButton.dispatchEvent(
    new dom.window.MouseEvent('click', { bubbles: true })
  );
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

  assert.deepEqual(Array.from(dom.window.toggleOnlineModeCalls), [true]);
  assert.equal(container.classList.contains('is-visible'), true);
  assert.equal(container.getAttribute('aria-busy'), 'false');
  assert.equal(onlineButton.disabled, false);
  assert.equal(onlineButton.classList.contains('is-selected'), false);
  assert.equal(
    onlineButton.querySelector('.mode-selection-progress').hidden,
    true
  );
  assert.equal(onlineButton.classList.contains('is-loading'), false);
  assert.equal(onlineButton.style.getPropertyValue('border-color'), '');
});

test('online creation outline reports intermediate progress and resets on cancel', async () => {
  let resolveOnlineCreation;
  const dom = createModeSelectionDom({
    toggleOnlineMode(_enabled, { onProgress }) {
      onProgress({ value: 42, label: 'Host profile ready' });
      return new Promise((resolve) => {
        resolveOnlineCreation = resolve;
      });
    }
  });
  const container = await dom.window.initializeModeSelection();
  const onlineButton = container.querySelector(
    '.mode-selection-button--online'
  );
  const progress = onlineButton.querySelector('.mode-selection-progress');

  onlineButton.dispatchEvent(
    new dom.window.MouseEvent('click', { bubbles: true })
  );
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

  assert.equal(onlineButton.classList.contains('is-loading'), true);
  assert.equal(onlineButton.disabled, true);
  assert.equal(onlineButton.style.borderColor, 'transparent');
  assert.equal(progress.hidden, false);
  assert.equal(progress.getAttribute('aria-valuenow'), '42');
  assert.equal(progress.getAttribute('aria-valuetext'), 'Host profile ready');
  assert.equal(
    progress.style.getPropertyValue('--mode-selection-online-progress'),
    '42'
  );

  resolveOnlineCreation(false);
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

  assert.equal(onlineButton.classList.contains('is-loading'), false);
  assert.equal(onlineButton.disabled, false);
  assert.equal(progress.hidden, true);
  assert.equal(progress.getAttribute('aria-valuenow'), '0');
  assert.equal(onlineButton.style.getPropertyValue('border-color'), '');
});

test('active-party mode supports a future navigation handler', async () => {
  const dom = createModeSelectionDom();
  const container = await dom.window.initializeModeSelection();
  const onlineButton = container.querySelector(
    '.mode-selection-button--online'
  );
  const activeParty = {
    code: 'ABC-123',
    key: 'paranoia',
    modeName: 'Paranoia',
    primaryColour: '#9D8AFF',
    secondaryColour: '#7F71B2',
    statusText: 'Waiting for players',
    returnPath: '/paranoia/settings?partyCode=ABC-123',
    isHost: true
  };
  const handledSessions = [];

  dom.window.PartyPlayModeController.setActivePartyActionHandler(
    async (session) => {
      handledSessions.push(session);
      return true;
    }
  );
  dom.window.dispatchEvent(
    new dom.window.CustomEvent('oe-active-party-lobby-state-changed', {
      detail: { active: true, session: activeParty }
    })
  );

  assert.equal(onlineButton.dataset.modeAction, 'active-party');
  assert.equal(onlineButton.dataset.activePartyCode, 'ABC-123');
  assert.equal(
    onlineButton
      .closest('.mode-selection-option')
      .classList.contains('has-active-party'),
    true
  );
  const onlineOption = onlineButton.closest('.mode-selection-option');
  assert.equal(
    onlineOption.style.getPropertyValue('--primarypagecolour'),
    '#9D8AFF'
  );
  assert.equal(
    onlineOption.style.getPropertyValue('--secondarypagecolour'),
    '#7F71B2'
  );
  assert.equal(
    onlineOption.querySelector('.mode-selection-help-title').textContent,
    'Party Active'
  );
  assert.equal(
    onlineOption.querySelector('[data-party-field="gamemode"]').textContent,
    'Paranoia'
  );
  assert.equal(
    onlineOption.querySelector('[data-party-field="code"]').textContent,
    'ABC-123'
  );
  assert.equal(
    onlineOption.querySelector('[data-party-field="status"]').textContent,
    'Waiting for players'
  );
  assert.equal(
    onlineOption.querySelector('[data-party-field="role"]').textContent,
    'Host'
  );
  assert.equal(
    onlineOption.querySelector('.mode-selection-party-details').hidden,
    false
  );
  assert.equal(
    onlineOption.querySelector('.mode-selection-help-description').hidden,
    true
  );
  assert.equal(
    onlineOption
      .querySelector('.mode-selection-help-button')
      .getAttribute('aria-label'),
    'Active party details'
  );
  assert.match(onlineButton.getAttribute('aria-label'), /Manage active party/);

  onlineButton.dispatchEvent(
    new dom.window.MouseEvent('click', { bubbles: true })
  );
  await new Promise((resolve) => dom.window.setTimeout(resolve, 240));

  assert.deepEqual(handledSessions, [activeParty]);
  assert.deepEqual(Array.from(dom.window.toggleOnlineModeCalls), []);
  assert.equal(container.classList.contains('is-visible'), false);
});

test('active online card opens party management instead of creating a party', async () => {
  const dom = createModeSelectionDom();
  const container = await dom.window.initializeModeSelection();
  const onlineButton = container.querySelector(
    '.mode-selection-button--online'
  );
  const openedDialogs = [];
  const activeParty = {
    code: 'ABC-123',
    key: 'paranoia',
    modeName: 'Paranoia',
    primaryColour: '#9D8AFF',
    secondaryColour: '#7F71B2',
    statusText: 'Game in progress',
    returnPath: '/paranoia/ABC-123',
    isHost: true
  };

  dom.window.refreshActivePartyLobbyLock = async () => false;
  dom.window.endActiveOwnedParty = async () => true;
  dom.window.ActivePartyConflictDialog = {
    open(options) {
      openedDialogs.push(options);
      return {};
    }
  };
  dom.window.dispatchEvent(
    new dom.window.CustomEvent('oe-active-party-lobby-state-changed', {
      detail: { active: true, session: activeParty }
    })
  );

  onlineButton.dispatchEvent(
    new dom.window.MouseEvent('click', { bubbles: true })
  );
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

  assert.equal(openedDialogs.length, 1);
  assert.equal(openedDialogs[0].partyCode, 'ABC-123');
  assert.equal(openedDialogs[0].gamemode, 'paranoia');
  assert.equal(openedDialogs[0].returnPath, '/paranoia/ABC-123');
  assert.equal(openedDialogs[0].source, 'party-management');
  assert.equal(openedDialogs[0].conflictType, 'owner');
  assert.equal(typeof openedDialogs[0].onEnd, 'function');
  assert.equal(openedDialogs[0].onLeave, null);
  assert.deepEqual(Array.from(dom.window.toggleOnlineModeCalls), []);
  assert.equal(container.classList.contains('is-visible'), true);
  assert.equal(container.getAttribute('aria-busy'), 'false');

  dom.window.PartyPlayModeController.setActivePartySession(null);
  const onlineOption = onlineButton.closest('.mode-selection-option');
  assert.equal(onlineButton.dataset.modeAction, 'create-party');
  assert.equal(
    onlineButton
      .closest('.mode-selection-option')
      .classList.contains('has-active-party'),
    false
  );
  assert.equal(onlineOption.style.getPropertyValue('--primarypagecolour'), '');
  assert.equal(onlineButton.dataset.activePartyCode, undefined);
  assert.equal(
    onlineOption.querySelector('.mode-selection-help-title').textContent,
    'Online'
  );
  assert.equal(
    onlineOption.querySelector('.mode-selection-party-details').hidden,
    true
  );
  assert.equal(
    onlineOption.querySelector('.mode-selection-help-description').hidden,
    false
  );
});
