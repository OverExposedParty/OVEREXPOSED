const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const mongoose = require('mongoose');

const OlingClashAbility = require('../../models/olings/oling-clash-ability-schema');
const OlingClashArchive = require('../../models/olings/oling-clash-archive-schema');
const OlingClashMatch = require('../../models/olings/oling-clash-match-schema');
const OlingClashRuleset = require('../../models/olings/oling-clash-ruleset-schema');
const OlingClashStatus = require('../../models/olings/oling-clash-status-schema');
const clashAbilityCatalog = require('../../public/json-files/olings/clash-abilities.json');
const clashRulesetCatalog = require('../../public/json-files/olings/clash-rulesets.json');
const clashStatusCatalog = require('../../public/json-files/olings/clash-statuses.json');
const traitCatalog = require('../../public/json-files/olings/traits.json');
const models = require('../../server/models');
const {
  createAiClashPlayer
} = require('../../server/services/oling-clashes/ai-opponent');

function createAbility(overrides = {}) {
  return {
    key: 'moss-mend',
    revision: 1,
    traitKey: 'moss-mouth',
    layer: 'mouth',
    trigger: 'attack_win',
    name: 'Mend',
    imagePath: '/images/olings/clash/abilities/moss/mend.svg',
    description: 'Heal the most damaged benched Oling by 1/2 Heart.',
    effects: [
      {
        order: 0,
        mechanic: 'heal',
        handler: 'heal_most_damaged_benched',
        target: { side: 'ally', location: 'bench' },
        parameters: { amountUnits: 1 }
      }
    ],
    roleTags: ['support'],
    ...overrides
  };
}

function createStatus(overrides = {}) {
  return {
    key: 'burn',
    revision: 1,
    name: 'Burn',
    description: 'Take 1/2 Normal Damage after the next decisive Clash.',
    polarity: 'negative',
    handler: 'damage_after_decisive_clash',
    parameters: {
      damageUnits: 1,
      damageType: 'normal',
      damageSource: 'burn',
      mustExistAtClashStart: true
    },
    ...overrides
  };
}

function createRulesetSnapshot(overrides = {}) {
  return {
    engineVersion: 3,
    name: 'Standard Clash',
    description: 'Standard competitive rules.',
    actions: {
      attackBeats: 'skill',
      skillBeats: 'guard',
      guardBeats: 'attack'
    },
    health: {
      unitsPerHeart: 2,
      startingHeartUnits: 6,
      layerOrder: ['shields', 'overgrowth', 'hearts'],
      shieldStacks: true,
      shieldCapacityUnits: 2,
      overgrowthStacks: true,
      healingCannotExceedMaximumHearts: true,
      overgrowthCanExceedMaximumHearts: true
    },
    damage: {
      decisiveUnits: 2,
      drawUnits: 1,
      defaultTypes: {
        clash: 'normal',
        draw: 'normal',
        bonus: 'normal'
      },
      routing: {
        normal: ['shields', 'overgrowth', 'hearts'],
        piercing: ['overgrowth', 'hearts'],
        true: ['hearts']
      }
    },
    lastStand: {
      enabled: true,
      minimumHeartUnits: 1,
      preventedDamageSources: ['draw']
    },
    transfer: {
      minimumDonorHeartUnits: 1,
      requireFullRecipientCapacity: true
    },
    redirect: {
      maximumRedirectsPerEffect: 1,
      currentTargetHasPriority: true,
      otherStealsResolveAfterTargetDeclines: true,
      stealAndReflectShareLimit: true
    },
    activation: {
      suppressionPreventsEntireActivation: true,
      defencesApplyToEachEffect: true
    },
    tagging: {
      maximumCharges: 2,
      decisiveClashesPerCharge: 3,
      queuedTargetBecomesReplacement: true,
      defeatReplacementTriggersTagEffects: false,
      preserveProtection: true,
      preserveStatuses: true,
      roundDurationsContinueWhileBenched: true,
      activationConditionsWaitWhileBenched: true,
      clashConditionsWaitWhileBenched: true
    },
    resolution: {
      clash: [
        'base-damage',
        'last-stand',
        'defeat-check',
        'part-activation',
        'triggered-statuses',
        'defeat-check',
        'tag'
      ],
      effect: ['redirect', 'block', 'ward', 'resolve'],
      multipleEffects: 'written-order'
    },
    ...overrides
  };
}

