function getAccountConsoleEnabled(account = getStoredSettingsAccount()) {
    return typeof account?.sitePreferences?.consoleEnabled === 'boolean'
        ? account.sitePreferences.consoleEnabled
        : null;
}

function getEffectiveConsoleEnabled(account = getStoredSettingsAccount()) {
    const accountConsoleEnabled = getAccountConsoleEnabled(account);
    return accountConsoleEnabled === null
        ? localStorage.getItem('settings-console') === 'true'
        : accountConsoleEnabled;
}

function getSettingsConsoleCheckbox() {
    return document.getElementById('settings-console');
}

function applyConsoleSetting(enabled, { persistLocal = true } = {}) {
    const consoleEnabled = Boolean(enabled);
    const consoleCheckbox = getSettingsConsoleCheckbox();
    if (consoleCheckbox) {
        consoleCheckbox.checked = consoleEnabled;
    }
    if (persistLocal) {
        localStorage.setItem('settings-console', String(consoleEnabled));
    }
    setOverexposureConsoleVisible(consoleEnabled);
}

async function saveAccountConsoleSetting(consoleEnabled) {
    if (!getStoredSettingsAccount()) return;

    try {
        const response = await fetch('/api/accounts/me/site-preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ consoleEnabled })
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || payload.success === false) {
            throw new Error(payload.message || 'Failed to save console preference');
        }

        const account = payload.account || getStoredSettingsAccount();
        if (account) {
            updateStoredSettingsAccount(account);
            syncSettingsConsoleState(account);
        }
    }
    catch (error) {
        console.error('Failed to save account console preference:', error);
        syncSettingsConsoleState();
    }
}

function setSettingsConsoleAdminState(account) {
    const canAccessConsole = canAccountAccessSettingsConsole(account);
    const consoleCheckbox = getSettingsConsoleCheckbox();

    if (settingsConsoleOption) {
        settingsConsoleOption.hidden = !canAccessConsole;
    }

    if (!canAccessConsole) {
        if (consoleCheckbox) {
            consoleCheckbox.checked = false;
            consoleCheckbox.disabled = true;
        }
        setOverexposureConsoleVisible(false);
        return;
    }

    if (consoleCheckbox) {
        consoleCheckbox.disabled = false;
    }

    initialiseOverexposureConsoleInteractions();
    applyConsoleSetting(getEffectiveConsoleEnabled(account));
}

function syncSettingsConsoleState(account = getStoredSettingsAccount()) {
    setSettingsConsoleAdminState(account);
}

function bindSettingsConsoleControl(root = document) {
    const consoleCheckbox = root.querySelector?.('#settings-console') || getSettingsConsoleCheckbox();
    if (!consoleCheckbox) return;

    if (consoleCheckbox.dataset.settingsBound !== 'true') {
        consoleCheckbox.dataset.settingsBound = 'true';
        consoleCheckbox.addEventListener('change', function () {
            applyConsoleSetting(consoleCheckbox.checked);
            saveAccountConsoleSetting(consoleCheckbox.checked);

            if (typeof setAccountFooterHint === 'function') {
                setAccountFooterHint(consoleCheckbox.checked ? 'Console enabled' : 'Console disabled');
            }

            if (consoleCheckbox.checked) {
                playInteractionSound('enabled');
            }
            else {
                playInteractionSound('disabled');
            }
        });
    }

    syncSettingsConsoleState();
}

window.bindSettingsConsoleControl = bindSettingsConsoleControl;
