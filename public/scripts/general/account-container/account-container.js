function setAccountPreview(account) {
  accountIsLoggedIn = Boolean(account);
  if (!account) {
    accountCommerceEnabled = false;
  } else if (hasAccountCommerceAccess(account)) {
    accountCommerceEnabled = true;
  }

  if (account) {
    saveAccountToLocalStorage(account);
    applyAccountOeIcon(account);
  } else {
    localStorage.removeItem('oe-account');
  }
  accountSubtitle.textContent = getAccountDisplayName(account);
  setAccountLevelBadge(account);
  setAccountOpalBalance(account);
  setAccountActionButtonsDisabled(!accountIsLoggedIn);
  setAccountFooterAuthState(accountIsLoggedIn);

  if (!accountIsLoggedIn && accountExpandedAction !== 'settings') {
    setAccountExpandedPanel('');
  } else if (accountExpandedAction) {
    renderAccountExpandedContent(accountExpandedAction);
  }

  if (typeof renderUserCustomisationHeaderIcon === 'function') {
    renderUserCustomisationHeaderIcon();
  }
  if (typeof updateExtraMenuAccess === 'function') {
    updateExtraMenuAccess(account);
  }

  window.dispatchEvent(
    new CustomEvent('oe-account-state-changed', {
      detail: { account: account || null, isLoggedIn: accountIsLoggedIn }
    })
  );
}

window.setAccountPreview = setAccountPreview;
window.updateOeFriendRelationship = requestAccountFriendUpdate;

async function refreshAccountPreview() {
  if (!accountContainer) return;

  const storedAccount = getStoredAccount();
  if (storedAccount) {
    accountCommerceEnabled = hasAccountCommerceAccess(storedAccount);
    setAccountPreview(storedAccount);
  }

  let account = storedAccount || null;

  try {
    const accountResponse = await fetch('/api/accounts/me', {
      credentials: 'same-origin'
    });
    const payload = await accountResponse.json();
    account = payload?.account || null;
  } catch {
    account = storedAccount || null;
  }

  accountCommerceEnabled = hasAccountCommerceAccess(account);

  try {
    const accessResponse = await fetch('/api/shop/account-container-access', {
      credentials: 'same-origin',
      cache: 'no-store'
    });
    const accessPayload = await accessResponse.json();
    accountCommerceEnabled =
      accessPayload?.data?.enabled === true ||
      hasAccountCommerceAccess(account);
  } catch {
    accountCommerceEnabled = hasAccountCommerceAccess(account);
  }

  setAccountPreview(account);
}

window.refreshAccountPreview = refreshAccountPreview;

const accountActivityHeartbeatMs = 5 * 60 * 1000;

async function recordAccountActivity() {
  if (document.visibilityState === 'hidden' || !getStoredAccount()) return;

  try {
    await fetch('/api/accounts/activity', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
  } catch (error) {
    console.warn(error);
  }
}

setInterval(recordAccountActivity, accountActivityHeartbeatMs);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') recordAccountActivity();
});
window.isAccountDefaultOeIcon = isAccountDefaultOeIcon;
window.getCurrentAccountOeIconString = getCurrentAccountOeIconString;
window.openAccountOeCustomisationEditor = openAccountOeCustomisationEditor;
window.requestAccountOeCustomisation = requestAccountOeCustomisation;

async function openAccountFriendRequests() {
  if (!accountContainer || !accountIsLoggedIn) return false;

  removeAllElements(settingsElementClassArray, { sound: false });
  addElementIfNotExists(settingsElementClassArray, accountContainer);
  showContainer(accountContainer);
  toggleOverlay(true);
  clearAccountFooterHint();

  if (typeof syncHeaderIconActiveStates === 'function') {
    syncHeaderIconActiveStates();
  }
  if (accountCustomisationEditMode) {
    await setAccountCustomisationEditMode(false);
  }

  accountExpandedAction = 'friends';
  accountExpandedTitle.textContent = 'FRIENDS';
  accountContainer.classList.add('has-expanded-action');
  await renderAccountFriendsPanel('requests');
  return true;
}

window.openAccountFriendRequests = openAccountFriendRequests;

