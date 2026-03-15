async function waitForOnlineCore() {
    const timeoutMs = 10000;
    const startTime = Date.now();

    while (
        typeof window.checkAndMaybeBecomeHost !== 'function' ||
        typeof window.joinParty !== 'function' ||
        typeof window.updateOnlineParty !== 'function' ||
        typeof window.ShowPartyDoesNotExistState !== 'function' ||
        typeof window.ShowGameAlreadyStartedState !== 'function'
    ) {
        if (Date.now() - startTime >= timeoutMs) {
            throw new Error('Online core scripts did not finish loading in time.');
        }
        await new Promise(resolve => setTimeout(resolve, 50));
    }
}

(async () => {
    try {
        await LoadScript('/scripts/party-games/gamemode/online/truth-or-dare/truth-or-dare-online-logic.js');
        await LoadScript('/scripts/party-games/gamemode/online/truth-or-dare/truth-or-dare-online-ui-helper.js');
        await LoadScript('/scripts/party-games/gamemode/online/truth-or-dare/truth-or-dare-online-setup.js');
        await Ready.when('selected-user-containers', { timeout: 10000 });
        await waitForOnlineCore();
        await SetPageSettings();
        SetScriptLoaded('/scripts/party-games/gamemode/online/truth-or-dare/truth-or-dare-online.js?30082025');
    } catch (err) {
        console.error("❌ Error loading Truth or Dare scripts:", err);
    }
})();
