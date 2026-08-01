function getAccountSoundEnabled(account = getStoredSettingsAccount()) {
    return typeof account?.sitePreferences?.soundEnabled === 'boolean'
        ? account.sitePreferences.soundEnabled
        : null;
}

function getAccountNsfwEnabled(account = getStoredSettingsAccount()) {
    return typeof account?.sitePreferences?.nsfwEnabled === 'boolean'
        ? account.sitePreferences.nsfwEnabled
        : null;
}

function getSettingsSoundCheckbox() {
    return document.getElementById('settings-sound');
}

function getSettingsNsfwCheckbox() {
    return document.getElementById('settings-nsfw');
}

const SETTINGS_VOLUME_CONFIG = Object.freeze({
    master: {
        id: 'settings-sound-volume-master',
        storageKey: 'settings-sound-volume',
        groups: []
    },
    ui: {
        id: 'settings-sound-volume-ui',
        storageKey: 'settings-sound-volume-ui',
        groups: ['ui']
    },
    game: {
        id: 'settings-sound-volume-game',
        storageKey: 'settings-sound-volume-game',
        groups: ['party-games', 'overexposure', 'olings']
    },
    notifications: {
        id: 'settings-sound-volume-notifications',
        storageKey: 'settings-sound-volume-notifications',
        groups: ['notifications']
    }
});

function clampSettingsVolume(value, fallback = 1) {
    if (value === null || value === undefined || value === '') return fallback;

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(1, Math.max(0, parsed));
}

function getStoredSettingsVolume(channel) {
    const config = SETTINGS_VOLUME_CONFIG[channel];
    if (!config) return 1;

    return clampSettingsVolume(localStorage.getItem(config.storageKey), 1);
}

function formatSettingsVolume(volume) {
    return String(Math.round(clampSettingsVolume(volume) * 100));
}

function getSettingsVolumeSlider(channel, root = document) {
    const id = SETTINGS_VOLUME_CONFIG[channel]?.id;
    return id ? root.querySelector?.(`#${id}`) || document.getElementById(id) : null;
}

function getSettingsVolumeHint(channel, volume) {
    const labels = {
        master: 'Master volume',
        ui: 'UI volume',
        game: 'Game volume',
        notifications: 'Notification volume'
    };

    return `${labels[channel] || 'Volume'}: ${formatSettingsVolume(volume)}`;
}

function getSliderFillPercent(slider) {
    const min = Number(slider.min) || 0;
    const max = Number(slider.max) || 100;
    const value = Number(slider.value) || min;
    const range = max - min;

    if (range <= 0) return 0;
    return Math.min(100, Math.max(0, ((value - min) / range) * 100));
}

function updateSettingsVolumeSliderFill(slider) {
    if (!slider) return;
    slider.style.setProperty('--volume-fill', `${getSliderFillPercent(slider)}%`);
}

function updateSettingsVolumeLabel(channel, volume, root = document) {
    const id = SETTINGS_VOLUME_CONFIG[channel]?.id;
    if (!id) return;

    const label = root.querySelector?.(`[data-volume-value-for="${id}"]`) ||
        document.querySelector(`[data-volume-value-for="${id}"]`);
    if (label) {
        label.textContent = formatSettingsVolume(volume);
    }
}

function applySettingsVolume(channel, volume, { persistLocal = true, root = document, updateSoundToggle = true } = {}) {
    const config = SETTINGS_VOLUME_CONFIG[channel];
    if (!config) return;

    const normalisedVolume = clampSettingsVolume(volume);
    if (persistLocal) {
        localStorage.setItem(config.storageKey, String(normalisedVolume));
    }

    const slider = getSettingsVolumeSlider(channel, root);
    if (slider) {
        const sliderValue = Math.round(normalisedVolume * 100);
        slider.value = String(sliderValue);
        updateSettingsVolumeSliderFill(slider);
    }
    updateSettingsVolumeLabel(channel, normalisedVolume, root);

    if (!window.OEAudio) return;

    if (channel === 'master') {
        OEAudio.setMasterVolume(normalisedVolume, { persist: persistLocal });
        if (updateSoundToggle && normalisedVolume === 0 && getEffectiveSoundEnabled()) {
            applySoundSetting(false);
            saveAccountSoundSetting(false);
            if (typeof setAccountFooterHint === 'function') {
                setAccountFooterHint('Sound disabled');
            }
        }
        return;
    }

    config.groups.forEach((group) => OEAudio.setGroupVolume(group, normalisedVolume));
}

function syncSettingsVolumeControls(root = document) {
    Object.keys(SETTINGS_VOLUME_CONFIG).forEach((channel) => {
        applySettingsVolume(channel, getStoredSettingsVolume(channel), {
            persistLocal: false,
            root,
            updateSoundToggle: false
        });
    });
}

function getEffectiveSoundEnabled(account = getStoredSettingsAccount()) {
    const accountSoundEnabled = getAccountSoundEnabled(account);
    return accountSoundEnabled === null
        ? localStorage.getItem('settings-sound') !== 'false'
        : accountSoundEnabled;
}

function getEffectiveNsfwEnabled(account = getStoredSettingsAccount()) {
    const accountNsfwEnabled = getAccountNsfwEnabled(account);
    return accountNsfwEnabled === null
        ? localStorage.getItem('settings-nsfw') === 'true'
        : accountNsfwEnabled;
}

function isNsfwContentEnabled() {
    return localStorage.getItem('settings-nsfw') === 'true';
}

