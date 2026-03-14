(async () => {
    try {
        await LoadScript('/scripts/party-games/gamemode/online/mafia/mafia-online-logic.js');
        await LoadScript('/scripts/party-games/gamemode/online/mafia/mafia-online-player-board.js');
        await LoadScript('/scripts/party-games/gamemode/online/mafia/mafia-online-voting-ui.js');
        await LoadScript('/scripts/party-games/gamemode/online/mafia/mafia-online-setup.js');
        await Ready.when('selected-user-containers', { timeout: 10000 });
        await Ready.when('user-customisation-icon', { timeout: 10000 });
        await SetPageSettings();
        SetScriptLoaded('/scripts/party-games/gamemode/online/mafia/mafia-online.js?30082025');

    } catch (err) {
        console.error("❌ Error loading Mafia scripts:", err);
    }
})();
