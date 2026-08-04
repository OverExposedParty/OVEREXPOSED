const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const analyticsScript = fs.readFileSync(
  path.join(__dirname, '../../public/scripts/general/analytics/analytics.js'),
  'utf8'
);

test('browser analytics queues only after consent and sends a private page path', async () => {
  const dom = new JSDOM('', {
    runScripts: 'outside-only',
    url: 'https://overexposed.test/sign-in?token=private'
  });
  const requests = [];
  dom.window.fetch = async (url, options) => {
    requests.push({ url, options });
    return { ok: true };
  };
  dom.window.eval(analyticsScript);

  assert.equal(
    dom.window.OEAnalytics.track('auth.attempted', { flow: 'signin' }),
    null
  );
  dom.window.localStorage.setItem('cookie-consent', 'true');
  const eventId = dom.window.OEAnalytics.track('auth.attempted', {
    flow: 'signin',
    provider: 'email',
    entryPoint: 'direct_auth_url'
  });
  assert.equal(typeof eventId, 'string');

  assert.equal(await dom.window.OEAnalytics.flush(), true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/analytics/events');
  const body = JSON.parse(requests[0].options.body);
  assert.equal(body.consent, true);
  assert.equal(body.events.length, 1);
  assert.equal(body.events[0].context.pagePath, '/sign-in');
  assert.equal(body.events[0].properties.provider, 'email');

  dom.window.close();
});

test('withdrawing cookie consent clears analytics identifiers and queued events', async () => {
  const dom = new JSDOM('', {
    runScripts: 'outside-only',
    url: 'https://overexposed.test/'
  });
  let requests = 0;
  dom.window.fetch = async () => {
    requests += 1;
    return { ok: true };
  };
  dom.window.localStorage.setItem('cookie-consent', 'true');
  dom.window.eval(analyticsScript);
  dom.window.OEAnalytics.track('notification.impression', {
    notificationKey: 'system_notice'
  });

  dom.window.localStorage.setItem('cookie-consent', 'false');
  dom.window.dispatchEvent(
    new dom.window.CustomEvent('oe-cookie-consent-decision', {
      detail: { consent: 'false' }
    })
  );

  assert.equal(await dom.window.OEAnalytics.flush(), false);
  assert.equal(requests, 0);
  assert.equal(
    dom.window.localStorage.getItem('oe-product-analytics-id'),
    null
  );
  dom.window.close();
});
