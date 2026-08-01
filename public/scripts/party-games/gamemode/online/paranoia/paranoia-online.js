(async () => {
    const onlineGameReadyPromise = (async () => {
        await LoadScript('/scripts/party-games/gamemode/online/general/round-late-join.js', { cacheBustKey: "PARTY_GAMES_ONLINE_PARANOIA" });
        await LoadScript('/scripts/party-games/gamemode/online/paranoia/paranoia-online-logic.js', { cacheBustKey: "PARTY_GAMES_ONLINE_PARANOIA" });
        await LoadScript('/scripts/party-games/gamemode/online/paranoia/paranoia-online-event-listeners.js', { cacheBustKey: "PARTY_GAMES_ONLINE_PARANOIA" });
        await LoadScript('/scripts/party-games/gamemode/online/paranoia/paranoia-online-ui-helper.js', { cacheBustKey: "PARTY_GAMES_ONLINE_PARANOIA" });
        await LoadScript('/scripts/party-games/gamemode/online/paranoia/paranoia-online-setup.js', { cacheBustKey: "PARTY_GAMES_ONLINE_PARANOIA" });
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
        SetScriptLoaded('/scripts/party-games/gamemode/online/paranoia/paranoia-online.js');

    } catch (err) {
        console.error("❌ Error loading Paranoia scripts:", err);
    }
})();
