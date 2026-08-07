(async () => {
    let loadedReported = false;

    function reportOnlineSettingsLoaded() {
        if (loadedReported) return;
        loadedReported = true;

        if (window.OEUsesPhasedLoader) return;

        const reportLoaded = () => {
            SetScriptLoaded('/scripts/party-games/online/online-settings.js');
        };

        if (typeof SetScriptLoaded === 'function') {
            reportLoaded();
        } else if (typeof waitForFunction === 'function') {
            waitForFunction('SetScriptLoaded', reportLoaded);
        }
    }

    const onlineSettingsReady = (async () => {
        await LoadScript('/scripts/general/online/session-status-prompts.js');
        await LoadScript('/scripts/general/online/active-party-conflict-dialog.js');
        await LoadScript('/scripts/general/online/party-auth-transition.js');
        await LoadScript('/scripts/party-games/online/party-core/state.js');
        await LoadScript('/scripts/party-games/online/party-core/routing.js');
        await LoadScript('/scripts/party-games/online/party-core/error-reporting.js');
        await LoadScript('/scripts/party-games/online/party-core/core-ready.js');
        await LoadScript('/scripts/party-games/online/party-core/identity.js');
        await LoadScript('/scripts/party-games/online/party-core/status-ui.js');
        await LoadScript('/scripts/party-games/online/party-core/sync.js');
        await LoadScript('/scripts/party-games/online/party-core.js');

        await LoadScript('/scripts/party-games/online/party-api/party-data.js');
        await LoadScript('/scripts/party-games/online/party-api/actions.js');
        await LoadScript('/scripts/party-games/online/party-api/players.js');
        await LoadScript('/scripts/party-games/online/party-api/account-link.js');
        await LoadScript('/scripts/party-games/online/party-api.js');
        await LoadScript('/scripts/party-games/online/party-game-switcher.js');
        await LoadScript('/scripts/party-games/online/party-socket.js');
        await LoadScript('/scripts/party-games/online/party-chat-and-exit.js');

        reportOnlineSettingsLoaded();

        window.onlineCoreReady = true;
        if (window.Ready?.set) {
            Ready.set('online-core');
        }
    })();

    if (window.OEReady) {
        window.OEReady.register('online-settings', onlineSettingsReady);
    }

    try {
        await onlineSettingsReady;
    } catch (err) {
        console.error("❌ Error loading Online scripts:", err);
        reportOnlineSettingsLoaded();
    }
})();
