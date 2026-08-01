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
      privacyPolicyAccepted: false
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
