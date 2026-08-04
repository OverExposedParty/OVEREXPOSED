const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const {
  createAuthSecurityContext
} = require('../../server/routes/api-route-context/auth-security');

function createContext() {
  return createAuthSecurityContext({
    crypto,
    canUseOeItem: () => false,
    Account: {},
    OeCustomisation: {}
  });
}

test('auth input normalizers canonicalize account identifiers to lowercase', () => {
  const context = createContext();

  assert.deepEqual(
    context.normalizeAccountInput({
      username: '  User.Name  ',
      email: '  USER@Example.COM  '
    }),
    {
      username: 'user.name',
      email: 'user@example.com',
      password: '',
      confirmPassword: '',
      termsAccepted: false,
      privacyPolicyAccepted: false,
      marketingEmailOptIn: false
    }
  );
  assert.equal(
    context.normalizeLoginInput({ identifier: '  USER.Name  ' }).identifier,
    'user.name'
  );
  assert.equal(
    context.normalizePasswordResetRequestInput({
      identifier: '  USER@Example.COM  '
    }).identifier,
    'user@example.com'
  );
});

test('signup consent records an explicit marketing choice', () => {
  const context = createContext();
  const req = {
    ip: '127.0.0.1',
    get(name) {
      return name === 'user-agent' ? 'consent-test' : null;
    }
  };

  const accepted = context.createSignupLegalConsent(req, true);
  const declined = context.createSignupLegalConsent(req, false);

  assert.equal(accepted.marketingConsentStatus, 'accepted');
  assert.equal(accepted.consentHistory.at(-1).type, 'marketing_email');
  assert.equal(accepted.consentHistory.at(-1).source, 'signup');
  assert.equal(declined.marketingConsentStatus, 'declined');
  assert.equal(declined.consentHistory.at(-1).acceptedAt, null);
});
