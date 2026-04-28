const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getCookieValue,
  getVersionedPublicAssetUrl,
  versionLocalAssetReferences,
  prepareHtmlResponse,
  reserveUniquePartyCode,
  renderWaitingRoomPage
} = require('../server/services/page-assets');

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
    '/scripts/html-templates/core-template.js'
  );
  const versionedStylesheet = getVersionedPublicAssetUrl(
    '/css/general/settings.css'
  );

  assert.match(
    versionedScript,
    /\/scripts\/html-templates\/core-template\.js\?v=/
  );
  assert.match(versionedStylesheet, /\/css\/general\/settings\.css\?v=/);
  assert.equal(
    getVersionedPublicAssetUrl('https://example.com/app.js'),
    'https://example.com/app.js'
  );
});

test('versionLocalAssetReferences versions local script, stylesheet, and image tags', () => {
  const html = `
    <html>
      <head>
        <link rel="stylesheet" href="/css/general/settings.css">
        <link rel="canonical" href="https://overexposed.app/example">
      </head>
      <body>
        <img src="/images/overexposure/card-template.svg">
        <script src="/scripts/html-templates/core-template.js"></script>
      </body>
    </html>
  `;

  const output = versionLocalAssetReferences(html);

  assert.match(output, /\/css\/general\/settings\.css\?v=/);
  assert.match(output, /\/images\/overexposure\/card-template\.svg\?v=/);
  assert.match(output, /\/scripts\/html-templates\/core-template\.js\?v=/);
  assert.match(
    output,
    /rel="canonical" href="https:\/\/overexposed\.app\/example"/
  );
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

test('prepareHtmlResponse strips meta CSP tags and adds script nonces', () => {
  const html = `
    <html>
      <head>
        <meta http-equiv="Content-Security-Policy" content="script-src 'unsafe-inline'">
      </head>
      <body>
        <script>window.test = true;</script>
        <script src="/scripts/html-templates/core-template.js"></script>
      </body>
    </html>
  `;

  const output = prepareHtmlResponse(html, { cspNonce: 'abc123' });

  assert.doesNotMatch(output, /http-equiv="Content-Security-Policy"/i);
  assert.match(output, /<script nonce="abc123">window\.test = true;<\/script>/);
  assert.match(
    output,
    /<script src="\/scripts\/html-templates\/core-template\.js\?v=[^"]+" nonce="abc123"><\/script>/
  );
});
