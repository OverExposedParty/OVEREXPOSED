const assert = require('node:assert/strict');
const test = require('node:test');

const Account = require('../../models/accounts/account-schema');

test('social accounts can be created without provider email', () => {
  const account = new Account({
    username: 'snapchat-user',
    email: null,
    passwordHash: 'hashed-password',
    profile: {
      accountStatus: 'active',
      loginProviders: [
        {
          name: 'snapchat',
          providerUserId: 'snap-user-123'
        }
      ]
    }
  });

  assert.equal(account.validateSync(), undefined);
});
