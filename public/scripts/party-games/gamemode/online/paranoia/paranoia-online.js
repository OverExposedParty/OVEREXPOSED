(async () => {
    try {
        await LoadScript('/scripts/party-games/gamemode/online/paranoia/paranoia-online-logic.js');
        await LoadScript('/scripts/party-games/gamemode/online/paranoia/paranoia-online-event-listeners.js');
        await LoadScript('/scripts/party-games/gamemode/online/paranoia/paranoia-online-ui-helper.js');
        await LoadScript('/scripts/party-games/gamemode/online/paranoia/paranoia-online-setup.js');
        await Ready.when('selected-user-containers', { timeout: 10000 });
        await waitForOnlineCore();
        await SetPageSettings();
        window.onlineGameUiReady = true;
        await flushPendingOnlineInstructionSync();
        if (typeof FetchInstructions === 'function' && isPlaying) {
            await runOnlineFetchInstructions({ reason: 'startup' });
        }
        SetScriptLoaded('/scripts/party-games/gamemode/online/paranoia/paranoia-online.js');

    } catch (err) {
        console.error("❌ Error loading Paranoia scripts:", err);
    }
})();
