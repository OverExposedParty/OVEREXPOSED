const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canAccessFeature,
  canAccessOwnerPages,
  canAccessProtectedPage
} = require('../../server/services/page-protection');

function createAccount(overrides = {}) {
  return {
    profile: {
      emailVerified: true,
      accountStatus: 'active',
      ...(overrides.profile || {})
    },
    admin: {
      roles: [],
      disabled: false,
      ...(overrides.admin || {})
    },
    access: {
      roles: [],
      features: [],
      disabled: false,
      ...(overrides.access || {})
    }
  };
}

function createAccountModel(account, accountsById = {}) {
  return {
    findOne() {
      return {
        select() {
          return Promise.resolve(account);
        }
      };
    },
    findById(accountId) {
      return Promise.resolve(accountsById[String(accountId)] || null);
    }
  };
}

function createPartyModel(party) {
  const activeParty = {
    ...party,
    state: {
      ...(party?.state || {}),
      lastPinged: party?.state?.lastPinged || new Date()
    }
  };
  return {
    findOne() {
      return {
        lean() {
          return Promise.resolve(activeParty);
        }
      };
    }
  };
}

test('canAccessFeature allows beta testers to use beta features', () => {
  const account = createAccount({
    access: {
      roles: ['beta_tester']
    }
  });

  assert.equal(canAccessFeature(account, 'olings.lab'), true);
  assert.equal(canAccessFeature(account, 'overexposure'), true);
  assert.equal(canAccessFeature(account, 'shop'), true);
  assert.equal(canAccessFeature(account, 'party-games.prompt-heist'), true);
  assert.equal(canAccessFeature(account, 'would-you-rather'), true);
  assert.equal(canAccessFeature(account, 'imposter'), true);
});

test('canAccessFeature blocks regular accounts from feature-gated shop', () => {
  assert.equal(canAccessFeature(createAccount(), 'shop'), false);
});

test('Mafia feature access remains owner-only', () => {
  const owner = createAccount({ admin: { roles: ['owner'] } });
  const admin = createAccount({ admin: { roles: ['admin'] } });
  const betaTester = createAccount({
    access: { roles: ['beta_tester'] }
  });

  assert.equal(canAccessFeature(owner, 'mafia'), true);
  assert.equal(canAccessFeature(admin, 'mafia'), false);
  assert.equal(canAccessFeature(betaTester, 'mafia'), false);
  assert.equal(canAccessFeature(createAccount(), 'mafia'), false);
});

test('canAccessFeature allows explicit feature grants without beta role', () => {
  const account = createAccount({
    access: {
      features: ['shop']
    }
  });

  assert.equal(canAccessFeature(account, 'shop'), true);
  assert.equal(canAccessFeature(account, 'imposter'), false);
});

test('canAccessFeature lets verified admin roles bypass beta gates', () => {
  const account = createAccount({
    admin: {
      roles: ['moderator']
    }
  });

  assert.equal(canAccessFeature(account, 'shop'), true);
});

test('canAccessOwnerPages only allows verified owners', () => {
  const owner = createAccount({
    admin: {
      roles: ['owner']
    }
  });
  const admin = createAccount({
    admin: {
      roles: ['admin']
    }
  });

  assert.equal(canAccessOwnerPages(owner), true);
  assert.equal(canAccessOwnerPages(admin), false);
});

test('canAccessProtectedPage blocks shop pages for regular accounts', async () => {
  const access = await canAccessProtectedPage(
    { headers: { cookie: 'oe_session=test-session' }, path: '/shop' },
    { type: 'feature', feature: 'shop' },
    { Account: createAccountModel(createAccount()) }
  );

  assert.equal(access.allowed, false);
  assert.equal(access.reason, 'feature_required');
  assert.equal(access.requiredAccess, 'beta');
  assert.equal(access.feature, 'shop');
});

test('canAccessProtectedPage describes the access needed when signed out', async () => {
  const request = { headers: { cookie: '' }, path: '/protected' };
  const Account = createAccountModel(null);

  const accountAccess = await canAccessProtectedPage(
    request,
    { type: 'account' },
    { Account }
  );
  const betaAccess = await canAccessProtectedPage(
    request,
    { type: 'feature', feature: 'shop' },
    { Account }
  );
  const ownerAccess = await canAccessProtectedPage(
    request,
    { type: 'owner' },
    { Account }
  );
  const adminAccess = await canAccessProtectedPage(
    request,
    { type: 'admin' },
    { Account }
  );

  assert.deepEqual(accountAccess, {
    allowed: false,
    reason: 'account_required',
    requiredAccess: 'account'
  });
  assert.deepEqual(betaAccess, {
    allowed: false,
    reason: 'account_required',
    requiredAccess: 'beta'
  });
  assert.deepEqual(ownerAccess, {
    allowed: false,
    reason: 'account_required',
    requiredAccess: 'owner'
  });
  assert.deepEqual(adminAccess, {
    allowed: false,
    reason: 'account_required',
    requiredAccess: 'admin'
  });
});

test('canAccessProtectedPage still blocks beta feature pages for ordinary accounts', async () => {
  const access = await canAccessProtectedPage(
    {
      headers: { cookie: 'oe_session=test-session' },
      path: '/olings/lab'
    },
    { type: 'feature', feature: 'olings.lab' },
    { Account: createAccountModel(createAccount()) }
  );

  assert.equal(access.allowed, false);
  assert.equal(access.reason, 'feature_required');
  assert.equal(access.feature, 'olings.lab');
});

