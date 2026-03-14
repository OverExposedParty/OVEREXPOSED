(async () => {
    try {
        await LoadScript('/scripts/party-games/gamemode/online/most-likely-to/most-likely-to-online-logic.js');
        await LoadScript('/scripts/party-games/gamemode/online/most-likely-to/most-likely-to-online-setup.js');
        await Ready.when('selected-user-containers', { timeout: 10000 });
        await SetPageSettings();
        SetScriptLoaded('/scripts/party-games/gamemode/online/most-likely-to/most-likely-to-online.js?30082025');

    } catch (err) {
        console.error("❌ Error loading Most Likely To scripts:", err);
    }
})();
