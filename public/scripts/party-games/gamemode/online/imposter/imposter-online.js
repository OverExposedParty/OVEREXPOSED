(async () => {
    try {
        await LoadScript('/scripts/party-games/gamemode/online/imposter/imposter-online-logic.js');
        await LoadScript('/scripts/party-games/gamemode/online/imposter/imposter-online-ui-helper.js');
        await LoadScript('/scripts/party-games/gamemode/online/imposter/imposter-online-setup.js');
        await Ready.when('selected-user-containers', { timeout: 10000 });
        await SetPageSettings();
        SetScriptLoaded('/scripts/party-games/gamemode/online/imposter/imposter-online.js?30082025');

    } catch (err) {
        console.error("❌ Error loading Imposter scripts:", err);
    }
})();
