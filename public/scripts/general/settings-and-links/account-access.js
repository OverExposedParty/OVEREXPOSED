function getStoredSettingsAccount() {
    try {
        return JSON.parse(localStorage.getItem('oe-account')) || null;
    }
    catch {
        return null;
    }
}

function updateStoredSettingsAccount(account) {
    if (!account) return;
    localStorage.setItem('oe-account', JSON.stringify(account));
    window.dispatchEvent(new CustomEvent('oe-account-state-changed', {
        detail: { account }
    }));
}

function canAccountAccessSettingsConsole(account) {
    if (!account) return false;
    if (account.admin?.disabled) return false;
    if (typeof account.canAccessConsole === 'boolean') {
        return account.canAccessConsole;
    }

    const roles = [
        ...(Array.isArray(account.admin?.roles) ? account.admin.roles : []),
        account.admin?.role
    ]
        .filter(Boolean)
        .map((role) => String(role).toLowerCase());
    const permissions = Array.isArray(account.admin?.permissions)
        ? account.admin.permissions.map((permission) => String(permission).toLowerCase())
        : [];

    return roles.some((role) => ['owner', 'admin'].includes(role))
        || permissions.includes('console.access');
}

function canShowSettingsConsole() {
    const consoleEnabled = typeof getEffectiveConsoleEnabled === 'function'
        ? getEffectiveConsoleEnabled(getStoredSettingsAccount())
        : localStorage.getItem('settings-console') === 'true';

    return consoleEnabled
        && canAccountAccessSettingsConsole(getStoredSettingsAccount());
}

const extraMenuBetaTesterRole = 'beta_tester';
const extraMenuBetaTesterFeatures = new Set([
    'olings.lab',
    'overexposure',
    'party-games.prompt-heist',
    'shop',
    'would-you-rather',
    'imposter'
]);

function getExtraMenuAccessRoles(account) {
    return (Array.isArray(account?.access?.roles) ? account.access.roles : [])
        .filter(Boolean)
        .map((role) => String(role).toLowerCase());
}

function getExtraMenuAccessFeatures(account) {
    return (Array.isArray(account?.access?.features) ? account.access.features : [])
        .filter(Boolean)
        .map((feature) => String(feature).toLowerCase());
}

function canAccountAccessExtraMenuFeature(account, feature) {
    const normalizedFeature = String(feature || '').trim().toLowerCase();
    if (!account || !normalizedFeature) return false;
    if (account.canAccessOePanel === true) return true;
    if (account.access?.disabled) return false;

    const roles = getExtraMenuAccessRoles(account);
    if (
        roles.includes(extraMenuBetaTesterRole)
        && extraMenuBetaTesterFeatures.has(normalizedFeature)
    ) {
        return true;
    }

    return getExtraMenuAccessFeatures(account).includes(normalizedFeature);
}

function setExtraMenuLinkVisible(link, visible) {
    if (!link) return;
    link.hidden = !visible;
}

function updateExtraMenuAccess(account = getStoredSettingsAccount()) {
    setExtraMenuLinkVisible(
        typeof olingLabLink !== 'undefined' ? olingLabLink : null,
        canAccountAccessExtraMenuFeature(account, 'olings.lab')
    );
    setExtraMenuLinkVisible(
        typeof shopLink !== 'undefined' ? shopLink : null,
        canAccountAccessExtraMenuFeature(account, 'shop')
    );
    setExtraMenuLinkVisible(
        typeof overexposureLink !== 'undefined' ? overexposureLink : null,
        canAccountAccessExtraMenuFeature(account, 'overexposure')
    );
}

window.updateExtraMenuAccess = updateExtraMenuAccess;
window.getStoredSettingsAccount = getStoredSettingsAccount;
window.canAccountAccessExtraMenuFeature = canAccountAccessExtraMenuFeature;

window.addEventListener('oe-account-state-changed', (event) => {
    updateExtraMenuAccess(event.detail?.account || null);
});

updateExtraMenuAccess();
