const assert = require('node:assert/strict');
const test = require('node:test');

const Account = require('../../models/accounts/account-schema');
const composedAccount = require('../../models/accounts/account-schema/index');
const identity = require('../../models/accounts/account-schema/identity');
const commerce = require('../../models/accounts/account-schema/commerce');
const social = require('../../models/accounts/account-schema/social');
const olings = require('../../models/accounts/account-schema/olings');
const progression = require('../../models/accounts/account-schema/progression');
const platform = require('../../models/accounts/account-schema/platform');
const admin = require('../../models/accounts/account-schema/admin');
const security = require('../../models/accounts/account-schema/security');
const governance = require('../../models/accounts/account-schema/governance');

test('account schema facade preserves the composed Account model', () => {
  assert.equal(Account, composedAccount);
  assert.equal(Account.collection.name, 'accounts');
  assert.deepEqual(Object.keys(Account.schema.paths).sort(), [
    '__v',
    '_id',
    'access',
    'admin',
    'analytics',
    'createdAt',
    'customisationPreferences',
    'email',
    'gameData',
    'legalConsent',
    'matchHistory',
    'olings',
    'overexposure',
    'passwordHash',
    'profile',
    'security',
    'shop',
    'updatedAt',
    'username'
  ]);
});

test('account schema preserves domain schema contracts and indexes', () => {
  assert.equal(
    identity.coreProfileSchema.path('accountStatus').defaultValue,
    'pending_verification'
  );
  assert.equal(
    commerce.shopSchema.path('preferences.currency').defaultValue,
    'GBP'
  );
  assert.equal(social.friendRelationshipSchema.path('status').isRequired, true);
  assert.equal(olings.olingLabSchema.path('columns').defaultValue, 3);
  assert.equal(progression.opalWalletSchema.path('balance').defaultValue, 0);
  assert.equal(
    platform.matchSummarySchema.path('result').defaultValue,
    'unknown'
  );
  assert.equal(admin.adminSchema.path('actionLogs').options.select, false);
  assert.equal(
    admin.adminSchema.path('emailTemplateTestRecipient').defaultValue,
    null
  );
  assert.equal(
    security.securitySchema.path('loginHistory').options.select,
    false
  );
  assert.equal(
    governance.legalConsentSchema.path('marketingConsentStatus').defaultValue,
    'declined'
  );

  const indexedPaths = Account.schema
    .indexes()
    .map(([fields]) => Object.keys(fields)[0]);
  assert.deepEqual(indexedPaths, [
    'username',
    'email',
    'profile.accountStatus',
    'profile.lastLoginAt',
    'shop.orderHistory.orderId',
    'gameData.friendsAndBlockedUsers.accountId',
    'gameData.notifications.createdAt',
    'gameData.inGamePurchasesAndUnlocks.key',
    'gameData.opalTransactions.createdAt',
    'overexposure.postsCreated.post.postId',
    'matchHistory.matchId',
    'analytics.lastSeenAt'
  ]);

  const [, emailIndexOptions] = Account.schema
    .indexes()
    .find(([fields]) => fields.email === 1);
  assert.equal(emailIndexOptions.name, 'account_email_unique');
  assert.equal(emailIndexOptions.unique, true);
  assert.deepEqual(emailIndexOptions.partialFilterExpression, {
    email: { $type: 'string' }
  });
});

test('account schema stores usernames and emails in lowercase', () => {
  const account = new Account({
    username: 'Lowercase.User',
    email: 'USER@Example.COM',
    passwordHash: 'password-hash'
  });

  assert.equal(account.username, 'lowercase.user');
  assert.equal(account.email, 'user@example.com');
  assert.equal(account.validateSync(), undefined);
});

test('account schema stores the administrator email test recipient', () => {
  const account = new Account({
    username: 'email-admin',
    passwordHash: 'password-hash',
    admin: { emailTemplateTestRecipient: ' TESTS@Example.COM ' }
  });

  assert.equal(account.admin.emailTemplateTestRecipient, 'tests@example.com');
  assert.equal(account.validateSync(), undefined);
});

test('account schema accepts reconnect notifications for persistence', () => {
  const account = new Account({
    username: 'reconnect-user',
    passwordHash: 'password-hash',
    gameData: {
      partyNotifications: [
        {
          notificationId: 'reconnect-occurrence-1',
          type: 'party_player_reconnected'
        }
      ]
    }
  });

  assert.equal(account.validateSync(), undefined);
  assert.equal(
    account.gameData.partyNotifications[0].notificationId,
    'reconnect-occurrence-1'
  );
  assert.equal(
    account.gameData.partyNotifications[0].type,
    'party_player_reconnected'
  );
});

test('account schema accepts unified notifications for persistence', () => {
  const account = new Account({
    username: 'notification-user',
    passwordHash: 'password-hash',
    gameData: {
      notifications: [
        {
          notificationId: '11111111-1111-4111-8111-111111111111',
          type: 'party_host_changed',
          category: 'party',
          metadata: { partyId: 'PARTY-ONE' }
        }
      ]
    }
  });

  assert.equal(account.validateSync(), undefined);
  assert.equal(account.gameData.notifications[0].category, 'party');
  assert.equal(account.gameData.notifications[0].metadata.partyId, 'PARTY-ONE');
});

test('account schema stores friend notification observation state', () => {
  const account = new Account({
    username: 'notification-state-user',
    passwordHash: 'password-hash',
    gameData: {
      friendNotificationStates: [
        {
          accountId: '111111111111111111111111',
          presenceInitialized: true,
          wasOnline: false,
          sessionInitialized: true,
          sessionFingerprint: 'party_game:paranoia:ABC-123'
        }
      ]
    }
  });

  assert.equal(account.validateSync(), undefined);
  assert.equal(
    account.gameData.friendNotificationStates[0].sessionFingerprint,
    'party_game:paranoia:ABC-123'
  );
});
