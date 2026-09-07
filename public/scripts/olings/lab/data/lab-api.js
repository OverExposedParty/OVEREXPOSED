(function () {
  function createOlingLabApi({
    LAB_ENDPOINT,
    RARITY_PALETTE_ENDPOINT,
    MY_OLINGS_ENDPOINT,
    OLING_STORAGE_ENDPOINT,
    parsePayload
  }) {
    const jsonHeaders = { Accept: 'application/json' };
    return {
      loadLab: () =>
        fetch(LAB_ENDPOINT, { headers: jsonHeaders }).then(parsePayload),
      saveLab: (lab) =>
        fetch(LAB_ENDPOINT, {
          method: 'PUT',
          headers: { ...jsonHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ lab })
        }).then(parsePayload),
      loadRarityPalette: () =>
        fetch(RARITY_PALETTE_ENDPOINT, { headers: jsonHeaders }).then(
          (response) => {
            if (!response.ok) throw new Error('Rarity palette request failed');
            return response.json();
          }
        ),
      loadPlayerOlings: () =>
        fetch(MY_OLINGS_ENDPOINT, { headers: jsonHeaders }).then(parsePayload),
      storeOling: (olingId, podKey, containerPlacedId) =>
        fetch(
          `${OLING_STORAGE_ENDPOINT}/${encodeURIComponent(olingId)}/store`,
          {
            method: 'POST',
            headers: { ...jsonHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ podKey, containerPlacedId })
          }
        ).then(parsePayload),
      transferStoredOling: (olingId, containerPlacedId) =>
        fetch(
          `${OLING_STORAGE_ENDPOINT}/${encodeURIComponent(olingId)}/transfer`,
          {
            method: 'POST',
            headers: { ...jsonHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ containerPlacedId })
          }
        ).then(parsePayload),
      releaseOling: (olingId) =>
        fetch(
          `${OLING_STORAGE_ENDPOINT}/${encodeURIComponent(olingId)}/release`,
          { method: 'POST', headers: jsonHeaders }
        ).then(parsePayload)
    };
  }
  window.createOlingLabApi = createOlingLabApi;
})();
