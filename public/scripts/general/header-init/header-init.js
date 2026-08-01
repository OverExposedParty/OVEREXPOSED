function initHeaderListeners() {
    if (headerSettingsButton) {
        headerSettingsButton.addEventListener('click', toggleSettings);
    }
    if (headerHelpButton) {
        headerHelpButton.addEventListener('click', toggleHelpHub);
    }
    if (overlay) {
        overlay.addEventListener('click', () => toggleOverlay(false));
    }
    if (headerExtraMenuButton) {
        headerExtraMenuButton.addEventListener('click', toggleExtraMenu);
    }
    if (accountLink && accountContainer) {
        accountLink.addEventListener('click', toggleAccount);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeaderListeners);
}
else {
    initHeaderListeners();
}