async function openAccountSettingsPanel() {
  if (!accountContainer) return false;

  removeAllElements(settingsElementClassArray, { sound: false });
  addElementIfNotExists(settingsElementClassArray, accountContainer);
  showContainer(accountContainer);
  toggleOverlay(true);
  clearAccountFooterHint();

  if (accountCustomisationEditMode) {
    await setAccountCustomisationEditMode(false);
  }

  setAccountExpandedPanel('SETTINGS', 'settings');
  if (typeof syncHeaderIconActiveStates === 'function') {
    syncHeaderIconActiveStates();
  }
  return true;
}

window.openAccountSettingsPanel = openAccountSettingsPanel;

async function openAccountAchievement(achievementKey) {
  const normalizedKey = normaliseAccountAchievementKey(achievementKey);
  if (!accountContainer || !accountIsLoggedIn || !normalizedKey) return false;

  removeAllElements(settingsElementClassArray, { sound: false });
  addElementIfNotExists(settingsElementClassArray, accountContainer);
  showContainer(accountContainer);
  toggleOverlay(true);
  clearAccountFooterHint();

  if (accountCustomisationEditMode) {
    await setAccountCustomisationEditMode(false);
  }

  pendingAccountAchievementKey = normalizedKey;
  setAccountExpandedPanel('ACHIEVEMENTS', 'achievements');
  if (typeof syncHeaderIconActiveStates === 'function') {
    syncHeaderIconActiveStates();
  }
  return true;
}

window.openAccountAchievement = openAccountAchievement;

async function resetAccountContainerToGuest() {
  const guestCustomisation = localStorage.getItem('oe-guest-customisation');
  if (guestCustomisation) {
    localStorage.setItem('user-customisation', guestCustomisation);
  }
  localStorage.removeItem('oe-account');
  localStorage.setItem('oe-guest', 'true');
  clearAccountFooterHint();
  if (accountCustomisationEditMode) {
    await setAccountCustomisationEditMode(false);
  }
  setAccountPreview(null);
  await renderAccountPreviewIcon();
}

function getCurrentAccountProtectionCheckPath() {
  return `${window.location.pathname}${window.location.search}`;
}

async function redirectIfCurrentPageIsProtectedForGuest() {
  const currentPath = getCurrentAccountProtectionCheckPath();

  try {
    const response = await fetch(currentPath, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'text/html'
      }
    });

    if (response.status !== 403) return;

    const redirectPath = `${currentPath}${window.location.hash}`;
    if (typeof transitionSplashScreen === 'function') {
      transitionSplashScreen(redirectPath, accountLoginSplashScreen);
      return;
    }

    window.location.assign(redirectPath);
  } catch (error) {
    console.warn(error);
  }
}

async function logoutAccount() {
  try {
    await fetch('/api/accounts/logout', {
      method: 'POST',
      credentials: 'same-origin'
    });
  } catch (error) {
    console.warn(error);
  }

  await resetAccountContainerToGuest();
  await redirectIfCurrentPageIsProtectedForGuest();
}

if (accountContainer) {
  const accountVisibilityObserver = new MutationObserver(() => {
    const accountContainerIsVisible = isContainerVisible(accountContainer);

    if (accountOeCustomisationCloseLocked && !accountContainerIsVisible) {
      addElementIfNotExists(settingsElementClassArray, accountContainer, {
        sound: false
      });
      showContainer(accountContainer);
      toggleOverlay(true);
      return;
    }

    if (accountContainerIsVisible) return;

    setAccountExpandedPanel('');

    if (accountCustomisationEditMode && !accountOeSaveInProgress) {
      setAccountCustomisationEditMode(false);
    }
  });

  accountVisibilityObserver.observe(accountContainer, {
    attributes: true,
    attributeFilter: ['class']
  });
}

accountButtonContainer?.addEventListener('click', (event) => {
  const arrow = event.target.closest('.account-customisation-arrow');
  if (arrow) {
    const row = arrow.closest('.account-customisation-row');
    changeAccountCustomisationSlot(
      row?.dataset.slotKey,
      Number(arrow.dataset.direction)
    );
    return;
  }

  const action = event.target.closest('.account-action-container');
  if (!action || action.classList.contains('disabled')) return;

  const actionTitle = accountActionRoutes[action.dataset.accountAction];
  if (actionTitle) {
    setAccountExpandedPanel(actionTitle, action.dataset.accountAction);
  }
});

accountButtonContainer?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;

  const target = event.target.closest(
    '.account-action-container, .account-customisation-arrow'
  );
  if (!target) return;

  event.preventDefault();
  target.click();
});

