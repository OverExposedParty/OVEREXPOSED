const placeHolderCookieConsentBanner = document.createElement("div");
placeHolderCookieConsentBanner.id = "place-holder-cookie-consent";
document.body.appendChild(placeHolderCookieConsentBanner)

const CookieConsentCSSlink = document.createElement('link');
CookieConsentCSSlink.rel = 'stylesheet';
CookieConsentCSSlink.href = '/css/general/cookie-banner.css';
document.head.appendChild(CookieConsentCSSlink);

fetch('/html-templates/other/cookie-banner.html')
    .then(res => res.text())
    .then(data => placeHolderCookieConsentBanner.innerHTML = data)
    .then(() => {
        placeHolderCookieConsentBanner.querySelector('#accept-cookies').addEventListener('click', () => {
            localStorage.setItem('cookie-consent', true);
            removeElementIfExists(permanantElementClassArray, placeHolderCookieConsentBanner.querySelector('.cookie-banner'));
            toggleOverlay(false);
            acceptCookies();
            console.log(permanantElementClassArray);
            placeHolderCookieConsentBanner.remove();
        });
        placeHolderCookieConsentBanner.querySelector('#decline-cookies').addEventListener('click', () => {
            localStorage.setItem('cookie-consent', false);
            removeElementIfExists(permanantElementClassArray, placeHolderCookieConsentBanner.querySelector('.cookie-banner'));
            toggleOverlay(false);
            declineCookies()
            console.log(permanantElementClassArray);
            placeHolderCookieConsentBanner.remove();
        });
        addElementIfNotExists(permanantElementClassArray, placeHolderCookieConsentBanner.querySelector('.cookie-banner'));
        overlay.classList.add('active');
    });

function acceptCookies() {
    localStorage.setItem('cookie-consent', true);
    gtag('consent', 'update', { 'analytics_storage': 'granted' });
}

function declineCookies() {
    localStorage.setItem('cookie-consent', false);
    gtag('consent', 'update', { 'analytics_storage': 'denied' });
}

