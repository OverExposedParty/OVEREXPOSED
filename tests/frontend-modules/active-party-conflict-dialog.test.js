const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..', '..');
const dialogScriptPath = path.join(
  root,
  'public/scripts/general/online/active-party-conflict-dialog.js'
);
const oeDialogScriptPath = path.join(
  root,
  'public/scripts/general/oe-dialog/oe-dialog.js'
);
const tooltipScriptPath = path.join(
  root,
  'public/scripts/general/tool-tip/tool-tip.js'
);

function createDialogDom() {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'outside-only',
    url: 'https://overexposed.test/truth-or-dare/settings'
  });
  const { window } = dom;
  const loadedStylesheets = [];
  const copiedValues = [];

  window.requestAnimationFrame = (callback) => {
    callback();
    return 1;
  };
  window.HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  window.HTMLDialogElement.prototype.close = function close(returnValue = '') {
    if (!this.open) return;
    this.returnValue = returnValue;
    this.removeAttribute('open');
    this.dispatchEvent(new window.Event('close'));
  };
  window.LoadStylesheet = (href) => loadedStylesheets.push(href);
  window.copyTextToClipboard = async (value) => {
    copiedValues.push(value);
    return true;
  };
  window.eval(fs.readFileSync(tooltipScriptPath, 'utf8'));
  window.eval(fs.readFileSync(oeDialogScriptPath, 'utf8'));
  window.eval(fs.readFileSync(dialogScriptPath, 'utf8'));

  return { copiedValues, dom, loadedStylesheets, window };
}

test('active-party conflict dialog loads on online and login surfaces', () => {
  const scriptPath = '/scripts/general/online/active-party-conflict-dialog.js';
  const onlineSettings = fs.readFileSync(
    path.join(root, 'public/scripts/party-games/online/online-settings.js'),
    'utf8'
  );
  const loginPageScripts = fs.readFileSync(
    path.join(root, 'public/pages/auth/login/page-scripts.html'),
    'utf8'
  );

  assert.ok(onlineSettings.indexOf(scriptPath) >= 0);
  assert.ok(
    onlineSettings.indexOf(scriptPath) <
      onlineSettings.indexOf(
        '/scripts/party-games/online/party-api/party-data.js'
      )
  );
  assert.ok(loginPageScripts.indexOf(scriptPath) >= 0);
  assert.ok(
    loginPageScripts.indexOf(scriptPath) <
      loginPageScripts.indexOf('/scripts/auth/login/auth-submissions.js')
  );
});

