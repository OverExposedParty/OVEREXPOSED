(async () => {
    try {
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
        SetScriptLoaded('/scripts/party-games/gamemode/online/imposter/imposter-online.js');

    } catch (err) {
        console.error("❌ Error loading Imposter scripts:", err);
    }
})();