function createTeamOling(teamSlot = 0, overrides = {}) {
  return {
    teamSlot,
    playerOlingId: new mongoose.Types.ObjectId(),
    snapshot: {
      name: 'Mossy',
      build: {
        body: 'moss-body',
        eyes: 'moss-eyes',
        mouth: 'moss-mouth',
        flight: 'moss-wings'
      },
      abilities: [createAbility()]
    },
    maxHeartUnits: 6,
    heartUnits: 6,
    overgrowthUnits: 1,
    shieldCount: 1,
    abilityProgress: [],
    ...overrides
  };
}

test('Clash abilities map traits to fixed triggers and ordered effects', async () => {
  const ability = new OlingClashAbility(createAbility());
  await ability.validate();

  assert.equal(ability.traitKey, 'moss-mouth');
  assert.equal(
    ability.imagePath,
    '/images/olings/clash/abilities/moss/mend.svg'
  );
  assert.equal(ability.effects[0].mechanic, 'heal');
  assert.equal(ability.effects[0].parameters.amountUnits, 1);

  await assert.rejects(
    new OlingClashAbility(createAbility({ trigger: 'guard_win' })).validate(),
    /mouth abilities must use the "attack_win" trigger/
  );
  await assert.rejects(
    new OlingClashAbility(
      createAbility({
        effects: [
          createAbility().effects[0],
          { ...createAbility().effects[0], mechanic: 'cleanse' }
        ]
      })
    ).validate(),
    /unique positions/
  );
});

test('Clash ability indexes preserve revisions and one current record per trait', () => {
  const indexes = OlingClashAbility.schema.indexes();

  assert.ok(
    indexes.some(
      ([fields, options]) =>
        fields.key === 1 && fields.revision === 1 && options.unique === true
    )
  );
  assert.ok(
    indexes.some(
      ([fields, options]) =>
        fields.traitKey === 1 &&
        fields.isCurrent === 1 &&
        options.unique === true
    )
  );
});

test('Clash Statuses preserve executable definitions and revisions', async () => {
  const status = new OlingClashStatus(createStatus());
  await status.validate();

  assert.equal(status.polarity, 'negative');
  assert.equal(status.parameters.damageType, 'normal');
  assert.ok(
    OlingClashStatus.schema
      .indexes()
      .some(
        ([fields, options]) =>
          fields.key === 1 && fields.revision === 1 && options.unique === true
      )
  );
});

test('Clash rulesets default to half-Hearts and the complete resolution model', async () => {
  const ruleset = new OlingClashRuleset({
    key: 'standard',
    revision: 1,
    name: 'Standard Clash'
  });
  await ruleset.validate();

  assert.equal(ruleset.engineVersion, 3);
  assert.equal(ruleset.health.unitsPerHeart, 2);
  assert.equal(ruleset.health.shieldCapacityUnits, 2);
  assert.equal(ruleset.health.startingHeartUnits, 6);
  assert.equal(ruleset.damage.drawUnits, 1);
  assert.deepEqual(ruleset.damage.routing.true, ['hearts']);
  assert.deepEqual(ruleset.lastStand.preventedDamageSources, ['draw']);
  assert.equal(ruleset.health.healingCannotExceedMaximumHearts, true);
  assert.equal(ruleset.health.overgrowthCanExceedMaximumHearts, true);
  assert.equal(ruleset.transfer.minimumDonorHeartUnits, 1);
  assert.equal(ruleset.redirect.maximumRedirectsPerEffect, 1);
  assert.equal(ruleset.redirect.stealAndReflectShareLimit, true);
  assert.equal(ruleset.activation.suppressionPreventsEntireActivation, true);
  assert.deepEqual(ruleset.resolution.effect, [
    'redirect',
    'block',
    'ward',
    'resolve'
  ]);
});

test('Clash rulesets reject invalid triangles, health order, and fractional units', async () => {
  await assert.rejects(
    new OlingClashRuleset({
      key: 'broken-triangle',
      revision: 1,
      name: 'Broken Triangle',
      actions: {
        attackBeats: 'guard',
        skillBeats: 'guard',
        guardBeats: 'attack'
      }
    }).validate(),
    /must form a complete triangle/
  );

  await assert.rejects(
    new OlingClashRuleset({
      key: 'broken-health',
      revision: 1,
      name: 'Broken Health',
      health: { layerOrder: ['shields', 'hearts'] }
    }).validate(),
    /must contain Shields, Overgrowth, and Hearts/
  );

  await assert.rejects(
    new OlingClashRuleset({
      key: 'fractional-damage',
      revision: 1,
      name: 'Fractional Damage',
      damage: { drawUnits: 0.5 }
    }).validate()
  );
});