test('canAccessProtectedPage allows feature pages for beta testers', async () => {
  const access = await canAccessProtectedPage(
    { headers: { cookie: 'oe_session=test-session' }, path: '/shop' },
    { type: 'feature', feature: 'shop' },
    {
      Account: createAccountModel(
        createAccount({
          access: {
            roles: ['beta_tester']
          }
        })
      )
    }
  );

  assert.equal(access.allowed, true);
});

test('canAccessProtectedPage blocks owner pages for non-owner admins', async () => {
  const access = await canAccessProtectedPage(
    { headers: { cookie: 'oe_session=test-session' }, path: '/mafia/settings' },
    { type: 'owner' },
    {
      Account: createAccountModel(
        createAccount({
          admin: {
            roles: ['admin']
          }
        })
      )
    }
  );

  assert.equal(access.allowed, false);
  assert.equal(access.reason, 'owner_required');
});

test('canAccessProtectedPage allows owner pages for owners', async () => {
  const access = await canAccessProtectedPage(
    { headers: { cookie: 'oe_session=test-session' }, path: '/mafia/settings' },
    { type: 'owner' },
    {
      Account: createAccountModel(
        createAccount({
          admin: {
            roles: ['owner']
          }
        })
      )
    }
  );

  assert.equal(access.allowed, true);
});

test('canAccessProtectedPage allows hosted beta party pages for guests', async () => {
  const hostAccount = createAccount({
    access: {
      roles: ['beta_tester']
    }
  });
  const access = await canAccessProtectedPage(
    {
      headers: { cookie: '' },
      params: { partyCode: 'ABC-123' },
      path: '/imposter/ABC-123'
    },
    { type: 'feature', feature: 'imposter', allowHostedParty: true },
    {
      Account: createAccountModel(null, {
        '64f000000000000000000001': hostAccount
      }),
      PartyModels: [
        createPartyModel({
          partyId: 'ABC-123',
          session: {
            access: {
              originalHostAccountId: '64f000000000000000000001'
            }
          },
          state: {
            hostComputerId: 'new-host'
          },
          players: [
            {
              identity: {
                computerId: 'new-host',
                accountId: '64f000000000000000000002'
              }
            }
          ]
        })
      ]
    }
  );

  assert.equal(access.allowed, true);
});

test('hosted beta party access checks the original host after host transfer', async () => {
  const originalHost = createAccount({
    access: {
      roles: ['beta_tester']
    }
  });
  const transferredHost = createAccount();
  const access = await canAccessProtectedPage(
    {
      headers: { cookie: '' },
      params: { partyCode: 'ABC-123' },
      path: '/would-you-rather/ABC-123'
    },
    {
      type: 'feature',
      feature: 'would-you-rather',
      allowHostedParty: true
    },
    {
      Account: createAccountModel(null, {
        '64f000000000000000000001': originalHost,
        '64f000000000000000000002': transferredHost
      }),
      PartyModels: [
        createPartyModel({
          partyId: 'ABC-123',
          session: {
            access: {
              originalHostAccountId: '64f000000000000000000001'
            }
          },
          state: {
            hostComputerId: 'transferred-host'
          },
          players: [
            {
              identity: {
                computerId: 'transferred-host',
                accountId: '64f000000000000000000002'
              }
            }
          ]
        })
      ]
    }
  );

  assert.equal(access.allowed, true);
});

test('hosted owner party access checks the original owner host', async () => {
  const originalHost = createAccount({
    admin: {
      roles: ['owner']
    }
  });
  const transferredHost = createAccount({
    admin: {
      roles: ['admin']
    }
  });
  const access = await canAccessProtectedPage(
    {
      headers: { cookie: '' },
      params: { partyCode: 'ABC-123' },
      path: '/mafia/ABC-123'
    },
    {
      type: 'owner',
      allowHostedParty: true
    },
    {
      Account: createAccountModel(null, {
        '64f000000000000000000001': originalHost,
        '64f000000000000000000002': transferredHost
      }),
      PartyModels: [
        createPartyModel({
          partyId: 'ABC-123',
          session: {
            access: {
              originalHostAccountId: '64f000000000000000000001'
            }
          },
          state: {
            hostComputerId: 'transferred-host'
          },
          players: [
            {
              identity: {
                computerId: 'transferred-host',
                accountId: '64f000000000000000000002'
              }
            }
          ]
        })
      ]
    }
  );

  assert.equal(access.allowed, true);
});

test('expired hosted parties no longer grant protected-page access', async () => {
  const hostAccount = createAccount({
    access: { roles: ['beta_tester'] }
  });
  const access = await canAccessProtectedPage(
    {
      headers: { cookie: '' },
      params: { partyCode: 'OLD-123' },
      path: '/imposter/OLD-123'
    },
    { type: 'feature', feature: 'imposter', allowHostedParty: true },
    {
      Account: createAccountModel(null, {
        '64f000000000000000000001': hostAccount
      }),
      PartyModels: [
        createPartyModel({
          partyId: 'OLD-123',
          session: {
            access: {
              originalHostAccountId: '64f000000000000000000001'
            }
          },
          state: {
            lastPinged: new Date(Date.now() - 21 * 60 * 1000)
          }
        })
      ]
    }
  );

  assert.equal(access.allowed, false);
  assert.equal(access.reason, 'account_required');
});