function applySoundSetting(enabled, { persistLocal = true } = {}) {
    const soundEnabled = Boolean(enabled);
    const soundCheckbox = getSettingsSoundCheckbox();
    if (soundCheckbox) {
        soundCheckbox.checked = soundEnabled;
    }
    if (persistLocal) {
        localStorage.setItem('settings-sound', String(soundEnabled));
    }
    if (window.OEAudio) {
        OEAudio.setEnabled(soundEnabled, { persist: persistLocal });
    }
}

function applyNsfwSetting(enabled, { persistLocal = true } = {}) {
    const nsfwEnabled = Boolean(enabled);
    const previousNsfwValue = localStorage.getItem('settings-nsfw');
    const nsfwControl = getSettingsNsfwCheckbox();
    if (nsfwControl) {
        nsfwControl.checked = nsfwEnabled;
    }
    if (persistLocal) {
        localStorage.setItem('settings-nsfw', String(nsfwEnabled));
    }
    window.dispatchEvent(new CustomEvent('oe-nsfw-setting-changed', {
        detail: {
            enabled: nsfwEnabled,
            changed: previousNsfwValue !== String(nsfwEnabled)
        }
    }));
}

function syncSoundSettingFromAccount(account = getStoredSettingsAccount()) {
    applySoundSetting(getEffectiveSoundEnabled(account));
}

function syncNsfwSettingFromAccount(account = getStoredSettingsAccount()) {
    applyNsfwSetting(getEffectiveNsfwEnabled(account));
}

async function saveAccountSitePreference(preferences) {
    if (!getStoredSettingsAccount()) return;

    try {
        const response = await fetch('/api/accounts/me/site-preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(preferences)
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || payload.success === false) {
            throw new Error(payload.message || 'Failed to save sound preference');
        }

        const account = payload.account || getStoredSettingsAccount();
        if (account) {
            updateStoredSettingsAccount(account);
            syncSoundSettingFromAccount(account);
            syncNsfwSettingFromAccount(account);
        }
    }
    catch (error) {
        console.error('Failed to save account site preference:', error);
        syncSoundSettingFromAccount();
        syncNsfwSettingFromAccount();
    }
}

async function saveAccountSoundSetting(soundEnabled) {
    return saveAccountSitePreference({ soundEnabled });
}

async function saveAccountNsfwSetting(nsfwEnabled) {
    return saveAccountSitePreference({ nsfwEnabled });
}

function initialiseSettingsSoundControls() {
    syncSoundSettingFromAccount();
    syncNsfwSettingFromAccount();
    syncSettingsVolumeControls();
    bindSettingsPreferenceControls(document);
}

function bindSettingsPreferenceControls(root = document) {
    const soundCheckbox = root.querySelector?.('#settings-sound') || getSettingsSoundCheckbox();
    const nsfwControl = root.querySelector?.('#settings-nsfw') || getSettingsNsfwCheckbox();

    if (soundCheckbox && soundCheckbox.dataset.settingsBound !== 'true') {
        soundCheckbox.dataset.settingsBound = 'true';
        soundCheckbox.addEventListener('change', async function () {
            if (soundCheckbox.checked) {
                if (getStoredSettingsVolume('master') === 0) {
                    applySettingsVolume('master', 1, { root, updateSoundToggle: false });
                }
                applySoundSetting(true);
                if (typeof setAccountFooterHint === 'function') {
                    setAccountFooterHint('Sound enabled');
                }
                playInteractionSound('enabled');
                saveAccountSoundSetting(true);
            }
            else {
                await playInteractionSound('disabled', { ignoreEnabled: true });
                applySoundSetting(false);
                if (typeof setAccountFooterHint === 'function') {
                    setAccountFooterHint('Sound disabled');
                }
                saveAccountSoundSetting(false);
            }
        });
    }

    if (nsfwControl && nsfwControl.dataset.settingsBound !== 'true') {
        nsfwControl.dataset.settingsBound = 'true';
        nsfwControl.addEventListener('change', function () {
            applyNsfwSetting(nsfwControl.checked);
            saveAccountNsfwSetting(nsfwControl.checked);
            recordAccountAchievementEvent('settings.changed', { oncePerPage: false });
            if (nsfwControl.checked) {
                if (typeof setAccountFooterHint === 'function') {
                    setAccountFooterHint('NSFW content enabled');
                }
                playInteractionSound('enabled');
            }
            else {
                if (typeof setAccountFooterHint === 'function') {
                    setAccountFooterHint('NSFW content disabled');
                }
                playInteractionSound('disabled');
            }
        });
    }

    Object.keys(SETTINGS_VOLUME_CONFIG).forEach((channel) => {
        const volumeSlider = getSettingsVolumeSlider(channel, root);
        if (!volumeSlider || volumeSlider.dataset.settingsBound === 'true') return;

        volumeSlider.dataset.settingsBound = 'true';
        volumeSlider.addEventListener('input', () => {
            const volume = Number(volumeSlider.value) / 100;
            applySettingsVolume(channel, volume, { root });
            if (typeof setAccountFooterHint === 'function') {
                setAccountFooterHint(getSettingsVolumeHint(channel, volume));
            }
        });
        volumeSlider.addEventListener('change', () => {
            if (typeof playInteractionSound === 'function') {
                playInteractionSound('confirm');
            }
        });
    });

    syncSoundSettingFromAccount();
    syncNsfwSettingFromAccount();
    syncSettingsVolumeControls(root);
}

window.bindSettingsPreferenceControls = bindSettingsPreferenceControls;
window.isNsfwContentEnabled = isNsfwContentEnabled;
