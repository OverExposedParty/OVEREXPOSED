const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  getCookieValue,
  getVersionedPublicAssetUrl,
  versionLocalAssetReferences,
  injectCriticalSplashStyles,
  prepareHtmlResponse,
  reserveUniquePartyCode,
  getProtectedPageLoginUrl,
  renderProtectedPage,
  renderWaitingRoomPage
} = require('../../server/services/page-assets');
const {
  getSplashScreenImageUrl
} = require('../../server/services/page-assets/asset-response');
const { getProtectedPageSplashScreen } = require('../../server/routes/pages');
const {
  renderBattleOlingsPage
} = require('../../server/services/page-assets-battle-olings');
const { renderLoginPage } = require('../../server/services/page-assets-login');

test('getCookieValue returns the requested cookie value', () => {
  const cookieHeader =
    'theme=dark; oe-deployment-version=2026-04-23-1; session=abc=123';

  assert.equal(getCookieValue(cookieHeader, 'theme'), 'dark');
  assert.equal(
    getCookieValue(cookieHeader, 'oe-deployment-version'),
    '2026-04-23-1'
  );
  assert.equal(getCookieValue(cookieHeader, 'session'), 'abc=123');
  assert.equal(getCookieValue(cookieHeader, 'missing'), null);
});

test('getVersionedPublicAssetUrl appends the cache-bust query to local public assets', () => {
  const versionedScript = getVersionedPublicAssetUrl(
    '/scripts/html-templates/core-template/core-template.js'
  );
  const versionedStylesheet = getVersionedPublicAssetUrl(
    '/css/general/settings/settings.css'
  );

  assert.match(
    versionedScript,
    /\/scripts\/html-templates\/core-template\/core-template\.js\?v=/
  );
  assert.match(
    versionedStylesheet,
    /\/css\/general\/settings\/settings\.css\?v=/
  );
  assert.equal(
    getVersionedPublicAssetUrl('https://example.com/app.js'),
    'https://example.com/app.js'
  );
});

test('versionLocalAssetReferences versions local script, stylesheet, and image tags', () => {
  const html = `
    <html>
      <head>
        <link rel="stylesheet" href="/css/general/settings/settings.css">
        <link rel="preload" href="/videos/shop/background-video.mp4" as="video" type="video/mp4">
        <link rel="canonical" href="https://overexposed.app/example">
      </head>
      <body>
        <img src="/images/overexposure/card-template.svg">
        <script src="/scripts/html-templates/core-template/core-template.js"></script>
      </body>
    </html>
  `;

  const output = versionLocalAssetReferences(html);

  assert.match(output, /\/css\/general\/settings\/settings\.css\?v=/);
  assert.match(output, /\/videos\/shop\/background-video\.mp4\?v=/);
  assert.match(output, /\/images\/overexposure\/card-template\.svg\?v=/);
  assert.match(
    output,
    /\/scripts\/html-templates\/core-template\/core-template\.js\?v=/
  );
  assert.match(
    output,
    /rel="canonical" href="https:\/\/overexposed\.app\/example"/
  );
});

test('injectCriticalSplashStyles adds first-paint splash CSS for splash pages', () => {
  const html = `
    <html>
      <head>
        <title>Splash test</title>
      </head>
      <body>
        <div class="splash-screen-container" id="splash-screen-container">
          <img src="/images/splash-screens/overexposed.png" alt="Splash Screen">
        </div>
      </body>
    </html>
  `;

  const output = injectCriticalSplashStyles(html);

  assert.match(
    output,
    /<head>\s*<link rel="preload" href="\/images\/splash-screens\/overexposed\.png" as="image" fetchpriority="high">\s*<style id="critical-splash-style">/
  );
  assert.match(output, /<style id="critical-splash-style">/);
  assert.match(
    output,
    /\.splash-screen-container,\n\.splash-screen-container-static/
  );
  assert.match(output, /html,\nbody \{[\s\S]*?overflow: hidden;[\s\S]*?\}/);
  assert.match(
    output,
    /\.splash-screen-container img,\n\.splash-screen-container-static img \{[\s\S]*?width: 100%;[\s\S]*?height: 100%;[\s\S]*?object-fit: cover;[\s\S]*?object-position: center;[\s\S]*?\}/
  );
});

