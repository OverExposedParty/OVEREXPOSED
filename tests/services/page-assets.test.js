const test = require('node:test');
const assert = require('node:assert/strict');

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
  renderBattleOlingsPage
} = require('../../server/services/page-assets-battle-olings');
const {
  renderLoginPage
} = require('../../server/services/page-assets-login');

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
  assert.match(
    output,
    /html,\nbody \{[\s\S]*?overflow: hidden;[\s\S]*?\}/
  );
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
    url: 'https://overexposed.app/ABC-123'
  });

  assert.match(
    html,
    /Party &quot;Ready&quot;&lt;script&gt;alert\(1\)&lt;\/script&gt;/
  );
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
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
    '/sign-in?returnTo=%2Folings%2Fbattle%2FABC-123%3Fside%3Dleft'
  );
  assert.match(
    html,
    /href="\/sign-in\?returnTo=%2Folings%2Fbattle%2FABC-123%3Fside%3Dleft"/
  );
});

test('renderBattleOlingsPage expands local page fragments', () => {
  const html = renderBattleOlingsPage();

  assert.doesNotMatch(html, /__BATTLE_OLINGS_/);
  assert.match(html, /class="oling-battle-container oling-battle-shell is-lobby"/);
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