test('Clash matches snapshot rules, abilities, Statuses, and health layers', async () => {
  const match = new OlingClashMatch({
    matchCode: 'abc-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: {
      key: 'standard',
      revision: 1,
      snapshot: createRulesetSnapshot()
    },
    statusDefinitions: [
      { key: 'burn', revision: 1, snapshot: createStatus() },
      {
        key: 'blocked',
        revision: 1,
        snapshot: createStatus({
          key: 'blocked',
          name: 'Blocked',
          handler: 'block_effect_category'
        })
      }
    ],
    players: [
      {
        accountId: new mongoose.Types.ObjectId(),
        slot: 'player-one',
        isAi: true,
        aiDifficulty: 0.65,
        activeTeamSlot: 0,
        statuses: [
          {
            key: 'blocked',
            revision: 1,
            sourcePlayerSlot: 'player-two',
            sourceTeamSlot: 0,
            appliedRound: 1,
            expiresAfterRound: 2,
            durationType: 'round',
            data: { activeFromRound: 2, category: 'positive-status' }
          }
        ],
        selection: {
          round: 1,
          action: 'skill',
          tagTeamSlot: 1,
          effectChoice: {
            abilityKey: 'vampire-transfusion',
            targetTeamSlot: 1,
            optionKey: 'self-to-bench'
          }
        },
        team: [
          createTeamOling(0, {
            pendingReclaimUnits: 1,
            abilityProgress: [
              {
                abilityKey: 'vampire-bloodsuck',
                abilityRevision: 1,
                activationCount: 1,
                data: { lastDecisiveVictoryAction: 'attack' }
              }
            ],
            removedPositiveStatuses: [
              {
                status: {
                  key: 'burn-primed',
                  revision: 1,
                  sourcePlayerSlot: 'player-one',
                  sourceTeamSlot: 0,
                  appliedRound: 1,
                  durationType: 'activation',
                  remaining: 1,
                  data: {
                    condition: 'next-action-win',
                    requiredAction: 'attack'
                  }
                },
                removedRound: 1,
                reason: 'trigger-consumed'
              }
            ]
          }),
          createTeamOling(1),
          createTeamOling(2)
        ]
      }
    ]
  });
  await match.validate();

  const teamOling = match.players[0].team[0];
  assert.equal(match.matchCode, 'ABC-123');
  assert.equal(match.players[0].isAi, true);
  assert.equal(match.players[0].aiDifficulty, 0.65);
  assert.equal(match.players[0].statuses[0].durationType, 'round');
  assert.equal(
    match.players[0].selection.effectChoice.abilityKey,
    'vampire-transfusion'
  );
  assert.equal(match.players[0].selection.effectChoice.targetTeamSlot, 1);
  assert.equal(
    match.players[0].selection.effectChoice.optionKey,
    'self-to-bench'
  );
  assert.equal(teamOling.heartUnits, 6);
  assert.equal(teamOling.overgrowthUnits, 1);
  assert.equal(teamOling.pendingReclaimUnits, 1);
  assert.equal(teamOling.abilityProgress[0].abilityKey, 'vampire-bloodsuck');
  assert.equal(teamOling.abilityProgress[0].abilityRevision, 1);
  assert.equal(teamOling.abilityProgress[0].activationCount, 1);
  assert.equal(teamOling.removedPositiveStatuses[0].status.key, 'burn-primed');
  assert.equal(teamOling.removedPositiveStatuses[0].reason, 'trigger-consumed');
  assert.equal(
    teamOling.abilityProgress[0].data.lastDecisiveVictoryAction,
    'attack'
  );
  assert.equal(
    teamOling.snapshot.abilities[0].effects[0].handler,
    'heal_most_damaged_benched'
  );
  assert.equal(
    match.statusDefinitions[0].snapshot.handler,
    'damage_after_decisive_clash'
  );
  assert.equal(match.ruleset.snapshot.lastStand.minimumHeartUnits, 1);
  assert.equal(match.ruleset.snapshot.tagging.maximumCharges, 2);
  assert.equal(match.ruleset.snapshot.tagging.decisiveClashesPerCharge, 3);
  assert.equal(match.players[0].tagCharges, 2);
  assert.equal(match.players[0].tagRechargeProgress, 0);
});

