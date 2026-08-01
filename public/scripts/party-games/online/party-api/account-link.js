(() => {
  const { requireOnlinePartyId } = window.PartyApiPartyData;
  let onlinePartyAccountLinkInFlight = null;
  let onlinePartyGuestContinuationInFlight = null;
  let currentAccountLinkIdentityKey = '';
  let lastShownAccountLinkConflictKey = '';

  function getStoredAccountId() {
    try {
      const storedAccount = JSON.parse(
        window.localStorage?.getItem('oe-account') || 'null'
      );
      return storedAccount?.id || storedAccount?._id || '';
    } catch {
      return '';
    }
  }

  function syncAccountLinkIdentity({ accountId, partyId }) {
    const identityKey = `${String(accountId || 'unknown-account')}:${partyId}`;
    if (identityKey !== currentAccountLinkIdentityKey) {
      currentAccountLinkIdentityKey = identityKey;
      lastShownAccountLinkConflictKey = '';
    }
    return identityKey;
  }

  function resetAccountLinkConflictState() {
    currentAccountLinkIdentityKey = '';
    lastShownAccountLinkConflictKey = '';
  }

  function getCurrentPartyPlayer() {
    const party =
      typeof currentPartyData !== 'undefined' ? currentPartyData : null;
    const computerId = typeof deviceId !== 'undefined' ? deviceId : null;
    if (!party || !computerId || !Array.isArray(party.players)) return null;

    return (
      party.players.find(
        (player) =>
          String(player?.identity?.computerId || player?.computerId || '') ===
          String(computerId)
      ) || null
    );
  }

  function getAccountLinkConflictPartyCode(data) {
    const serverError =
      data?.error && typeof data.error === 'object' ? data.error : null;
    if (serverError?.code !== 'party_owner_active_party_exists') return '';

    const partyCode = String(serverError.details?.partyCode || '')
      .trim()
      .toUpperCase();
    return /^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(partyCode) ? partyCode : '';
  }

  async function linkCurrentPartyPlayerToAccount({
    partyId = partyCode,
    computerId = deviceId,
    partyType = sessionPartyType,
    accountId = getStoredAccountId(),
    silent = true
  } = {}) {
    if (!partyId || !computerId || !partyType) return null;
    if (onlinePartyAccountLinkInFlight) return onlinePartyAccountLinkInFlight;

    onlinePartyAccountLinkInFlight = (async () => {
      try {
        const normalisedPartyId = requireOnlinePartyId(partyId);
        const identityKey = syncAccountLinkIdentity({
          accountId,
          partyId: normalisedPartyId
        });
        const res = await fetch(
          `/api/${partyType}/link-player-account?partyCode=${encodeURIComponent(normalisedPartyId)}`,
          {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ partyId: normalisedPartyId, computerId })
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const conflictPartyCode = getAccountLinkConflictPartyCode(data);
          const conflictKey = conflictPartyCode
            ? `${identityKey}:${conflictPartyCode}`
            : '';
          if (conflictKey && conflictKey === lastShownAccountLinkConflictKey) {
            return null;
          }

          const conflictShown =
            typeof window.ActivePartyConflictDialog?.openFromError ===
              'function' &&
            window.ActivePartyConflictDialog.openFromError(data, {
              source: 'account-link'
            });
          if (conflictShown) {
            lastShownAccountLinkConflictKey = conflictKey;
            return null;
          }

          const message =
            data.error?.message ||
            (typeof data.error === 'string' ? data.error : '') ||
            data.message ||
            'Failed to link player account';
          const error = new Error(message);
          error.status = res.status;
          error.code = data.error?.code;
          error.details = data.error?.details;
          error.payload = data;
          if (!silent) throw error;
          if (typeof debugLog === 'function') {
            debugLog('[linkCurrentPartyPlayerToAccount] skipped', data);
          }
          return null;
        }

        lastShownAccountLinkConflictKey = '';

        if (data.updated) currentPartyData = data.updated;
        if (
          data.rewardSummaries &&
          currentPartyData?.state?.phaseData &&
          typeof currentPartyData.state.phaseData === 'object'
        ) {
          currentPartyData.state.phaseData.rewardSummaries =
            data.rewardSummaries;
        }
        const rewardSummary =
          typeof getCurrentPlayerPartyGameRewardSummary === 'function'
            ? getCurrentPlayerPartyGameRewardSummary()
            : data.claimedReward;
        if (typeof renderPartyGameRewards === 'function') {
          renderPartyGameRewards(rewardSummary);
        }
        if (typeof renderPartyGameXp === 'function') {
          renderPartyGameXp(rewardSummary);
        }
        if (data.claimedReward?.earnedTotal > 0) {
          window.refreshAccountPreview?.();
        }

        return data;
      } finally {
        onlinePartyAccountLinkInFlight = null;
      }
    })();

    return onlinePartyAccountLinkInFlight;
  }

  async function continueCurrentPartyPlayerAsGuest({
    partyId = partyCode,
    computerId = deviceId,
    partyType = sessionPartyType
  } = {}) {
    if (!partyId || !computerId || !partyType) return null;
    if (onlinePartyGuestContinuationInFlight) {
      return onlinePartyGuestContinuationInFlight;
    }

    onlinePartyGuestContinuationInFlight = (async () => {
      try {
        const normalisedPartyId = requireOnlinePartyId(partyId);
        const players =
          typeof currentPartyData !== 'undefined' &&
          Array.isArray(currentPartyData?.players)
            ? currentPartyData.players
            : [];
        const username =
          typeof window.resolveOnlineUsername === 'function'
            ? await window.resolveOnlineUsername(players)
            : window.getOrCreateOeGuestUsername?.() || 'Guest';
        const userIcon =
          typeof window.getStoredUserIconString === 'function'
            ? window.getStoredUserIconString()
            : '0000:0100:0200:0300';
        const response = await fetch(
          `/api/${partyType}/continue-player-as-guest?partyCode=${encodeURIComponent(normalisedPartyId)}`,
          {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              partyId: normalisedPartyId,
              computerId,
              newUsername: username,
              newUserIcon: userIcon
            })
          }
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            data.error?.message ||
              data.message ||
              'Failed to continue party as a guest'
          );
        }

        if (data.updated) currentPartyData = data.updated;
        if (typeof onlineUsername !== 'undefined') onlineUsername = username;
        if (
          data.updated &&
          typeof window.UpdateUserIcons === 'function'
        ) {
          await window.UpdateUserIcons(data.updated);
        }
        return data;
      } finally {
        onlinePartyGuestContinuationInFlight = null;
      }
    })();

    return onlinePartyGuestContinuationInFlight;
  }

  function bindPartyAccountLinkListener() {
    if (window.PartyApiAccountLinkListenerBound) return;
    window.PartyApiAccountLinkListenerBound = true;

    window.addEventListener('oe-account-state-changed', (event) => {
      if (!event.detail?.isLoggedIn) {
        resetAccountLinkConflictState();
        if (getCurrentPartyPlayer()) {
          return continueCurrentPartyPlayerAsGuest().catch((error) => {
            console.warn('Failed to continue party as a guest:', error);
          });
        }
        return;
      }
      if (
        typeof partyCode === 'undefined' ||
        typeof sessionPartyType === 'undefined' ||
        typeof deviceId === 'undefined' ||
        !partyCode ||
        !sessionPartyType ||
        !deviceId
      ) {
        return;
      }
      linkCurrentPartyPlayerToAccount({
        accountId: event.detail.account?.id || event.detail.account?._id || ''
      }).catch((error) => {
        console.warn(
          'Failed to claim party player rewards after sign in:',
          error
        );
      });
    });
  }

  window.PartyApiAccountLink = {
    bindPartyAccountLinkListener,
    continueCurrentPartyPlayerAsGuest,
    linkCurrentPartyPlayerToAccount
  };
})();
