const recordedAchievementEvents = new Set();

function getAchievementEventPageKey() {
    return window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
}

function getStoredAchievementAccount() {
    try {
        return JSON.parse(localStorage.getItem('oe-account')) || null;
    }
    catch {
        return null;
    }
}

function hasSignedInAchievementAccount() {
    const account = getStoredAchievementAccount();
    return Boolean(account?._id || account?.id || account?.accountId);
}

function recordAccountAchievementEvent(eventType, { oncePerPage = true } = {}) {
    const normalizedEventType = String(eventType || '').trim();
    if (!normalizedEventType) return Promise.resolve(null);
    if (!hasSignedInAchievementAccount()) return Promise.resolve(null);

    const eventKey = `${normalizedEventType}:${getAchievementEventPageKey()}`;
    if (oncePerPage && recordedAchievementEvents.has(eventKey)) {
        return Promise.resolve(null);
    }
    recordedAchievementEvents.add(eventKey);

    return fetch('/api/accounts/me/achievement-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        keepalive: true,
        body: JSON.stringify({ eventType: normalizedEventType })
    }).catch(() => null);
}

function recordPageVisitAchievementEvents() {
    const path = getAchievementEventPageKey();
    const now = new Date();

    if (now.getMonth() === 3 && now.getDate() === 1) {
        recordAccountAchievementEvent('seasonal.april-fool-visit');
    }
    if (path === '/terms-and-privacy') {
        recordAccountAchievementEvent('legal.terms-privacy-viewed');
    }
    if (document.querySelector('[data-template="page-not-found"]')) {
        recordAccountAchievementEvent('page.not-found-viewed');
    }
}

function initialiseSettingsAchievementEvents() {
    window.recordAccountAchievementEvent = recordAccountAchievementEvent;
    recordPageVisitAchievementEvents();
}
