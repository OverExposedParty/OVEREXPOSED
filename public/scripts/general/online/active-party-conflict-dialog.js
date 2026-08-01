(function initialiseActivePartyConflictDialog() {
  const ERROR_CODE = 'party_owner_active_party_exists';
  const PARTICIPANT_ERROR_CODE = 'party_participant_active_party_exists';
  const PARTY_CODE_PATTERN = /^[A-Z0-9]{3}-[A-Z0-9]{3}$/;
  const TITLE_ID = 'active-party-conflict-dialog-title';
  const DESCRIPTION_ID = 'active-party-conflict-dialog-description';
  const MASCOT_PARTS = [
    ['colour', '/images/user-customisation/colour/base/overexposed-blue.svg'],
    [
      'head-slot',
      '/images/user-customisation/head-slot/base/cardboard-box.svg'
    ],
    ['eyes-slot', '/images/user-customisation/eyes-slot/base/wide-eyes.svg'],
    ['mouth-slot', '/images/user-customisation/mouth-slot/base/two-teeth.svg']
  ];
  const GAMEMODE_COLOURS = {
    'truth-or-dare': { primary: '#66CCFF', secondary: '#427BB9' },
    paranoia: { primary: '#9D8AFF', secondary: '#7F71B2' },
    'never-have-i-ever': { primary: '#FF9266', secondary: '#B96542' },
    'most-likely-to': { primary: '#FFEE66', secondary: '#B9AA42' },
    imposter: { primary: '#3DA7A1', secondary: '#2A6E6A' },
    'would-you-rather': { primary: '#7CFFB2', secondary: '#55B97F' },
    mafia: { primary: '#9B56D3', secondary: '#6D3C95' }
  };
  const DEFAULT_GAMEMODE_COLOURS = GAMEMODE_COLOURS['truth-or-dare'];

  let dialogHost = null;
  let activeDialogState = null;
  let nextDialogGeneration = 1;
  const pendingCloseEvents = [];

  if (typeof window.LoadStylesheet === 'function') {
    window.LoadStylesheet('/css/general/online/party-code-controls.css');
    window.LoadStylesheet(
      '/css/general/online/active-party-conflict-dialog.css'
    );
  }

  function normalisePartyCode(value) {
    const candidate = String(value || '')
      .trim()
      .toUpperCase();
    return PARTY_CODE_PATTERN.test(candidate) ? candidate : '';
  }

  function normaliseGamemode(value) {
    return String(value || '')
      .trim()
      .slice(0, 80)
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  function getGamemodeKey(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-');
  }

  function getGamemodeColours(value) {
    return GAMEMODE_COLOURS[getGamemodeKey(value)] || DEFAULT_GAMEMODE_COLOURS;
  }

  function getReturnPath(partyCode, gamemode, conflictType) {
    if (!partyCode) return '';
    const gamemodeKey = getGamemodeKey(gamemode);
    if (
      conflictType === 'owner' &&
      Object.hasOwn(GAMEMODE_COLOURS, gamemodeKey)
    ) {
      return `/${gamemodeKey}/settings?partyCode=${encodeURIComponent(partyCode)}`;
    }
    return `/${partyCode}`;
  }

  function normaliseReturnPath(value) {
    const candidate = String(value || '').trim();
    return /^\/(?!\/)/.test(candidate) ? candidate : '';
  }

  function getErrorPayload(value) {
    if (!value || typeof value !== 'object') return null;
    if (value.error && typeof value.error === 'object') return value.error;
    if (value.data?.error && typeof value.data.error === 'object') {
      return value.data.error;
    }
    return value;
  }

  function isConflict(value) {
    const code = getErrorPayload(value)?.code;
    return code === ERROR_CODE || code === PARTICIPANT_ERROR_CODE;
  }

  function createElement(tagName, className, textContent) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (typeof textContent === 'string') element.textContent = textContent;
    return element;
  }

  function createMascot() {
    const mascot = createElement(
      'div',
      'active-party-conflict-dialog-mascot'
    );
    mascot.setAttribute('aria-hidden', 'true');

    const stack = createElement(
      'div',
      'active-party-conflict-dialog-mascot-stack'
    );
    MASCOT_PARTS.forEach(([id, src], index) => {
      const image = document.createElement('img');
      image.id = `active-party-conflict-mascot-${id}`;
      image.src = src;
      image.alt = '';
      image.style.zIndex = String(index + 1);
      stack.appendChild(image);
    });
    mascot.appendChild(stack);
    return mascot;
  }

  function createCopyIcon() {
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(namespace, 'svg');
    svg.setAttribute('viewBox', '0 0 206.78 262.84');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    const rectangle = document.createElementNS(namespace, 'rect');
    rectangle.setAttribute('x', '49.78');
    rectangle.setAttribute('y', '55.84');
    rectangle.setAttribute('width', '150');
    rectangle.setAttribute('height', '200');
    rectangle.setAttribute('rx', '12.37');
    rectangle.setAttribute('ry', '12.37');

    const path = document.createElementNS(namespace, 'path');
    path.setAttribute(
      'd',
      'M49.78,68.24v126.15c0,6.79-5.47,12.32-12.26,12.4l-18.15.21c-6.83,0-12.37-5.54-12.37-12.37V19.4c0-6.85,5.55-12.4,12.4-12.4h125.2c6.85,0,12.4,5.55,12.4,12.4v24.06c0,6.85-5.55,12.4-12.41,12.4l-82.41-.03c-6.85,0-12.41,5.55-12.41,12.4Z'
    );

    svg.append(rectangle, path);
    return svg;
  }

  function settleDialogState(state, reason) {
    if (!state || state.settled) return;
    state.settled = true;

    if (
      reason !== 'return' &&
      reason !== 'leave-and-create' &&
      reason !== 'end-and-create' &&
      reason !== 'leave-party' &&
      reason !== 'end-party' &&
      typeof state.onDismiss === 'function'
    ) {
      state.onDismiss(reason, state.context);
    }
  }

  function queueActiveClose(reason) {
    const state = activeDialogState;
    activeDialogState = null;
    pendingCloseEvents.push({ reason, state });
  }

  function handleDialogClose(event) {
    const pendingClose = pendingCloseEvents.shift();
    if (pendingClose) {
      settleDialogState(pendingClose.state, pendingClose.reason);
      if (dialogHost?.open) event.stopImmediatePropagation();
      return;
    }

    // A queued close event from an older opening must never consume the state
    // of a dialog that has already been reopened.
    if (dialogHost?.open) {
      event.stopImmediatePropagation();
      return;
    }

    const state = activeDialogState;
    activeDialogState = null;
    settleDialogState(state, dialogHost?.returnValue || 'programmatic');
  }

  function ensureDialogHost() {
    if (dialogHost?.isConnected) return dialogHost;

    dialogHost = document.createElement('dialog');
    dialogHost.className = 'active-party-conflict-dialog-host oe-dialog';
    dialogHost.setAttribute('aria-labelledby', TITLE_ID);
    dialogHost.setAttribute('aria-describedby', DESCRIPTION_ID);
    dialogHost.addEventListener('cancel', () => {
      dialogHost.returnValue = 'cancel';
    });
    dialogHost.addEventListener('close', handleDialogClose);
    document.body.appendChild(dialogHost);
    window.OeDialog?.register(dialogHost);
    return dialogHost;
  }

  function close(reason = 'programmatic') {
    if (!dialogHost?.open) return false;

    const closeReason = String(reason || 'programmatic');
    queueActiveClose(closeReason);
    if (typeof window.OeDialog?.close === 'function') {
      window.OeDialog.close(dialogHost, closeReason);
    } else {
      dialogHost.close(closeReason);
    }
    return true;
  }

  async function copyPartyCode(partyCode, copyButton) {
    let copied = false;
    const partyUrl = `${window.location.origin}/${partyCode}`;
    try {
      copied =
        typeof window.copyTextToClipboard === 'function' &&
        (await window.copyTextToClipboard(partyUrl));
    } catch {
      copied = false;
    }

    if (typeof window.setTooltipSelectedState === 'function') {
      window.setTooltipSelectedState(
        copyButton,
        copied ? 'COPIED' : 'COPY FAILED'
      );
    }
  }

  function renderDialog({
    partyCode,
    lobbyPath,
    gamemode,
    gamemodeColours,
    statusText,
    source,
    conflictType,
    onLeave,
    onEnd,
    onLeaveAndCreate,
    onEndAndCreate
  }) {
    const isAccountLink = source === 'account-link';
    const isPartyManagement = source === 'party-management';
    const isParticipant = conflictType === 'participant';
    const content = createElement('section', 'active-party-conflict-dialog');
    content.style.setProperty(
      '--party-conflict-primary',
      gamemodeColours.primary
    );
    content.style.setProperty(
      '--party-conflict-secondary',
      gamemodeColours.secondary
    );

    const title = createElement(
      'h2',
      'active-party-conflict-dialog-title',
      isAccountLink
        ? 'This account has another party'
        : isParticipant
          ? "You're already in a party"
          : 'You already have a party'
    );
    title.id = TITLE_ID;
    const header = createElement(
      'header',
      'active-party-conflict-dialog-header'
    );
    header.appendChild(title);
    const mascot = createMascot();

    const description = createElement(
      'p',
      'active-party-conflict-dialog-description',
      isAccountLink
        ? partyCode
          ? `This account already owns party ${partyCode}. Your current guest party was left unchanged.`
          : 'This account already owns another active party. Your current guest party was left unchanged.'
        : isParticipant
          ? "You're already in an active party. Return to it or leave it before creating another one."
          : 'You already have an active party. Return to it or end it before creating another one.'
    );
    description.id = DESCRIPTION_ID;
    const media = createElement(
      'div',
      'active-party-conflict-dialog-media'
    );
    const qrImage = document.createElement('img');
    qrImage.className = 'active-party-conflict-dialog-qr-image';
    qrImage.alt = partyCode ? `Join party ${partyCode}` : 'Party QR code';
    if (partyCode) {
      qrImage.src = `/api/party-qr/${encodeURIComponent(partyCode)}?color=${encodeURIComponent(gamemodeColours.primary)}`;
    }
    media.append(mascot, description, qrImage);

    const summary = createElement(
      'section',
      'active-party-conflict-dialog-summary'
    );
    summary.setAttribute(
      'aria-label',
      partyCode ? `Active party ${partyCode}` : 'Active party'
    );
    const summaryLabel = createElement(
      'span',
      'active-party-conflict-dialog-summary-label',
      isPartyManagement && statusText ? statusText : 'Active party'
    );
    const summaryMeta = createElement(
      'div',
      'active-party-conflict-dialog-summary-meta'
    );
    summaryMeta.appendChild(summaryLabel);
    if (gamemode) {
      summaryMeta.appendChild(
        createElement('span', 'active-party-conflict-dialog-gamemode', gamemode)
      );
    }
    const codeRow = createElement(
      'div',
      'active-party-conflict-dialog-code-row'
    );
    const code = createElement(
      'strong',
      'active-party-conflict-dialog-code',
      partyCode || 'Party details unavailable'
    );
    codeRow.appendChild(code);

    if (partyCode) {
      const partyControls = createElement(
        'div',
        'active-party-conflict-dialog-party-controls'
      );
      const copyButton = createElement(
        'button',
        'active-party-conflict-dialog-copy party-code-action-button tool-tip'
      );
      copyButton.type = 'button';
      copyButton.setAttribute('aria-label', `Copy party code ${partyCode}`);
      copyButton.dataset.tooltip = 'COPY PARTY URL';
      copyButton.dataset.pressFeedback = 'linger';
      const copyLabel = createElement('span', 'sr-only', 'Copy party URL');
      copyButton.append(copyLabel, createCopyIcon());
      copyButton.addEventListener('click', () => {
        copyPartyCode(partyCode, copyButton);
      });

      const qrButton = createElement(
        'button',
        'active-party-conflict-dialog-qr party-code-action-button is-qr tool-tip'
      );
      qrButton.type = 'button';
      qrButton.dataset.tooltip = 'SHOW QR CODE';
      qrButton.setAttribute('aria-label', `Show QR code for party ${partyCode}`);
      qrButton.setAttribute('aria-pressed', 'false');
      qrButton.append(
        createElement('span', 'sr-only', 'Show party QR code'),
        createElement('span', '', 'QR')
      );
      qrButton.lastElementChild.setAttribute('aria-hidden', 'true');
      qrButton.addEventListener('click', () => {
        const showQrCode = !media.classList.contains('is-qr-visible');
        media.classList.toggle('is-qr-visible', showQrCode);
        qrButton.classList.toggle('active', showQrCode);
        qrButton.setAttribute('aria-pressed', String(showQrCode));
        qrButton.dataset.tooltip = showQrCode ? 'SHOW MASCOT' : 'SHOW QR CODE';
        qrButton.setAttribute(
          'aria-label',
          showQrCode
            ? `Show mascot for party ${partyCode}`
            : `Show QR code for party ${partyCode}`
        );
        window.refreshActiveTooltip?.(qrButton);
      });

      partyControls.append(copyButton, qrButton);
      codeRow.appendChild(partyControls);
    }

    summary.append(summaryMeta, codeRow);

    const actions = createElement(
      'div',
      'active-party-conflict-dialog-actions'
    );
    if (lobbyPath) {
      const returnLabel =
        isPartyManagement && /^game/i.test(String(statusText || ''))
          ? 'Return to game'
          : isPartyManagement
            ? 'Go to party'
            : 'Return to party';
      const returnLink = createElement(
        'a',
        'active-party-conflict-dialog-action is-primary',
        returnLabel
      );
      returnLink.href = lobbyPath;
      returnLink.addEventListener('click', () => close('return'));
      actions.appendChild(returnLink);
    }

    const replacementAction = isPartyManagement
      ? isParticipant
        ? onLeave
        : onEnd
      : isParticipant
        ? onLeaveAndCreate
        : isAccountLink
          ? null
          : onEndAndCreate;
    const replacementLabel = isPartyManagement
      ? isParticipant
        ? 'Leave party'
        : 'End party'
      : isParticipant
        ? 'Leave & Create'
        : 'End & Create New';
    const replacementProgressLabel = isParticipant
      ? 'Leaving...'
      : 'Ending...';
    const replacementCloseReason = isPartyManagement
      ? isParticipant
        ? 'leave-party'
        : 'end-party'
      : isParticipant
        ? 'leave-and-create'
        : 'end-and-create';
    const secondaryButton = createElement(
      'button',
      'active-party-conflict-dialog-action is-secondary',
      isAccountLink ? 'Continue here' : replacementLabel
    );
    secondaryButton.type = 'button';
    if (!isAccountLink) {
      secondaryButton.disabled = typeof replacementAction !== 'function';
      secondaryButton.addEventListener('click', async () => {
        if (secondaryButton.disabled) return;
        if (
          isPartyManagement &&
          secondaryButton.dataset.confirming !== 'true'
        ) {
          secondaryButton.dataset.confirming = 'true';
          secondaryButton.textContent = isParticipant
            ? 'Confirm leave'
            : 'Confirm end party';
          description.textContent = isParticipant
            ? 'Leaving removes you from this party. Press again to confirm.'
            : 'Ending this party removes it for everyone. Press again to confirm.';
          return;
        }

        secondaryButton.disabled = true;
        secondaryButton.setAttribute('aria-busy', 'true');
        secondaryButton.textContent = replacementProgressLabel;
        try {
          await replacementAction({ partyCode });
          close(replacementCloseReason);
        } catch (error) {
          console.error(
            isPartyManagement
              ? 'Failed to update the active party:'
              : 'Failed to replace the active party:',
            error
          );
          if (isPartyManagement) {
            description.textContent =
              error?.message ||
              (isParticipant
                ? 'The party could not be left. Try again.'
                : 'The party could not be ended. Try again.');
          } else if (error?.previousPartyExited) {
            description.textContent = isParticipant
              ? 'You left the previous party, but the new party could not be created. Try again.'
              : 'Your previous party ended, but the new party could not be created. Try again.';
          }
          secondaryButton.disabled = false;
          secondaryButton.removeAttribute('aria-busy');
          delete secondaryButton.dataset.confirming;
          secondaryButton.textContent =
            !isPartyManagement && error?.previousPartyExited
              ? 'Create New Party'
              : replacementLabel;
        }
      });
    } else {
      secondaryButton.addEventListener('click', () => close('continue'));
    }
    actions.appendChild(secondaryButton);

    content.append(header, media, summary, actions);
    return content;
  }

  function open({
    partyCode: rawPartyCode,
    gamemode: rawGamemode,
    returnPath: rawReturnPath,
    statusText: rawStatusText,
    source = 'party-creation',
    conflictType = 'owner',
    opener = document.activeElement,
    onDismiss = null,
    onLeave = null,
    onEnd = null,
    onLeaveAndCreate = null,
    onEndAndCreate = null
  } = {}) {
    const host = ensureDialogHost();
    const partyCode = normalisePartyCode(rawPartyCode);
    const gamemode = normaliseGamemode(rawGamemode);
    const gamemodeColours = getGamemodeColours(rawGamemode);
    const normalisedSource =
      source === 'account-link'
        ? 'account-link'
        : source === 'party-management'
          ? 'party-management'
          : 'party-creation';
    const normalisedConflictType =
      conflictType === 'participant' ? 'participant' : 'owner';
    const lobbyPath =
      normaliseReturnPath(rawReturnPath) ||
      getReturnPath(partyCode, rawGamemode, normalisedConflictType);
    const statusText = String(rawStatusText || '').trim().slice(0, 80);

    if (!host.open && activeDialogState) {
      queueActiveClose(host.returnValue || 'programmatic');
    } else if (host.open && activeDialogState) {
      // Replacing visible content is not a user dismissal and must not trigger
      // authentication navigation callbacks.
      activeDialogState.settled = true;
      activeDialogState = null;
    }
    activeDialogState = {
      context: {
        partyCode,
        source: normalisedSource,
        conflictType: normalisedConflictType
      },
      generation: nextDialogGeneration++,
      onDismiss,
      settled: false
    };
    host.returnValue = '';
    host.style.setProperty(
      '--party-conflict-primary',
      gamemodeColours.primary
    );
    host.style.setProperty(
      '--party-conflict-secondary',
      gamemodeColours.secondary
    );
    host.replaceChildren(
      renderDialog({
        partyCode,
        lobbyPath,
        gamemode,
        gamemodeColours,
        statusText,
        source: normalisedSource,
        conflictType: normalisedConflictType,
        onLeave,
        onEnd,
        onLeaveAndCreate,
        onEndAndCreate
      })
    );

    window.OeDialog?.register(host);
    const initialFocus = lobbyPath
      ? '.active-party-conflict-dialog-action.is-primary'
      : '.active-party-conflict-dialog-action.is-secondary';
    if (typeof window.OeDialog?.open === 'function') {
      window.OeDialog.open(host, { initialFocus, opener });
    } else {
      if (!host.open) host.showModal();
      host.querySelector(initialFocus)?.focus({ preventScroll: true });
    }

    return host;
  }

  function openFromError(value, options = {}) {
    const error = getErrorPayload(value);
    if (!isConflict(error)) return false;

    const dialogOptions = {
      ...error,
      ...(error.details && typeof error.details === 'object'
        ? error.details
        : {}),
      ...options
    };
    const partyCode = normalisePartyCode(dialogOptions.partyCode);
    if (!partyCode) return false;

    open({
      ...dialogOptions,
      partyCode,
      conflictType:
        error.code === PARTICIPANT_ERROR_CODE ? 'participant' : 'owner'
    });
    return true;
  }

  window.ActivePartyConflictDialog = {
    ERROR_CODE,
    PARTICIPANT_ERROR_CODE,
    close,
    isConflict,
    open,
    openFromError
  };

})();
