(async () => {
    try {
        await LoadScript('/scripts/party-games/gamemode/online/most-likely-to/most-likely-to-online-logic.js', { cacheBustKey: "PARTY_GAMES_ONLINE_MOST_LIKELY_TO" });
        await LoadScript('/scripts/party-games/gamemode/online/most-likely-to/most-likely-to-online-setup.js', { cacheBustKey: "PARTY_GAMES_ONLINE_MOST_LIKELY_TO" });
        await Ready.when('selected-user-containers', { timeout: 10000 });
        await waitForOnlineCore();
        await SetPageSettings();
        window.onlineGameUiReady = true;
        await flushPendingOnlineInstructionSync();
        if (typeof FetchInstructions === 'function' && isPlaying) {
            await runOnlineFetchInstructions({ reason: 'startup' });
        }
        SetScriptLoaded('/scripts/party-games/gamemode/online/most-likely-to/most-likely-to-online.js');

    } catch (err) {
        console.error("❌ Error loading Most Likely To scripts:", err);
    }
})();
