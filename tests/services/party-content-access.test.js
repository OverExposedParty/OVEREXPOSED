const assert = require('node:assert/strict');
const test = require('node:test');

const {
  assertPartyConfigContentAccess,
  getGrandfatheredPartyContentKeys
} = require('../../server/services/party-content-access');
const { getRuleAccess } = require('../../server/services/game-rules');

function createRuleModel() {
  return {
    find() {
      return {
        sort() {
          return {
            lean: async () => [
              {
                gameType: 'truth-or-dare',
                scope: 'gamemode',
                appliesTo: ['truth-or-dare'],
                key: 'prompt-heist',
                enabled: true,
                status: 'published',
                buttonType: 'toggle'
              },
              {
                gameType: 'truth-or-dare',
                scope: 'gamemode',
                appliesTo: ['truth-or-dare'],
                key: 'rounds',
                enabled: true,
                status: 'published',
                buttonType: 'increment'
              }
            ]
          };
        }
      };
    }
  };
}

function createPackModel() {
  return {
    find() {
      return {
        sort() {
          return {
            lean: async () => [
              {
                gameType: 'truth-or-dare',
                slug: 'classic',
                key: 'truth-or-dare-classic',
                enabled: true,
                status: 'published'
              }
            ]
          };
        }
      };
    }
  };
}

function createAccessInput(account, gameRules) {
  return {
    config: {
      gamemode: 'truth-or-dare',
      gameRules,
      selectedPacks: ['classic']
    },
    partyId: 'ABC-123',
    existingParty: {
      session: {
        access: { originalHostAccountId: 'original-host' }
      }
    },
    principal: {
      type: 'account',
      accountId: 'current-host'
    },
    Account: {
      findById: async (accountId) => {
        assert.equal(accountId, 'original-host');
        return account;
      }
    },
    WaitingRoom: null,
    GameRule: createRuleModel(),
    GamePack: createPackModel()
  };
}

function createMafiaAccessInput(account, roleCounts, configOverrides = {}) {
  const emptyContentModel = {
    find() {
      return {
        sort() {
          return {
            lean: async () => []
          };
        }
      };
    }
  };
  const GameRole = {
    find() {
      return {
        sort() {
          return {
            lean: async () => [
              {
                gameType: 'mafia',
                key: 'civilian',
                faction: 'civilian',
                enabled: true,
                status: 'published',
                selection: {
                  defaultCount: 0,
                  increment: 1,
                  minimum: 0,
                  maximum: 20,
                  fillRemaining: true
                }
              },
              {
                gameType: 'mafia',
                key: 'mafioso',
                faction: 'mafioso',
                enabled: true,
                status: 'published',
                selection: {
                  defaultCount: 1,
                  increment: 1,
                  minimum: 0,
                  maximum: 15,
                  fillRemaining: false
                }
              },
              {
                gameType: 'mafia',
                key: 'inspector',
                faction: 'civilian',
                enabled: true,
                status: 'published',
                access: {
                  type: 'feature',
                  feature: 'party-games.prompt-heist'
                },
                selection: {
                  defaultCount: 0,
                  increment: 1,
                  minimum: 0,
                  maximum: 15,
                  fillRemaining: false
                }
              }
            ]
          };
        }
      };
    }
  };
  const GameRule = {
    find() {
      return {
        sort() {
          return {
            lean: async () => [
              {
                gameType: 'mafia',
                scope: 'gamemode',
                appliesTo: ['mafia'],
                key: 'death-reveal',
                enabled: true,
                status: 'published',
                buttonType: 'toggle'
              }
            ]
          };
        }
      };
    }
  };

  return {
    config: {
      gamemode: 'mafia',
      gameRules: { 'death-reveal': true },
      selectedPacks: [],
      roleCounts,
      ...configOverrides
    },
    partyId: 'ABC-123',
    existingParty: {
      session: {
        access: { originalHostAccountId: 'original-host' }
      }
    },
    principal: {
      type: 'account',
      accountId: 'current-host'
    },
    Account: {
      findById: async () => account
    },
    WaitingRoom: null,
    GameRule,
    GamePack: emptyContentModel,
    GameRole
  };
}

test('Prompt Heist canonical and legacy keys share the beta feature gate', () => {
  assert.deepEqual(
    getRuleAccess({
      gameType: 'truth-or-dare',
      key: 'prompt-heist'
    }),
    {
      type: 'feature',
      feature: 'party-games.prompt-heist'
    }
  );
  assert.deepEqual(
    getRuleAccess({
      gameType: 'truth-or-dare',
      key: 'truth-or-dare-prompt-heist'
    }),
    {
      type: 'feature',
      feature: 'party-games.prompt-heist'
    }
  );
  assert.deepEqual(
    getRuleAccess({
      gameType: 'truth-or-dare',
      key: 'rounds'
    }),
    { type: 'public' }
  );
});