test('Clash matches reject invalid health units and team references', async () => {
  const match = new OlingClashMatch({
    matchCode: 'BAD-123',
    ruleset: {
      key: 'standard',
      revision: 1,
      snapshot: createRulesetSnapshot()
    },
    players: [
      {
        accountId: new mongoose.Types.ObjectId(),
        slot: 'player-one',
        activeTeamSlot: 2,
        team: [createTeamOling(0, { heartUnits: 6.5 })]
      }
    ]
  });

  await assert.rejects(match.validate());
});

test('Clash selections allow no queued Tag while requiring integer team slots', async () => {
  const createMatch = (tagTeamSlot) =>
    new OlingClashMatch({
      matchCode: 'TAG-123',
      ruleset: {
        key: 'standard',
        revision: 1,
        snapshot: createRulesetSnapshot()
      },
      players: [
        {
          accountId: new mongoose.Types.ObjectId(),
          slot: 'player-one',
          selection: {
            round: 1,
            action: 'attack',
            tagTeamSlot
          }
        }
      ]
    });

  const matchWithoutTag = createMatch(null);
  await matchWithoutTag.validate();
  assert.equal(matchWithoutTag.players[0].selection.tagTeamSlot, null);

  await assert.rejects(createMatch(1.5).validate(), /tagTeamSlot/);
});

test('Clash last-move summaries allow draws without making draw selectable', async () => {
  const createMatch = ({ lastMoves, selection } = {}) =>
    new OlingClashMatch({
      matchCode: 'DRW-123',
      ruleset: {
        key: 'standard',
        revision: 1,
        snapshot: createRulesetSnapshot()
      },
      players: [
        {
          accountId: new mongoose.Types.ObjectId(),
          slot: 'player-one',
          lastMoves,
          selection
        }
      ]
    });

  const match = createMatch({
    lastMoves: [
      {
        teamSlot: 0,
        action: 'draw',
        activationStatus: 'revealed',
        outcome: 'draw',
        round: 2
      }
    ]
  });
  await match.validate();
  assert.equal(match.players[0].lastMoves[0].action, 'draw');

  await assert.rejects(
    createMatch({ selection: { round: 2, action: 'draw' } }).validate(),
    /is not a valid enum value for path `action`/
  );
});

test('Clash matches cap pending Reclaim Blood at half a Heart', async () => {
  const match = new OlingClashMatch({
    matchCode: 'RCL-123',
    ruleset: {
      key: 'standard',
      revision: 1,
      snapshot: createRulesetSnapshot()
    },
    players: [
      {
        accountId: new mongoose.Types.ObjectId(),
        slot: 'player-one',
        team: [
          createTeamOling(0, { pendingReclaimUnits: 2 }),
          createTeamOling(1),
          createTeamOling(2)
        ]
      }
    ]
  });

  await assert.rejects(match.validate(), /pendingReclaimUnits/);
});

test('Clash lobby players may wait without a team but not with a partial team', async () => {
  const createMatch = (team) =>
    new OlingClashMatch({
      matchCode: 'LOB-123',
      ruleset: {
        key: 'standard',
        revision: 1,
        snapshot: createRulesetSnapshot()
      },
      players: [
        {
          accountId: new mongoose.Types.ObjectId(),
          slot: 'player-one',
          team
        }
      ]
    });

  await createMatch([]).validate();
  await assert.rejects(
    createMatch([createTeamOling(0), createTeamOling(1)]).validate(),
    /either no team or exactly three Olings/
  );
});

test('Clash matches embed typed damage events', async () => {
  const match = new OlingClashMatch({
    matchCode: 'ABC-123',
    ruleset: {
      key: 'standard',
      revision: 1,
      snapshot: createRulesetSnapshot()
    },
    events: [
      {
        sequence: 1,
        round: 4,
        type: 'round-resolved',
        actorSlot: 'player-one',
        damageSource: 'draw',
        damageType: 'normal',
        payload: {
          attemptedUnits: 1,
          heartDamageUnits: 0,
          preventedUnits: 1,
          preventedBy: 'last-stand'
        }
      }
    ]
  });
  await match.validate();

  const event = match.events[0];
  assert.equal(event.damageSource, 'draw');
  assert.equal(event.damageType, 'normal');
  assert.equal(event.payload.preventedBy, 'last-stand');
});

