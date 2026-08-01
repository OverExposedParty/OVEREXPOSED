(async () => {
    const onlineGameReadyPromise = (async () => {
        await LoadScript('/scripts/party-games/gamemode/online/general/round-late-join.js', { cacheBustKey: "PARTY_GAMES_ONLINE_IMPOSTER" });
        await LoadScript('/scripts/party-games/gamemode/online/imposter/imposter-online-logic.js');
        await LoadScript('/scripts/party-games/gamemode/online/imposter/imposter-online-ui-helper.js');
        await LoadScript('/scripts/party-games/gamemode/online/imposter/imposter-online-setup.js');
        await Ready.when('selected-user-containers', { timeout: 10000 });
        await waitForOnlineCore();
        await SetPageSettings();
        window.onlineGameUiReady = true;
        await flushPendingOnlineInstructionSync();
        if (typeof FetchInstructions === 'function' && isPlaying) {
            await runOnlineFetchInstructions({ reason: 'startup' });
        }
    })();

    if (window.OEReady) {
        window.OEReady.register('online-game-page-ready', onlineGameReadyPromise);
    }

    try {
        await onlineGameReadyPromise;
        SetScriptLoaded('/scripts/party-games/gamemode/online/imposter/imposter-online.js');

    } catch (err) {
        console.error("❌ Error loading Imposter scripts:", err);
    }
})();
