(async () => {
    try {
        await LoadScript('/scripts/party-games/gamemode/online/truth-or-dare/truth-or-dare-online-logic.js');
        await LoadScript('/scripts/party-games/gamemode/online/truth-or-dare/truth-or-dare-online-ui-helper.js');
        await LoadScript('/scripts/party-games/gamemode/online/truth-or-dare/truth-or-dare-online-setup.js');
        await Ready.when('selected-user-containers', { timeout: 10000 });
        await SetPageSettings();
    } catch (err) {
        console.error("❌ Error loading Truth or Dare scripts:", err);
    }
})();