test('active games grandfather only content already selected by that party', () => {
  assert.deepEqual(
    getGrandfatheredPartyContentKeys({
      session: { playSequence: 1 },
      config: {
        selectedPacks: ['halloween'],
        gameRules: {
          'seasonal-rule': true,
          'seasonal-rule-game-rule-time-limit': 30,
          disabled: false
        },
        roleCounts: { civilian: 0, mafioso: 1 }
      },
      state: { phase: 'night', isPlaying: true },
      players: [{ state: { roleKey: 'civilian' } }]
    }),
    {
      packKeys: ['halloween'],
      ruleKeys: ['seasonal-rule'],
      roleKeys: ['mafioso', 'civilian']
    }
  );
});

test('regular hosts cannot submit Prompt Heist in party configuration', async () => {
  await assert.rejects(
    assertPartyConfigContentAccess(
      createAccessInput(
        { access: { roles: [], features: [] } },
        { 'prompt-heist': true, rounds: 15 }
      )
    ),
    (error) => {
      assert.equal(error.status, 403);
      assert.equal(error.code, 'feature_access_required');
      assert.deepEqual(error.details, {
        contentType: 'rule',
        contentKey: 'prompt-heist',
        feature: 'party-games.prompt-heist'
      });
      return true;
    }
  );
});

test('legacy Prompt Heist aliases cannot bypass the party configuration gate', async () => {
  await assert.rejects(
    assertPartyConfigContentAccess(
      createAccessInput(
        { access: { roles: [], features: [] } },
        { 'truth-or-dare-prompt-heist': true }
      )
    ),
    { code: 'feature_access_required' }
  );
});

test('beta hosts can submit Prompt Heist and public packs', async () => {
  await assert.doesNotReject(
    assertPartyConfigContentAccess(
      createAccessInput(
        { access: { roles: ['beta_tester'], features: [] } },
        { 'prompt-heist': true, rounds: 15 }
      )
    )
  );
});

test('regular hosts retain every public rule and pack', async () => {
  await assert.doesNotReject(
    assertPartyConfigContentAccess(
      createAccessInput(
        { access: { roles: [], features: [] } },
        { 'prompt-heist': false, rounds: 15 }
      )
    )
  );
});

test('regular hosts cannot submit restricted Mafia role counts', async () => {
  await assert.rejects(
    assertPartyConfigContentAccess(
      createMafiaAccessInput(
        { access: { roles: [], features: [] } },
        { mafioso: 1, inspector: 1 }
      )
    ),
    (error) => {
      assert.equal(error.status, 403);
      assert.deepEqual(error.details, {
        contentType: 'role',
        contentKey: 'inspector',
        feature: 'party-games.prompt-heist'
      });
      return true;
    }
  );
});

test('eligible hosts can submit restricted Mafia role counts', async () => {
  await assert.doesNotReject(
    assertPartyConfigContentAccess(
      createMafiaAccessInput(
        { access: { roles: ['beta_tester'], features: [] } },
        { mafioso: 1, inspector: 1 }
      )
    )
  );
});

test('Mafia configuration rejects missing roleCounts', async () => {
  await assert.rejects(
    assertPartyConfigContentAccess(
      createMafiaAccessInput(
        { access: { roles: ['beta_tester'], features: [] } },
        undefined
      )
    ),
    {
      code: 'invalid_role_counts',
      details: { field: 'roleCounts' }
    }
  );
});

test('Mafia configuration rejects role keys submitted as rules or packs', async () => {
  const account = { access: { roles: ['beta_tester'], features: [] } };

  await assert.rejects(
    assertPartyConfigContentAccess(
      createMafiaAccessInput(
        account,
        { mafioso: 1, inspector: 0 },
        {
          gameRules: { mafioso: 1 }
        }
      )
    ),
    {
      code: 'invalid_game_content',
      details: { contentType: 'rule', contentKey: 'mafioso' }
    }
  );

  await assert.rejects(
    assertPartyConfigContentAccess(
      createMafiaAccessInput(
        account,
        { mafioso: 1, inspector: 0 },
        {
          selectedPacks: ['mafioso']
        }
      )
    ),
    {
      code: 'invalid_game_content',
      details: { contentType: 'pack', contentKey: 'mafioso' }
    }
  );
});
