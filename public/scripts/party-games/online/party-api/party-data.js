(() => {
  const ONLINE_PARTY_ID_PATTERN = /^[A-Za-z0-9]{3}-[A-Za-z0-9]{3}$/;

  function normaliseOnlinePartyId(value = partyCode) {
    const candidate =
      value && typeof value === 'object'
        ? (value.partyId ??
          value.partyCode ??
          value.data?.partyId ??
          value.data?.partyCode)
        : value;

    if (typeof candidate !== 'string') return '';

    const trimmed = candidate.trim();
    if (ONLINE_PARTY_ID_PATTERN.test(trimmed)) return trimmed;

    return trimmed.match(/[A-Za-z0-9]{3}-[A-Za-z0-9]{3}/)?.[0] ?? '';
  }

  function requireOnlinePartyId(value = partyCode) {
    const normalisedPartyId = normaliseOnlinePartyId(value);
    if (normalisedPartyId) return normalisedPartyId;

    throw new Error('partyId must match XXX-XXX');
  }

  async function getExistingPartyData(partyId, partyType = sessionPartyType) {
    try {
      const normalisedPartyId = requireOnlinePartyId(partyId);
      const res = await fetch(
        `/api/${partyType}?partyCode=${encodeURIComponent(normalisedPartyId)}`,
        { cache: 'no-store' }
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const message =
          payload.error?.message ||
          payload.message ||
          `Failed to fetch party data with status ${res.status}`;
        throw new Error(message);
      }
      return await res.json();
    } catch (err) {
      console.error('Failed to fetch existing party data:', err);
      throw err;
    }
  }

  async function GetCurrentPartyData({
    requireInstructions = false,
    retries = 0,
    delayMs = 150
  } = {}) {
    const fallbackParty =
      currentPartyData &&
      (currentPartyData.partyId === partyCode || !currentPartyData.partyId)
        ? currentPartyData
        : null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const existingData = await getExistingPartyData(partyCode);
      const latestParty = existingData?.[0];
      const latestInstructions =
        typeof getUserInstructions === 'function'
          ? getUserInstructions(latestParty)
          : (latestParty?.config?.userInstructions ??
            latestParty?.state?.userInstructions ??
            latestParty?.userInstructions ??
            '');

      if (!latestParty) {
        debugLog('[OE_DEBUG][GetCurrentPartyData] no latest party', {
          partyCode,
          requireInstructions,
          attempt,
          retries,
          hasFallbackParty: Boolean(fallbackParty)
        });
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        if (fallbackParty) return fallbackParty;
        console.warn('No party data found.');
        return undefined;
      }

      if (!requireInstructions) return latestParty;

      if (typeof latestInstructions === 'string' && latestInstructions.trim()) {
        return latestParty;
      }

      if (attempt < retries) {
        debugLog(
          '[OE_DEBUG][GetCurrentPartyData] latest party missing instructions, retrying',
          { partyCode, attempt, retries }
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        debugLog(
          '[OE_DEBUG][GetCurrentPartyData] returning latest party without instructions after retries',
          { partyCode, attempt }
        );
        return latestParty;
      }
    }

    return undefined;
  }

  async function reserveUniquePartyCode() {
    const res = await fetch('/api/party-code/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      const serverError = payload?.error || {};
      const error = new Error(
        serverError.message || 'Failed to reserve unique party code'
      );
      error.code = serverError.code || 'party_code_reserve_failed';
      error.details = serverError.details || null;
      error.status = res.status;
      error.requestId = payload?.requestId || null;
      throw error;
    }

    const data = await res.json();
    return requireOnlinePartyId(data.partyCode ?? data.data?.partyCode);
  }

  async function getPartyChatLog() {
    try {
      const res = await fetch(`/api/chat/${partyCode}`, {
        cache: 'no-store'
      });
      const existingData = await res.json();
      return existingData.data ?? existingData;
    } catch (err) {
      console.error('Failed to fetch party chat log:', err);
      throw err;
    }
  }

  window.PartyApiPartyData = {
    GetCurrentPartyData,
    getExistingPartyData,
    getPartyChatLog,
    normaliseOnlinePartyId,
    requireOnlinePartyId,
    reserveUniquePartyCode
  };
})();