test('Generated Clash AI teams validate against the live match snapshot schema', async () => {
  const aiModels = {
    OlingClashAbility: {
      find() {
        return {
          sort() {
            return this;
          },
          async lean() {
            return clashAbilityCatalog.abilities;
          }
        };
      }
    },
    OlingTrait: {
      find() {
        return { lean: async () => traitCatalog.traits };
      }
    }
  };
  const ruleset = {
    key: 'standard',
    revision: 1,
    snapshot: createRulesetSnapshot()
  };
  const aiPlayer = await createAiClashPlayer(
    aiModels,
    'player-two',
    ruleset,
    0.5,
    { random: () => 0.25 }
  );
  const match = new OlingClashMatch({
    matchCode: 'AI0-001',
    ruleset,
    players: [aiPlayer]
  });

  await match.validate();
  assert.equal(match.players[0].isAi, true);
  assert.equal(match.players[0].team.length, 3);
  assert.equal(match.players[0].team[0].snapshot.abilities.length, 4);
});

test('Clash archives retain a completed game snapshot', async () => {
  const archive = new OlingClashArchive({
    gameId: 'OCL-0123456789ABCDEF0123456789ABCDEF',
    sourceMatchId: new mongoose.Types.ObjectId(),
    matchCode: 'ABC-123',
    completionStatus: 'completed',
    endedAt: new Date(),
    roundsPlayed: 4,
    ruleset: {
      key: 'standard',
      revision: 1,
      snapshot: createRulesetSnapshot()
    },
    finalState: {
      status: 'completed',
      phase: 'complete',
      round: 4,
      endReason: 'team_defeated'
    }
  });
  await archive.validate();
  assert.equal(archive.roundsPlayed, 4);
});

test('Clash models are registered on the Olings connection', () => {
  assert.equal(models.OlingClashAbility.modelName, 'OlingClashAbility');
  assert.equal(models.OlingClashStatus.modelName, 'OlingClashStatus');
  assert.equal(models.OlingClashRuleset.modelName, 'OlingClashRuleset');
  assert.equal(models.OlingClashMatch.modelName, 'OlingClashMatch');
  assert.equal(models.OlingClashArchive.modelName, 'OlingClashArchive');
  assert.equal(models.OlingClashStatus.db, models.olingsConnection);
  assert.equal(models.OlingClashMatch.db, models.olingsConnection);
});

test('Clash JSON catalogs validate and map every ability to one Oling Part', async () => {
  assert.equal(clashAbilityCatalog.abilities.length, 24);
  assert.equal(clashRulesetCatalog.rulesets.length, 1);

  const traitKeys = new Set(traitCatalog.traits.map((trait) => trait.key));
  const abilityTraitKeys = clashAbilityCatalog.abilities.map(
    (ability) => ability.traitKey
  );
  assert.equal(new Set(abilityTraitKeys).size, abilityTraitKeys.length);

  for (const ability of clashAbilityCatalog.abilities) {
    assert.ok(traitKeys.has(ability.traitKey), ability.traitKey);
    assert.equal(path.extname(ability.imagePath), '.svg', ability.key);
    assert.equal(
      fs.existsSync(path.join(__dirname, '../../public', ability.imagePath)),
      true,
      `${ability.key} is missing ${ability.imagePath}`
    );
    await new OlingClashAbility(ability).validate();
  }

  for (const ruleset of clashRulesetCatalog.rulesets) {
    await new OlingClashRuleset(ruleset).validate();
  }
});

test('Clash ability status references resolve to versioned status definitions', async () => {
  const statusKeys = new Set(
    clashStatusCatalog.statuses.map((status) => status.key)
  );
  assert.ok(statusKeys.size > 0);

  for (const status of clashStatusCatalog.statuses) {
    await new OlingClashStatus(status).validate();
  }

  for (const ability of clashAbilityCatalog.abilities) {
    for (const effect of ability.effects) {
      const referencedStatusKeys = Object.entries(effect.parameters || {})
        .filter(([key]) => key.toLowerCase().endsWith('statuskey'))
        .map(([, value]) => value);
      for (const referencedStatusKey of referencedStatusKeys) {
        assert.ok(
          statusKeys.has(referencedStatusKey),
          `${ability.key} references missing Status ${referencedStatusKey}`
        );
      }
    }
  }
});