test('openFromError recognises supported error envelopes and renders an accessible dialog', () => {
  const { dom, loadedStylesheets, window } = createDialogDom();

  try {
    const api = window.ActivePartyConflictDialog;
    assert.deepEqual(loadedStylesheets, [
      '/css/general/online/party-code-controls.css',
      '/css/general/online/active-party-conflict-dialog.css'
    ]);
    assert.equal(api.isConflict({ code: api.ERROR_CODE }), true);
    assert.equal(
      api.isConflict({ code: api.PARTICIPANT_ERROR_CODE }),
      true
    );
    assert.equal(
      api.isConflict({ data: { error: { code: api.ERROR_CODE } } }),
      true
    );
    assert.equal(api.openFromError({ error: { code: 'other_error' } }), false);
    assert.equal(
      api.openFromError({
        code: api.ERROR_CODE,
        lobbyPath: '/admin'
      }),
      false
    );
    assert.equal(
      window.document.querySelector('.active-party-conflict-dialog-host'),
      null
    );

    const handled = api.openFromError({
      error: {
        code: api.ERROR_CODE,
        details: {
          partyCode: ' abc-123 ',
          lobbyPath: '/truth-or-dare/ABC-123',
          gamemode: 'truth-or-dare'
        }
      }
    });

    assert.equal(handled, true);
    const dialog = window.document.querySelector(
      '.active-party-conflict-dialog-host'
    );
    const title = window.document.getElementById(
      dialog.getAttribute('aria-labelledby')
    );
    const description = window.document.getElementById(
      dialog.getAttribute('aria-describedby')
    );
    const returnLink = dialog.querySelector(
      '.active-party-conflict-dialog-action.is-primary'
    );

    assert.ok(dialog.open);
    assert.ok(title);
    assert.ok(description);
    assert.equal(
      dialog.querySelector('.active-party-conflict-dialog-close'),
      null
    );
    assert.equal(
      dialog.querySelector('.active-party-conflict-dialog-eyebrow'),
      null
    );
    assert.equal(
      dialog.querySelectorAll(
        '.active-party-conflict-dialog-mascot-stack img'
      ).length,
      4
    );
    assert.equal(
      dialog.querySelector('.active-party-conflict-dialog-header')
        .firstElementChild,
      title
    );
    assert.equal(
      dialog.querySelector('.active-party-conflict-dialog-media').children[1],
      description
    );
    assert.equal(title.textContent, 'You already have a party');
    assert.equal(
      description.textContent,
      'You already have an active party. Return to it or end it before creating another one.'
    );
    assert.equal(
      dialog.querySelector('.active-party-conflict-dialog-code').textContent,
      'ABC-123'
    );
    assert.equal(
      dialog.querySelector('.active-party-conflict-dialog-gamemode')
        .textContent,
      'Truth Or Dare'
    );
    const summaryMeta = dialog.querySelector(
      '.active-party-conflict-dialog-summary-meta'
    );
    assert.equal(
      summaryMeta.querySelector('.active-party-conflict-dialog-summary-label')
        .textContent,
      'Active party'
    );
    assert.equal(
      summaryMeta.querySelector('.active-party-conflict-dialog-gamemode')
        .textContent,
      'Truth Or Dare'
    );
    assert.equal(
      returnLink.getAttribute('href'),
      '/truth-or-dare/settings?partyCode=ABC-123'
    );
    assert.equal(window.document.activeElement, returnLink);
    assert.equal(
      dialog.style.getPropertyValue('--party-conflict-primary'),
      '#66CCFF'
    );
    assert.equal(
      dialog.style.getPropertyValue('--party-conflict-secondary'),
      '#427BB9'
    );

    const qrButton = dialog.querySelector(
      '.active-party-conflict-dialog-qr'
    );
    const media = dialog.querySelector('.active-party-conflict-dialog-media');
    const qrImage = dialog.querySelector(
      '.active-party-conflict-dialog-qr-image'
    );
    assert.ok(qrImage.src.includes('/api/party-qr/ABC-123'));
    assert.ok(qrImage.src.includes('color=%2366CCFF'));
    qrButton.click();
    assert.equal(media.classList.contains('is-qr-visible'), true);
    assert.equal(qrButton.getAttribute('aria-pressed'), 'true');
    qrButton.click();
    assert.equal(media.classList.contains('is-qr-visible'), false);

    assert.equal(
      api.openFromError({
        code: api.ERROR_CODE,
        partyCode: 'def-456',
        lobbyPath: '/would-you-rather/DEF-456',
        gamemode: 'would-you-rather'
      }),
      true
    );
    assert.equal(
      dialog.querySelector('.active-party-conflict-dialog-code').textContent,
      'DEF-456'
    );
    assert.equal(
      dialog
        .querySelector('.active-party-conflict-dialog-action.is-primary')
        .getAttribute('href'),
      '/would-you-rather/settings?partyCode=DEF-456'
    );
  } finally {
    dom.window.close();
  }
});

test('participant conflict can leave the current party and continue creating', async () => {
  const { dom, window } = createDialogDom();
  const leaveCalls = [];

  try {
    const opened = window.ActivePartyConflictDialog.openFromError(
      {
        code: 'party_participant_active_party_exists',
        details: {
          partyCode: 'ABC-123',
          gamemode: 'truth-or-dare',
          apiRoute: 'party-game-truth-or-dare',
          playerComputerId: 'player-device'
        }
      },
      {
        onLeaveAndCreate(context) {
          leaveCalls.push(context);
        }
      }
    );

    assert.equal(opened, true);
    const dialog = window.document.querySelector(
      '.active-party-conflict-dialog-host'
    );
    assert.equal(
      dialog.querySelector('.active-party-conflict-dialog-title').textContent,
      "You're already in a party"
    );
    assert.equal(
      dialog.querySelector('.active-party-conflict-dialog-description')
        .textContent,
      "You're already in an active party. Return to it or leave it before creating another one."
    );
    assert.equal(
      dialog
        .querySelector('.active-party-conflict-dialog-action.is-primary')
        .getAttribute('href'),
      '/ABC-123'
    );
    const leaveButton = dialog.querySelector(
      '.active-party-conflict-dialog-action.is-secondary'
    );
    assert.equal(leaveButton.textContent, 'Leave & Create');
    leaveButton.click();
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    assert.equal(leaveCalls.length, 1);
    assert.equal(leaveCalls[0].partyCode, 'ABC-123');
    assert.equal(dialog.open, false);
  } finally {
    dom.window.close();
  }
});

