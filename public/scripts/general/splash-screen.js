let previousPage = {
    link: "/",
    splashScreen: "/images/splash-screens/overexposed.png"
};

// Page Load Transition
const heading = document.createElement('div');
heading.classList.add('loading-screen');

const splashScreenContainer = document.getElementById("splash-screen-container");
const staticSplashScreenContainer = document.getElementById("splash-screen-container-static");

if (backButton) {
    backButton.addEventListener('click', () => {
        transitionSplashScreen(previousPage.link, previousPage.splashScreen)
    });
}

if (logoContainer) {
    logoContainer.addEventListener('click', function () {
        transitionSplashScreen('/', '/images/splash-screens/overexposed.png');
    });
}

if (partyGamesLink) {
    partyGamesLink.addEventListener('click', function () {
        transitionSplashScreen('/', '/images/splash-screens/overexposed.png');
    });
}
if (termsAndPrivacyLink) {
    termsAndPrivacyLink.addEventListener('click', function () {
        transitionSplashScreen('/terms-and-privacy', '/images/splash-screens/terms-and-privacy.png');
    });
}
if (frequentlyAskedQuestionsLink) {
    frequentlyAskedQuestionsLink.addEventListener('click', function () {
        transitionSplashScreen('/faqs', '/images/splash-screens/frequently-asked-questions.png');
    });
}

function initSplashScreen() {
    setTimeout(() => splashScreenContainer.classList.add('center'), 50);

    setTimeout(() => {
        splashScreenContainer.classList.remove('center');
        staticSplashScreenContainer?.remove();
        splashScreenContainer.classList.add('down');
        playSoundEffect('splashScreenDown');
    }, 300);

    setTimeout(() => {
        splashScreenContainer.remove();
        heading?.remove();
    }, 1000);
}

window.addEventListener("load", initSplashScreen);

function transitionSplashScreen(link, splashScreen) {
    const container = document.createElement('div');
    container.className = 'splash-screen-container down';
    const img = document.createElement('img');
    img.src = splashScreen;
    container.appendChild(img);
    document.body.appendChild(container);

    setTimeout(() => {
        container.classList.remove('down');
        container.classList.add('center');
        playSoundEffect('splashScreenUp');
    }, 500); // Slight delay to ensure CSS applies

    // Listen for transition end
    container.addEventListener('transitionend', function onTransitionEnd(event) {
        if (event.propertyName === 'top') { // Ensure we're detecting the correct transition
            container.removeEventListener('transitionend', onTransitionEnd);
            window.location.href = link;
        }
    });
}

async function getRandomFact(key) {
    const response = await fetch('/json-files/other/overexposed-facts.json');
    const facts = await response.json();

    const categoryFacts = facts[key];
    const randomIndex = Math.floor(Math.random() * categoryFacts.length);

    const splashScreenContainerFact = document.createElement('p');
    const staticSplashScreenContainerFact = document.createElement('p');

    splashScreenContainer.appendChild(splashScreenContainerFact);
    staticSplashScreenContainer.appendChild(staticSplashScreenContainerFact);

    splashScreenContainerFact.textContent = categoryFacts[randomIndex];
    staticSplashScreenContainerFact.textContent = categoryFacts[randomIndex];


}

//getRandomFact("truth-or-dare");