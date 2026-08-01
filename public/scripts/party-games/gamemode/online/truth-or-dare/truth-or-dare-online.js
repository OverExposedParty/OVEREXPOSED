(async () => {
    const onlineGameReadyPromise = (async () => {
        await LoadScript('/scripts/party-games/gamemode/online/truth-or-dare/truth-or-dare-online-logic.js');
        await LoadScript('/scripts/party-games/gamemode/online/truth-or-dare/truth-or-dare-online-ui-helper.js');
        await LoadScript('/scripts/party-games/gamemode/online/truth-or-dare/truth-or-dare-online-setup.js');
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
        SetScriptLoaded('/scripts/party-games/gamemode/online/truth-or-dare/truth-or-dare-online.js');
    } catch (err) {
        console.error("❌ Error loading Truth or Dare scripts:", err);
    }
})();
