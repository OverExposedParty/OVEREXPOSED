const assert = require('node:assert/strict');
const test = require('node:test');

const {
  applyMarketingConsent,
  createMarketingUnsubscribeToken,
  createMarketingUnsubscribeUrl,
  parseMarketingUnsubscribeToken
} = require('../../server/services/marketing-consent');

const accountId = '507f1f77bcf86cd799439011';
const secret = 'test-unsubscribe-secret';

test('marketing unsubscribe tokens are signed and tied to an email address', () => {
  const account = { _id: accountId, email: 'PLAYER@Example.com' };
  const token = createMarketingUnsubscribeToken(account, secret);

  assert.deepEqual(parseMarketingUnsubscribeToken(token, secret), {
    accountId,
    email: 'player@example.com'
  });
  assert.equal(
    parseMarketingUnsubscribeToken(`${token.slice(0, -1)}x`, secret),
    null
  );
  assert.match(
    createMarketingUnsubscribeUrl({
      siteUrl: 'https://overexposed.test/',
      account,
      secret
    }),
    /^https:\/\/overexposed\.test\/unsubscribe\?token=/
  );
});

test('marketing consent changes synchronize preference, status, and history', () => {
  const account = {
    profile: { notificationPreferences: { marketingEmail: false } },
    legalConsent: { consentHistory: [] }
  };
  const req = {
    ip: '127.0.0.1',
    get: () => 'marketing-consent-test'
  };

  applyMarketingConsent(account, {
    accepted: true,
    req,
    source: 'account_settings'
  });
  assert.equal(account.profile.notificationPreferences.marketingEmail, true);
  assert.equal(account.legalConsent.marketingConsentStatus, 'accepted');
  assert.equal(account.legalConsent.consentHistory.at(-1).status, 'accepted');

  applyMarketingConsent(account, {
    accepted: false,
    req,
    source: 'unsubscribe_link'
  });
  assert.equal(account.profile.notificationPreferences.marketingEmail, false);
  assert.equal(account.legalConsent.marketingConsentStatus, 'withdrawn');
  assert.equal(
    account.legalConsent.consentHistory.at(-1).source,
    'unsubscribe_link'
  );
  assert.ok(account.legalConsent.consentHistory.at(-1).withdrawnAt);
});
