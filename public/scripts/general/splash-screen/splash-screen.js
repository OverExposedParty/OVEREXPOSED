let previousPage = {
  link: '/',
  splashScreen: '/images/splash-screens/overexposed.png'
};
let isTransitioningSplash = false;

const SPLASH_SCREEN_EXIT_DIRECTIONS = new Set(['up', 'down']);

function getSplashScreenExitDirection() {
  return SPLASH_SCREEN_EXIT_DIRECTIONS.has(window.splashScreenExitDirection)
    ? window.splashScreenExitDirection
    : 'down';
}

function releaseSplashScreenViewport() {
  document.getElementById('critical-splash-style')?.remove();
  document.documentElement.classList.remove('splash-transition-active');
}

function playSplashScreenExitSound(direction) {
  if (typeof playSoundEffect !== 'function') return;

  const soundKey = direction === 'up' ? 'splashScreenUp' : 'splashScreenDown';
  Promise.resolve(playSoundEffect(soundKey, { ignoreInteraction: true })).catch(() => {});
}

// Page Load Transition
const heading = document.createElement('div');
heading.classList.add('loading-screen');

if (backButton) {
  backButton.addEventListener('click', () => {
    transitionSplashScreen(previousPage.link, previousPage.splashScreen);
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
if (olingLabLink) {
  olingLabLink.addEventListener('click', function () {
    transitionSplashScreen('/olings/lab', '/images/splash-screens/overexposed.png');
  });
}
if (shopLink) {
  shopLink.addEventListener('click', function () {
    transitionSplashScreen(
      '/shop',
      '/images/splash-screens/product-shop/coming-soon.jpg'
    );
  });
}
if (overexposureLink) {
  overexposureLink.addEventListener('click', function () {
    transitionSplashScreen(
      '/overexposure',
      '/images/splash-screens/overexposure.png'
    );
  });
}
if (termsAndPrivacyLink) {
  termsAndPrivacyLink.addEventListener('click', function () {
    transitionSplashScreen(
      '/terms-and-privacy',
      '/images/splash-screens/terms-and-privacy.png'
    );
  });
}
if (frequentlyAskedQuestionsLink) {
  frequentlyAskedQuestionsLink.addEventListener('click', function () {
    transitionSplashScreen(
      '/faqs',
      '/images/splash-screens/frequently-asked-questions.png'
    );
  });
}

if (oesCustomisationLink) {
  oesCustomisationLink.addEventListener('click', function () {
    transitionSplashScreen(
      '/oe-library',
      '/images/splash-screens/oes-customisation.png'
    );
  });
}

function initSplashScreen() {
  window.oeForceSplashDismiss = () => {
    staticSplashScreenContainer?.remove();
    splashScreenContainer?.remove();
    heading?.remove();
    releaseSplashScreenViewport();
  };

  if (window.allowTransition === false) {
    return;
  }

  setTimeout(() => {
    splashScreenContainer.classList.add('center');
  }, 50);

  setTimeout(() => {
    splashScreenContainer.classList.remove('center');
    staticSplashScreenContainer?.remove();
    const exitDirection = getSplashScreenExitDirection();
    splashScreenContainer.classList.add(exitDirection);
    playSplashScreenExitSound(exitDirection);
  }, 300);

  setTimeout(() => {
    splashScreenContainer.remove();
    heading?.remove();
    releaseSplashScreenViewport();
  }, 1000);
}

function transitionSplashScreen(link, splashScreen, options = {}) {
  if (isTransitioningSplash) return;
  isTransitioningSplash = true;
  document.documentElement.classList.add('splash-transition-active');

  const container = document.createElement('div');
  container.className = 'splash-screen-container down';
  const img = document.createElement('img');
  img.alt = 'Splash Screen';
  img.loading = 'eager';
  img.src = splashScreen;
  container.appendChild(img);
  document.body.appendChild(container);

  let hasNavigated = false;
  let navigationRequested = false;
  const commitNavigation = () => {
    if (hasNavigated) return;
    hasNavigated = true;
    window.location.href = link;
  };
  const navigate = () => {
    if (navigationRequested) return;
    navigationRequested = true;

    const beforeNavigate = options.beforeNavigate;
    if (beforeNavigate && typeof beforeNavigate.then === 'function') {
      Promise.resolve(beforeNavigate)
        .catch(() => {})
        .then(commitNavigation);
      return;
    }

    commitNavigation();
  };

  container.getBoundingClientRect();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      container.classList.remove('down');
      container.classList.add('center');
      playSoundEffect('splashScreenUp');
    });
  });

  container.addEventListener('transitionend', function onTransitionEnd(event) {
    if (event.propertyName === 'transform') {
      container.removeEventListener('transitionend', onTransitionEnd);
      navigate();
    }
  });

  setTimeout(navigate, 1200);
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

SetScriptLoaded('/scripts/html-templates/core-template/core-template.js');

//getRandomFact("truth-or-dare");
