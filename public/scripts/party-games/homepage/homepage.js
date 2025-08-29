let helpContainerFile = "homepage.json";

const cards = document.querySelectorAll('.grid-item .card');

cards.forEach((card, index) => {
    card.addEventListener('click', function (event) {
        if (card.classList.contains('flipped')) {
            switch (index) {
                case 0:
                    transitionSplashScreen('truth-or-dare/settings', "/images/splash-screens/truth-or-dare-settings.png")
                    break;
                case 1:
                    transitionSplashScreen('paranoia/settings', "images/splash-screens/paranoia-settings.png")
                    break;
                case 2:
                    transitionSplashScreen('never-have-i-ever/settings', "/images/splash-screens/never-have-i-ever-settings.png")
                    break;
                case 3:
                    transitionSplashScreen('most-likely-to/settings', "/images/splash-screens/most-likely-to-settings.png")
                    break;
                case 4:
                    //transitionSplashScreen('mafia/settings', "/images/splash-screens/mafia-settings.png")
                    break;
                case 5:
                    //window.location.href = 'coming-soon-settings';
                    break;
            }
        } else {
            cards.forEach(otherCard => {
                if (otherCard !== card && otherCard.classList.contains('flipped')) {
                    otherCard.classList.remove('flipped');
                }
            });

            card.classList.add('flipped');
            playSoundEffect('cardFlip');
            changeHeaderColor(index);
            changeFavicon(index);
        }
    });
});

function changeFavicon(index) {
    const sizes = ['16x16', '32x32', '96x96', '180x180'];
    const colorFolders = ['overexposed', 'paranoia', 'never-have-i-ever', 'most-likely-to', 'grey', 'grey'];

    const faviconLinks = document.querySelectorAll('link[rel="icon"]');

    faviconLinks.forEach((favicon, i) => {
        const size = sizes[i % sizes.length];
        const colorFolder = colorFolders[index % colorFolders.length];
        favicon.href = `/images/icons/${colorFolder}/favicons/favicon-${size}.png`;

        document.documentElement.style.setProperty('--rotatedeviceicon', `url(/images/icons/${colorFolder}/rotate-phone-icon.svg)`);
        document.documentElement.style.setProperty('--tiktokicon', `url(/images/icons/${colorFolder}/tik-tok-icon.svg)`);
        document.documentElement.style.setProperty('--instagramicon', `url(/images/icons/${colorFolder}/instagram-icon.svg)`);
    });
}

function changeHeaderColor(index) {
    const colors = ['#66CCFF', '#9D8AFF', '#FF9266', '#FFEE66', '#999999', '#999999'];
    const secondaryColors = ['#427BB9', '#7F71B2', '#B96542', '#B9AA42', '#666666 ', '#666666'];
    selectedColor = colors[index % colors.length];
    selectedSecondaryColor = secondaryColors[index % secondaryColors.length];

    document.documentElement.style.setProperty('--primarypagecolour', selectedColor);
    document.documentElement.style.setProperty('--secondarypagecolour', selectedSecondaryColor);
}
window.addEventListener('load', () => {
    fetchHelpContainer(helpContainerFile);
})

