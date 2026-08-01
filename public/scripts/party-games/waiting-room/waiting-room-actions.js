function waitingRoomUserHasDefaultOeIcon() {
  const currentIcon = getStoredUserIconString();
  return (
    typeof window.isAccountDefaultOeIcon === 'function'
      ? window.isAccountDefaultOeIcon(currentIcon)
      : currentIcon === '0000:0100:0200:0300'
  );
}

async function promptWaitingRoomUserForCustomOeIcon() {
  if (
    !waitingRoomUserHasDefaultOeIcon() ||
    typeof window.requestAccountOeCustomisation !== 'function'
  ) {
    return null;
  }

  try {
    return await window.requestAccountOeCustomisation({
      requireNonDefault: true,
      closeOnSave: true,
      preventClose: true
    });
  } catch (error) {
    console.warn('Failed to request OE customisation:', error);
    return null;
  }
}

function hasRestriction(restrictionValue, expectedRestriction) {
  if (!restrictionValue || !expectedRestriction) return false;
  try {
    const restrictions = JSON.parse(restrictionValue);
    return (
      Array.isArray(restrictions) && restrictions.includes(expectedRestriction)
    );
  } catch {
    return false;
  }
}

function setupPartyCodeActionButtons() {
  inputPartyCode = inputPartyCode || document.getElementById('party-code');
  const copyPartyCodeButton = document.getElementById('party-code-copy-button');
  const qrCodeButton = document.getElementById('qr-code-button');
  if (!inputPartyCode || !copyPartyCodeButton || !qrCodeButton) return false;

  if (copyPartyCodeButton && !copyPartyCodeButton.dataset.bound) {
    copyPartyCodeButton.dataset.bound = 'true';
    copyPartyCodeButton.dataset.sound = 'none';
    copyPartyCodeButton.addEventListener('click', async () => {
      flashButtonHoverState(copyPartyCodeButton, {
        duration: 0,
        fadeDuration: 200,
        className: 'copy-feedback-active',
        transitionClassName: 'copy-feedback-fade'
      });

      const codeToCopy = (inputPartyCode?.value || '').trim();
      if (!codeToCopy) return;
      const fullPartyUrl = `${window.location.origin}/${codeToCopy}`;
      try {
        const copied = await copyTextToClipboard(fullPartyUrl);
        if (!copied) {
          throw new Error('Clipboard copy command was not successful.');
        }
        if (typeof window.setTooltipSelectedState === 'function') {
          window.setTooltipSelectedState(copyPartyCodeButton);
        }
        playSoundEffect('socialCopyLink');
      } catch (err) {
        console.error('Failed to copy party URL:', err);
        playInteractionSound('error');
      }
    });
  }

  if (qrCodeButton && !qrCodeButton.dataset.bound) {
    qrCodeButton.dataset.bound = 'true';
    qrCodeButton.addEventListener('click', () => {
      if (!partyCode || typeof togglePartyQrCode !== 'function') return;
      const willShow = !qrCodeButton.classList.contains('active');
      togglePartyQrCode(willShow, partyCode);
    });
  }
  return true;
}

function bindPartyCodeActionButtonsWithRetry(attempt = 0) {
  const maxAttempts = 80;
  const bound = setupPartyCodeActionButtons();
  if (bound || attempt >= maxAttempts) return;
  setTimeout(() => bindPartyCodeActionButtonsWithRetry(attempt + 1), 50);
}

function observePartyCodeActionButtons() {
  if (waitingRoomPartyCodeObserver) return;

  if (setupPartyCodeActionButtons()) {
    return;
  }

  waitingRoomPartyCodeObserver = new MutationObserver(() => {
    if (!setupPartyCodeActionButtons()) return;
    waitingRoomPartyCodeObserver.disconnect();
    waitingRoomPartyCodeObserver = null;
  });

  waitingRoomPartyCodeObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}
