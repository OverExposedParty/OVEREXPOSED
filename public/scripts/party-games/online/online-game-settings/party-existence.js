function stopOnlinePartyExpiryMonitor() {
  if (!onlinePartyExpiryMonitorId) return;
  clearInterval(onlinePartyExpiryMonitorId);
  onlinePartyExpiryMonitorId = null;
}

async function resetOnlineSettingsAfterMissingParty(reason = 'missing-party') {
  if (!partyCode) return;

  const expiredPartyCode = partyCode;
  stopOnlinePartyExpiryMonitor();

  hostedParty = false;
  waitingForHost = false;
  currentPartyData = null;
  partyCode = null;
  removeOnlineSettingsPartyCodeFromUrl();
  window.PartyChat?.clearMessages?.();
  window.PartyChat?.setAvailable?.(false);
  window.currentOnlineShuffleSeed = null;

  debugLog(
    `[OnlineSettings] Party ${expiredPartyCode} no longer exists:`,
    reason
  );

  window.onlinePartySuppressNextLeftPartyDisbanded = true;
  socket?.emit?.('leave-party', expiredPartyCode);

  if (inputPartyCode) {
    inputPartyCode.value = '';
  }

  if (typeof togglePartyQrCode === 'function') {
    togglePartyQrCode(false);
  }
  if (typeof updatePartyQrPlayerCount === 'function') {
    updatePartyQrPlayerCount(0);
  }
  if (typeof clearPlayerCountRestrictionError === 'function') {
    clearPlayerCountRestrictionError();
  }

  onlineSettingsTab.classList.add('disabled');
  onlineSettingsTab.classList.remove('active');
  hideContainer(onlineSettingsContainer);

  hideContainer(packsContainer);
  packsSettingsTab.classList.remove('active');

  showContainer(rulesContainer);
  rulesSettingsTab.classList.add('active');

  SetGamemodeButtons();
  await UpdateSettings({ syncOnlineParty: false });

  allUsersReady = undefined;
  updateStartGameButton();
  toggleUserCustomisationIcon(false);
}

async function checkOnlinePartyStillExists() {
  if (!partyCode || loadingPage) return true;

  try {
    const existingData = await getExistingPartyData(partyCode);
    const latestParty = Array.isArray(existingData) ? existingData[0] : null;

    if (!latestParty) {
      await resetOnlineSettingsAfterMissingParty('ttl-expired');
      return false;
    }

    return true;
  } catch (error) {
    console.warn('Failed to check whether online party still exists:', error);
    return true;
  }
}

function startOnlinePartyExpiryMonitor() {
  stopOnlinePartyExpiryMonitor();
  onlinePartyExpiryMonitorId = setInterval(() => {
    checkOnlinePartyStillExists();
  }, ONLINE_PARTY_EXPIRY_CHECK_INTERVAL_MS);
}

function setOnlineSettingsPartyCodeInUrl(code = partyCode) {
  if (!code || !/\/settings\/?$/i.test(window.location.pathname)) return;

  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('partyCode') === code) return;
    url.searchParams.set('partyCode', code);
    window.history.replaceState({}, document.title, url.toString());
  } catch (error) {
    console.warn('Failed to update online settings URL:', error);
  }
}

function removeOnlineSettingsPartyCodeFromUrl() {
  if (!/\/settings\/?$/i.test(window.location.pathname)) return;

  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('partyCode')) return;
    url.searchParams.delete('partyCode');
    window.history.replaceState({}, document.title, url.toString());
  } catch (error) {
    console.warn('Failed to clear online settings URL:', error);
  }
}

