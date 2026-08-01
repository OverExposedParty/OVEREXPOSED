var rightHeaderContainer = document.querySelector(
  '.header-icon-container.row.right'
);
var userCustomisationIconButton;
var accountIconButton;
var accountNotificationBadgeTotal = 0;

function formatAccountNotificationCount(count) {
  return count > 9 ? '9+' : String(count);
}

function updateAccountNotificationBadge(snapshot) {
  if (!accountIconButton) return;

  const state =
    snapshot || window.OEAccountNotificationState?.getSnapshot?.() || {};
  const totalUnread = Math.max(0, Number(state.totalUnread) || 0);
  let badge = accountIconButton.querySelector('.account-notification-badge');

  if (!badge) {
    badge = document.createElement('span');
    badge.className =
      'notification-count-badge account-notification-badge';
    badge.hidden = true;
    badge.setAttribute('aria-hidden', 'true');
    accountIconButton.appendChild(badge);
  }

  badge.textContent = totalUnread
    ? formatAccountNotificationCount(totalUnread)
    : '';
  badge.hidden = totalUnread === 0;
  accountIconButton.classList.toggle(
    'has-account-notifications',
    totalUnread > 0
  );
  accountIconButton.setAttribute(
    'aria-label',
    totalUnread > 0
      ? `Account, ${totalUnread} unread notification${
          totalUnread === 1 ? '' : 's'
        }`
      : 'Account'
  );

  if (totalUnread > accountNotificationBadgeTotal) {
    badge.classList.remove('is-increasing');
    badge.getBoundingClientRect();
    badge.classList.add('is-increasing');
  }
  accountNotificationBadgeTotal = totalUnread;
}

function getCurrentHeaderCustomisation() {
  const saved = localStorage.getItem('user-customisation');
  debugLog(saved);
  if (saved) {
    try {
      const obj = JSON.parse(saved);

      return {
        colour:
          getFilePathByCustomisationId(obj.colourSlotId) ??
          blankUserCustomisation.colour,
        headSlot:
          getFilePathByCustomisationId(obj.headSlotId) ??
          blankUserCustomisation.headSlot,
        eyesSlot:
          getFilePathByCustomisationId(obj.eyesSlotId) ??
          blankUserCustomisation.eyesSlot,
        mouthSlot:
          getFilePathByCustomisationId(obj.mouthSlotId) ??
          blankUserCustomisation.mouthSlot
      };
    } catch (e) {
      // fall through to blank
    }
  }
  debugLog(blankUserCustomisation);
  return blankUserCustomisation;
}

function renderUserCustomisationHeaderIcon() {
  if (!accountIconButton) return;
  accountIconButton.innerHTML = '';

  const current = getCurrentHeaderCustomisation();
  debugLog('Rendering account icon with customisation:', current);
  const stack = CreateImageStack(current);
  accountIconButton.appendChild(stack);
  updateAccountNotificationBadge();
  if (typeof window.renderAccountPreviewIcon === 'function') {
    window.renderAccountPreviewIcon();
  }
}

function toggleUserCustomisationIcon(bool) {
  if (!userCustomisationIconButton) return;
  userCustomisationIconButton.classList.remove('disabled');
}

(async () => {
  if (!rightHeaderContainer) return;

  accountIconButton = document.getElementById('account-button');
  if (!accountIconButton) {
    accountIconButton = document.createElement('div');
    accountIconButton.classList.add('icon-container');
    accountIconButton.id = 'account-button';
    accountIconButton.setAttribute('aria-label', 'Account');
    accountIconButton.setAttribute('role', 'button');
    accountIconButton.setAttribute('tabindex', '0');
    rightHeaderContainer.appendChild(accountIconButton);
  }
  userCustomisationIconButton = accountIconButton;
  window.addEventListener('oe-notification-count-changed', (event) => {
    updateAccountNotificationBadge(event.detail);
  });

  if (typeof syncHeaderIconActiveStates === 'function') {
    syncHeaderIconActiveStates();
  }

  if (accountIconButton.dataset.listenerBound !== 'true') {
    accountIconButton.dataset.listenerBound = 'true';
    accountIconButton.addEventListener('click', async () => {
      if (typeof toggleAccount === 'function') {
        toggleAccount();
      }
    });
  }

  await Ready.when('user-customisation-icon', { timeout: 10000 });
  renderUserCustomisationHeaderIcon();
  if (typeof syncHeaderIconActiveStates === 'function') {
    syncHeaderIconActiveStates();
  }

  SetScriptLoaded('/scripts/general/online/user-customisation-header.js');
  Ready.set('user-customisation-header', true);
})();