accountPreviewEditButton?.addEventListener('click', () => {
  if (accountOeEditingDisabled) return;
  if (accountOeCustomisationCloseLocked && accountCustomisationEditMode) return;

  setAccountCustomisationEditMode(!accountCustomisationEditMode);
});

accountPreviewEditButton?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  accountPreviewEditButton.click();
});

accountPreviewRandomiseButton?.addEventListener('click', () => {
  if (accountOeEditingDisabled) return;
  randomiseAccountCustomisationDraft();
});

accountPreviewRandomiseButton?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  accountPreviewRandomiseButton.click();
});

accountExpandedBackButton?.addEventListener('click', () => {
  setAccountExpandedPanel('');
});

accountExpandedBackButton?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  accountExpandedBackButton.click();
});

accountExpandedContent?.addEventListener('click', (event) => {
  const notificationAction = event.target.closest('[data-notification-action]');
  if (notificationAction) {
    const action = notificationAction.dataset.notificationAction;
    if (action === 'friend-requests') {
      openAccountFriendRequests();
    } else if (action === 'achievements') {
      openAccountAchievement(notificationAction.dataset.achievementKey);
    } else if (action === 'settings') {
      openAccountSettingsPanel();
    } else if (
      action === 'public-profile' &&
      typeof window.openOnlinePublicProfile === 'function'
    ) {
      window.openOnlinePublicProfile({
        accountId: notificationAction.dataset.accountId
      });
    } else if (
      action === 'navigate' &&
      /^\/[a-zA-Z0-9/?&=_-]+$/.test(notificationAction.dataset.path || '')
    ) {
      if (typeof window.navigateFromPopupFeed === 'function') {
        window.navigateFromPopupFeed(notificationAction.dataset.path);
      } else {
        window.location.assign(notificationAction.dataset.path);
      }
    }
    return;
  }

  const friendSearchClear = event.target.closest('[data-friend-search-clear]');
  if (friendSearchClear) {
    renderAccountFriendsPanel();
    return;
  }

  const friendTab = event.target.closest('[data-friend-tab]');
  if (friendTab) {
    renderAccountFriendsPanel(friendTab.dataset.friendTab);
    return;
  }

  const friendSummary = event.target.closest('.account-friend-summary');
  if (friendSummary) {
    const card = friendSummary.closest('.account-friend-card');
    const details = card?.querySelector('.account-friend-details');
    const isExpanded = friendSummary.getAttribute('aria-expanded') === 'true';

    friendSummary.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
    card?.classList.toggle('is-expanded', !isExpanded);
    if (details) details.hidden = isExpanded;
    return;
  }

  const friendAction = event.target.closest('[data-friend-action]');
  if (friendAction) {
    if (friendAction.dataset.friendAction === 'profile') {
      if (typeof window.openOnlinePublicProfile === 'function') {
        window.openOnlinePublicProfile({
          accountId: friendAction.dataset.friendId
        });
      } else {
        setAccountFooterHint('Public profile is unavailable here');
      }
      return;
    }

    if (friendAction.dataset.friendAction === 'invite') {
      inviteAccountFriend(friendAction);
      return;
    }

    updateAccountFriend(friendAction);
    return;
  }

  const purchaseTab = event.target.closest('[data-purchase-tab]');
  if (purchaseTab) {
    renderAccountPurchaseHistoryPanel(purchaseTab.dataset.purchaseTab);
    return;
  }

  const purchaseSummary = event.target.closest('.account-purchase-summary');
  if (purchaseSummary) {
    const card = purchaseSummary.closest('.account-purchase-card');
    const details = card?.querySelector('.account-purchase-details');
    const isExpanded = purchaseSummary.getAttribute('aria-expanded') === 'true';

    purchaseSummary.setAttribute(
      'aria-expanded',
      isExpanded ? 'false' : 'true'
    );
    card?.classList.toggle('is-expanded', !isExpanded);
    if (details) details.hidden = isExpanded;
    return;
  }

  const purchaseAction = event.target.closest('[data-purchase-action]');
  if (purchaseAction) {
    if (purchaseAction.dataset.purchaseAction === 'receipt') {
      renderAccountReceiptPanel(purchaseAction.dataset.purchaseId);
      return;
    }

    setAccountFooterHint(`${purchaseAction.textContent} is coming soon`);
    return;
  }

  const receiptAction = event.target.closest('[data-receipt-action]');
  if (receiptAction) {
    if (receiptAction.getAttribute('aria-disabled') === 'true') {
      setAccountFooterHint(receiptAction.dataset.accountHint || 'Coming soon');
      return;
    }

    if (receiptAction.dataset.receiptAction === 'back') {
      renderAccountPurchaseHistoryPanel();
      return;
    }

    setAccountFooterHint(`${receiptAction.textContent} is coming soon`);
    return;
  }

  const statSummary = event.target.closest('.account-stat-summary');
  if (statSummary) {
    const card = statSummary.closest('.account-stat-card');
    const details = card?.querySelector('.account-stat-details');
    const isExpanded = statSummary.getAttribute('aria-expanded') === 'true';

    statSummary.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
    card?.classList.toggle('is-expanded', !isExpanded);
    if (details) details.hidden = isExpanded;
    return;
  }

  const action = event.target.closest('[data-profile-action]');
  if (!action || action.disabled) return;

  if (action.dataset.profileAction === 'sendVerificationEmail') {
    sendAccountVerificationEmail(action);
    return;
  }

  if (action.dataset.profileAction === 'linkProvider') {
    linkAccountProvider(action.dataset.provider);
    return;
  }

  if (action.dataset.profileAction === 'changePassword') {
    window.location.href = '/sign-in?mode=reset';
    return;
  }

  if (action.dataset.profileAction === 'manageEmail') {
    requestAccountEmailChange(action);
    return;
  }

  if (action.dataset.profileAction === 'purchaseHistory') {
    setAccountExpandedPanel('PURCHASE HISTORY', 'purchaseHistory');
    return;
  }

  if (action.dataset.profileAction === 'securitySessions') {
    setAccountExpandedPanel('SECURITY', 'security');
    return;
  }

  const privacyActionSettings = {
    makeProfilePublic: { profileVisibility: 'public' },
    makeProfilePrivate: { profileVisibility: 'private' },
    showGameStats: { showGameStats: true },
    hideGameStats: { showGameStats: false },
    showOnlineStatus: { showOnlineStatus: true },
    hideOnlineStatus: { showOnlineStatus: false },
    allowFriendRequests: { allowFriendRequests: true },
    blockFriendRequests: { allowFriendRequests: false }
  };

  if (privacyActionSettings[action.dataset.profileAction]) {
    patchAccountPrivacySettings(
      action,
      privacyActionSettings[action.dataset.profileAction]
    );
    return;
  }

  if (action.dataset.profileAction === 'requestDataExport') {
    requestAccountDataExport(action);
    return;
  }

  if (action.dataset.profileAction === 'deleteAccount') {
    requestAccountDeletion(action);
    return;
  }

  if (action.dataset.profileAction === 'signOut') {
    logoutAccount();
  }
});