test('injectCriticalSplashStyles leaves pages without splash markup unchanged', () => {
  const html = '<html><head></head><body><main>No splash</main></body></html>';

  assert.equal(injectCriticalSplashStyles(html), html);
});

test('reserveUniquePartyCode retries duplicate key errors', async () => {
  let attempts = 0;
  const createdCodes = [];
  const waitingRoomModel = {
    async create(doc) {
      attempts += 1;
      createdCodes.push(doc.partyId);
      if (attempts === 1) {
        const error = new Error('duplicate');
        error.code = 11000;
        throw error;
      }
      return doc;
    }
  };

  const code = await reserveUniquePartyCode(waitingRoomModel);

  assert.match(code, /^[A-Z0-9]{3}-[A-Z0-9]{3}$/);
  assert.equal(attempts, 2);
  assert.equal(createdCodes[1], code);
});

test('renderWaitingRoomPage escapes unsafe meta content', () => {
  const html = renderWaitingRoomPage({
    title: 'Party "Ready"<script>alert(1)</script>',
    description: 'Join & play',
    ogImage: 'https://overexposed.app/images/example.jpg',
    primaryColour: '#9B56D3',
    secondaryColour: '#6D3C95',
    splashScreen: '/images/splash-screens/mafia.png',
    url: 'https://overexposed.app/ABC-123'
  });

  assert.match(
    html,
    /Party &quot;Ready&quot;&lt;script&gt;alert\(1\)&lt;\/script&gt;/
  );
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.equal(html.match(/\/images\/splash-screens\/mafia\.png/g)?.length, 3);
  assert.doesNotMatch(html, /__WAITING_ROOM_SPLASH_SCREEN__/);
  assert.match(html, /--primarypagecolour', '#9B56D3'/);
  assert.match(html, /--secondarypagecolour', '#6D3C95'/);
  assert.doesNotMatch(html, /__WAITING_ROOM_(?:PRIMARY|SECONDARY)_COLOUR__/);
});

test('protected page login URL keeps the current page as returnTo', () => {
  const loginUrl = getProtectedPageLoginUrl({
    originalUrl: '/olings/battle/ABC-123?side=left'
  });
  const html = renderProtectedPage(
    { reason: 'account_required' },
    { loginUrl }
  );

  assert.equal(
    loginUrl,
    '/sign-in?returnTo=%2Folings%2Fbattle%2FABC-123%3Fside%3Dleft&authEntryPoint=protected_page'
  );
  assert.match(
    html,
    /href="\/sign-in\?returnTo=%2Folings%2Fbattle%2FABC-123%3Fside%3Dleft&amp;authEntryPoint=protected_page"/
  );
  assert.match(html, />Sign In<\/a>/);
  assert.doesNotMatch(html, /__PROTECTION_SIGN_IN_HIDDEN__/);
});

test('renderProtectedPage uses copy specific to each access state', () => {
  const cases = [
    {
      access: { reason: 'account_required', requiredAccess: 'account' },
      title: 'Sign In Required',
      message: 'Sign in to access this page.',
      showsSignIn: true
    },
    {
      access: { reason: 'account_required', requiredAccess: 'beta' },
      title: 'Sign In Required',
      message: 'Sign in to continue. Access is limited to eligible accounts.',
      showsSignIn: true
    },
    {
      access: { reason: 'feature_required', requiredAccess: 'restricted' },
      title: 'Access Restricted',
      message:
        'Your account does not have the required access to view this page.'
    },
    {
      access: { reason: 'feature_required', requiredAccess: 'beta' },
      title: 'Beta Access Required',
      message: 'This page is only available to beta testers.'
    },
    {
      access: { reason: 'owner_required' },
      title: 'Owner Access Required',
      message: 'This page is only available to owner accounts.'
    },
    {
      access: { reason: 'admin_required' },
      title: 'Admin Access Required',
      message: 'This page is only available to administrator accounts.'
    },
    {
      access: { reason: 'password_required' },
      title: 'Password Required',
      message: 'Enter the page password to continue.'
    },
    {
      access: { reason: 'window_closed' },
      title: 'Access Closed',
      message: 'This page is no longer available.'
    }
  ];

  for (const { access, title, message, showsSignIn = false } of cases) {
    const html = renderProtectedPage(access);
    assert.match(html, new RegExp(`<h1 id="protected-title">${title}<\\/h1>`));
    assert.match(html, new RegExp(`<p>${message.replace('.', '\\.')}`));
    assert.equal(/href="\/sign-in"\s*>Sign In<\/a>/.test(html), showsSignIn);
    assert.doesNotMatch(html, /__PROTECTION_/);
  }
});

test('protected page content is revealed beneath a downward splash transition', () => {
  const splashScreen = '/images/splash-screens/imposter-settings.png';
  const html = renderProtectedPage(
    {
      reason: 'account_required',
      requiredAccess: 'account'
    },
    { splashScreen }
  );
  const movingSplashIndex = html.indexOf('id="splash-screen-container"');
  const protectedPageIndex = html.indexOf('<main class="protected-page"');
  const protectedTitleIndex = html.indexOf('id="protected-title"');

  assert.ok(movingSplashIndex >= 0);
  assert.ok(protectedPageIndex > movingSplashIndex);
  assert.ok(protectedTitleIndex > protectedPageIndex);
  assert.match(html, /class="protected-page-background"/);
  assert.equal(html.match(new RegExp(splashScreen, 'g'))?.length, 3);
  assert.match(
    html,
    /class="protected-page-background"\s+src="\/images\/protection\/splash-screen\/garage-door\.jpg"/
  );
  assert.match(html, /window\.allowTransition = true/);
  assert.match(html, /window\.splashScreenExitDirection = 'down'/);
  assert.doesNotMatch(html, /protected-splash/);
});

test('protected pages use the destination splash with the homepage as fallback', () => {
  const destinationHtml = `
    <div class="splash-screen-container-static">
      <img src="/images/splash-screens/shop.png" alt="">
    </div>
  `;

  assert.equal(
    getSplashScreenImageUrl(destinationHtml),
    '/images/splash-screens/shop.png'
  );
  assert.equal(
    getProtectedPageSplashScreen(
      path.join(
        __dirname,
        '../../public/pages/party-games/imposter/imposter-settings-page.html'
      )
    ),
    '/images/splash-screens/imposter-settings.png'
  );
  assert.equal(
    getProtectedPageSplashScreen(
      path.join(__dirname, '../../public/pages/olings/lab.html')
    ),
    '/images/splash-screens/overexposed.png'
  );
});

test('renderBattleOlingsPage expands local page fragments', () => {
  const html = renderBattleOlingsPage();

  assert.doesNotMatch(html, /__BATTLE_OLINGS_/);
  assert.match(
    html,
    /class="oling-battle-container oling-battle-shell is-lobby"/
  );
  assert.match(html, /class="oling-battle-lobby-matchup"/);
  assert.match(html, /class="battle-momentum-bar"/);
  assert.match(html, /NO OLING FOUND/);
  assert.match(html, /window\.pageScripts = {/);
});

test('renderLoginPage expands local page fragments', () => {
  const html = renderLoginPage();

  assert.doesNotMatch(html, /__LOGIN_/);
  assert.match(html, /id="login-form"/);
  assert.match(html, /id="signup-form"/);
  assert.match(html, /id="auth-legal-dialog"/);
  assert.match(html, /window\.pageScripts = {/);
});

test('prepareHtmlResponse strips meta CSP tags and adds script nonces', () => {
  const html = `
    <html>
      <head>
        <meta http-equiv="Content-Security-Policy" content="script-src 'unsafe-inline'">
      </head>
      <body>
        <script>window.test = true;</script>
        <script src="/scripts/html-templates/core-template/core-template.js"></script>
      </body>
    </html>
  `;

  const output = prepareHtmlResponse(html, { cspNonce: 'abc123' });

  assert.doesNotMatch(output, /http-equiv="Content-Security-Policy"/i);
  assert.match(output, /<script nonce="abc123">window\.test = true;<\/script>/);
  assert.match(
    output,
    /<script src="\/scripts\/html-templates\/core-template\/core-template\.js\?v=[^"]+" nonce="abc123"><\/script>/
  );
});
