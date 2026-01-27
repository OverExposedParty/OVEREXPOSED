(async () => {
    try {
        await LoadScript('/scripts/party-games/online/party-core.js');

        await LoadScript('/scripts/party-games/online/party-api.js');
        await LoadScript('/scripts/party-games/online/party-socket.js');
        await LoadScript('/scripts/party-games/online/party-chat-and-exit.js');

        await CheckGamePage();

    } catch (err) {
        console.error("❌ Error loading Online scripts:", err);
    }
})();
