(async () => {
    const onlineGameReadyPromise = (async () => {
        await LoadScript('/scripts/party-games/gamemode/online/general/round-late-join.js', { cacheBustKey: "PARTY_GAMES_ONLINE_NEVER_HAVE_I_EVER" });
        await LoadScript('/scripts/party-games/gamemode/online/never-have-i-ever/never-have-i-ever-online-logic.js', { cacheBustKey: "PARTY_GAMES_ONLINE_NEVER_HAVE_I_EVER" });
        await LoadScript('/scripts/party-games/gamemode/online/never-have-i-ever/never-have-i-ever-ui-helper.js', { cacheBustKey: "PARTY_GAMES_ONLINE_NEVER_HAVE_I_EVER" });
        await LoadScript('/scripts/party-games/gamemode/online/never-have-i-ever/never-have-i-ever-online-setup.js', { cacheBustKey: "PARTY_GAMES_ONLINE_NEVER_HAVE_I_EVER" });
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
        SetScriptLoaded('/scripts/party-games/gamemode/online/never-have-i-ever/never-have-i-ever-online.js');

    } catch (err) {
        console.error("❌ Error loading Never Have I Ever scripts:", err);
    }
})();