accountExpandedContent?.addEventListener('submit', (event) => {
  const searchForm = event.target.closest('.account-friends-search');
  if (!searchForm) return;

  event.preventDefault();
  const searchInput = searchForm.querySelector('.account-friends-search-input');
  const query = searchInput?.value?.trim();
  if (!query) {
    setAccountFooterHint('Enter a username');
    searchInput?.focus();
    return;
  }
  searchAccountFriends(query);
});

accountFooterHintController?.attach();

accountFooterGridButtons.forEach((grid) => {
  grid.addEventListener('click', () => {
    if (grid === accountFooterAuthGrid) {
      if (accountIsLoggedIn) {
        logoutAccount();
        return;
      }

      redirectToLoginFromAccount();
      return;
    }

    if (grid === accountFooterSaveGrid) {
      if (accountOeEditingDisabled) return;
      saveAccountCustomisation();
      return;
    }

    if (grid.id === 'footer-grid-3') {
      openAccountSettingsPanel();
    }
  });

  grid.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    grid.click();
  });
});

renderAccountActionMenu();
setAccountFooterAuthState(false);
setAccountPreview(getStoredAccount());
setAccountOeEditingDisabled(isOnlineGamePage());

window.addEventListener('focus', refreshAccountPreview);
window.addEventListener('pageshow', refreshAccountPreview);

refreshAccountPreview().finally(() => {
  renderAccountPreviewIcon();
  SetScriptLoaded('/scripts/general/account-container/account-container.js');
});
