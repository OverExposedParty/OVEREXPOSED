const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const rootDirectory = path.join(__dirname, '..', '..');
const protectedPageHtml = fs.readFileSync(
  path.join(rootDirectory, 'public/pages/protection/protected-page.html'),
  'utf8'
);
const bodyguardSource = fs.readFileSync(
  path.join(rootDirectory, 'public/scripts/protection/bodyguard/bodyguard.js'),
  'utf8'
);
const protectedPageActionsSource = fs.readFileSync(
  path.join(
    rootDirectory,
    'public/scripts/protection/protected-page-actions.js'
  ),
  'utf8'
);
const { renderProtectedPage } = require('../../server/services/page-assets');

test('protected-page bodyguard enters after the splash finishes moving', () => {
  const dom = new JSDOM(protectedPageHtml, {
    runScripts: 'outside-only',
    url: 'https://overexposed.app/protected'
  });
  const { document } = dom.window;
  const bodyguard = document.querySelector('.oe-bodyguard');
  const splash = document.getElementById('splash-screen-container');

  dom.window.LoadStylesheet = () => {};
  dom.window.setTimeout = () => 1;
  dom.window.clearTimeout = () => {};
  dom.window.eval(bodyguardSource);
  document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

  assert.equal(bodyguard.parentElement.matches('.protected-page'), true);
  assert.equal(bodyguard.classList.contains('is-revealing'), false);

  const transitionEnd = new dom.window.Event('transitionend');
  Object.defineProperty(transitionEnd, 'propertyName', {
    value: 'transform'
  });
  splash.dispatchEvent(transitionEnd);

  assert.equal(bodyguard.classList.contains('is-revealing'), true);
  dom.window.close();
});

test('protected-page transition respects reduced-motion preferences', () => {
  const styles = fs.readFileSync(
    path.join(rootDirectory, 'public/css/protection/protected-page.css'),
    'utf8'
  );

  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(
    styles,
    /\.protected-access-page \.splash-screen-container \{\s*transition-duration: 0\.01ms;/
  );
});

test('protected page covers the header while remaining beneath the splash', () => {
  const protectedStyles = fs.readFileSync(
    path.join(rootDirectory, 'public/css/protection/protected-page.css'),
    'utf8'
  );
  const headerStyles = fs.readFileSync(
    path.join(rootDirectory, 'public/css/general/header/bar.css'),
    'utf8'
  );
  const splashStyles = fs.readFileSync(
    path.join(rootDirectory, 'public/css/general/header/splash.css'),
    'utf8'
  );
  const protectedLayer = Number(
    protectedStyles.match(/\.protected-page \{[\s\S]*?z-index: (\d+);/)?.[1]
  );
  const headerLayer = Number(headerStyles.match(/z-index: (\d+);/)?.[1]);
  const splashLayer = Number(
    splashStyles.match(
      /\.splash-screen-container,\s*\.splash-screen-container-static \{[\s\S]*?z-index: (\d+);/
    )?.[1]
  );

  assert.ok(headerLayer < protectedLayer);
  assert.ok(protectedLayer < splashLayer);
});

function captureProtectedPageTransition(selector) {
  const loginUrl = '/sign-in?returnTo=%2Fshop&authEntryPoint=protected_page';
  const dom = new JSDOM(
    renderProtectedPage(
      { reason: 'account_required', requiredAccess: 'beta' },
      { loginUrl }
    ),
    {
      runScripts: 'outside-only',
      url: 'https://overexposed.app/shop'
    }
  );
  const transitions = [];
  dom.window.transitionSplashScreen = (destination, splashScreen) => {
    transitions.push({ destination, splashScreen });
  };
  dom.window.eval(protectedPageActionsSource);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

  const link = dom.window.document.querySelector(selector);
  link.dispatchEvent(
    new dom.window.MouseEvent('click', {
      bubbles: true,
      button: 0,
      cancelable: true
    })
  );
  link.dispatchEvent(
    new dom.window.MouseEvent('click', {
      bubbles: true,
      button: 0,
      cancelable: true
    })
  );

  const disabledActions = [
    ...dom.window.document.querySelectorAll(
      '.protected-page-action[aria-disabled="true"]'
    )
  ];
  dom.window.close();
  return { transitions, disabledActions, loginUrl };
}

test('protected-page actions transition through the homepage splash', () => {
  const signIn = captureProtectedPageTransition(
    '.protected-page-action[href^="/sign-in"]'
  );
  const mainMenu = captureProtectedPageTransition(
    '.protected-page-action[href="/"]'
  );

  assert.deepEqual(signIn.transitions, [
    {
      destination: signIn.loginUrl,
      splashScreen: '/images/splash-screens/overexposed.png'
    }
  ]);
  assert.equal(signIn.disabledActions.length, 2);
  assert.deepEqual(mainMenu.transitions, [
    {
      destination: '/',
      splashScreen: '/images/splash-screens/overexposed.png'
    }
  ]);
  assert.equal(mainMenu.disabledActions.length, 2);
});
