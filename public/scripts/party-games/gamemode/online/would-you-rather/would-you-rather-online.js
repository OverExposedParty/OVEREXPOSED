(async () => {
    try {
        await LoadScript('/scripts/party-games/gamemode/online/would-you-rather/would-you-rather-online-logic.js');
        await LoadScript('/scripts/party-games/gamemode/online/would-you-rather/would-you-rather-ui-helper.js');
        await LoadScript('/scripts/party-games/gamemode/online/would-you-rather/would-you-rather-online-setup.js');
        await Ready.when('selected-user-containers', { timeout: 10000 });
        await waitForOnlineCore();
        await SetPageSettings();
        window.onlineGameUiReady = true;
        await flushPendingOnlineInstructionSync();
        if (typeof FetchInstructions === 'function' && isPlaying) {
            await runOnlineFetchInstructions({ reason: 'startup' });
        }
        SetScriptLoaded('/scripts/party-games/gamemode/online/would-you-rather/would-you-rather-online.js');

    } catch (err) {
        console.error("❌ Error loading Would You Rather scripts:", err);
    }
})();
