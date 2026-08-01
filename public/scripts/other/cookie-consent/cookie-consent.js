const placeHolderCookieConsentBanner = document.createElement('div');
placeHolderCookieConsentBanner.id = 'place-holder-cookie-consent';
document.body.appendChild(placeHolderCookieConsentBanner);

const CookieConsentCSSlink = document.createElement('link');
CookieConsentCSSlink.rel = 'stylesheet';
CookieConsentCSSlink.href = '/css/general/cookie-banner/cookie-banner.css';
document.head.appendChild(CookieConsentCSSlink);

fetch('/html-templates/other/cookie-banner.html')
  .then((res) => res.text())
  .then((data) =>
    appendTrustedHtml(placeHolderCookieConsentBanner, data, { replace: true })
  )
  .then(() => {
    placeHolderCookieConsentBanner
      .querySelector('#accept-cookies')
      .addEventListener('click', () => {
        acceptCookies();
        placeHolderCookieConsentBanner.remove();
      });
    placeHolderCookieConsentBanner
      .querySelector('#decline-cookies')
      .addEventListener('click', () => {
        declineCookies();
        placeHolderCookieConsentBanner.remove();
      });
  });

function acceptCookies() {
  localStorage.setItem('cookie-consent', true);
  window.notifyCookieConsentDecision?.();
  gtag('consent', 'update', { analytics_storage: 'granted' });
}

function declineCookies() {
  localStorage.setItem('cookie-consent', false);
  window.notifyCookieConsentDecision?.();
  gtag('consent', 'update', { analytics_storage: 'denied' });
}
