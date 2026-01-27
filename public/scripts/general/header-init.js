function initHeaderListeners() {
    if (headerSettingsButton) {
        headerSettingsButton.addEventListener('click', toggleSettings);
    }
    if (headerHelpButton) {
        headerHelpButton.addEventListener('click', toggleHelp);
    }
    if (overlay) {
        overlay.addEventListener('click', () => toggleOverlay(false));
    }
    if (headerExtraMenuButton) {
        headerExtraMenuButton.addEventListener('click', toggleExtraMenu);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeaderListeners);
}
else {
    initHeaderListeners();
}
