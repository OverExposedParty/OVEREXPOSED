if (instagramLink) instagramLink.href = instagramUrl;
if (tiktokLink) tiktokLink.href = tiktokUrl;

document.querySelectorAll('[data-oe-social-link]').forEach((link) => {
    const platform = link.dataset.oeSocialLink;
    const socialLink = window.OE_SOCIAL_MEDIA_LINKS?.[platform];
    if (socialLink?.url) {
        link.href = socialLink.url;
        if (!link.textContent.trim()) link.textContent = socialLink.label;
    }
});

const settingsConsoleOption = document.getElementById('settings-console-option');
const settingsConsoleCheckbox = document.getElementById('settings-console');

function initialiseSettingsAndLinks() {
    if (localStorage.getItem('settings-sound') === null) {
        localStorage.setItem('settings-sound', 'true');
    }
    if (localStorage.getItem('settings-nsfw') === null) {
        localStorage.setItem('settings-nsfw', 'true');
    }

    initialiseSettingsAchievementEvents();
    initialiseSettingsSoundControls();

    window.syncSettingsConsoleState = syncSettingsConsoleState;

    window.addEventListener('oe-account-state-changed', (event) => {
        const account = event.detail?.account || getStoredSettingsAccount();
        syncSoundSettingFromAccount(account);
        syncNsfwSettingFromAccount(account);
        syncSettingsConsoleState(account);
    });

    if (localStorage.getItem('settings-console') === null) {
        localStorage.setItem('settings-console', 'false');
    }

    syncSettingsConsoleState();
    window.addEventListener('pageshow', () => syncSettingsConsoleState());
    window.addEventListener('load', () => syncSettingsConsoleState());

    if (document.querySelector('#card-bounds-checkbox')) {
        if (localStorage.getItem('settings-card-bounds') === 'true') {
            cardBoundsCheckbox.checked = true;
        }

        cardBoundsCheckbox.addEventListener('change', function () {
            localStorage.setItem('settings-card-bounds', cardBoundsCheckbox.checked);
            if (cardBoundsCheckbox.checked) {
                playInteractionSound('enabled');
            }
            else {
                playInteractionSound('disabled');
            }
        });
    }
}

initialiseSettingsAndLinks();
