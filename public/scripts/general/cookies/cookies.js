const cookieConsentStorageKey = 'cookie-consent';
let cookieConsentDecisionPromise = null;

function hasCookieConsentDecision() {
    return localStorage.getItem(cookieConsentStorageKey) !== null;
}

function notifyCookieConsentDecision() {
    window.dispatchEvent(new CustomEvent('oe-cookie-consent-decision', {
        detail: {
            consent: localStorage.getItem(cookieConsentStorageKey)
        }
    }));
}

function waitForCookieConsentDecision() {
    if (hasCookieConsentDecision()) return Promise.resolve();
    if (cookieConsentDecisionPromise) return cookieConsentDecisionPromise;

    cookieConsentDecisionPromise = new Promise((resolve) => {
        const finish = () => {
            if (!hasCookieConsentDecision()) return;

            window.removeEventListener('oe-cookie-consent-decision', finish);
            window.removeEventListener('storage', finish);
            resolve();
        };

        window.addEventListener('oe-cookie-consent-decision', finish);
        window.addEventListener('storage', finish);
    });

    return cookieConsentDecisionPromise;
}

window.hasCookieConsentDecision = hasCookieConsentDecision;
window.notifyCookieConsentDecision = notifyCookieConsentDecision;
window.waitForCookieConsentDecision = waitForCookieConsentDecision;

if (!hasCookieConsentDecision()) {
    LoadScript('/scripts/other/cookie-consent/cookie-consent.js');
}

window.addEventListener('load', updateVh);
window.addEventListener('resize', updateVh);

(async () => {
    await LoadScript('/scripts/general/splash-screen/splash-screen.js');
})();
