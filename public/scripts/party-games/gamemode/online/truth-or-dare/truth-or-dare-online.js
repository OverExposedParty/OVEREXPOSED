(async () => {
    try {
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
        SetScriptLoaded('/scripts/party-games/gamemode/online/truth-or-dare/truth-or-dare-online.js');
    } catch (err) {
        console.error("❌ Error loading Truth or Dare scripts:", err);
    }
})();
