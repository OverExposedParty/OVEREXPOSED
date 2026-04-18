async function waitForOnlineCore() {
    const timeoutMs = 30000;

    if (window.Ready?.when) {
        await Ready.when('online-core', { timeout: timeoutMs });
    }

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
        await LoadScript('/scripts/party-games/gamemode/online/mafia/mafia-online-logic.js');
        await LoadScript('/scripts/party-games/gamemode/online/mafia/mafia-online-player-board.js');
        await LoadScript('/scripts/party-games/gamemode/online/mafia/mafia-online-voting-ui.js');
        await LoadScript('/scripts/party-games/gamemode/online/mafia/mafia-online-setup.js');
        await Ready.when('selected-user-containers', { timeout: 10000 });
        await Ready.when('user-customisation-icon', { timeout: 10000 });
        await waitForOnlineCore();
        await SetPageSettings();
        window.onlineGameUiReady = true;
        await flushPendingOnlineInstructionSync();
        if (typeof FetchInstructions === 'function' && isPlaying) {
            await runOnlineFetchInstructions({ reason: 'startup' });
        }
        SetScriptLoaded('/scripts/party-games/gamemode/online/mafia/mafia-online.js');

    } catch (err) {
        console.error("❌ Error loading Mafia scripts:", err);
    }
})();