test('account-link copy is safe and unsafe return paths fall back to the party code', async () => {
  const { copiedValues, dom, window } = createDialogDom();

  try {
    const dialog = window.ActivePartyConflictDialog.open({
      partyCode: 'abc-123',
      lobbyPath: 'https://evil.example/steal',
      gamemode: '<img src=x onerror=alert(1)>',
      source: 'account-link'
    });
    const copyButton = dialog.querySelector(
      '.active-party-conflict-dialog-copy'
    );
    assert.equal(copyButton.dataset.pressFeedback, 'linger');

    assert.equal(
      dialog.querySelector('.active-party-conflict-dialog-title').textContent,
      'This account has another party'
    );
    assert.match(
      dialog.querySelector('.active-party-conflict-dialog-description')
        .textContent,
      /current guest party was left unchanged/
    );
    assert.equal(
      dialog
        .querySelector('.active-party-conflict-dialog-action.is-primary')
        .getAttribute('href'),
      '/ABC-123'
    );
    assert.equal(
      dialog.querySelector('.active-party-conflict-dialog-action.is-secondary')
        .textContent,
      'Continue here'
    );
    assert.equal(dialog.querySelector('script'), null);
    assert.equal(
      dialog.querySelector('.active-party-conflict-dialog-gamemode')
        .textContent,
      '<Img Src=X Onerror=Alert(1)>'
    );
    assert.ok(copyButton.querySelector('svg'));

    copyButton.dispatchEvent(
      new window.MouseEvent('mouseover', { bubbles: true })
    );
    const tooltip = dialog.querySelector('.floating-tooltip');
    assert.ok(tooltip);
    assert.equal(tooltip.parentElement, dialog);

    copyButton.click();
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(copiedValues, ['https://overexposed.test/ABC-123']);
    assert.equal(
      dialog.querySelector('.active-party-conflict-dialog-copy-status'),
      null
    );
    assert.equal(tooltip.textContent, 'COPIED');
  } finally {
    dom.window.close();
  }
});

test('party management returns to the active game or confirms ending it', async () => {
  const { dom, window } = createDialogDom();
  const endedParties = [];

  try {
    const dialog = window.ActivePartyConflictDialog.open({
      partyCode: 'ABC-123',
      gamemode: 'paranoia',
      returnPath: '/paranoia/ABC-123',
      statusText: 'Game in progress',
      source: 'party-management',
      conflictType: 'owner',
      onEnd: async ({ partyCode }) => {
        endedParties.push(partyCode);
      }
    });
    const returnLink = dialog.querySelector(
      '.active-party-conflict-dialog-action.is-primary'
    );
    const endButton = dialog.querySelector(
      '.active-party-conflict-dialog-action.is-secondary'
    );

    assert.equal(returnLink.textContent, 'Return to game');
    assert.equal(returnLink.getAttribute('href'), '/paranoia/ABC-123');
    assert.equal(
      dialog.querySelector('.active-party-conflict-dialog-summary-label')
        .textContent,
      'Game in progress'
    );
    assert.equal(endButton.textContent, 'End party');

    endButton.click();
    assert.equal(dialog.open, true);
    assert.deepEqual(endedParties, []);
    assert.equal(endButton.textContent, 'Confirm end party');
    assert.match(
      dialog.querySelector('.active-party-conflict-dialog-description')
        .textContent,
      /removes it for everyone/
    );

    endButton.click();
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    assert.deepEqual(endedParties, ['ABC-123']);
    assert.equal(dialog.open, false);
  } finally {
    dom.window.close();
  }
});

