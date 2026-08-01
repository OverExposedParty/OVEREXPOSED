(function () {
    var gaScript = document.createElement("script");
    gaScript.async = true;
    gaScript.src = "https://www.googletagmanager.com/gtag/js?id=G-ZFD5EBXYE5";
    document.head.appendChild(gaScript);

    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());

    const consent = localStorage.getItem('cookie-consent');
    if (consent === "true") {
        gtag('consent', 'default', { 'analytics_storage': 'granted' });
    } else {
        gtag('consent', 'default', { 'analytics_storage': 'denied' });
    }

    gtag('config', 'G-ZFD5EBXYE5');
})();
