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
  getSplashScreenImageUrl,
  isCacheableClashPage
} = require('../../server/services/page-assets/asset-response');
const {
  getProtectedPageSplashScreen,
  registerPageRoutes
} = require('../../server/routes/pages');
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

test('production HTML caching is scoped to Olings Clash page shells', () => {
  assert.equal(
    isCacheableClashPage('G:\\site\\public\\pages\\olings\\clash.html'),
    true
  );
  assert.equal(
    isCacheableClashPage(
      'G:\\site\\public\\pages\\olings\\clash-settings.html'
    ),
    true
  );
  assert.equal(
    isCacheableClashPage('G:\\site\\public\\pages\\homepages\\homepage.html'),
    false
  );
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
          <img src="/images/splash-screens/core/overexposed.png" alt="Splash Screen">
        </div>
      </body>
    </html>
  `;

  const output = injectCriticalSplashStyles(html);

  assert.match(
    output,
    /<head>\s*<link rel="preload" href="\/images\/splash-screens\/core\/overexposed\.png" as="image" fetchpriority="high">\s*<style id="critical-splash-style">/
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
    splashScreen: '/images/splash-screens/party-games/mafia/game.png',
    url: 'https://overexposed.app/ABC-123'
  });

  assert.match(
    html,
    /Party &quot;Ready&quot;&lt;script&gt;alert\(1\)&lt;\/script&gt;/
  );
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.equal(
    html.match(/\/images\/splash-screens\/party-games\/mafia\/game\.png/g)
      ?.length,
    3
  );
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
  const splashScreen =
    '/images/splash-screens/party-games/imposter/settings.png';
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
    '/images/splash-screens/party-games/imposter/settings.png'
  );
  assert.equal(
    getProtectedPageSplashScreen(
      path.join(__dirname, '../../public/pages/olings/lab.html')
    ),
    '/images/splash-screens/core/overexposed.png'
  );
});

test('Olings Clash registers protected and state-aware page shells', async () => {
  const routes = [];
  let clashStatus = 'waiting';
  const app = {
    get(route, handler) {
      routes.push({ handler, route });
    },
    use() {}
  };

  registerPageRoutes({
    app,
    accountModel: {
      findOne() {
        return {
          select() {
            return Promise.resolve({
              profile: { emailVerified: true, accountStatus: 'active' },
              admin: { roles: [], disabled: false },
              access: {
                roles: ['beta_tester'],
                features: [],
                disabled: false
              }
            });
          }
        };
      }
    },
    debugLog() {},
    olingClashMatchModel: {
      findOne() {
        return {
          select() {
            return this;
          },
          lean() {
            return Promise.resolve({ status: clashStatus });
          }
        };
      }
    },
    waitingRoomModel: {}
  });

  const clashRoute = routes.find(({ route }) => route === '/olings/clash');
  const clashSettingsRoute = routes.find(
    ({ route }) => route === '/olings/clash/settings'
  );
  const codedClashRoute = routes.find(
    ({ route }) =>
      route === '/olings/clash/:matchCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})'
  );
  const clashHtmlPath = path.join(
    __dirname,
    '../../public/pages/olings/clash.html'
  );
  const clashHtml = require('node:fs').readFileSync(clashHtmlPath, 'utf8');
  const clashSettingsHtml = require('node:fs').readFileSync(
    path.join(__dirname, '../../public/pages/olings/clash-settings.html'),
    'utf8'
  );
  assert.equal(
    clashHtml.match(/\/images\/splash-screens\/olings\/clash\/game\.png/g)
      ?.length,
    3
  );
  assert.equal(
    clashSettingsHtml.match(
      /\/images\/splash-screens\/olings\/clash\/settings\.png/g
    )?.length,
    3
  );
  assert.match(clashHtml, /window\.allowTransition\s*=\s*true/);
  assert.match(clashSettingsHtml, /window\.allowTransition\s*=\s*true/);
  assert.match(
    clashHtml,
    /window\.splashScreenExitDirection\s*=\s*['"]down['"]/
  );
  assert.match(
    clashSettingsHtml,
    /window\.splashScreenExitDirection\s*=\s*['"]down['"]/
  );

  function requestClash(route, cookie = '') {
    return new Promise((resolve, reject) => {
      let statusCode = 200;
      const response = {
        append() {},
        headersSent: false,
        locals: {},
        send(body) {
          resolve({ body, statusCode });
          return this;
        },
        setHeader() {},
        status(value) {
          statusCode = value;
          return this;
        },
        type() {
          return this;
        }
      };
      try {
        route.handler(
          {
            headers: { cookie },
            id: 'anonymous-clash-test',
            originalUrl: route.route,
            params: { matchCode: 'ABC-123' },
            path: route.route,
            query: {}
          },
          response
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  assert.equal(typeof clashRoute?.handler, 'function');
  assert.equal(typeof clashSettingsRoute?.handler, 'function');
  assert.equal(typeof codedClashRoute?.handler, 'function');
  const [
    publicClash,
    publicSettings,
    publicCodedClash,
    betaClash,
    betaSettings,
    betaCodedClash
  ] = await Promise.all([
    requestClash(clashRoute),
    requestClash(clashSettingsRoute),
    requestClash(codedClashRoute),
    requestClash(clashRoute, 'oe_session=beta-session'),
    requestClash(clashSettingsRoute, 'oe_session=beta-session'),
    requestClash(codedClashRoute, 'oe_session=beta-session')
  ]);
  assert.equal(publicClash.statusCode, 403);
  assert.equal(publicSettings.statusCode, 403);
  assert.equal(publicCodedClash.statusCode, 403);
  assert.equal(betaClash.statusCode, 200);
  assert.equal(betaSettings.statusCode, 200);
  assert.equal(betaCodedClash.statusCode, 200);
  clashStatus = 'active';
  const betaActiveClash = await requestClash(
    codedClashRoute,
    'oe_session=beta-session'
  );
  assert.match(betaClash.body, /<title>Olings Clash \| OVEREXPOSED<\/title>/);
  assert.match(
    betaCodedClash.body,
    /<title>Olings Clash \| OVEREXPOSED<\/title>/
  );
  assert.match(betaSettings.body, /data-clash-page="settings"/);
  assert.match(betaCodedClash.body, /class="olings-clash-lobby"/);
  assert.match(betaActiveClash.body, /data-clash-game/);
  assert.match(clashHtml, /<title>Olings Clash \| OVEREXPOSED<\/title>/);
  assert.match(
    clashHtml,
    /<html lang="en" data-required-orientation="landscape">/
  );
  assert.doesNotMatch(clashSettingsHtml, /data-required-orientation=/);
  assert.match(clashHtml, /id="header-placeholder"/);
  assert.match(
    clashHtml,
    /<main\s+class="olings-clash-page is-game"\s+data-template="olings-clash"\s+data-orientation-guard-target\s+aria-label="Olings Clash"/
  );
  assert.match(
    clashHtml,
    /class="olings-clash-game"[\s\S]*?data-clash-game[\s\S]*?aria-hidden="false"/
  );
  assert.equal((clashHtml.match(/data-clash-roster-slot=/g) || []).length, 6);
  assert.equal((clashHtml.match(/data-clash-effects/g) || []).length, 6);
  assert.equal((clashHtml.match(/data-heart-units="6"/g) || []).length, 6);
  assert.equal((clashHtml.match(/data-overgrowth-units="0"/g) || []).length, 6);
  assert.equal((clashHtml.match(/data-shield-count="0"/g) || []).length, 6);
  assert.doesNotMatch(clashHtml, /data-effect-key=/);
  assert.equal((clashHtml.match(/data-clash-tag-button/g) || []).length, 2);
  assert.equal((clashHtml.match(/data-clash-tag-indicator/g) || []).length, 2);
  assert.equal((clashHtml.match(/data-clash-tag-resource=/g) || []).length, 2);
  assert.equal(
    (clashHtml.match(/data-clash-tag-charge-pips/g) || []).length,
    2
  );
  assert.doesNotMatch(clashHtml, /data-clash-tag-charge-count/);
  assert.equal(
    (clashHtml.match(/data-clash-tag-resource-divider/g) || []).length,
    2
  );
  assert.equal(
    (clashHtml.match(/data-clash-tag-recharge-pips/g) || []).length,
    2
  );
  const localRosterStart = clashHtml.indexOf('data-clash-roster="local"');
  const localLastSlot = clashHtml.indexOf(
    'data-clash-roster-slot="bench-2"',
    localRosterStart
  );
  const localTagResource = clashHtml.indexOf(
    'data-clash-tag-resource="local"',
    localRosterStart
  );
  const opponentRosterStart = clashHtml.indexOf('data-clash-roster="opponent"');
  const opponentLastSlot = clashHtml.indexOf(
    'data-clash-roster-slot="bench-2"',
    opponentRosterStart
  );
  const opponentTagResource = clashHtml.indexOf(
    'data-clash-tag-resource="opponent"',
    opponentRosterStart
  );
  assert.ok(localTagResource > localLastSlot);
  assert.ok(opponentTagResource > opponentLastSlot);
  assert.match(clashHtml, /data-clash-picker/);
  assert.match(clashHtml, /data-clash-picker-options/);
  assert.match(clashHtml, /data-clash-picker-confirm/);
  assert.match(clashHtml, /data-clash-inspector/);
  assert.doesNotMatch(clashHtml, /data-clash-inspector-avatar/);
  assert.match(clashHtml, /data-clash-inspector-position/);
  assert.match(clashHtml, /data-clash-inspector-content/);
  assert.doesNotMatch(clashHtml, /data-clash-inspector-close/);
  assert.equal((clashHtml.match(/data-clash-fighter=/g) || []).length, 2);
  assert.match(clashHtml, /data-clash-actions/);
  assert.match(clashHtml, /data-clash-action-confirm/);
  assert.equal((clashHtml.match(/data-clash-action=/g) || []).length, 4);
  assert.match(clashHtml, /data-clash-action="attack"/);
  assert.match(clashHtml, /data-clash-action="guard"/);
  assert.match(clashHtml, /data-clash-action="skill"/);
  assert.match(clashHtml, /data-clash-action="draw"/);
  assert.match(clashHtml, /data-clash-passive/);
  assert.match(
    clashHtml,
    /data-clash-action="draw"[\s\S]*?data-clash-move-name>CANOPY</
  );
  assert.match(clashHtml, /data-clash-round-display/);
  assert.match(clashHtml, /data-clash-last-outcome/);
  assert.match(clashHtml, /data-clash-round>1</);
  assert.match(clashHtml, /data-clash-decision-area/);
  assert.match(clashHtml, /data-display-mode="decision"/);
  assert.match(clashHtml, /data-clash-result-detail/);
  assert.match(
    clashSettingsHtml,
    /class="olings-clash-lobby"[\s\S]*?aria-hidden="false"/
  );
  assert.doesNotMatch(clashSettingsHtml, /ROOM:/);
  assert.equal(
    (clashSettingsHtml.match(/class="olings-clash-team-slot"/g) || []).length,
    3
  );
  assert.match(clashSettingsHtml, />SELECT YOUR CLASH TEAM<\/h2>/);
  assert.match(clashSettingsHtml, />\s*READY UP\s*<\/button>/);
  assert.match(clashSettingsHtml, /data-clash-player="local"/);
  assert.match(clashSettingsHtml, /data-clash-opponent-slot/);
  assert.match(clashSettingsHtml, /\/scripts\/olings\/clash\/oe-layers\.js/);
  assert.match(clashSettingsHtml, /\/scripts\/olings\/clash\/clash-lobby\.js/);
  assert.doesNotMatch(clashSettingsHtml, /data-clash-game/);
  assert.doesNotMatch(clashHtml, /\/scripts\/olings\/clash\/clash-lobby\.js/);
  assert.match(clashHtml, /\/scripts\/olings\/clash\/oe-layers\.js/);
  assert.match(clashHtml, /\/css\/olings\/shared\/oling-flight-motion\.css/);
  const flightMotionIndex = clashHtml.indexOf(
    "'/scripts/olings/shared/oling-flight-motion.js'"
  );
  const stateIndex = clashHtml.indexOf("'/scripts/olings/clash/game/state.js'");
  const resolutionIndex = clashHtml.indexOf(
    "'/scripts/olings/clash/game/resolution.js'"
  );
  const opponentIndex = clashHtml.indexOf(
    "'/scripts/olings/clash/game/demo-opponent.js'"
  );
  const healthRendererIndex = clashHtml.indexOf(
    "'/scripts/olings/clash/game/renderers/health.js'"
  );
  const damageRendererIndex = clashHtml.indexOf(
    "'/scripts/olings/clash/game/renderers/damage-feedback.js'"
  );
  const combatRendererIndex = clashHtml.indexOf(
    "'/scripts/olings/clash/game/renderers/combat-motion.js'"
  );
  const tagRendererIndex = clashHtml.indexOf(
    "'/scripts/olings/clash/game/renderers/tag-motion.js'"
  );
  const phaseRendererIndex = clashHtml.indexOf(
    "'/scripts/olings/clash/game/renderers/phase.js'"
  );
  const matchRendererIndex = clashHtml.indexOf(
    "'/scripts/olings/clash/game/renderers/match.js'"
  );
  const pickerRendererIndex = clashHtml.indexOf(
    "'/scripts/olings/clash/game/renderers/picker.js'"
  );
  const inspectorRendererIndex = clashHtml.indexOf(
    "'/scripts/olings/clash/game/renderers/inspector.js'"
  );
  const timerIndex = clashHtml.indexOf("'/scripts/olings/clash/game/timer.js'");
  const flowIndex = clashHtml.indexOf("'/scripts/olings/clash/game/flow.js'");
  const gameBootstrapIndex = clashHtml.indexOf(
    "'/scripts/olings/clash/clash-game.js'"
  );
  const lobbyBootstrapIndex = clashHtml.indexOf(
    "'/scripts/olings/clash/clash-lobby.js'"
  );
  assert.ok(flightMotionIndex >= 0);
  assert.ok(stateIndex > flightMotionIndex);
  assert.ok(resolutionIndex > stateIndex);
  assert.ok(opponentIndex > resolutionIndex);
  assert.ok(healthRendererIndex > opponentIndex);
  assert.ok(damageRendererIndex > healthRendererIndex);
  assert.ok(combatRendererIndex > damageRendererIndex);
  assert.ok(tagRendererIndex > combatRendererIndex);
  assert.ok(phaseRendererIndex > tagRendererIndex);
  assert.ok(matchRendererIndex > phaseRendererIndex);
  assert.ok(pickerRendererIndex > matchRendererIndex);
  assert.ok(inspectorRendererIndex > pickerRendererIndex);
  assert.ok(timerIndex > inspectorRendererIndex);
  assert.ok(flowIndex > timerIndex);
  assert.ok(gameBootstrapIndex > flowIndex);
  assert.equal(lobbyBootstrapIndex, -1);
  assert.ok(
    clashSettingsHtml.indexOf("'/scripts/olings/clash/clash-lobby.js'") >= 0
  );
  assert.match(clashHtml, /core-template\/core-template\.js/);
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