test('replacement and return actions do not report a dismissal', async () => {
  const { dom, window } = createDialogDom();
  const dismissals = [];
  const onDismiss = (reason, context) => dismissals.push({ context, reason });

  try {
    const api = window.ActivePartyConflictDialog;
    let dialog = api.open({
      partyCode: 'ABC-123',
      source: 'party-creation',
      onDismiss,
      onEndAndCreate: async () => {}
    });
    const endButton = dialog.querySelector(
      '.active-party-conflict-dialog-action.is-secondary'
    );
    assert.equal(endButton.textContent, 'End & Create New');
    endButton.click();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    assert.equal(dialog.open, false);
    assert.equal(dismissals.length, 0);

    dialog = api.open({
      partyCode: 'DEF-456',
      source: 'account-link',
      onDismiss
    });
    dialog
      .querySelector('.active-party-conflict-dialog-action.is-secondary')
      .click();
    assert.equal(dismissals.at(-1).reason, 'continue');

    dialog = api.open({ partyCode: 'GHI-789', onDismiss });
    const returnLink = dialog.querySelector(
      '.active-party-conflict-dialog-action.is-primary'
    );
    returnLink.addEventListener('click', (event) => event.preventDefault());
    returnLink.click();
    assert.equal(dialog.open, false);
    assert.equal(dismissals.length, 1);

    dialog = api.open({ partyCode: 'MNO-345', onDismiss });
    dialog.getBoundingClientRect = () => ({
      bottom: 200,
      left: 100,
      right: 200,
      top: 100
    });
    dialog.dispatchEvent(
      new window.MouseEvent('click', {
        bubbles: true,
        clientX: 0,
        clientY: 0
      })
    );
    assert.equal(dismissals.at(-1).reason, 'backdrop');

    dialog = api.open({ partyCode: 'PQR-678', onDismiss });
    const cancelEvent = new window.Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancelEvent);
    if (!cancelEvent.defaultPrevented) dialog.close(dialog.returnValue);
    assert.equal(dismissals.at(-1).reason, 'cancel');

    dialog = api.open({ partyCode: 'STU-901', onDismiss });
    assert.equal(api.close(), true);
    assert.equal(dismissals.at(-1).reason, 'programmatic');
    assert.equal(api.close(), false);
  } finally {
    dom.window.close();
  }
});

test('dialog stays closed until an active-party conflict is opened', () => {
  const { dom, window } = createDialogDom();

  try {
    assert.equal(
      window.document.querySelector('.active-party-conflict-dialog-host'),
      null
    );
  } finally {
    dom.window.close();
  }
});

test('opening a new conflict reuses one host without treating replacement as dismissal', () => {
  const { dom, window } = createDialogDom();
  const dismissals = [];

  try {
    window.ActivePartyConflictDialog.open({
      partyCode: 'ABC-123',
      onDismiss: (reason) => dismissals.push(reason)
    });
    window.ActivePartyConflictDialog.open({ partyCode: 'DEF-456' });

    assert.deepEqual(dismissals, []);
    assert.equal(
      window.document.querySelectorAll('.active-party-conflict-dialog-host')
        .length,
      1
    );
    assert.equal(
      window.document.querySelector('.active-party-conflict-dialog-code')
        .textContent,
      'DEF-456'
    );
  } finally {
    dom.window.close();
  }
});

test('a queued native close stays associated with the opening that produced it', () => {
  const { dom, window } = createDialogDom();
  const queuedCloseEvents = [];
  const dismissals = [];

  try {
    window.HTMLDialogElement.prototype.close = function close(
      returnValue = ''
    ) {
      if (!this.open) return;
      this.returnValue = returnValue;
      this.removeAttribute('open');
      queuedCloseEvents.push(() => {
        this.dispatchEvent(new window.Event('close'));
      });
    };

    const api = window.ActivePartyConflictDialog;
    const dialog = api.open({
      partyCode: 'ABC-123',
      onDismiss: (reason) => dismissals.push(`first:${reason}`)
    });

    // Simulate OeDialog/native code closing outside the component, then reopen
    // before the browser dispatches its queued close event.
    dialog.close('backdrop');
    api.open({
      partyCode: 'DEF-456',
      source: 'account-link',
      onDismiss: (reason) => dismissals.push(`second:${reason}`)
    });

    queuedCloseEvents.shift()();
    assert.deepEqual(dismissals, ['first:backdrop']);
    assert.equal(dialog.open, true);
    assert.equal(
      window.document.body.classList.contains('oe-dialog-open'),
      true
    );
    assert.equal(
      window.document.activeElement,
      dialog.querySelector('.active-party-conflict-dialog-action.is-primary')
    );
    assert.equal(
      dialog.querySelector('.active-party-conflict-dialog-code').textContent,
      'DEF-456'
    );

    api.close('continue');
    queuedCloseEvents.shift()();
    assert.deepEqual(dismissals, ['first:backdrop', 'second:continue']);
  } finally {
    dom.window.close();
  }
});
