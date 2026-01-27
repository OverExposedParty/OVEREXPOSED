if (!localStorage.getItem('cookie-consent')) {
    LoadScript('/scripts/other/cookie-consent.js');
}

window.addEventListener('load', updateVh);
window.addEventListener('resize', updateVh);

(async () => {
    await LoadScript('/scripts/general/splash-screen.js');
})();
