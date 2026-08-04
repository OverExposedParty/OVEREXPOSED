const assert = require('node:assert/strict');
const test = require('node:test');

const {
  EmailAudienceValidationError,
  buildAudienceAccountQuery,
  normalizeEmailAudienceInput,
  resolveAudienceRecipients,
  resolveManualAudienceAccounts
} = require('../../server/services/email-audiences');

test('audience input normalizes supported conditions and manual identifiers', () => {
  const audience = normalizeEmailAudienceInput({
    name: ' Recently Active ',
    type: 'dynamic',
    match: 'any',
    requireMarketingConsent: 'true',
    conditions: [
      { field: 'country', operator: 'is', value: 'gb' },
      { field: 'emailVerified', operator: 'is', value: 'true' }
    ]
  });

  assert.equal(audience.name, 'Recently Active');
  assert.equal(audience.requireMarketingConsent, true);
  assert.deepEqual(audience.conditions, [
    { field: 'country', operator: 'is', value: 'GB' },
    { field: 'emailVerified', operator: 'is', value: true }
  ]);
  assert.throws(
    () =>
      normalizeEmailAudienceInput({
        name: 'Unsafe',
        conditions: [{ field: '$where', operator: 'is', value: 'x' }]
      }),
    EmailAudienceValidationError
  );
});

test('audience queries enforce account eligibility and marketing consent', () => {
  const query = buildAudienceAccountQuery({
    type: 'dynamic',
    match: 'all',
    requireMarketingConsent: true,
    conditions: [
      { field: 'emailVerified', operator: 'is', value: true },
      { field: 'hasPurchased', operator: 'is', value: true }
    ]
  });
  const encoded = JSON.stringify(query);

  assert.match(encoded, /marketingConsentStatus/);
  assert.match(encoded, /notificationPreferences\.marketingEmail/);
  assert.match(encoded, /profile\.emailVerified/);
  assert.match(encoded, /shop\.orderHistory\.0/);
  assert.match(encoded, /suspended/);
  assert.match(encoded, /banned/);
});

test('audience resolution reports suppressions separately from eligible recipients', async () => {
  const countQueries = [];
  const findQueries = [];
  const Account = {
    async countDocuments(query) {
      countQueries.push(query);
      return countQueries.length === 1 ? 5 : 2;
    },
    find(query) {
      findQueries.push(query);
      return {
        select() {
          return this;
        },
        sort() {
          return this;
        },
        limit() {
          return this;
        },
        async lean() {
          return [
            {
              _id: 'account-1',
              username: 'alex',
              email: 'alex@example.com',
              profile: { displayName: 'Alex' }
            }
          ];
        }
      };
    }
  };
  const EmailSuppression = {
    find() {
      return {
        select() {
          return this;
        },
        async lean() {
          return [{ email: 'blocked@example.com' }];
        }
      };
    }
  };

  const resolution = await resolveAudienceRecipients({
    Account,
    EmailSuppression,
    audience: { type: 'dynamic', conditions: [] }
  });

  assert.equal(resolution.matchedCount, 5);
  assert.equal(resolution.suppressedCount, 2);
  assert.equal(resolution.eligibleCount, 3);
  assert.equal(resolution.preview[0].displayName, 'Alex');
  assert.match(JSON.stringify(findQueries[0]), /blocked@example\.com/);
});

test('manual audiences resolve usernames and email addresses without raw recipients', async () => {
  const Account = {
    find() {
      return {
        select() {
          return this;
        },
        limit() {
          return this;
        },
        async lean() {
          return [
            {
              _id: 'account-1',
              username: 'alex',
              email: 'alex@example.com'
            }
          ];
        }
      };
    }
  };

  const result = await resolveManualAudienceAccounts(Account, [
    'alex',
    'missing@example.com'
  ]);
  assert.deepEqual(result.recipientIds, ['account-1']);
  assert.deepEqual(result.missingIdentifiers, ['missing@example.com']);
});
