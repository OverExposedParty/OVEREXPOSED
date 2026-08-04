const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const verificationPage = fs.readFileSync(
  path.join(__dirname, '../../public/pages/auth/verify-email.html'),
  'utf8'
);
const verificationScript = fs.readFileSync(
  path.join(
    __dirname,
    '../../public/scripts/auth/verify-email/verify-email.js'
  ),
  'utf8'
);
const homepageScript = fs.readFileSync(
  path.join(__dirname, '../../public/scripts/party-games/homepage/homepage.js'),
  'utf8'
);

function createVerificationDom(url) {
  const dom = new JSDOM(
    '<form id="verify-email-form"><button type="submit">Confirm</button></form><p id="auth-status"></p>',
    { runScripts: 'outside-only', url }
  );
  dom.window.SetScriptLoaded = () => {};
  return dom;
}

test('email verification page requires an explicit confirmation action', () => {
  assert.match(verificationPage, /id="verify-email-form"/);
  assert.match(verificationPage, /CONFIRM EMAIL AND CONTINUE/);
  assert.match(verificationPage, /href="\/sign-in"/);
  assert.match(verificationPage, /href="\/"/);
  assert.match(
    verificationPage,
    /\/scripts\/auth\/verify-email\/verify-email\.js/
  );
});

test('email verification page rejects a missing token before making a request', () => {
  const dom = createVerificationDom('https://overexposed.test/verify-email');
  let requests = 0;
  dom.window.fetch = async () => {
    requests += 1;
  };

  dom.window.eval(verificationScript);
  dom.window.document
    .getElementById('verify-email-form')
    .dispatchEvent(new dom.window.Event('submit', { cancelable: true }));

  assert.equal(requests, 0);
  assert.equal(
    dom.window.document.getElementById('auth-status').textContent,
    'This email confirmation link is invalid or has expired.'
  );
  assert.equal(
    dom.window.document.querySelector('[type="submit"]').disabled,
    true
  );
  dom.window.close();
});

test('email verification submits its token and displays an invalid response', async () => {
  const dom = createVerificationDom(
    'https://overexposed.test/verify-email?token=expired&emailTrackingId=tracking-id'
  );
  let request;
  dom.window.fetch = async (url, options) => {
    request = { url, options };
    return {
      ok: false,
      status: 400,
      async json() {
        return {
          success: false,
          error: {
            message: 'This email confirmation link is invalid or has expired'
          }
        };
      }
    };
  };

  dom.window.eval(verificationScript);
  dom.window.document
    .getElementById('verify-email-form')
    .dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(request.url, '/api/accounts/verify-email/complete');
  assert.deepEqual(JSON.parse(request.options.body), {
    token: 'expired',
    emailTrackingId: 'tracking-id'
  });
  assert.equal(
    dom.window.document.getElementById('auth-status').textContent,
    'This email confirmation link is invalid or has expired'
  );
  assert.equal(
    dom.window.document
      .getElementById('auth-status')
      .classList.contains('error'),
    true
  );
  dom.window.close();
});

test('homepage consumes the one-time email confirmation success notice', () => {
  const dom = new JSDOM('', {
    runScripts: 'outside-only',
    url: 'https://overexposed.test/'
  });
  let popupShown = false;
  dom.window.sessionStorage.setItem('oe-auth-completion', 'email-verified');
  dom.window.loadHomepageTiles = () => {};
  dom.window.renderHomepageGrid = () => {};
  dom.window.showEmailVerificationSuccessPopup = () => {
    popupShown = true;
  };
  dom.window.playSoundEffect = () => {};
  dom.window.waitForFunction = (name, callback) => {
    if (typeof dom.window[name] === 'function') callback();
  };
  dom.window.OEAudio = { register: async () => {} };
  dom.window.SetScriptLoaded = () => {};

  dom.window.eval(homepageScript);

  assert.equal(dom.window.sessionStorage.getItem('oe-auth-completion'), null);
  assert.equal(popupShown, true);
  dom.window.close();
});
