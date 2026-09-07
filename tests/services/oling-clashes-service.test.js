const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');

const {
  CLASH_FLOW_DURATIONS,
  addAiClashOpponent,
  applyStatus,
  applyRoutedDamage,
  assertClashPlayerEligible,
  chooseClashReplacement,
  commitClashSelection,
  finalizeExpiredClashSelections,
  getAvailableClashActions,
  createClashArchiveSnapshot,
  createAiClashPlayer,
  createRandomAiOeIcon,
  chooseAiEffectChoice,
  chooseAiClashSelection,
  forfeitClashMatch,
  getValidCleanseChoices,
  getValidHeartTransferChoices,
  getValidPartWardChoices,
  getRoundPlaybackDuration,
  isClashReadyToStart,
  joinClashMatch,
  markClashPlayerLoaded,
  requestClashRematch,
  resetClashMatchForRematch,
  resolveCoreClashRound,
  serializeClashMatch,
  serializeLiveClashMatch,
  startClashMatch,
  updateClashSelectionDraft,
  updateAiClashOpponentDifficulty
} = require('../../server/services/oling-clashes');
const {
  getCurrentClashContent,
  snapshotClashAbility
} = require('../../server/services/oling-clashes/snapshots');

function createRuleset() {
  return {
    key: 'standard',
    revision: 1,
    snapshot: {
      actions: {
        attackBeats: 'skill',
        skillBeats: 'guard',
        guardBeats: 'attack'
      },
      health: { shieldCapacityUnits: 2 },
      damage: {
        decisiveUnits: 2,
        drawUnits: 1,
        defaultTypes: { clash: 'normal', draw: 'normal' },
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
      }
    }
  };
}

test('Online Clash deadlines reserve the original result and Tag timings', () => {
  assert.equal(CLASH_FLOW_DURATIONS.actionSubmittedHold, 1100);
  assert.equal(getRoundPlaybackDuration({ outcome: 'decisive' }), 5800);
  assert.equal(getRoundPlaybackDuration({ outcome: 'draw' }), 7200);
  assert.equal(
    getRoundPlaybackDuration({
      outcome: 'decisive',
      responseDelayMs: 500,
      tags: [{}, {}]
    }),
    9100
  );
});

test('Expired Clash selections finalize server-side from private drafts', async () => {
  const human = addReinforceAbility(createPlayer('player-one', null));
  const opponent = createPlayer('player-two', null);
  human.selection = null;
  opponent.selection = null;
  let saveCount = 0;
  let resolvedSelections = null;
  const match = {
    gameId: 'OCL-SERVER-DEADLINE',
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    phaseEndsAt: new Date(1000),
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [human, opponent],
    events: [],
    async save() {
      saveCount += 1;
    }
  };
  const models = { OlingClashMatch: { findOne: async () => match } };

  await updateClashSelectionDraft({
    models,
    account: { _id: human.accountId },
    matchCode: match.matchCode,
    action: 'skill',
    now: () => 500
  });

  const hostView = serializeClashMatch(match, human.accountId);
  const guestView = serializeClashMatch(match, opponent.accountId);
  assert.equal(hostView.players[0].selectionDraft.action, 'skill');
  assert.equal(guestView.players[0].selectionDraft, null);

  const result = await finalizeExpiredClashSelections({
    models,
    matchCode: match.matchCode,
    now: () => 1001,
    random: () => 0,
    resolveRound: async (currentMatch) => {
      resolvedSelections = currentMatch.players.map((player) => ({
        ...player.selection,
        effectChoice: player.selection.effectChoice
          ? { ...player.selection.effectChoice }
          : null
      }));
      currentMatch.players.forEach((player) => {
        player.selection = null;
      });
      currentMatch.round = 2;
      currentMatch.phase = 'selection';
      return {
        actions: {
          'player-one': resolvedSelections[0].action,
          'player-two': resolvedSelections[1].action
        },
        outcome: 'decisive',
        round: 1
      };
    }
  });

  assert.equal(result.finalized, true);
  assert.equal(resolvedSelections[0].action, 'skill');
  assert.equal(
    resolvedSelections[0].effectChoice.abilityKey,
    'stone-reinforce'
  );
  assert.ok(
    ['body', 'eyes', 'flight', 'mouth'].includes(
      resolvedSelections[0].effectChoice.optionKey
    )
  );
  assert.equal(resolvedSelections[1].action, 'attack');
  assert.equal(human.selectionDraft, null);
  assert.equal(saveCount, 2);
});

test('Clash selection drafts use a guarded positional update when available', async () => {
  const player = createPlayer('player-one', null);
  let atomicWrite = null;
  const match = {
    gameId: 'OCL-ATOMIC-DRAFT',
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    phaseEndsAt: new Date(Date.now() + 30_000),
    round: 3,
    ruleset: createRuleset(),
    players: [player],
    events: [],
    async save() {
      throw new Error('The full match document should not be saved.');
    }
  };
  const models = {
    OlingClashMatch: {
      async findOne() {
        return match;
      },
      async findOneAndUpdate(filter, update, options) {
        atomicWrite = { filter, options, update };
        return match;
      }
    }
  };

  await updateClashSelectionDraft({
    models,
    account: { _id: player.accountId },
    matchCode: match.matchCode,
    action: 'attack'
  });

  assert.equal(
    atomicWrite.update.$set['players.$[player].selectionDraft'].action,
    'attack'
  );
  assert.equal(atomicWrite.update.$inc.__v, 1);
  assert.equal(atomicWrite.filter.gameId, match.gameId);
  assert.deepEqual(atomicWrite.options.arrayFilters, [
    { 'player.accountId': player.accountId }
  ]);
});

test('Clash deadline finalization is a no-op before the stored deadline', async () => {
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    phaseEndsAt: new Date(2000),
    round: 1,
    players: []
  };
  const result = await finalizeExpiredClashSelections({
    models: { OlingClashMatch: { findOne: async () => match } },
    matchCode: match.matchCode,
    now: () => 1999
  });
  assert.equal(result.finalized, false);
});

test('A raced manual selection cannot retry into the following Clash round', async () => {
  const accountId = new mongoose.Types.ObjectId();
  const createRoundMatch = (round, phaseEndsAt) => {
    const human = createPlayer('player-one', null);
    human.accountId = accountId;
    human.selection = null;
    const opponent = createPlayer('player-two', null);
    opponent.selection = null;
    return {
      _doc: { _id: new mongoose.Types.ObjectId() },
      gameId: 'OCL-SELECTION-RACE',
      matchCode: 'ABC-123',
      status: 'active',
      phase: 'selection',
      phaseEndsAt,
      round,
      ruleset: createRuleset(),
      statusDefinitions: [],
      players: [human, opponent],
      events: [],
      async save() {}
    };
  };
  const firstRound = createRoundMatch(1, new Date(2000));
  const secondRound = createRoundMatch(2, new Date(4000));
  firstRound.save = async () => {
    throw new mongoose.Error.VersionError(firstRound, 0, ['players']);
  };
  let loadCount = 0;
  const models = {
    OlingClashMatch: {
      findOne: async () => (loadCount++ === 0 ? firstRound : secondRound)
    }
  };

  await assert.rejects(
    commitClashSelection({
      models,
      account: { _id: accountId },
      matchCode: 'ABC-123',
      action: 'attack',
      now: () => 1000
    }),
    (error) => error.code === 'oling_clash_selection_stale'
  );
  assert.equal(secondRound.players[0].selection, null);
});

test('Manual Clash selections close at the authoritative server deadline', async () => {
  const human = createPlayer('player-one', null);
  human.selection = null;
  const match = {
    gameId: 'OCL-MANUAL-DEADLINE',
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    phaseEndsAt: new Date(1000),
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: [],
    players: [human],
    events: [],
    async save() {
      assert.fail('An expired manual selection must not be saved.');
    }
  };

  await assert.rejects(
    commitClashSelection({
      models: { OlingClashMatch: { findOne: async () => match } },
      account: { _id: human.accountId },
      matchCode: match.matchCode,
      action: 'attack',
      now: () => 1001
    }),
    (error) => error.code === 'oling_clash_selection_closed'
  );
});

test('A raced private draft cannot carry into the following Clash round', async () => {
  const accountId = new mongoose.Types.ObjectId();
  const createRoundMatch = (round, phaseEndsAt) => {
    const human = createPlayer('player-one', null);
    human.accountId = accountId;
    human.selection = null;
    return {
      _doc: { _id: new mongoose.Types.ObjectId() },
      gameId: 'OCL-DRAFT-RACE',
      matchCode: 'ABC-123',
      status: 'active',
      phase: 'selection',
      phaseEndsAt,
      round,
      ruleset: createRuleset(),
      statusDefinitions: [],
      players: [human],
      events: [],
      async save() {}
    };
  };
  const firstRound = createRoundMatch(1, new Date(2000));
  const secondRound = createRoundMatch(2, new Date(4000));
  firstRound.save = async () => {
    throw new mongoose.Error.VersionError(firstRound, 0, ['players']);
  };
  let loadCount = 0;

  await updateClashSelectionDraft({
    models: {
      OlingClashMatch: {
        findOne: async () => (loadCount++ === 0 ? firstRound : secondRound)
      }
    },
    account: { _id: accountId },
    matchCode: 'ABC-123',
    action: 'guard',
    now: () => 1000
  });

  assert.equal(secondRound.players[0].selectionDraft, undefined);
});

function createPlayer(slot, action, heartUnits = 6) {
  return {
    accountId: new mongoose.Types.ObjectId(),
    slot,
    connected: true,
    ready: true,
    activeTeamSlot: 0,
    statuses: [],
    selection: { round: 1, action, tagTeamSlot: null },
    team: [
      {
        teamSlot: 0,
        playerOlingId: new mongoose.Types.ObjectId(),
        heartUnits,
        maxHeartUnits: 6,
        shieldCount: 0,
        overgrowthUnits: 0,
        bloodUnits: 0,
        defeated: false,
        abilityProgress: [],
        snapshot: {
          abilities: [],
          build: {
            body: 'moss-body',
            eyes: 'moss-eyes',
            mouth: 'moss-mouth',
            flight: 'moss-wings'
          }
        }
      }
    ]
  };
}

function addMendTeam(player, benchHeartUnits = [4, 5]) {
  player.team[0].snapshot.abilities = [
    {
      key: 'moss-mend',
      revision: 1,
      layer: 'mouth',
      effects: [
        {
          order: 0,
          mechanic: 'heal',
          handler: 'heal_most_damaged_benched',
          target: {
            side: 'ally',
            location: 'bench',
            selector: 'most-damaged'
          },
          parameters: { amountUnits: 1, activationCount: 2 }
        }
      ]
    }
  ];
  benchHeartUnits.forEach((heartUnits, index) => {
    player.team.push({
      teamSlot: index + 1,
      playerOlingId: new mongoose.Types.ObjectId(),
      heartUnits,
      maxHeartUnits: 6,
      shieldCount: 0,
      overgrowthUnits: 0,
      bloodUnits: 0,
      defeated: heartUnits === 0,
      snapshot: { abilities: [], build: {} }
    });
  });
  return player;
}

function addWildGrowthTeam(player, benchHeartUnits = [6, 6]) {
  player.team[0].snapshot.abilities = [
    {
      key: 'moss-wild-growth',
      revision: 1,
      layer: 'flight',
      effects: [
        {
          order: 0,
          mechanic: 'grant-overgrowth',
          handler: 'grant_overgrowth_to_self_or_tag_recipient',
          parameters: { amountUnits: 1 }
        }
      ]
    }
  ];
  benchHeartUnits.forEach((heartUnits, index) => {
    player.team.push({
      teamSlot: index + 1,
      playerOlingId: new mongoose.Types.ObjectId(),
      heartUnits,
      maxHeartUnits: 6,
      shieldCount: 0,
      overgrowthUnits: 0,
      defeated: heartUnits === 0,
      snapshot: { abilities: [], build: {} }
    });
  });
  return player;
}

function addCanopyTeam(
  player,
  benchHeartUnits = [3, 5],
  benchShieldCounts = [0, 0]
) {
  player.team[0].snapshot.abilities = [
    {
      key: 'moss-canopy',
      revision: 2,
      layer: 'eyes',
      cadence: {
        every: 2,
        mode: 'cumulative',
        retainWhileBenched: true,
        consumeWhenPrevented: true
      },
      effects: [
        {
          order: 0,
          mechanic: 'grant-shield',
          handler: 'grant_shield_to_most_damaged_ally',
          parameters: { shieldCount: 1 }
        }
      ]
    }
  ];
  benchHeartUnits.forEach((heartUnits, index) => {
    player.team.push({
      teamSlot: index + 1,
      playerOlingId: new mongoose.Types.ObjectId(),
      heartUnits,
      maxHeartUnits: 6,
      shieldCount: benchShieldCounts[index] || 0,
      overgrowthUnits: 0,
      defeated: heartUnits === 0,
      snapshot: { abilities: [], build: {} }
    });
  });
  return player;
}

function addHardenAbility(player) {
  player.team[0].snapshot.abilities = [
    {
      key: 'stone-harden',
      revision: 2,
      layer: 'eyes',
      cadence: {
        every: 2,
        mode: 'cumulative',
        retainWhileBenched: true,
        consumeWhenPrevented: true
      },
      effects: [
        {
          order: 0,
          mechanic: 'grant-shield',
          handler: 'grant_shield',
          parameters: { shieldCount: 1 }
        }
      ]
    }
  ];
  return player;
}

function addBloodsuckTeam(player, benchHeartUnits = [6, 6]) {
  player.team[0].snapshot.abilities = [
    {
      key: 'vampire-bloodsuck',
      revision: 1,
      layer: 'mouth',
      cadence: {
        every: 2,
        mode: 'cumulative',
        retainWhileBenched: true,
        consumeWhenPrevented: true
      },
      effects: [
        {
          order: 0,
          mechanic: 'heal',
          handler: 'heal_every_nth_activation',
          parameters: { amountUnits: 1 }
        }
      ]
    }
  ];
  player.team[0].abilityProgress = [];
  benchHeartUnits.forEach((heartUnits, index) => {
    player.team.push({
      teamSlot: index + 1,
      playerOlingId: new mongoose.Types.ObjectId(),
      heartUnits,
      maxHeartUnits: 6,
      shieldCount: 0,
      overgrowthUnits: 0,
      bloodUnits: 0,
      defeated: heartUnits === 0,
      abilityProgress: [],
      snapshot: { abilities: [], build: {} }
    });
  });
  return player;
}

function addBloodBankAbility(player) {
  player.team[0].snapshot.abilities = [
    {
      key: 'vampire-blood-bank',
      revision: 1,
      layer: 'body',
      effects: [
        {
          order: 0,
          mechanic: 'store-resource',
          handler: 'store_and_convert_resource',
          parameters: {
            resource: 'blood',
            amountUnits: 1,
            conversionThresholdUnits: 2,
            convertedHeartUnits: 2
          }
        }
      ]
    }
  ];
  player.team[0].bloodUnits = 0;
  return player;
}

function addEruptionAbility(player, teamSlot = 0) {
  const oling = player.team.find(
    (candidate) => candidate.teamSlot === teamSlot
  );
  oling.snapshot.abilities = [
    ...(oling.snapshot.abilities || []).filter(
      (ability) => ability.layer !== 'mouth'
    ),
    {
      key: 'magma-eruption',
      revision: 1,
      layer: 'mouth',
      effects: [
        {
          order: 0,
          mechanic: 'damage',
          handler: 'damage_after_repeated_decisive_action',
          target: { side: 'opponent', location: 'active' },
          parameters: {
            amountUnits: 1,
            damageType: 'normal',
            damageSource: 'bonus',
            action: 'attack'
          }
        }
      ]
    }
  ];
  if (!Array.isArray(oling.abilityProgress)) oling.abilityProgress = [];
  return player;
}

function addRetaliateAbility(player, teamSlot = 0) {
  const oling = player.team.find(
    (candidate) => candidate.teamSlot === teamSlot
  );
  oling.snapshot.abilities = [
    ...(oling.snapshot.abilities || []).filter(
      (ability) => ability.layer !== 'body'
    ),
    {
      key: 'magma-retaliate',
      revision: 1,
      layer: 'body',
      effects: [
        {
          order: 0,
          mechanic: 'mark',
          handler: 'prime_status_on_next_action_win',
          parameters: {
            primeStatusKey: 'burn-primed',
            statusKey: 'burn',
            action: 'attack',
            durationType: 'activation'
          }
        }
      ]
    }
  ];
  return player;
}

function addIgniteAbility(player, teamSlot = 0) {
  const oling = player.team.find(
    (candidate) => candidate.teamSlot === teamSlot
  );
  oling.snapshot.abilities = [
    ...(oling.snapshot.abilities || []).filter(
      (ability) => ability.layer !== 'eyes'
    ),
    {
      key: 'magma-ignite',
      revision: 1,
      layer: 'eyes',
      effects: [
        {
          order: 0,
          mechanic: 'mark',
          handler: 'prime_status_on_next_decisive_action_win',
          parameters: {
            statusKey: 'burn',
            action: 'attack',
            durationType: 'clash'
          }
        }
      ]
    }
  ];
  return player;
}

function addCrushAbility(player, teamSlot = 0) {
  const oling = player.team.find(
    (candidate) => candidate.teamSlot === teamSlot
  );
  oling.snapshot.abilities = [
    ...(oling.snapshot.abilities || []).filter(
      (ability) => ability.layer !== 'mouth'
    ),
    {
      key: 'stone-crush',
      revision: 1,
      layer: 'mouth',
      cadence: {
        every: 2,
        mode: 'cumulative',
        retainWhileBenched: true,
        consumeWhenPrevented: true
      },
      effects: [
        {
          order: 0,
          mechanic: 'damage',
          handler: 'damage_every_nth_activation',
          target: { side: 'opponent', location: 'active' },
          parameters: {
            amountUnits: 1,
            damageType: 'normal',
            damageSource: 'bonus',
            activationCount: 2
          }
        }
      ]
    }
  ];
  return player;
}

function addFortifyAbility(player, teamSlot = 0) {
  const oling = player.team.find(
    (candidate) => candidate.teamSlot === teamSlot
  );
  oling.snapshot.abilities = [
    ...(oling.snapshot.abilities || []).filter(
      (ability) => ability.layer !== 'body'
    ),
    {
      key: 'stone-fortify',
      revision: 1,
      layer: 'body',
      effects: [
        {
          order: 0,
          mechanic: 'ward',
          handler: 'ward_effect_category',
          parameters: {
            statusKey: 'warded',
            category: 'bonus-damage',
            durationType: 'until-consumed'
          }
        }
      ]
    }
  ];
  return player;
}

function addReinforceAbility(player, teamSlot = 0) {
  const oling = player.team.find(
    (candidate) => candidate.teamSlot === teamSlot
  );
  oling.snapshot.abilities = [
    ...(oling.snapshot.abilities || []).filter(
      (ability) => ability.layer !== 'flight'
    ),
    {
      key: 'stone-reinforce',
      revision: 1,
      layer: 'flight',
      effects: [
        {
          order: 0,
          mechanic: 'ward',
          handler: 'ward_chosen_part',
          target: { side: 'ally', location: 'self', part: 'chosen' },
          parameters: {
            statusKey: 'warded',
            category: 'part-disable',
            durationType: 'until-consumed'
          }
        }
      ]
    }
  ];
  return player;
}

function addScorchAbility(player, teamSlot = 0) {
  const oling = player.team.find(
    (candidate) => candidate.teamSlot === teamSlot
  );
  oling.snapshot.abilities = [
    ...(oling.snapshot.abilities || []).filter(
      (ability) => ability.layer !== 'flight'
    ),
    {
      key: 'magma-scorch',
      revision: 1,
      layer: 'flight',
      effects: [
        {
          order: 0,
          mechanic: 'suppress',
          handler: 'suppress_part',
          target: {
            side: 'opponent',
            location: 'active',
            part: 'mouth'
          },
          parameters: {
            statusKey: 'suppressed',
            durationType: 'activation'
          }
        }
      ]
    }
  ];
  return player;
}

function addScavengeAbility(player, teamSlot = 0) {
  const oling = player.team.find(
    (candidate) => candidate.teamSlot === teamSlot
  );
  oling.snapshot.abilities = [
    ...(oling.snapshot.abilities || []).filter(
      (ability) => ability.layer !== 'mouth'
    ),
    {
      key: 'trash-scavenge',
      revision: 1,
      layer: 'mouth',
      effects: [
        {
          order: 0,
          mechanic: 'mark',
          handler: 'mark_part_for_positive_effect_steal',
          target: {
            side: 'opponent',
            location: 'active',
            part: 'last-used'
          },
          parameters: {
            statusKey: 'marked',
            durationType: 'round',
            duration: 1
          }
        }
      ]
    }
  ];
  return player;
}

function addReturnToSenderAbility(player, teamSlot = 0) {
  const oling = player.team.find(
    (candidate) => candidate.teamSlot === teamSlot
  );
  oling.snapshot.abilities = [
    ...(oling.snapshot.abilities || []).filter(
      (ability) => ability.layer !== 'body'
    ),
    {
      key: 'trash-return-to-sender',
      revision: 1,
      layer: 'body',
      effects: [
        {
          order: 0,
          mechanic: 'reflect',
          handler: 'reflect_opponent_mouth_effect',
          target: { side: 'opponent', scope: 'mouth-effect' },
          parameters: { maximumRedirects: 1 }
        }
      ]
    }
  ];
  return player;
}

function addJunkyardAbility(player, teamSlot = 0) {
  const oling = player.team.find(
    (candidate) => candidate.teamSlot === teamSlot
  );
  oling.snapshot.abilities = [
    ...(oling.snapshot.abilities || []).filter(
      (ability) => ability.layer !== 'flight'
    ),
    {
      key: 'trash-junkyard',
      revision: 1,
      layer: 'flight',
      effects: [
        {
          order: 0,
          mechanic: 'block',
          handler: 'replace_next_activation_with_junk',
          target: { side: 'opponent', scope: 'next-part-activation' },
          parameters: {
            statusKey: 'junk',
            category: 'part-activation',
            durationType: 'activation'
          }
        }
      ]
    }
  ];
  return player;
}

function addSalvageAbility(player, teamSlot = 0) {
  const oling = player.team.find(
    (candidate) => candidate.teamSlot === teamSlot
  );
  oling.snapshot.abilities = [
    ...(oling.snapshot.abilities || []).filter(
      (ability) => ability.layer !== 'eyes'
    ),
    {
      key: 'trash-salvage',
      revision: 1,
      layer: 'eyes',
      effects: [
        {
          order: 0,
          mechanic: 'restore',
          handler: 'restore_most_recent_positive_status',
          target: { side: 'ally', location: 'self' },
          parameters: {
            selector: 'most-recent',
            eligibility: 'temporary-positive-status'
          }
        }
      ]
    }
  ];
  return player;
}

function addFractureAbility(player) {
  player.team[0].snapshot.abilities = [
    ...(player.team[0].snapshot.abilities || []).filter(
      (ability) => ability.layer !== 'mouth'
    ),
    {
      key: 'bone-fracture',
      revision: 1,
      layer: 'mouth',
      effects: [
        {
          order: 0,
          mechanic: 'suppress',
          handler: 'suppress_part',
          target: {
            side: 'opponent',
            location: 'active',
            part: 'body'
          },
          parameters: {
            statusKey: 'suppressed',
            durationType: 'activation'
          }
        }
      ]
    }
  ];
  return player;
}

function addSplinterAbility(player) {
  player.team[0].snapshot.abilities = [
    ...(player.team[0].snapshot.abilities || []).filter(
      (ability) => ability.layer !== 'body'
    ),
    {
      key: 'bone-splinter',
      revision: 1,
      layer: 'body',
      effects: [
        {
          order: 0,
          mechanic: 'suppress',
          handler: 'suppress_random_part_until_different_action_win',
          target: {
            side: 'opponent',
            location: 'active',
            part: 'random'
          },
          parameters: {
            statusKey: 'suppressed',
            durationType: 'activation'
          }
        }
      ]
    }
  ];
  return player;
}

function addWitherAbility(player) {
  player.team[0].snapshot.abilities = [
    ...(player.team[0].snapshot.abilities || []).filter(
      (ability) => ability.layer !== 'flight'
    ),
    {
      key: 'bone-wither',
      revision: 1,
      layer: 'flight',
      effects: [
        {
          order: 0,
          mechanic: 'block',
          handler: 'block_effect_category',
          target: { side: 'opponent', scope: 'player' },
          parameters: {
            statusKey: 'blocked',
            category: 'positive-status',
            durationType: 'round',
            duration: 1
          }
        }
      ]
    }
  ];
  return player;
}

function addReadAbility(player) {
  player.team[0].snapshot.abilities = [
    ...(player.team[0].snapshot.abilities || []).filter(
      (ability) => ability.layer !== 'eyes'
    ),
    {
      key: 'bone-read',
      revision: 1,
      layer: 'eyes',
      effects: [
        {
          order: 0,
          mechanic: 'mark',
          handler: 'mark_repeated_action_for_suppression',
          target: { side: 'opponent', scope: 'action' },
          parameters: {
            statusKey: 'marked',
            suppressionStatusKey: 'suppressed',
            durationType: 'round',
            duration: 1,
            suppressedPart: 'random'
          }
        }
      ]
    }
  ];
  return player;
}

function addTransfusionTeam(player, benchHeartUnits = [3, 6]) {
  player.team[0].snapshot.abilities = [
    {
      key: 'vampire-transfusion',
      revision: 1,
      layer: 'flight',
      effects: [
        {
          order: 0,
          mechanic: 'transfer',
          handler: 'transfer_hearts_between_self_and_bench',
          parameters: {
            resource: 'hearts',
            amountUnits: 1,
            direction: 'chosen'
          }
        }
      ]
    }
  ];
  benchHeartUnits.forEach((heartUnits, index) => {
    player.team.push({
      teamSlot: index + 1,
      playerOlingId: new mongoose.Types.ObjectId(),
      heartUnits,
      maxHeartUnits: 6,
      shieldCount: 0,
      overgrowthUnits: 0,
      bloodUnits: 0,
      defeated: heartUnits === 0,
      abilityProgress: [],
      snapshot: { abilities: [], build: {} }
    });
  });
  return player;
}

function addReclaimAbility(player) {
  player.team[0].snapshot.abilities = [
    ...(player.team[0].snapshot.abilities || []).filter(
      (ability) => ability.layer !== 'eyes'
    ),
    {
      key: 'vampire-reclaim',
      revision: 1,
      layer: 'eyes',
      effects: [
        {
          order: 0,
          mechanic: 'store-resource',
          handler: 'reclaim_draw_damage_as_blood',
          parameters: {
            resource: 'blood',
            maximumUnits: 1,
            recoveryTrigger: 'next-decisive-win',
            lossTrigger: 'next-decisive-loss'
          }
        }
      ]
    }
  ];
  player.team[0].pendingReclaimUnits = 0;
  return player;
}

function createStatusInstance(key, revision = 1, targetPart = null) {
  return {
    key,
    revision,
    sourcePlayerSlot: 'player-two',
    sourceTeamSlot: 0,
    targetPart,
    stacks: 1,
    appliedRound: 1,
    durationType: 'until-consumed',
    data: {}
  };
}

function createCleanseStatusDefinitions() {
  return [
    {
      key: 'burn',
      revision: 1,
      snapshot: {
        key: 'burn',
        revision: 1,
        name: 'Burn',
        polarity: 'negative',
        handler: 'damage_after_decisive_clash',
        parameters: {
          damageUnits: 1,
          damageType: 'normal',
          damageSource: 'burn'
        }
      }
    },
    {
      key: 'burn-primed',
      revision: 1,
      snapshot: {
        key: 'burn-primed',
        revision: 1,
        name: 'Burn Primed',
        polarity: 'positive',
        handler: 'apply_status_on_matching_action_win'
      }
    },
    {
      key: 'blocked',
      revision: 1,
      snapshot: {
        key: 'blocked',
        revision: 1,
        name: 'Blocked',
        polarity: 'negative',
        handler: 'block_effect_category'
      }
    },
    {
      key: 'suppressed',
      revision: 1,
      snapshot: {
        key: 'suppressed',
        revision: 1,
        name: 'Suppressed',
        polarity: 'negative',
        handler: 'prevent_next_valid_activation'
      }
    },
    {
      key: 'warded',
      revision: 1,
      snapshot: {
        key: 'warded',
        revision: 1,
        name: 'Warded',
        polarity: 'positive',
        handler: 'prevent_matching_effect'
      }
    },
    {
      key: 'marked',
      revision: 1,
      snapshot: {
        key: 'marked',
        revision: 1,
        name: 'Marked',
        polarity: 'variable',
        handler: 'record_reference'
      }
    },
    {
      key: 'junk',
      revision: 1,
      snapshot: {
        key: 'junk',
        revision: 1,
        name: 'Junk',
        polarity: 'negative',
        handler: 'replace_next_valid_activation_with_junk'
      }
    }
  ];
}

function addCleanseTeam(player, teamStatuses = [[], [], []]) {
  player.team[0].snapshot.abilities = [
    {
      key: 'moss-cleanse',
      revision: 1,
      layer: 'body',
      effects: [
        {
          order: 0,
          mechanic: 'cleanse',
          handler: 'cleanse_status',
          parameters: { count: 1, polarity: 'negative' }
        }
      ]
    }
  ];
  player.team[0].statuses = teamStatuses[0] || [];
  [1, 2].forEach((teamSlot) => {
    player.team.push({
      teamSlot,
      playerOlingId: new mongoose.Types.ObjectId(),
      heartUnits: 6,
      maxHeartUnits: 6,
      shieldCount: 0,
      overgrowthUnits: 0,
      bloodUnits: 0,
      defeated: false,
      abilityProgress: [],
      statuses: teamStatuses[teamSlot] || [],
      snapshot: { abilities: [], build: {} }
    });
  });
  return player;
}

function createAiCatalogModels() {
  const triggers = {
    body: 'guard_win',
    eyes: 'draw_survived',
    mouth: 'attack_win',
    flight: 'skill_win'
  };
  const abilities = ['body', 'eyes', 'mouth', 'flight'].flatMap((layer) =>
    Array.from({ length: 3 }, (_, index) => ({
      key: `${layer}-ability-${index}`,
      revision: 1,
      traitKey: `${layer}-trait-${index}`,
      layer,
      trigger: triggers[layer],
      name: `${layer} ability ${index}`,
      effects: [],
      roleTags: [],
      isCurrent: true,
      enabled: true,
      status: 'published'
    }))
  );
  const traits = abilities.map((ability) => ({
    key: ability.traitKey,
    name: ability.traitKey,
    layer: ability.layer,
    assets: { image: `/${ability.traitKey}.svg` }
  }));
  return {
    OlingClashAbility: {
      find() {
        return {
          sort() {
            return this;
          },
          async lean() {
            return abilities;
          }
        };
      }
    },
    OlingTrait: {
      find() {
        return { lean: async () => traits };
      }
    }
  };
}

test('Clash views keep opponent selections private', () => {
  const players = [
    createPlayer('player-one', 'attack'),
    createPlayer('player-two', 'skill')
  ];
  players[0].selection.effectChoice = {
    abilityKey: 'vampire-transfusion',
    targetTeamSlot: 1,
    optionKey: 'self-to-bench'
  };
  players[1].statuses = [
    {
      ...createStatusInstance('blocked'),
      expiresAfterRound: 2,
      durationType: 'round',
      data: { activeFromRound: 2, category: 'positive-status' }
    }
  ];
  const match = {
    _id: new mongoose.Types.ObjectId(),
    gameId: 'OCL-0123456789ABCDEF0123456789ABCDEF',
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    players,
    events: []
  };

  const privateView = serializeClashMatch(match, players[0].accountId);
  const publicView = serializeClashMatch(match);
  assert.equal(privateView.players[0].selection.action, 'attack');
  assert.equal(
    privateView.players[0].selection.effectChoice.optionKey,
    'self-to-bench'
  );
  assert.equal(privateView.players[1].selection, null);
  assert.equal(publicView.players[0].selection, null);
  assert.equal(publicView.players[1].selection, null);
  assert.equal(publicView.players[1].selectionCommitted, true);
  assert.equal(publicView.players[1].statuses[0].key, 'blocked');
});

test('Live Clash views replace event history with compact result summaries', () => {
  const players = [
    createPlayer('player-one', null),
    createPlayer('player-two', null)
  ];
  players[0].team.push({ ...players[0].team[0], teamSlot: 1 });
  players[0].activeTeamSlot = 1;
  const events = [
    {
      round: 1,
      type: 'round-resolved',
      visibility: 'public',
      payload: {
        actions: { 'player-one': 'attack', 'player-two': 'guard' },
        activations: [],
        effects: [],
        outcome: 'decisive',
        round: 1,
        tags: [],
        triggeredStatuses: [],
        winnerSlot: 'player-one'
      }
    },
    {
      round: 2,
      type: 'round-resolved',
      visibility: 'public',
      payload: {
        actions: { 'player-one': 'guard', 'player-two': 'skill' },
        activations: [],
        effects: [],
        outcome: 'decisive',
        round: 2,
        tags: [
          {
            incomingTeamSlot: 1,
            playerSlot: 'player-one',
            previousTeamSlot: 0
          }
        ],
        triggeredStatuses: [],
        winnerSlot: 'player-one'
      }
    },
    {
      round: 3,
      type: 'round-resolved',
      visibility: 'public',
      payload: {
        actions: { 'player-one': 'skill', 'player-two': 'skill' },
        activations: [],
        effects: [],
        outcome: 'draw',
        round: 3,
        tags: [],
        triggeredStatuses: [],
        winnerSlot: null
      }
    }
  ];
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 4,
    ruleset: createRuleset(),
    players,
    events
  };

  const liveView = serializeLiveClashMatch(match, players[0].accountId);

  assert.equal(Object.hasOwn(liveView, 'events'), false);
  assert.equal(liveView.latestRoundResult.round, 3);
  assert.deepEqual(
    liveView.players[0].lastMoves.map((move) => ({
      action: move.action,
      outcome: move.outcome,
      round: move.round,
      teamSlot: move.teamSlot
    })),
    [
      { action: 'draw', outcome: 'draw', round: 3, teamSlot: 1 },
      { action: 'guard', outcome: 'win', round: 2, teamSlot: 0 }
    ]
  );
});

test('Live Clash views use persisted summaries without reading event history', () => {
  const player = createPlayer('player-one', null);
  player.lastMoves = [
    {
      teamSlot: 0,
      action: 'attack',
      activationStatus: 'activated',
      outcome: 'win',
      round: 8
    }
  ];
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 9,
    stateRevision: 12,
    derivedStateVersion: 1,
    latestRoundResult: { round: 8, outcome: 'decisive' },
    ruleset: createRuleset(),
    players: [player]
  };
  Object.defineProperty(match, 'events', {
    get() {
      throw new Error('Live serialization read the embedded event log.');
    }
  });

  const liveView = serializeLiveClashMatch(match, player.accountId);

  assert.equal(liveView.revision, 12);
  assert.equal(liveView.latestRoundResult.round, 8);
  assert.equal(liveView.players[0].lastMoves[0].round, 8);
});

test('Clash eligibility requires at least three owned Olings', async () => {
  const account = { _id: new mongoose.Types.ObjectId() };
  await assert.rejects(
    assertClashPlayerEligible(
      {
        PlayerOling: { countDocuments: async () => 2 }
      },
      account
    ),
    (error) => {
      assert.equal(error.code, 'oling_clash_three_olings_required');
      assert.deepEqual(error.details, {
        ownedOlingCount: 2,
        requiredOlingCount: 3
      });
      return true;
    }
  );
  assert.equal(
    await assertClashPlayerEligible(
      {
        PlayerOling: { countDocuments: async () => 3 }
      },
      account
    ),
    3
  );
});

test('Clash content keeps status identity inside immutable snapshots', async () => {
  const ruleset = {
    key: 'standard',
    revision: 2,
    isCurrent: true,
    status: 'published',
    name: 'Standard Clash'
  };
  const burn = {
    key: 'burn',
    revision: 3,
    isCurrent: true,
    enabled: true,
    status: 'published',
    name: 'Burn',
    polarity: 'negative',
    handler: 'damage_after_decisive_clash'
  };
  const statusQuery = {
    sort() {
      return this;
    },
    async lean() {
      return [burn];
    }
  };
  const content = await getCurrentClashContent({
    OlingClashRuleset: {
      findOne() {
        return { lean: async () => ruleset };
      }
    },
    OlingClashStatus: {
      find() {
        return statusQuery;
      }
    }
  });

  assert.equal(content.statusDefinitions[0].key, 'burn');
  assert.equal(content.statusDefinitions[0].revision, 3);
  assert.equal(content.statusDefinitions[0].snapshot.key, 'burn');
  assert.equal(content.statusDefinitions[0].snapshot.revision, 3);
  assert.equal(content.statusDefinitions[0].snapshot.enabled, undefined);
});

test('Clash AI players receive a synthetic identity and three complete Olings', async () => {
  const player = await createAiClashPlayer(
    createAiCatalogModels(),
    'player-two',
    createRuleset(),
    0.7,
    { random: () => 0.25 }
  );

  assert.equal(player.isAi, true);
  assert.equal(player.ready, true);
  assert.equal(player.aiDifficulty, 0.7);
  assert.equal(player.oeIcon, 'A003:A103:A203:A303');
  assert.equal(player.team.length, 3);
  assert.equal(
    new Set(player.team.map((oling) => oling.playerOlingId)).size,
    3
  );
  assert.equal(
    player.team.every(
      (oling) =>
        Object.keys(oling.snapshot.build).length === 4 &&
        oling.snapshot.abilities.length === 4
    ),
    true
  );
});

test('Clash AI builds a random OE from each published customisation slot', async () => {
  let customisationQuery = null;
  const randomValues = [0, 0.99, 0.5, 0.25];
  const oeIcon = await createRandomAiOeIcon(
    {
      OeCustomisation: {
        find(query) {
          customisationQuery = query;
          return {
            async lean() {
              return [
                { oeId: 'C000', slot: 'colour' },
                { oeId: 'C001', slot: 'colour' },
                { oeId: 'H000', slot: 'head-slot' },
                { oeId: 'H001', slot: 'head-slot' },
                { oeId: 'E000', slot: 'eyes-slot' },
                { oeId: 'E001', slot: 'eyes-slot' },
                { oeId: 'M000', slot: 'mouth-slot' },
                { oeId: 'M001', slot: 'mouth-slot' }
              ];
            }
          };
        }
      }
    },
    { random: () => randomValues.shift() }
  );

  assert.equal(oeIcon, 'C000:H001:E001:M000');
  assert.deepEqual(customisationQuery, {
    recordType: 'image',
    slot: { $in: ['colour', 'head-slot', 'eyes-slot', 'mouth-slot'] },
    oeId: { $nin: ['0000', '0100', '0200', '0300'] },
    enabled: true,
    status: 'published',
    blacklist: { $ne: true }
  });
});

test('Only the Clash creator can add an AI to an empty lobby slot', async () => {
  const account = { _id: new mongoose.Types.ObjectId() };
  const creator = {
    accountId: account._id,
    slot: 'player-one',
    ready: false,
    isAi: false
  };
  const match = {
    matchCode: 'ABC-123',
    status: 'waiting',
    phase: 'waiting',
    round: 0,
    ruleset: createRuleset(),
    players: [creator],
    events: [],
    async save() {}
  };
  const models = {
    ...createAiCatalogModels(),
    OlingClashMatch: { findOne: async () => match }
  };

  await addAiClashOpponent({
    models,
    account,
    matchCode: 'ABC-123',
    random: () => 0.25
  });
  assert.equal(match.players.length, 2);
  assert.equal(match.players[1].isAi, true);
  assert.equal(match.players[1].team.length, 3);
  assert.equal(match.events[0].type, 'ai-joined');
});

test('Non-creator Clash players cannot add an AI opponent', async () => {
  const account = { _id: new mongoose.Types.ObjectId() };
  const match = {
    status: 'waiting',
    players: [
      {
        accountId: account._id,
        slot: 'player-two',
        isAi: false
      }
    ]
  };
  await assert.rejects(
    addAiClashOpponent({
      models: {
        OlingClashMatch: { findOne: async () => match }
      },
      account,
      matchCode: 'ABC-123'
    }),
    (error) => error.code === 'oling_clash_creator_required'
  );
});

test('Clash creators can change AI difficulty before the match starts', async () => {
  const account = { _id: new mongoose.Types.ObjectId() };
  const aiPlayer = {
    accountId: new mongoose.Types.ObjectId(),
    slot: 'player-two',
    isAi: true,
    aiDifficulty: 0.45
  };
  const match = {
    matchCode: 'ABC-123',
    status: 'ready',
    players: [
      {
        accountId: account._id,
        slot: 'player-one',
        isAi: false
      },
      aiPlayer
    ],
    events: [],
    async save() {}
  };

  await updateAiClashOpponentDifficulty({
    models: { OlingClashMatch: { findOne: async () => match } },
    account,
    matchCode: 'ABC-123',
    difficulty: 0.75
  });

  assert.equal(aiPlayer.aiDifficulty, 0.75);
  assert.equal(match.events.at(-1).type, 'ai-difficulty-changed');
});

test('The host can start once the opponent is ready without readying themself', async () => {
  const host = {
    accountId: new mongoose.Types.ObjectId(),
    slot: 'player-one',
    isAi: false,
    ready: false,
    team: [{}, {}, {}]
  };
  const guest = {
    accountId: new mongoose.Types.ObjectId(),
    slot: 'player-two',
    isAi: false,
    ready: true,
    team: [{}, {}, {}]
  };
  const match = {
    matchCode: 'ABC-123',
    status: 'ready',
    phase: 'waiting',
    round: 0,
    players: [host, guest],
    events: [],
    async save() {}
  };

  assert.equal(isClashReadyToStart(match), true);
  await startClashMatch({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: host.accountId },
    matchCode: match.matchCode
  });

  assert.equal(match.status, 'active');
  assert.equal(match.phase, 'starting');
  assert.equal(match.round, 0);
  assert.equal(match.phaseEndsAt, null);
  assert.equal(host.gameLoaded, false);
  assert.equal(guest.gameLoaded, false);

  const models = { OlingClashMatch: { findOne: async () => match } };
  await markClashPlayerLoaded({
    models,
    account: { _id: host.accountId },
    matchCode: match.matchCode
  });
  assert.equal(match.phase, 'starting');
  assert.equal(match.phaseEndsAt, null);

  await markClashPlayerLoaded({
    models,
    account: { _id: guest.accountId },
    matchCode: match.matchCode
  });
  assert.equal(match.phase, 'selection');
  assert.equal(match.round, 1);
  assert.equal(match.phaseEndsAt instanceof Date, true);
  assert.ok(match.phaseEndsAt.getTime() - Date.now() <= 15000);
  assert.ok(match.phaseEndsAt.getTime() - Date.now() > 14000);

  const originalDeadline = match.phaseEndsAt;
  await markClashPlayerLoaded({
    models,
    account: { _id: host.accountId },
    matchCode: match.matchCode
  });
  assert.equal(match.phaseEndsAt, originalDeadline);
});

test('A ready guest cannot start the host Clash', async () => {
  const host = {
    accountId: new mongoose.Types.ObjectId(),
    slot: 'player-one',
    ready: false,
    team: [{}, {}, {}]
  };
  const guest = {
    accountId: new mongoose.Types.ObjectId(),
    slot: 'player-two',
    ready: true,
    team: [{}, {}, {}]
  };
  const match = {
    matchCode: 'ABC-123',
    status: 'ready',
    phase: 'waiting',
    players: [host, guest]
  };

  await assert.rejects(
    startClashMatch({
      models: { OlingClashMatch: { findOne: async () => match } },
      account: { _id: guest.accountId },
      matchCode: match.matchCode
    }),
    (error) => error.code === 'oling_clash_host_required'
  );
});

test('A human Clash rematch starts only after both players accept', async () => {
  const host = {
    accountId: new mongoose.Types.ObjectId(),
    slot: 'player-one',
    isAi: false,
    rematchAccepted: false,
    team: [{}, {}, {}]
  };
  const guest = {
    accountId: new mongoose.Types.ObjectId(),
    slot: 'player-two',
    isAi: false,
    rematchAccepted: false,
    team: [{}, {}, {}]
  };
  const match = {
    matchCode: 'ABC-123',
    status: 'waiting',
    phase: 'waiting',
    round: 0,
    players: [host, guest],
    events: [],
    async save() {}
  };
  const models = { OlingClashMatch: { findOne: async () => match } };

  await requestClashRematch({
    models,
    account: { _id: host.accountId },
    matchCode: match.matchCode
  });
  assert.equal(match.status, 'waiting');
  assert.equal(host.rematchAccepted, true);
  assert.equal(guest.rematchAccepted, false);

  await requestClashRematch({
    models,
    account: { _id: guest.accountId },
    matchCode: match.matchCode,
    accepted: false
  });
  assert.equal(host.rematchAccepted, false);
  assert.equal(guest.rematchAccepted, false);

  await requestClashRematch({
    models,
    account: { _id: host.accountId },
    matchCode: match.matchCode
  });

  await requestClashRematch({
    models,
    account: { _id: guest.accountId },
    matchCode: match.matchCode
  });
  assert.equal(match.status, 'active');
  assert.equal(match.phase, 'starting');
  assert.equal(match.round, 0);
  assert.equal(match.phaseEndsAt, null);
  assert.equal(match.events.at(-1).payload.rematch, true);
});

test('An AI accepts a Clash rematch immediately', async () => {
  const host = {
    accountId: new mongoose.Types.ObjectId(),
    slot: 'player-one',
    isAi: false,
    rematchAccepted: false,
    team: [{}, {}, {}]
  };
  const ai = {
    accountId: new mongoose.Types.ObjectId(),
    slot: 'player-two',
    isAi: true,
    rematchAccepted: true,
    team: [{}, {}, {}]
  };
  const match = {
    matchCode: 'ABC-123',
    status: 'waiting',
    phase: 'waiting',
    round: 0,
    players: [host, ai],
    events: [],
    async save() {}
  };

  await requestClashRematch({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: host.accountId },
    matchCode: match.matchCode
  });

  assert.equal(match.status, 'active');
  assert.equal(match.phase, 'starting');
  assert.equal(match.round, 0);
  assert.equal(match.phaseEndsAt, null);
  assert.equal(host.gameLoaded, false);
  assert.equal(ai.gameLoaded, true);

  await markClashPlayerLoaded({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: host.accountId },
    matchCode: match.matchCode
  });
  assert.equal(match.phase, 'selection');
  assert.equal(match.round, 1);
  assert.equal(match.phaseEndsAt instanceof Date, true);
});

test('Clash AI choices ignore the human current hidden selection', () => {
  const human = createPlayer('player-one', 'skill');
  const ai = {
    ...createPlayer('player-two', null),
    isAi: true,
    aiDifficulty: 1
  };
  ai.selection = null;
  const match = {
    ruleset: createRuleset(),
    players: [human, ai],
    events: [
      {
        type: 'round-resolved',
        payload: { actions: { 'player-one': 'attack' } }
      }
    ]
  };

  const first = chooseAiClashSelection(match, ai, { random: () => 0 });
  human.selection.action = 'guard';
  const second = chooseAiClashSelection(match, ai, { random: () => 0 });
  assert.equal(first.action, 'guard');
  assert.deepEqual(second, first);
});

test('Clash AI cannot queue a voluntary Tag without a charge', () => {
  const human = addMendTeam(createPlayer('player-one', 'attack'));
  const ai = addMendTeam(createPlayer('player-two', 'skill', 1));
  ai.isAi = true;
  ai.aiDifficulty = 1;
  ai.tagCharges = 0;
  const match = {
    ruleset: createRuleset(),
    players: [human, ai],
    events: []
  };

  const selection = chooseAiClashSelection(match, ai, { random: () => 0 });

  assert.equal(selection.tagTeamSlot, null);
});

test('Clash timeouts confirm an available highlighted action', async () => {
  const human = createPlayer('player-one', null);
  const opponent = createPlayer('player-two', null);
  human.selection = null;
  opponent.selection = null;
  const match = {
    gameId: 'OCL-TIMEOUT-PREFERRED',
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    phaseEndsAt: new Date(1000),
    round: 1,
    ruleset: createRuleset(),
    players: [human, opponent],
    events: [],
    async save() {}
  };

  await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: match.matchCode,
    expectedGameId: match.gameId,
    expectedPhaseEndsAt: match.phaseEndsAt,
    expectedRound: match.round,
    preferredAction: 'skill',
    timedOut: true,
    now: () => 1001,
    random: () => 0
  });

  assert.equal(human.selection.action, 'skill');
});

test('Clash timeouts randomly select only from available actions', async () => {
  const human = createPlayer('player-one', null);
  const opponent = createPlayer('player-two', null);
  human.selection = null;
  opponent.selection = null;
  human.team[0].statuses = [
    { key: 'action-block', revision: 1, targetPart: 'mouth', data: {} }
  ];
  const match = {
    gameId: 'OCL-TIMEOUT-AVAILABLE',
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    phaseEndsAt: new Date(1000),
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: [
      {
        key: 'action-block',
        revision: 1,
        snapshot: { parameters: { preventsAction: true } }
      }
    ],
    players: [human, opponent],
    events: [],
    async save() {}
  };

  assert.deepEqual(getAvailableClashActions(match, human), ['guard', 'skill']);
  await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: match.matchCode,
    expectedGameId: match.gameId,
    expectedPhaseEndsAt: match.phaseEndsAt,
    expectedRound: match.round,
    preferredAction: 'attack',
    timedOut: true,
    now: () => 1001,
    random: () => 0
  });

  assert.equal(human.selection.action, 'guard');
});

test('Clash players cannot manually commit an action blocked by an effect', async () => {
  const human = createPlayer('player-one', null);
  human.selection = null;
  human.team[0].statuses = [
    { key: 'action-block', revision: 1, targetAction: 'guard', data: {} }
  ];
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: [
      {
        key: 'action-block',
        revision: 1,
        snapshot: { parameters: { preventsAction: true } }
      }
    ],
    players: [human, createPlayer('player-two', null)],
    events: [],
    async save() {}
  };

  await assert.rejects(
    commitClashSelection({
      models: { OlingClashMatch: { findOne: async () => match } },
      account: { _id: human.accountId },
      matchCode: match.matchCode,
      action: 'guard'
    }),
    (error) => error.code === 'oling_clash_action_blocked'
  );
});

test('Clash timeouts generate a valid required effect choice', async () => {
  const human = createPlayer('player-one', null);
  const opponent = createPlayer('player-two', null);
  human.selection = null;
  opponent.selection = null;
  human.team[0].snapshot.abilities = [
    {
      key: 'stone-reinforce',
      layer: 'flight',
      effects: [{ handler: 'ward_chosen_part', parameters: {} }]
    }
  ];
  const match = {
    gameId: 'OCL-TIMEOUT-CHOICE',
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    phaseEndsAt: new Date(1000),
    round: 1,
    ruleset: createRuleset(),
    players: [human, opponent],
    events: [],
    async save() {}
  };

  await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: match.matchCode,
    expectedGameId: match.gameId,
    expectedPhaseEndsAt: match.phaseEndsAt,
    expectedRound: match.round,
    preferredAction: 'skill',
    timedOut: true,
    now: () => 1001,
    random: () => 0.5
  });

  assert.equal(human.selection.action, 'skill');
  assert.equal(human.selection.effectChoice.abilityKey, 'stone-reinforce');
  assert.equal(human.selection.effectChoice.targetTeamSlot, 0);
  assert.ok(
    ['mouth', 'body', 'flight', 'eyes'].includes(
      human.selection.effectChoice.optionKey
    )
  );
});

test('Clash timeout selections cannot commit before the server deadline', async () => {
  const human = createPlayer('player-one', null);
  human.selection = null;
  const match = {
    gameId: 'OCL-TIMEOUT-DEADLINE',
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    phaseEndsAt: new Date(2000),
    round: 1,
    ruleset: createRuleset(),
    players: [human, createPlayer('player-two', null)],
    events: [],
    async save() {}
  };

  await assert.rejects(
    commitClashSelection({
      models: { OlingClashMatch: { findOne: async () => match } },
      account: { _id: human.accountId },
      matchCode: match.matchCode,
      expectedGameId: match.gameId,
      expectedPhaseEndsAt: match.phaseEndsAt,
      expectedRound: match.round,
      timedOut: true,
      now: () => 1500
    }),
    (error) =>
      error.code === 'oling_clash_timeout_not_reached' &&
      error.details.retryAfterMs === 500
  );
});

test('Clash timeout selections reject stale round context', async () => {
  const human = createPlayer('player-one', null);
  human.selection = null;
  const match = {
    gameId: 'OCL-CURRENT',
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    phaseEndsAt: new Date(2000),
    round: 2,
    ruleset: createRuleset(),
    players: [human, createPlayer('player-two', null)],
    events: [],
    async save() {}
  };

  await assert.rejects(
    commitClashSelection({
      models: { OlingClashMatch: { findOne: async () => match } },
      account: { _id: human.accountId },
      matchCode: match.matchCode,
      expectedGameId: match.gameId,
      expectedPhaseEndsAt: new Date(1000),
      expectedRound: 1,
      timedOut: true,
      now: () => 2500
    }),
    (error) => error.code === 'oling_clash_timeout_stale'
  );
  assert.equal(human.selection, null);
});

test('Human Clash selections reject a voluntary Tag without a charge', async () => {
  const human = addMendTeam(createPlayer('player-one', null));
  human.selection = null;
  human.tagCharges = 0;
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    players: [human, addMendTeam(createPlayer('player-two', 'skill'))],
    events: [],
    async save() {}
  };

  await assert.rejects(
    commitClashSelection({
      models: { OlingClashMatch: { findOne: async () => match } },
      account: { _id: human.accountId },
      matchCode: 'ABC-123',
      action: 'attack',
      tagTeamSlot: 1
    }),
    (error) => error.code === 'oling_clash_tag_charge_required'
  );
});

test('Voluntary Tags spend one charge and restore it after three later decisive Clashes', () => {
  const player = addMendTeam(createPlayer('player-one', 'attack'));
  const opponent = addMendTeam(createPlayer('player-two', 'skill'));
  player.tagCharges = 2;
  player.tagRechargeProgress = 0;
  opponent.team[0].shieldCount = 10;
  player.selection.tagTeamSlot = 1;
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [player, opponent]
  };

  const tagRound = resolveCoreClashRound(match);
  assert.equal(tagRound.tags[0].reason, 'tag');
  assert.equal(player.tagCharges, 1);
  assert.equal(player.tagRechargeProgress, 0);
  assert.deepEqual(
    tagRound.tagChargeUpdates.find(
      (update) => update.playerSlot === player.slot
    ),
    {
      playerSlot: player.slot,
      charges: 1,
      rechargeProgress: 0,
      maximumCharges: 2,
      decisiveClashesPerCharge: 3,
      restoredCharges: 0
    }
  );

  let latestResult;
  for (let decisiveClash = 1; decisiveClash <= 3; decisiveClash += 1) {
    player.selection = {
      round: match.round,
      action: 'attack',
      tagTeamSlot: null
    };
    opponent.selection = {
      round: match.round,
      action: 'skill',
      tagTeamSlot: null
    };
    latestResult = resolveCoreClashRound(match);
  }

  assert.equal(player.tagCharges, 2);
  assert.equal(player.tagRechargeProgress, 0);
  assert.equal(
    latestResult.tagChargeUpdates.find(
      (update) => update.playerSlot === player.slot
    ).restoredCharges,
    1
  );
});

test('Draws do not advance Tag recharge progress', () => {
  const player = addMendTeam(createPlayer('player-one', 'attack'));
  const opponent = addMendTeam(createPlayer('player-two', 'attack'));
  player.tagCharges = 1;
  player.tagRechargeProgress = 1;
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [player, opponent]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(result.outcome, 'draw');
  assert.equal(result.tagChargeUpdates.length, 0);
  assert.equal(player.tagCharges, 1);
  assert.equal(player.tagRechargeProgress, 1);
});

test('A voluntary Tag on a Draw reports its spent charge without recharging', () => {
  const player = addMendTeam(createPlayer('player-one', 'attack'));
  const opponent = addMendTeam(createPlayer('player-two', 'attack'));
  player.tagCharges = 2;
  player.tagRechargeProgress = 0;
  player.selection.tagTeamSlot = 1;
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [player, opponent]
  };

  const result = resolveCoreClashRound(match);
  const update = result.tagChargeUpdates.find(
    (item) => item.playerSlot === player.slot
  );

  assert.equal(result.outcome, 'draw');
  assert.equal(result.tags[0].reason, 'tag');
  assert.equal(player.tagCharges, 1);
  assert.equal(player.tagRechargeProgress, 0);
  assert.equal(update.charges, 1);
  assert.equal(update.rechargeProgress, 0);
  assert.equal(update.restoredCharges, 0);
});

test('Defeat replacements remain free while decisive Clash recharge advances', () => {
  const player = addMendTeam(createPlayer('player-one', 'skill', 1), [4, 0]);
  const opponent = addMendTeam(createPlayer('player-two', 'attack'));
  player.tagCharges = 0;
  player.tagRechargeProgress = 0;
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [player, opponent]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(result.tags[0].reason, 'defeat-replacement');
  assert.equal(player.tagCharges, 0);
  assert.equal(player.tagRechargeProgress, 1);
});

test('A defeated human waits to choose when multiple Olings can replace them', () => {
  const player = addMendTeam(createPlayer('player-one', 'skill', 1));
  const opponent = addMendTeam(createPlayer('player-two', 'attack'));
  player.tagCharges = 1;
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [player, opponent]
  };

  const result = resolveCoreClashRound(match);

  assert.deepEqual(result.tags, []);
  assert.deepEqual(result.pendingReplacementPlayerSlots, ['player-one']);
  assert.equal(match.phase, 'replacement');
  assert.equal(match.round, 1);
  assert.equal(player.activeTeamSlot, 0);
  assert.equal(player.tagCharges, 1);
});

test('A human replacement choice is free and starts the next round', async () => {
  const player = addMendTeam(createPlayer('player-one', 'skill', 1));
  const opponent = addMendTeam(createPlayer('player-two', 'attack'));
  player.tagCharges = 1;
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'resolution',
    phaseEndsAt: null,
    round: 1,
    ruleset: createRuleset(),
    players: [player, opponent],
    events: [],
    async save() {}
  };
  resolveCoreClashRound(match);

  const result = await chooseClashReplacement({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: player.accountId },
    matchCode: match.matchCode,
    teamSlot: 2
  });

  assert.deepEqual(result.replacement, {
    playerSlot: 'player-one',
    previousTeamSlot: 0,
    incomingTeamSlot: 2,
    reason: 'defeat-replacement',
    tagEffectsActivate: false
  });
  assert.equal(player.activeTeamSlot, 2);
  assert.equal(player.tagCharges, 1);
  assert.equal(match.phase, 'selection');
  assert.equal(match.round, 2);
  assert.ok(Date.parse(match.phaseEndsAt) > Date.now());
  assert.equal(match.events[0].type, 'replacement-selected');
  assert.equal(match.events[0].round, 1);
});

test('A human commit generates the AI choice and resolves the round', async () => {
  const human = createPlayer('player-one', null);
  const ai = {
    ...createPlayer('player-two', null),
    isAi: true,
    aiDifficulty: 0
  };
  human.selection = null;
  ai.selection = null;
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    players: [human, ai],
    events: [],
    async save() {}
  };
  const result = await commitClashSelection({
    models: {
      OlingClashMatch: { findOne: async () => match }
    },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'attack'
  });

  assert.equal(result.roundResult.round, 1);
  assert.ok(
    result.roundResult.responseDelayMs >=
      CLASH_FLOW_DURATIONS.actionSubmittedHold
  );
  assert.ok(result.roundResult.responseDelayMs <= 2000);
  assert.equal(result.resolvedMatch.round, 2);
  assert.ok(Date.parse(result.resolvedMatch.phaseEndsAt) > Date.now() + 20000);
  assert.equal(result.roundResult.actions['player-one'], 'attack');
  assert.equal(
    ['attack', 'guard', 'skill'].includes(
      result.roundResult.actions['player-two']
    ),
    true
  );
  assert.equal(match.round, 2);
  assert.equal(
    match.players.every((player) => player.selection === null),
    true
  );
});

test('Human Clash rounds hold before lock-in after the second confirmation', async () => {
  const firstPlayer = createPlayer('player-one', 'skill');
  const secondPlayer = createPlayer('player-two', null);
  secondPlayer.selection = null;
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    players: [firstPlayer, secondPlayer],
    events: [],
    async save() {}
  };

  const result = await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: secondPlayer.accountId },
    matchCode: match.matchCode,
    action: 'attack'
  });

  assert.equal(
    result.roundResult.responseDelayMs,
    CLASH_FLOW_DURATIONS.actionSubmittedHold
  );
  assert.equal(getRoundPlaybackDuration(result.roundResult), 6900);
});

test('Ineligible players are rejected before taking a Clash lobby slot', async () => {
  const match = {
    status: 'waiting',
    players: [],
    async save() {}
  };
  await assert.rejects(
    joinClashMatch({
      models: {
        OlingClashMatch: { findOne: async () => match },
        PlayerOling: { countDocuments: async () => 2 }
      },
      account: { _id: new mongoose.Types.ObjectId() },
      matchCode: 'ABC-123'
    }),
    (error) => error.code === 'oling_clash_three_olings_required'
  );
  assert.equal(match.players.length, 0);
});

test('Existing Clash players can reconnect after the match starts', async () => {
  const account = { _id: new mongoose.Types.ObjectId() };
  let saves = 0;
  const player = { accountId: account._id, connected: false };
  const match = {
    status: 'active',
    players: [player],
    async save() {
      saves += 1;
    }
  };
  const result = await joinClashMatch({
    models: {
      OlingClashMatch: { findOne: async () => match }
    },
    account,
    matchCode: 'ABC-123'
  });
  assert.equal(result, match);
  assert.equal(player.connected, true);
  assert.equal(saves, 1);
});

test('Draw damage cannot defeat an Oling through Last Stand', () => {
  const oling = {
    heartUnits: 1,
    shieldCount: 0,
    overgrowthUnits: 0
  };
  const result = applyRoutedDamage(
    oling,
    1,
    'normal',
    'draw',
    createRuleset().snapshot
  );
  assert.equal(oling.heartUnits, 1);
  assert.equal(result.appliedUnits, 0);
  assert.equal(result.preventedUnits, 1);
  assert.equal(result.preventedBy, 'last-stand');
});

test('Server Clash damage breaks whole Shields and routes excess damage', () => {
  const oneShield = {
    heartUnits: 6,
    shieldCount: 1,
    overgrowthUnits: 0
  };
  const result = applyRoutedDamage(
    oneShield,
    3,
    'normal',
    'clash',
    createRuleset().snapshot
  );

  assert.equal(oneShield.shieldCount, 0);
  assert.equal(oneShield.heartUnits, 5);
  assert.deepEqual(result.layers, [
    { layer: 'shields', units: 2, shieldsDestroyed: 1 },
    { layer: 'hearts', units: 1 }
  ]);

  const twoShields = {
    heartUnits: 6,
    shieldCount: 2,
    overgrowthUnits: 0
  };
  applyRoutedDamage(twoShields, 3, 'normal', 'clash', createRuleset().snapshot);
  assert.equal(twoShields.shieldCount, 0);
  assert.equal(twoShields.heartUnits, 6);
});

test('Core Clash rounds resolve the action triangle and clear submissions', () => {
  const players = [
    createPlayer('player-one', 'attack'),
    createPlayer('player-two', 'skill')
  ];
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players
  };
  const result = resolveCoreClashRound(match);
  assert.equal(result.winnerSlot, 'player-one');
  assert.equal(players[1].team[0].heartUnits, 4);
  assert.equal(players[0].selection, null);
  assert.equal(players[1].selection, null);
  assert.equal(match.round, 2);
  assert.equal(match.phase, 'selection');
});

test('Mend heals the most damaged living benched Oling after an Attack win', () => {
  const winner = addMendTeam(createPlayer('player-one', 'attack'), [4, 5]);
  const loser = createPlayer('player-two', 'skill');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [winner, loser]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(winner.team[1].heartUnits, 5);
  assert.equal(winner.team[2].heartUnits, 5);
  assert.deepEqual(result.effects, [
    {
      playerSlot: 'player-one',
      sourceTeamSlot: 0,
      abilityKey: 'moss-mend',
      abilityRevision: 1,
      effectOrder: 0,
      mechanic: 'heal',
      handler: 'heal_most_damaged_benched',
      status: 'resolved',
      targetPlayerSlot: 'player-one',
      targetTeamSlot: 1,
      requestedUnits: 1,
      appliedUnits: 1,
      beforeHeartUnits: 4,
      afterHeartUnits: 5,
      maxHeartUnits: 6
    }
  ]);
});

test('Mend reports no target when every living benched Oling is at full Hearts', () => {
  const winner = addMendTeam(createPlayer('player-one', 'attack'), [6, 0]);
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [winner, createPlayer('player-two', 'skill')]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(result.effects[0].status, 'no-target');
  assert.equal(result.effects[0].appliedUnits, 0);
  assert.equal(result.effects[0].targetTeamSlot, null);
});

test('Mend resolution is preserved in the embedded round event', async () => {
  const human = addMendTeam(createPlayer('player-one', null), [3, 5]);
  const opponent = createPlayer('player-two', 'skill');
  human.selection = null;
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    players: [human, opponent],
    events: [],
    async save() {}
  };

  const result = await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'attack'
  });

  assert.equal(result.roundResult.effects[0].abilityKey, 'moss-mend');
  assert.equal(match.events.length, 1);
  assert.equal(match.events[0].type, 'round-resolved');
  assert.equal(match.events[0].payload.effects[0].appliedUnits, 1);
  assert.equal(human.team[1].heartUnits, 4);
});

test('Wild Growth grants half an Overgrowth Heart to its active Oling', () => {
  const winner = addWildGrowthTeam(createPlayer('player-one', 'skill'));
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [winner, createPlayer('player-two', 'guard')]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(winner.team[0].overgrowthUnits, 1);
  assert.equal(winner.activeTeamSlot, 0);
  assert.deepEqual(result.effects[0], {
    playerSlot: 'player-one',
    sourceTeamSlot: 0,
    abilityKey: 'moss-wild-growth',
    abilityRevision: 1,
    effectOrder: 0,
    mechanic: 'grant-overgrowth',
    handler: 'grant_overgrowth_to_self_or_tag_recipient',
    status: 'resolved',
    targetPlayerSlot: 'player-one',
    targetTeamSlot: 0,
    targetReason: 'self',
    requestedUnits: 1,
    appliedUnits: 1,
    beforeOvergrowthUnits: 0,
    afterOvergrowthUnits: 1
  });
});

test('Wild Growth redirects to the incoming Oling after a successful Tag', () => {
  const winner = addWildGrowthTeam(createPlayer('player-one', 'skill'));
  winner.selection.tagTeamSlot = 2;
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [winner, createPlayer('player-two', 'guard')]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(winner.team[0].overgrowthUnits, 0);
  assert.equal(winner.team[2].overgrowthUnits, 1);
  assert.equal(winner.activeTeamSlot, 2);
  assert.equal(result.effects[0].targetTeamSlot, 2);
  assert.equal(result.effects[0].targetReason, 'tag-recipient');
  assert.deepEqual(result.tags, [
    {
      playerSlot: 'player-one',
      previousTeamSlot: 0,
      incomingTeamSlot: 2,
      reason: 'tag',
      tagEffectsActivate: true
    }
  ]);
});

test('Wild Growth stays on its active Oling when the queued Tag cannot resolve', () => {
  const winner = addWildGrowthTeam(createPlayer('player-one', 'skill'), [0, 6]);
  winner.selection.tagTeamSlot = 1;
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [winner, createPlayer('player-two', 'guard')]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(winner.team[0].overgrowthUnits, 1);
  assert.equal(winner.team[1].overgrowthUnits, 0);
  assert.equal(winner.activeTeamSlot, 0);
  assert.equal(result.effects[0].targetReason, 'self');
  assert.deepEqual(result.tags, []);
});

test('Wild Growth Tag redirection is preserved in the embedded round event', async () => {
  const human = addWildGrowthTeam(createPlayer('player-one', null));
  const opponent = createPlayer('player-two', 'guard');
  human.selection = null;
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    players: [human, opponent],
    events: [],
    async save() {}
  };

  const result = await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'skill',
    tagTeamSlot: 1
  });

  assert.equal(human.activeTeamSlot, 1);
  assert.equal(human.team[1].overgrowthUnits, 1);
  assert.equal(result.roundResult.effects[0].targetReason, 'tag-recipient');
  assert.equal(match.events.length, 1);
  assert.equal(match.events[0].payload.effects[0].targetTeamSlot, 1);
  assert.equal(match.events[0].payload.tags[0].reason, 'tag');
});

test('Canopy grants a stacking Shield to the most damaged living ally', () => {
  const moss = addCanopyTeam(
    createPlayer('player-one', 'guard'),
    [3, 5],
    [1, 0]
  );
  moss.team[0].abilityProgress = [
    {
      abilityKey: 'moss-canopy',
      abilityRevision: 2,
      activationCount: 1
    }
  ];
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [moss, createPlayer('player-two', 'guard')]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(moss.team[0].heartUnits, 5);
  assert.equal(moss.team[1].shieldCount, 2);
  assert.deepEqual(result.effects[0], {
    playerSlot: 'player-one',
    sourceTeamSlot: 0,
    abilityKey: 'moss-canopy',
    abilityRevision: 2,
    effectOrder: 0,
    mechanic: 'grant-shield',
    handler: 'grant_shield_to_most_damaged_ally',
    status: 'resolved',
    activationThreshold: 2,
    beforeActivationCount: 1,
    afterActivationCount: 0,
    cadenceMode: 'cumulative',
    triggered: true,
    targetPlayerSlot: 'player-one',
    targetTeamSlot: 1,
    requestedShieldCount: 1,
    appliedShieldCount: 1,
    beforeShieldCount: 1,
    afterShieldCount: 2
  });
});

test('Canopy records progress without granting a Shield on its first Draw', () => {
  const moss = addCanopyTeam(createPlayer('player-one', 'guard'), [3, 5]);
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [moss, createPlayer('player-two', 'guard')]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(moss.team[1].shieldCount, 0);
  assert.equal(result.effects[0].abilityKey, 'moss-canopy');
  assert.equal(result.effects[0].status, 'progressed');
  assert.equal(result.effects[0].afterActivationCount, 1);
  assert.equal(result.effects[0].triggered, false);
});

test('Canopy can target its active Oling after that Oling takes Draw damage', () => {
  const moss = addCanopyTeam(createPlayer('player-one', 'attack'), [6, 6]);
  moss.team[0].abilityProgress = [
    {
      abilityKey: 'moss-canopy',
      abilityRevision: 2,
      activationCount: 1
    }
  ];
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [moss, createPlayer('player-two', 'attack')]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(moss.team[0].heartUnits, 5);
  assert.equal(moss.team[0].shieldCount, 1);
  assert.equal(result.effects[0].targetTeamSlot, 0);
});

test('Canopy does not activate when its Oling does not survive Draw damage', () => {
  const moss = addCanopyTeam(createPlayer('player-one', 'skill', 1), [6, 6]);
  const ruleset = createRuleset();
  ruleset.snapshot.lastStand.enabled = false;
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset,
    players: [moss, createPlayer('player-two', 'skill')]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(moss.team[0].defeated, true);
  assert.equal(moss.team[0].shieldCount, 0);
  assert.equal(
    result.effects.some((effect) => effect.abilityKey === 'moss-canopy'),
    false
  );
});

test('Canopy resolution is preserved in the embedded round event', async () => {
  const human = addCanopyTeam(createPlayer('player-one', null), [3, 5]);
  human.team[0].abilityProgress = [
    {
      abilityKey: 'moss-canopy',
      abilityRevision: 2,
      activationCount: 1
    }
  ];
  const opponent = createPlayer('player-two', 'guard');
  human.selection = null;
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    players: [human, opponent],
    events: [],
    async save() {}
  };

  const result = await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'guard'
  });

  assert.equal(result.roundResult.effects[0].abilityKey, 'moss-canopy');
  assert.equal(human.team[1].shieldCount, 1);
  assert.equal(match.events.length, 1);
  assert.equal(match.events[0].payload.effects[0].targetTeamSlot, 1);
  assert.equal(match.events[0].payload.effects[0].afterShieldCount, 1);
});

test('Harden progresses after its first survived Draw', () => {
  const stone = addHardenAbility(createPlayer('player-one', 'attack'));
  stone.team[0].shieldCount = 2;
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [stone, createPlayer('player-two', 'attack')]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(result.damage[0].layers[0].shieldsDestroyed, 1);
  assert.equal(stone.team[0].shieldCount, 1);
  assert.equal(result.effects[0].abilityKey, 'stone-harden');
  assert.equal(result.effects[0].status, 'progressed');
  assert.equal(result.effects[0].beforeActivationCount, 0);
  assert.equal(result.effects[0].afterActivationCount, 1);
  assert.equal(result.effects[0].triggered, false);
});

test('Clash snapshots do not invent a one-round cadence', () => {
  const snapshot = snapshotClashAbility({
    key: 'stone-harden',
    revision: 2,
    name: 'Harden'
  });

  assert.equal(Object.hasOwn(snapshot, 'cadence'), false);
});

test('Harden activates only on every second survived Draw', () => {
  const stone = addHardenAbility(createPlayer('player-one', 'attack'));
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [stone, createPlayer('player-two', 'attack')]
  };

  const firstResult = resolveCoreClashRound(match);
  match.round += 1;
  stone.selection = { round: 2, action: 'attack', tagTeamSlot: null };
  match.players[1].selection = {
    round: 2,
    action: 'attack',
    tagTeamSlot: null
  };
  const secondResult = resolveCoreClashRound(match);

  assert.equal(firstResult.effects[0].status, 'progressed');
  assert.equal(firstResult.effects[0].triggered, false);
  assert.equal(firstResult.effects[0].afterActivationCount, 1);
  assert.equal(secondResult.effects[0].status, 'resolved');
  assert.equal(secondResult.effects[0].triggered, true);
  assert.equal(secondResult.effects[0].afterActivationCount, 0);
  assert.equal(stone.team[0].shieldCount, 1);
});

test('Legacy Harden snapshots repair incorrect cadence before resolution and display', async () => {
  const stone = addHardenAbility(createPlayer('player-one', null));
  stone.team[0].snapshot.abilities[0].cadence.every = 1;
  const opponent = createPlayer('player-two', 'attack');
  stone.selection = null;
  const markedPaths = [];
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    players: [stone, opponent],
    events: [],
    markModified(path) {
      markedPaths.push(path);
    },
    async save() {}
  };
  const result = await commitClashSelection({
    models: {
      OlingClashAbility: {
        find() {
          return {
            async lean() {
              return [
                {
                  key: 'stone-harden',
                  revision: 2,
                  cadence: {
                    every: 2,
                    mode: 'cumulative',
                    retainWhileBenched: true,
                    consumeWhenPrevented: true
                  }
                }
              ];
            }
          };
        }
      },
      OlingClashMatch: { findOne: async () => match }
    },
    account: { _id: stone.accountId },
    matchCode: 'ABC-123',
    action: 'attack'
  });

  assert.equal(stone.team[0].snapshot.abilities[0].cadence.every, 2);
  assert.equal(stone.team[0].abilityProgress[0].activationCount, 1);
  assert.equal(result.roundResult.effects[0].status, 'progressed');
  assert.equal(result.roundResult.effects[0].triggered, false);
  assert.equal(
    result.resolvedMatch.players[0].team[0].snapshot.abilities[0].cadence.every,
    2
  );
  assert.deepEqual(markedPaths, ['players']);
});

test('Harden activates after Last Stand prevents Draw damage', () => {
  const stone = addHardenAbility(createPlayer('player-one', 'guard', 1));
  stone.team[0].abilityProgress = [
    {
      abilityKey: 'stone-harden',
      abilityRevision: 2,
      activationCount: 1
    }
  ];
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [stone, createPlayer('player-two', 'guard')]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(result.damage[0].preventedBy, 'last-stand');
  assert.equal(stone.team[0].heartUnits, 1);
  assert.equal(stone.team[0].shieldCount, 1);
  assert.equal(result.effects[0].abilityKey, 'stone-harden');
});

test('Harden resolution is preserved in the embedded round event', async () => {
  const human = addHardenAbility(createPlayer('player-one', null));
  human.team[0].abilityProgress = [
    {
      abilityKey: 'stone-harden',
      abilityRevision: 2,
      activationCount: 1
    }
  ];
  const opponent = createPlayer('player-two', 'skill');
  human.selection = null;
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    players: [human, opponent],
    events: [],
    async save() {}
  };

  const result = await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'skill'
  });

  assert.equal(result.roundResult.effects[0].abilityKey, 'stone-harden');
  assert.equal(human.team[0].shieldCount, 1);
  assert.equal(match.events[0].payload.effects[0].handler, 'grant_shield');
  assert.equal(match.events[0].payload.effects[0].afterShieldCount, 1);
});

test('Bloodsuck heals every second Attack victory and resets its counter', () => {
  const vampire = addBloodsuckTeam(createPlayer('player-one', 'attack', 4));
  const opponent = createPlayer('player-two', 'skill');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [vampire, opponent]
  };

  const first = resolveCoreClashRound(match);
  assert.equal(vampire.team[0].heartUnits, 4);
  assert.equal(first.effects[0].status, 'progressed');
  assert.equal(first.effects[0].afterActivationCount, 1);
  assert.equal(first.effects[0].triggered, false);

  vampire.selection = { round: 2, action: 'attack', tagTeamSlot: null };
  opponent.selection = { round: 2, action: 'skill', tagTeamSlot: null };
  match.phase = 'resolution';
  const second = resolveCoreClashRound(match);

  assert.equal(vampire.team[0].heartUnits, 5);
  assert.equal(second.effects[0].status, 'resolved');
  assert.equal(second.effects[0].appliedUnits, 1);
  assert.equal(second.effects[0].beforeActivationCount, 1);
  assert.equal(second.effects[0].afterActivationCount, 0);
  assert.equal(second.effects[0].triggered, true);
  assert.deepEqual(vampire.team[0].abilityProgress, [
    {
      abilityKey: 'vampire-bloodsuck',
      abilityRevision: 1,
      activationCount: 0
    }
  ]);
});

test('Bloodsuck progress remains with Vampire while it Tags out', () => {
  const vampire = addBloodsuckTeam(createPlayer('player-one', 'attack', 4));
  const opponent = createPlayer('player-two', 'skill');
  vampire.selection.tagTeamSlot = 1;
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [vampire, opponent]
  };

  resolveCoreClashRound(match);

  assert.equal(vampire.activeTeamSlot, 1);
  assert.equal(vampire.team[0].abilityProgress[0].activationCount, 1);
  assert.deepEqual(vampire.team[1].abilityProgress, []);

  vampire.activeTeamSlot = 0;
  vampire.selection = { round: 2, action: 'attack', tagTeamSlot: null };
  opponent.selection = { round: 2, action: 'skill', tagTeamSlot: null };
  match.phase = 'resolution';
  resolveCoreClashRound(match);

  assert.equal(vampire.team[0].heartUnits, 5);
  assert.equal(vampire.team[0].abilityProgress[0].activationCount, 0);
});

test('Bloodsuck resets its second-win counter when Hearts are already full', () => {
  const vampire = addBloodsuckTeam(createPlayer('player-one', 'attack'));
  vampire.team[0].abilityProgress = [
    {
      abilityKey: 'vampire-bloodsuck',
      abilityRevision: 1,
      activationCount: 1
    }
  ];
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [vampire, createPlayer('player-two', 'skill')]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(vampire.team[0].heartUnits, 6);
  assert.equal(vampire.team[0].abilityProgress[0].activationCount, 0);
  assert.equal(result.effects[0].status, 'no-effect');
  assert.equal(result.effects[0].triggered, true);
  assert.equal(result.effects[0].appliedUnits, 0);
});

test('Bloodsuck progress and healing are preserved in embedded round events', async () => {
  const human = addBloodsuckTeam(createPlayer('player-one', null, 4));
  const opponent = createPlayer('player-two', 'skill');
  human.selection = null;
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    players: [human, opponent],
    events: [],
    async save() {}
  };

  await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'attack'
  });
  opponent.selection = { round: 2, action: 'skill', tagTeamSlot: null };
  const result = await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'attack'
  });

  assert.equal(match.events.length, 2);
  assert.equal(match.events[0].payload.effects[0].status, 'progressed');
  assert.equal(match.events[0].payload.effects[0].afterActivationCount, 1);
  assert.equal(match.events[1].payload.effects[0].status, 'resolved');
  assert.equal(match.events[1].payload.effects[0].afterActivationCount, 0);
  assert.equal(result.roundResult.effects[0].appliedUnits, 1);
  assert.equal(human.team[0].heartUnits, 5);
});

test('Clash rematches clear persisted ability progress', () => {
  const player = addBloodsuckTeam(createPlayer('player-one', null, 4));
  player.team[0].abilityProgress = [
    {
      abilityKey: 'vampire-bloodsuck',
      abilityRevision: 1,
      activationCount: 1
    }
  ];
  player.team[0].pendingReclaimUnits = 1;
  player.team[0].removedPositiveStatuses = [
    {
      status: createStatusInstance('warded'),
      removedRound: 3,
      reason: 'ward-consumed'
    }
  ];
  player.statuses = [createStatusInstance('blocked')];
  const match = {
    gameId: 'OCL-0123456789ABCDEF0123456789ABCDEF',
    status: 'completed',
    phase: 'complete',
    round: 4,
    startedAt: new Date(),
    endedAt: new Date(),
    winnerAccountId: player.accountId,
    endReason: 'team_defeated',
    events: [],
    players: [player]
  };

  resetClashMatchForRematch(match);

  assert.deepEqual(player.team[0].abilityProgress, []);
  assert.equal(player.team[0].pendingReclaimUnits, 0);
  assert.deepEqual(player.team[0].removedPositiveStatuses, []);
  assert.deepEqual(player.statuses, []);
  assert.equal(player.team[0].heartUnits, 6);
  assert.equal(match.status, 'waiting');
  assert.equal(match.round, 0);
});

test('Blood Bank stores half a Blood Heart then converts a full one', () => {
  const vampire = addBloodBankAbility(createPlayer('player-one', 'guard', 3));
  const opponent = createPlayer('player-two', 'attack');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [vampire, opponent]
  };

  const first = resolveCoreClashRound(match);

  assert.equal(vampire.team[0].bloodUnits, 1);
  assert.equal(vampire.team[0].heartUnits, 3);
  assert.equal(first.effects[0].status, 'stored');
  assert.equal(first.effects[0].converted, false);
  assert.equal(first.effects[0].beforeResourceUnits, 0);
  assert.equal(first.effects[0].afterResourceUnits, 1);

  vampire.selection = { round: 2, action: 'guard', tagTeamSlot: null };
  opponent.selection = { round: 2, action: 'attack', tagTeamSlot: null };
  match.phase = 'resolution';
  const second = resolveCoreClashRound(match);

  assert.equal(vampire.team[0].bloodUnits, 0);
  assert.equal(vampire.team[0].heartUnits, 5);
  assert.equal(second.effects[0].status, 'resolved');
  assert.equal(second.effects[0].converted, true);
  assert.equal(second.effects[0].conversionCount, 1);
  assert.equal(second.effects[0].requestedUnits, 2);
  assert.equal(second.effects[0].appliedUnits, 2);
  assert.equal(second.effects[0].beforeResourceUnits, 1);
  assert.equal(second.effects[0].afterResourceUnits, 0);
});

test('Blood Bank consumes converted Blood when permanent Hearts are full', () => {
  const vampire = addBloodBankAbility(createPlayer('player-one', 'guard'));
  vampire.team[0].bloodUnits = 1;
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [vampire, createPlayer('player-two', 'attack')]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(vampire.team[0].heartUnits, 6);
  assert.equal(vampire.team[0].bloodUnits, 0);
  assert.equal(result.effects[0].status, 'no-effect');
  assert.equal(result.effects[0].converted, true);
  assert.equal(result.effects[0].appliedUnits, 0);
});

test('Blood Bank resource remains with Vampire after a successful Tag', () => {
  const vampire = addBloodBankAbility(
    addBloodsuckTeam(createPlayer('player-one', 'guard'))
  );
  vampire.selection.tagTeamSlot = 1;
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [vampire, createPlayer('player-two', 'attack')]
  };

  resolveCoreClashRound(match);

  assert.equal(vampire.activeTeamSlot, 1);
  assert.equal(vampire.team[0].bloodUnits, 1);
  assert.equal(vampire.team[1].bloodUnits, 0);
});

test('Blood Bank storage and conversion are preserved in round events', async () => {
  const human = addBloodBankAbility(createPlayer('player-one', null, 3));
  const opponent = createPlayer('player-two', 'attack');
  human.selection = null;
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    players: [human, opponent],
    events: [],
    async save() {}
  };

  await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'guard'
  });
  opponent.selection = { round: 2, action: 'attack', tagTeamSlot: null };
  const result = await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'guard'
  });

  assert.equal(match.events.length, 2);
  assert.equal(match.events[0].payload.effects[0].status, 'stored');
  assert.equal(match.events[0].payload.effects[0].afterResourceUnits, 1);
  assert.equal(match.events[1].payload.effects[0].status, 'resolved');
  assert.equal(match.events[1].payload.effects[0].afterResourceUnits, 0);
  assert.equal(result.roundResult.effects[0].appliedUnits, 2);
  assert.equal(human.team[0].heartUnits, 5);
});

test('Transfusion gives half a Heart to a chosen benched Oling before Tagging', () => {
  const vampire = addTransfusionTeam(createPlayer('player-one', 'skill', 4));
  vampire.selection.effectChoice = {
    abilityKey: 'vampire-transfusion',
    targetTeamSlot: 1,
    optionKey: 'self-to-bench'
  };
  vampire.selection.tagTeamSlot = 1;
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [vampire, createPlayer('player-two', 'guard')]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(vampire.team[0].heartUnits, 3);
  assert.equal(vampire.team[1].heartUnits, 4);
  assert.equal(vampire.activeTeamSlot, 1);
  assert.equal(result.effects[0].status, 'resolved');
  assert.equal(result.effects[0].optionKey, 'self-to-bench');
  assert.equal(result.effects[0].donorTeamSlot, 0);
  assert.equal(result.effects[0].recipientTeamSlot, 1);
  assert.equal(result.effects[0].appliedUnits, 1);
});

test('Transfusion receives half a Heart from a chosen benched Oling', () => {
  const vampire = addTransfusionTeam(
    createPlayer('player-one', 'skill', 3),
    [4, 6]
  );
  vampire.selection.effectChoice = {
    abilityKey: 'vampire-transfusion',
    targetTeamSlot: 1,
    optionKey: 'bench-to-self'
  };
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [vampire, createPlayer('player-two', 'guard')]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(vampire.team[0].heartUnits, 4);
  assert.equal(vampire.team[1].heartUnits, 3);
  assert.equal(result.effects[0].optionKey, 'bench-to-self');
  assert.equal(result.effects[0].donorTeamSlot, 1);
  assert.equal(result.effects[0].recipientTeamSlot, 0);
});

test('Transfusion choices enforce donor survival and recipient capacity', () => {
  const vampire = addTransfusionTeam(
    createPlayer('player-one', 'skill', 1),
    [1, 6]
  );
  const choices = getValidHeartTransferChoices(
    vampire,
    vampire.activeTeamSlot,
    1,
    createRuleset().snapshot
  );

  assert.deepEqual(
    choices.map(({ abilityTargetTeamSlot, optionKey }) => ({
      abilityTargetTeamSlot,
      optionKey
    })),
    [{ abilityTargetTeamSlot: 2, optionKey: 'bench-to-self' }]
  );
});

test('Clash AI selects a legal Transfusion target without exposing it', () => {
  const vampire = addTransfusionTeam(
    createPlayer('player-two', null, 4),
    [3, 6]
  );
  vampire.isAi = true;
  const match = { ruleset: createRuleset() };

  const choice = chooseAiEffectChoice(match, vampire, 'skill', () => 0);

  assert.deepEqual(choice, {
    abilityKey: 'vampire-transfusion',
    targetTeamSlot: 1,
    optionKey: 'self-to-bench'
  });
});

test('Transfusion validation and resolution are preserved in round events', async () => {
  const human = addTransfusionTeam(createPlayer('player-one', null, 4), [3, 6]);
  const opponent = createPlayer('player-two', 'guard');
  human.selection = null;
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    players: [human, opponent],
    events: [],
    async save() {}
  };

  const result = await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'skill',
    effectChoice: {
      abilityKey: 'vampire-transfusion',
      targetTeamSlot: 1,
      optionKey: 'self-to-bench'
    }
  });

  assert.equal(human.team[0].heartUnits, 3);
  assert.equal(human.team[1].heartUnits, 4);
  assert.equal(result.roundResult.effects[0].abilityKey, 'vampire-transfusion');
  assert.equal(match.events[0].payload.effects[0].donorTeamSlot, 0);
  assert.equal(match.events[0].payload.effects[0].recipientTeamSlot, 1);
  assert.equal(match.events[0].payload.effects[0].appliedUnits, 1);
});

test('Transfusion rejects an illegal target and direction at commit time', async () => {
  const human = addTransfusionTeam(createPlayer('player-one', null, 1), [1, 6]);
  human.selection = null;
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    players: [human, createPlayer('player-two', 'guard')],
    events: [],
    async save() {}
  };

  await assert.rejects(
    commitClashSelection({
      models: { OlingClashMatch: { findOne: async () => match } },
      account: { _id: human.accountId },
      matchCode: 'ABC-123',
      action: 'skill',
      effectChoice: {
        abilityKey: 'vampire-transfusion',
        targetTeamSlot: 1,
        optionKey: 'self-to-bench'
      }
    }),
    (error) => {
      assert.equal(error.code, 'oling_clash_effect_choice_invalid');
      return true;
    }
  );
});

test('Reclaim stores only Draw damage that reaches permanent Hearts', () => {
  const vampire = addReclaimAbility(createPlayer('player-one', 'attack', 4));
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [vampire, createPlayer('player-two', 'attack')]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(vampire.team[0].heartUnits, 3);
  assert.equal(vampire.team[0].pendingReclaimUnits, 1);
  assert.equal(result.effects[0].abilityKey, 'vampire-reclaim');
  assert.equal(result.effects[0].status, 'stored');
  assert.equal(result.effects[0].heartDamageUnits, 1);
  assert.equal(result.effects[0].storedUnits, 1);
  assert.equal(result.effects[0].afterPendingReclaimUnits, 1);
});

test('Reclaim generates no Blood when Draw damage is absorbed or prevented', () => {
  const cases = [
    { heartUnits: 4, shieldCount: 1, overgrowthUnits: 0 },
    { heartUnits: 4, shieldCount: 0, overgrowthUnits: 1 },
    { heartUnits: 1, shieldCount: 0, overgrowthUnits: 0 }
  ];

  cases.forEach((health, index) => {
    const vampire = addReclaimAbility(
      createPlayer('player-one', 'guard', health.heartUnits)
    );
    Object.assign(vampire.team[0], health);
    const match = {
      status: 'active',
      phase: 'resolution',
      round: index + 1,
      ruleset: createRuleset(),
      players: [vampire, createPlayer('player-two', 'guard')]
    };

    const result = resolveCoreClashRound(match);

    assert.equal(vampire.team[0].pendingReclaimUnits, 0);
    assert.equal(result.effects[0].status, 'no-effect');
    assert.equal(result.effects[0].heartDamageUnits, 0);
    assert.equal(result.effects[0].storedUnits, 0);
  });
});

test('Reclaim remains capped through repeated Draws', () => {
  const vampire = addReclaimAbility(createPlayer('player-one', 'skill', 5));
  const opponent = createPlayer('player-two', 'skill');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [vampire, opponent]
  };

  resolveCoreClashRound(match);
  vampire.selection = { round: 2, action: 'skill', tagTeamSlot: null };
  opponent.selection = { round: 2, action: 'skill', tagTeamSlot: null };
  match.phase = 'resolution';
  const second = resolveCoreClashRound(match);

  assert.equal(vampire.team[0].heartUnits, 3);
  assert.equal(vampire.team[0].pendingReclaimUnits, 1);
  assert.equal(second.effects[0].status, 'no-effect');
  assert.equal(second.effects[0].heartDamageUnits, 1);
  assert.equal(second.effects[0].storedUnits, 0);
});

test('Reclaim recovers pending Blood after Vampire next wins decisively', () => {
  const vampire = addReclaimAbility(createPlayer('player-one', 'attack', 4));
  const opponent = createPlayer('player-two', 'attack');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [vampire, opponent]
  };

  resolveCoreClashRound(match);
  vampire.selection = { round: 2, action: 'attack', tagTeamSlot: null };
  opponent.selection = { round: 2, action: 'skill', tagTeamSlot: null };
  match.phase = 'resolution';
  const decisive = resolveCoreClashRound(match);

  assert.equal(vampire.team[0].heartUnits, 4);
  assert.equal(vampire.team[0].pendingReclaimUnits, 0);
  assert.equal(decisive.effects[0].handler, 'resolve_reclaim_after_decisive');
  assert.equal(decisive.effects[0].outcome, 'recovered');
  assert.equal(decisive.effects[0].appliedUnits, 1);
});

test('Reclaim loses pending Blood after Vampire next loses decisively', () => {
  const vampire = addReclaimAbility(createPlayer('player-one', 'attack', 6));
  const opponent = createPlayer('player-two', 'attack');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [vampire, opponent]
  };

  resolveCoreClashRound(match);
  vampire.selection = { round: 2, action: 'skill', tagTeamSlot: null };
  opponent.selection = { round: 2, action: 'attack', tagTeamSlot: null };
  match.phase = 'resolution';
  const decisive = resolveCoreClashRound(match);

  assert.equal(vampire.team[0].heartUnits, 3);
  assert.equal(vampire.team[0].pendingReclaimUnits, 0);
  assert.equal(decisive.effects[0].status, 'lost');
  assert.equal(decisive.effects[0].outcome, 'lost');
  assert.equal(decisive.effects[0].appliedUnits, 0);
});

test('Reclaim waits while Vampire is benched', () => {
  const vampire = addReclaimAbility(
    addBloodsuckTeam(createPlayer('player-one', 'guard', 5))
  );
  vampire.selection.tagTeamSlot = 1;
  const opponent = createPlayer('player-two', 'guard');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [vampire, opponent]
  };

  resolveCoreClashRound(match);
  assert.equal(vampire.activeTeamSlot, 1);
  assert.equal(vampire.team[0].pendingReclaimUnits, 1);

  vampire.selection = { round: 2, action: 'guard', tagTeamSlot: null };
  opponent.selection = { round: 2, action: 'attack', tagTeamSlot: null };
  match.phase = 'resolution';
  resolveCoreClashRound(match);

  assert.equal(vampire.team[0].pendingReclaimUnits, 1);
  assert.equal(vampire.team[0].heartUnits, 4);
});

test('Reclaim resolves after the current winning Part ability', () => {
  const vampire = addReclaimAbility(
    addBloodsuckTeam(createPlayer('player-one', 'attack', 5))
  );
  vampire.team[0].pendingReclaimUnits = 1;
  vampire.team[0].abilityProgress = [
    {
      abilityKey: 'vampire-bloodsuck',
      abilityRevision: 1,
      activationCount: 1
    }
  ];
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [vampire, createPlayer('player-two', 'skill')]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(vampire.team[0].heartUnits, 6);
  assert.equal(result.effects[0].abilityKey, 'vampire-bloodsuck');
  assert.equal(result.effects[0].appliedUnits, 1);
  assert.equal(result.effects[1].abilityKey, 'vampire-reclaim');
  assert.equal(result.effects[1].appliedUnits, 0);
  assert.equal(result.effects[1].status, 'no-effect');
});

test('Reclaim storage and recovery are preserved in embedded round events', async () => {
  const human = addReclaimAbility(createPlayer('player-one', null, 4));
  const opponent = createPlayer('player-two', 'attack');
  human.selection = null;
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    players: [human, opponent],
    events: [],
    async save() {}
  };

  await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'attack'
  });
  opponent.selection = { round: 2, action: 'skill', tagTeamSlot: null };
  const result = await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'attack'
  });

  assert.equal(match.events.length, 2);
  assert.equal(match.events[0].payload.effects[0].status, 'stored');
  assert.equal(match.events[0].payload.effects[0].afterPendingReclaimUnits, 1);
  assert.equal(match.events[1].payload.effects[0].outcome, 'recovered');
  assert.equal(result.roundResult.effects[0].appliedUnits, 1);
  assert.equal(human.team[0].pendingReclaimUnits, 0);
});

test('Cleanse removes the chosen Negative Status from itself', () => {
  const moss = addCleanseTeam(createPlayer('player-one', 'guard'), [
    [
      createStatusInstance('burn'),
      createStatusInstance('suppressed', 1, 'mouth'),
      createStatusInstance('warded')
    ],
    [],
    []
  ]);
  moss.selection.effectChoice = {
    abilityKey: 'moss-cleanse',
    targetTeamSlot: 0,
    optionKey: 'burn'
  };
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [moss, createPlayer('player-two', 'attack')]
  };

  const result = resolveCoreClashRound(match);

  assert.deepEqual(
    moss.team[0].statuses.map((status) => status.key),
    ['suppressed', 'warded']
  );
  assert.equal(result.effects[0].status, 'resolved');
  assert.equal(result.effects[0].targetTeamSlot, 0);
  assert.equal(result.effects[0].removedStatusKey, 'burn');
  assert.equal(result.effects[0].removedStatusName, 'Burn');
  assert.equal(result.effects[0].removedCount, 1);
});

test('Cleanse targets a chosen living teammate and preserves other Statuses', () => {
  const moss = addCleanseTeam(createPlayer('player-one', 'guard'), [
    [],
    [
      createStatusInstance('suppressed', 1, 'flight'),
      createStatusInstance('burn'),
      createStatusInstance('warded')
    ],
    [createStatusInstance('burn')]
  ]);
  moss.selection.effectChoice = {
    abilityKey: 'moss-cleanse',
    targetTeamSlot: 1,
    optionKey: 'suppressed'
  };
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [moss, createPlayer('player-two', 'attack')]
  };

  const result = resolveCoreClashRound(match);

  assert.deepEqual(
    moss.team[1].statuses.map((status) => status.key),
    ['burn', 'warded']
  );
  assert.deepEqual(
    moss.team[2].statuses.map((status) => status.key),
    ['burn']
  );
  assert.equal(result.effects[0].targetTeamSlot, 1);
  assert.equal(result.effects[0].removedStatusKey, 'suppressed');
});

test('Cleanse choices ignore Positive, Variable, defeated, and duplicate Statuses', () => {
  const moss = addCleanseTeam(createPlayer('player-one', 'guard'), [
    [createStatusInstance('warded'), createStatusInstance('marked')],
    [createStatusInstance('burn'), createStatusInstance('burn')],
    [createStatusInstance('suppressed')]
  ]);
  moss.team[2].defeated = true;
  moss.team[2].heartUnits = 0;
  const match = {
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions()
  };

  const choices = getValidCleanseChoices(moss, match, 'negative');

  assert.deepEqual(
    choices.map(({ abilityTargetTeamSlot, optionKey }) => ({
      abilityTargetTeamSlot,
      optionKey
    })),
    [{ abilityTargetTeamSlot: 1, optionKey: 'burn' }]
  );
});

test('Cleanse removes only one matching duplicate Status instance', () => {
  const moss = addCleanseTeam(createPlayer('player-one', 'guard'), [
    [],
    [createStatusInstance('burn'), createStatusInstance('burn')],
    []
  ]);
  moss.selection.effectChoice = {
    abilityKey: 'moss-cleanse',
    targetTeamSlot: 1,
    optionKey: 'burn'
  };
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [moss, createPlayer('player-two', 'attack')]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(moss.team[1].statuses.length, 1);
  assert.equal(moss.team[1].statuses[0].key, 'burn');
  assert.equal(result.effects[0].removedCount, 1);
  assert.equal(result.effects[0].remainingStatusCount, 1);
});

test('Cleanse distinguishes Fracture and Splinter Suppression variants', () => {
  const fracture = {
    ...createStatusInstance('suppressed', 1, 'body'),
    data: {
      consumption: 'matching-activation',
      sourceAbilityKey: 'bone-fracture'
    }
  };
  const splinter = {
    ...createStatusInstance('suppressed', 1, 'mouth'),
    data: {
      consumption: 'different-action-win',
      sourceAbilityKey: 'bone-splinter'
    }
  };
  const moss = addCleanseTeam(createPlayer('player-one', 'guard'), [
    [],
    [fracture, splinter],
    []
  ]);
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [moss, createPlayer('player-two', 'attack')]
  };
  const choices = getValidCleanseChoices(moss, match, 'negative');
  moss.selection.effectChoice = {
    abilityKey: 'moss-cleanse',
    targetTeamSlot: 1,
    optionKey: 'suppressed:mouth:bone-splinter'
  };

  resolveCoreClashRound(match);

  assert.deepEqual(
    choices.map((choice) => choice.optionKey),
    ['suppressed:body:bone-fracture', 'suppressed:mouth:bone-splinter']
  );
  assert.equal(moss.team[1].statuses.length, 1);
  assert.equal(moss.team[1].statuses[0].data.sourceAbilityKey, 'bone-fracture');
});

test('Cleanse allows Guard and resolves with no target when no Negative Status exists', async () => {
  const human = addCleanseTeam(createPlayer('player-one', null), [
    [createStatusInstance('warded')],
    [createStatusInstance('marked')],
    []
  ]);
  human.selection = null;
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [human, createPlayer('player-two', 'attack')],
    events: [],
    async save() {}
  };

  const result = await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'guard'
  });

  assert.equal(result.roundResult.effects[0].status, 'no-target');
  assert.equal(result.roundResult.effects[0].removedCount, 0);
  assert.equal(human.team[0].statuses[0].key, 'warded');
  assert.equal(human.team[1].statuses[0].key, 'marked');
});

test('Clash AI chooses a legal Cleanse target and Negative Status', () => {
  const moss = addCleanseTeam(createPlayer('player-two', null), [
    [],
    [createStatusInstance('suppressed')],
    [createStatusInstance('burn')]
  ]);
  moss.isAi = true;
  const match = {
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions()
  };

  const choice = chooseAiEffectChoice(match, moss, 'guard', () => 0);

  assert.deepEqual(choice, {
    abilityKey: 'moss-cleanse',
    targetTeamSlot: 1,
    optionKey: 'suppressed'
  });
});

test('Cleanse rejects a stale or non-Negative Status choice at commit time', async () => {
  const human = addCleanseTeam(createPlayer('player-one', null), [
    [createStatusInstance('warded')],
    [createStatusInstance('burn')],
    []
  ]);
  human.selection = null;
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [human, createPlayer('player-two', 'attack')],
    events: [],
    async save() {}
  };

  await assert.rejects(
    commitClashSelection({
      models: { OlingClashMatch: { findOne: async () => match } },
      account: { _id: human.accountId },
      matchCode: 'ABC-123',
      action: 'guard',
      effectChoice: {
        abilityKey: 'moss-cleanse',
        targetTeamSlot: 0,
        optionKey: 'warded'
      }
    }),
    (error) => {
      assert.equal(error.code, 'oling_clash_effect_choice_invalid');
      return true;
    }
  );
});

test('Cleanse removal is preserved in the embedded round event', async () => {
  const human = addCleanseTeam(createPlayer('player-one', null), [
    [],
    [createStatusInstance('burn')],
    []
  ]);
  human.selection = null;
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [human, createPlayer('player-two', 'attack')],
    events: [],
    async save() {}
  };

  const result = await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'guard',
    effectChoice: {
      abilityKey: 'moss-cleanse',
      targetTeamSlot: 1,
      optionKey: 'burn'
    }
  });

  assert.equal(human.team[1].statuses.length, 0);
  assert.equal(result.roundResult.effects[0].removedStatusKey, 'burn');
  assert.equal(match.events[0].payload.effects[0].targetTeamSlot, 1);
  assert.equal(match.events[0].payload.effects[0].removedCount, 1);
});

test('Fracture applies Body Suppression after decisive Clash damage', () => {
  const bone = addFractureAbility(createPlayer('player-one', 'attack'));
  const target = addBloodBankAbility(createPlayer('player-two', 'skill'));
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [bone, target]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(target.team[0].heartUnits, 4);
  assert.equal(target.team[0].statuses.length, 1);
  assert.equal(target.team[0].statuses[0].key, 'suppressed');
  assert.equal(target.team[0].statuses[0].targetPart, 'body');
  assert.equal(target.team[0].statuses[0].durationType, 'activation');
  assert.equal(result.effects[0].abilityKey, 'bone-fracture');
  assert.equal(result.effects[0].statusResult, 'applied');
});

test('Fracture prevents and consumes the next successful Body activation', () => {
  const bone = addFractureAbility(createPlayer('player-one', 'attack'));
  const vampire = addBloodBankAbility(createPlayer('player-two', 'skill'));
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [bone, vampire]
  };
  resolveCoreClashRound(match);
  bone.selection = { round: 2, action: 'attack', tagTeamSlot: null };
  vampire.selection = { round: 2, action: 'guard', tagTeamSlot: null };

  const result = resolveCoreClashRound(match);

  assert.equal(bone.team[0].heartUnits, 4);
  assert.equal(vampire.team[0].bloodUnits, 0);
  assert.equal(vampire.team[0].statuses.length, 0);
  assert.equal(result.activations.length, 0);
  assert.equal(result.effects.length, 0);
  assert.equal(result.triggeredStatuses.length, 1);
  assert.equal(result.triggeredStatuses[0].targetPart, 'body');
  assert.equal(
    result.triggeredStatuses[0].preventedAbilityKey,
    'vampire-blood-bank'
  );
});

test('Fracture remains until the affected Oling wins with Guard', () => {
  const bone = addFractureAbility(createPlayer('player-one', 'attack'));
  const vampire = addBloodBankAbility(createPlayer('player-two', 'skill'));
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [bone, vampire]
  };
  resolveCoreClashRound(match);
  bone.selection = { round: 2, action: 'skill', tagTeamSlot: null };
  vampire.selection = { round: 2, action: 'guard', tagTeamSlot: null };

  const lostGuard = resolveCoreClashRound(match);

  assert.equal(lostGuard.triggeredStatuses.length, 0);
  assert.equal(vampire.team[0].statuses.length, 1);
  bone.selection = { round: 3, action: 'attack', tagTeamSlot: null };
  vampire.selection = { round: 3, action: 'guard', tagTeamSlot: null };

  const wonGuard = resolveCoreClashRound(match);

  assert.equal(wonGuard.triggeredStatuses.length, 1);
  assert.equal(vampire.team[0].statuses.length, 0);
  assert.equal(vampire.team[0].bloodUnits, 0);
});

test('Fracture stays on the outgoing Oling when that opponent Tags', () => {
  const bone = addFractureAbility(createPlayer('player-one', 'attack'));
  const target = addCleanseTeam(createPlayer('player-two', 'skill'));
  target.selection.tagTeamSlot = 1;
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [bone, target]
  };

  resolveCoreClashRound(match);

  assert.equal(target.activeTeamSlot, 1);
  assert.equal(target.team[0].statuses[0].key, 'suppressed');
  assert.equal(target.team[1].statuses.length, 0);
});

test('Fracture refreshes matching Suppression instead of stacking it', () => {
  const bone = addFractureAbility(createPlayer('player-one', 'attack'));
  const target = addBloodBankAbility(createPlayer('player-two', 'skill'));
  target.team[0].statuses = [createStatusInstance('suppressed', 1, 'body')];
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 4,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [bone, target]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(target.team[0].statuses.length, 1);
  assert.equal(target.team[0].statuses[0].appliedRound, 4);
  assert.equal(target.team[0].statuses[0].sourcePlayerSlot, 'player-one');
  assert.equal(result.effects[0].statusResult, 'refreshed');
});

test('Fracture cannot Suppress an Oling defeated by its Clash damage', () => {
  const bone = addFractureAbility(createPlayer('player-one', 'attack'));
  const target = addBloodBankAbility(createPlayer('player-two', 'skill', 2));
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [bone, target]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(target.team[0].defeated, true);
  assert.equal(target.team[0].statuses?.length || 0, 0);
  assert.equal(result.effects[0].status, 'no-target');
});

test('Fracture resolution is preserved in the embedded round event', async () => {
  const human = addFractureAbility(createPlayer('player-one', null));
  human.selection = null;
  const opponent = addBloodBankAbility(createPlayer('player-two', 'skill'));
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [human, opponent],
    events: [],
    async save() {}
  };

  const result = await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'attack'
  });

  assert.equal(result.roundResult.effects[0].statusKey, 'suppressed');
  assert.equal(match.events[0].payload.effects[0].targetPart, 'body');
  assert.equal(opponent.team[0].statuses[0].key, 'suppressed');

  opponent.selection = { round: 2, action: 'guard', tagTeamSlot: null };
  const nextRound = await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'attack'
  });

  assert.equal(nextRound.roundResult.triggeredStatuses.length, 1);
  assert.equal(
    match.events[1].payload.triggeredStatuses[0].outcome,
    'activation-suppressed'
  );
  assert.equal(opponent.team[0].statuses.length, 0);
});

test('Splinter can randomly Suppress every opponent Part', () => {
  const expectedParts = ['mouth', 'body', 'flight', 'eyes'];
  [0, 0.25, 0.5, 0.999].forEach((randomValue, index) => {
    const bone = addSplinterAbility(createPlayer('player-one', 'guard'));
    const target = createPlayer('player-two', 'attack');
    const match = {
      status: 'active',
      phase: 'resolution',
      round: 1,
      ruleset: createRuleset(),
      statusDefinitions: createCleanseStatusDefinitions(),
      players: [bone, target]
    };

    const result = resolveCoreClashRound(match, {
      random: () => randomValue
    });

    assert.equal(target.team[0].statuses[0].targetPart, expectedParts[index]);
    assert.equal(
      target.team[0].statuses[0].data.consumption,
      'different-action-win'
    );
    assert.equal(result.effects[0].abilityKey, 'bone-splinter');
    assert.equal(result.effects[0].targetPart, expectedParts[index]);
  });
});

test('Splinter keeps blocking its selected Part across matching wins', () => {
  const bone = addSplinterAbility(createPlayer('player-one', 'guard'));
  const target = addMendTeam(createPlayer('player-two', 'attack'), [4, 6]);
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [bone, target]
  };
  resolveCoreClashRound(match, { random: () => 0 });

  for (let round = 2; round <= 3; round += 1) {
    bone.selection = { round, action: 'skill', tagTeamSlot: null };
    target.selection = { round, action: 'attack', tagTeamSlot: null };
    const result = resolveCoreClashRound(match);

    assert.equal(result.triggeredStatuses[0].status, 'active');
    assert.equal(result.triggeredStatuses[0].targetPart, 'mouth');
    assert.equal(target.team[0].statuses.length, 1);
    assert.equal(target.team[1].heartUnits, 4);
  }
});

test('Splinter clears when the affected Oling wins with a different Action', () => {
  const bone = addSplinterAbility(createPlayer('player-one', 'guard'));
  const target = addMendTeam(createPlayer('player-two', 'attack'), [4, 6]);
  target.team[0].snapshot.abilities.push({
    key: 'plain-skill',
    revision: 1,
    layer: 'flight',
    effects: []
  });
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [bone, target]
  };
  resolveCoreClashRound(match, { random: () => 0 });
  bone.selection = { round: 2, action: 'guard', tagTeamSlot: null };
  target.selection = { round: 2, action: 'skill', tagTeamSlot: null };

  const result = resolveCoreClashRound(match);

  assert.equal(target.team[0].statuses.length, 0);
  assert.equal(result.activations[0].abilityKey, 'plain-skill');
  assert.equal(result.triggeredStatuses.length, 1);
  assert.equal(result.triggeredStatuses[0].outcome, 'different-action-win');
  assert.equal(result.triggeredStatuses[0].targetPart, 'mouth');
  assert.equal(result.triggeredStatuses[0].clearingPart, 'flight');
});

test('Splinter does not clear after a loss or Draw', () => {
  const bone = addSplinterAbility(createPlayer('player-one', 'guard'));
  const target = addMendTeam(createPlayer('player-two', 'attack'));
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [bone, target]
  };
  resolveCoreClashRound(match, { random: () => 0 });
  bone.selection = { round: 2, action: 'attack', tagTeamSlot: null };
  target.selection = { round: 2, action: 'skill', tagTeamSlot: null };
  resolveCoreClashRound(match);
  assert.equal(target.team[0].statuses.length, 1);

  bone.selection = { round: 3, action: 'guard', tagTeamSlot: null };
  target.selection = { round: 3, action: 'guard', tagTeamSlot: null };
  resolveCoreClashRound(match);
  assert.equal(target.team[0].statuses.length, 1);
});

test('Splinter remains attached to its Oling through a Tag', () => {
  const bone = addSplinterAbility(createPlayer('player-one', 'guard'));
  const target = addCleanseTeam(createPlayer('player-two', 'attack'));
  target.selection.tagTeamSlot = 1;
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [bone, target]
  };

  resolveCoreClashRound(match, { random: () => 0.5 });

  assert.equal(target.activeTeamSlot, 1);
  assert.equal(target.team[0].statuses[0].targetPart, 'flight');
  assert.equal(target.team[1].statuses.length, 0);
});

test('Splinter refreshes its own matching Part without replacing Fracture', () => {
  const bone = addSplinterAbility(createPlayer('player-one', 'guard'));
  const target = createPlayer('player-two', 'attack');
  target.team[0].statuses = [
    {
      ...createStatusInstance('suppressed', 1, 'body'),
      data: {
        consumption: 'matching-activation',
        sourceAbilityKey: 'bone-fracture'
      }
    },
    {
      ...createStatusInstance('suppressed', 1, 'mouth'),
      appliedRound: 1,
      data: {
        consumption: 'different-action-win',
        sourceAbilityKey: 'bone-splinter'
      }
    }
  ];
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 4,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [bone, target]
  };

  const result = resolveCoreClashRound(match, { random: () => 0 });

  assert.equal(target.team[0].statuses.length, 2);
  assert.equal(
    target.team[0].statuses.find(
      (status) => status.data.sourceAbilityKey === 'bone-fracture'
    ).targetPart,
    'body'
  );
  assert.equal(
    target.team[0].statuses.find(
      (status) => status.data.sourceAbilityKey === 'bone-splinter'
    ).appliedRound,
    4
  );
  assert.equal(result.effects[0].statusResult, 'refreshed');
});

test('Splinter application and clearing are preserved in round events', async () => {
  const human = addSplinterAbility(createPlayer('player-one', null));
  human.selection = null;
  const opponent = addMendTeam(createPlayer('player-two', 'attack'));
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [human, opponent],
    events: [],
    async save() {}
  };

  const applied = await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'guard',
    resolveRound: (activeMatch) =>
      resolveCoreClashRound(activeMatch, { random: () => 0 })
  });
  assert.equal(applied.roundResult.effects[0].targetPart, 'mouth');

  opponent.selection = { round: 2, action: 'guard', tagTeamSlot: null };
  const cleared = await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'attack'
  });

  assert.equal(cleared.roundResult.triggeredStatuses[0].status, 'removed');
  assert.equal(
    match.events[1].payload.triggeredStatuses[0].outcome,
    'different-action-win'
  );
});

test('Wither blocks Positive Status applications during the following round', () => {
  const bone = addWitherAbility(createPlayer('player-one', 'skill'));
  const opponent = createPlayer('player-two', 'guard');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [bone, opponent]
  };

  const appliedRound = resolveCoreClashRound(match);

  assert.equal(opponent.statuses.length, 1);
  assert.equal(opponent.statuses[0].key, 'blocked');
  assert.equal(opponent.statuses[0].data.category, 'positive-status');
  assert.equal(opponent.statuses[0].data.activeFromRound, 2);
  assert.equal(opponent.statuses[0].expiresAfterRound, 2);
  assert.equal(appliedRound.effects[0].abilityKey, 'bone-wither');
  assert.equal(appliedRound.effects[0].targetTeamSlot, null);

  const positive = applyStatus({
    match,
    sourcePlayerSlot: opponent.slot,
    sourceTeamSlot: 0,
    target: opponent.team[0],
    statusKey: 'warded'
  });
  const negative = applyStatus({
    match,
    sourcePlayerSlot: bone.slot,
    sourceTeamSlot: 0,
    target: opponent.team[0],
    statusKey: 'suppressed',
    targetPart: 'mouth'
  });

  assert.equal(positive.result, 'blocked');
  assert.equal(positive.blockedByStatusKey, 'blocked');
  assert.equal(negative.result, 'applied');
  assert.deepEqual(
    opponent.team[0].statuses.map((status) => status.key),
    ['suppressed']
  );
});

test('Wither persists through a Tag and expires after its active round', () => {
  const bone = addWitherAbility(createPlayer('player-one', 'skill'));
  const opponent = addMendTeam(createPlayer('player-two', 'guard'));
  opponent.selection.tagTeamSlot = 1;
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [bone, opponent]
  };

  resolveCoreClashRound(match);

  assert.equal(opponent.activeTeamSlot, 1);
  assert.equal(opponent.statuses[0].key, 'blocked');
  assert.equal(
    applyStatus({
      match,
      sourcePlayerSlot: opponent.slot,
      sourceTeamSlot: 1,
      target: opponent.team[1],
      statusKey: 'warded'
    }).result,
    'blocked'
  );

  bone.selection = { round: 2, action: 'attack', tagTeamSlot: null };
  opponent.selection = { round: 2, action: 'skill', tagTeamSlot: null };
  const activeRound = resolveCoreClashRound(match);

  assert.equal(opponent.statuses.length, 0);
  assert.equal(activeRound.triggeredStatuses.at(-1).outcome, 'round-expired');
  assert.equal(activeRound.triggeredStatuses.at(-1).statusKey, 'blocked');
});

test('Wither does not block Hearts, Shields, Overgrowth, or Negative Statuses', () => {
  const bone = addWitherAbility(createPlayer('player-one', 'skill'));
  const opponent = createPlayer('player-two', 'guard', 4);
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [bone, opponent]
  };
  resolveCoreClashRound(match);

  const beforeHeartUnits = opponent.team[0].heartUnits;
  opponent.team[0].heartUnits += 1;
  opponent.team[0].shieldCount += 1;
  opponent.team[0].overgrowthUnits += 1;
  const negative = applyStatus({
    match,
    sourcePlayerSlot: bone.slot,
    sourceTeamSlot: 0,
    target: opponent.team[0],
    statusKey: 'suppressed',
    targetPart: 'eyes'
  });

  assert.equal(opponent.team[0].heartUnits, beforeHeartUnits + 1);
  assert.equal(opponent.team[0].shieldCount, 1);
  assert.equal(opponent.team[0].overgrowthUnits, 1);
  assert.equal(negative.result, 'applied');
});

test('Wither application is preserved in the embedded round event', async () => {
  const human = addWitherAbility(createPlayer('player-one', null));
  human.selection = null;
  const opponent = createPlayer('player-two', 'guard');
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [human, opponent],
    events: [],
    async save() {}
  };

  const result = await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'skill'
  });

  assert.equal(result.roundResult.effects[0].abilityKey, 'bone-wither');
  assert.equal(match.events[0].payload.effects[0].statusKey, 'blocked');
  assert.equal(match.events[0].payload.effects[0].activeFromRound, 2);
  assert.equal(opponent.statuses[0].expiresAfterRound, 2);
});

test('Read marks the opponent Action after surviving a Draw', () => {
  const bone = addReadAbility(createPlayer('player-one', 'attack'));
  const opponent = createPlayer('player-two', 'attack');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [bone, opponent]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(result.effects[0].abilityKey, 'bone-read');
  assert.equal(result.effects[0].recordedAction, 'attack');
  assert.equal(result.effects[0].checkRound, 2);
  assert.equal(opponent.statuses[0].key, 'marked');
  assert.equal(opponent.statuses[0].data.recordedAction, 'attack');
  assert.equal(opponent.statuses[0].expiresAfterRound, 2);
});

test('Read Suppresses the tagged-in Oling when the Action is repeated', () => {
  const bone = addReadAbility(createPlayer('player-one', 'attack'));
  const opponent = addMendTeam(createPlayer('player-two', 'attack'));
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [bone, opponent]
  };
  resolveCoreClashRound(match);
  bone.selection = { round: 2, action: 'guard', tagTeamSlot: null };
  opponent.selection = { round: 2, action: 'attack', tagTeamSlot: 1 };

  const result = resolveCoreClashRound(match, { random: () => 0.5 });

  assert.equal(opponent.activeTeamSlot, 1);
  assert.equal(opponent.statuses.length, 0);
  assert.equal(opponent.team[0].statuses?.length || 0, 0);
  assert.equal(opponent.team[1].statuses[0].key, 'suppressed');
  assert.equal(opponent.team[1].statuses[0].targetPart, 'flight');
  assert.equal(opponent.team[1].statuses[0].data.sourceAbilityKey, 'bone-read');
  assert.equal(
    result.triggeredStatuses.find((status) => status.statusKey === 'marked')
      .outcome,
    'action-repeated'
  );
  assert.equal(result.effects.at(-1).targetTeamSlot, 1);
  assert.equal(result.effects.at(-1).activatesRound, 3);
});

test('Read expires without Suppression when the opponent changes Action', () => {
  const bone = addReadAbility(createPlayer('player-one', 'skill'));
  const opponent = createPlayer('player-two', 'skill');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [bone, opponent]
  };
  resolveCoreClashRound(match);
  bone.selection = { round: 2, action: 'attack', tagTeamSlot: null };
  opponent.selection = { round: 2, action: 'guard', tagTeamSlot: null };

  const result = resolveCoreClashRound(match);

  assert.equal(opponent.statuses.length, 0);
  assert.equal(opponent.team[0].statuses?.length || 0, 0);
  assert.equal(
    result.triggeredStatuses.find((status) => status.statusKey === 'marked')
      .outcome,
    'action-changed'
  );
  assert.equal(
    result.effects.some((effect) => effect.abilityKey === 'bone-read'),
    false
  );
});

test('Read Suppression is consumed by its matching successful Part', () => {
  const bone = addReadAbility(createPlayer('player-one', 'guard'));
  const opponent = addCleanseTeam(createPlayer('player-two', 'guard'));
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [bone, opponent]
  };
  resolveCoreClashRound(match);
  bone.selection = { round: 2, action: 'attack', tagTeamSlot: null };
  opponent.selection = { round: 2, action: 'guard', tagTeamSlot: null };
  resolveCoreClashRound(match, { random: () => 0.25 });
  assert.equal(opponent.team[0].statuses[0].targetPart, 'body');

  bone.selection = { round: 3, action: 'attack', tagTeamSlot: null };
  opponent.selection = { round: 3, action: 'guard', tagTeamSlot: null };
  const result = resolveCoreClashRound(match);

  assert.equal(opponent.team[0].statuses.length, 0);
  assert.equal(result.triggeredStatuses[0].outcome, 'activation-suppressed');
  assert.equal(result.triggeredStatuses[0].preventedAbilityKey, 'moss-cleanse');
});

test('Read marking and delayed Suppression are preserved in round events', async () => {
  const human = addReadAbility(createPlayer('player-one', null));
  human.selection = null;
  const opponent = createPlayer('player-two', 'attack');
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [human, opponent],
    events: [],
    async save() {}
  };

  await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'attack'
  });
  opponent.selection = { round: 2, action: 'attack', tagTeamSlot: null };
  const repeated = await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'guard',
    resolveRound: (activeMatch) =>
      resolveCoreClashRound(activeMatch, { random: () => 0.999 })
  });

  assert.equal(match.events[0].payload.effects[0].recordedAction, 'attack');
  assert.equal(
    match.events[1].payload.triggeredStatuses[0].outcome,
    'action-repeated'
  );
  assert.equal(repeated.roundResult.effects.at(-1).targetPart, 'eyes');
});

test('Read does not Suppress when the repeated Action ends the match', () => {
  const bone = addReadAbility(createPlayer('player-one', 'attack'));
  const opponent = createPlayer('player-two', 'attack', 3);
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [bone, opponent]
  };
  resolveCoreClashRound(match);
  bone.selection = { round: 2, action: 'guard', tagTeamSlot: null };
  opponent.selection = { round: 2, action: 'attack', tagTeamSlot: null };

  const result = resolveCoreClashRound(match, { random: () => 0 });

  assert.equal(match.status, 'completed');
  assert.equal(opponent.team[0].statuses?.length || 0, 0);
  assert.equal(
    result.effects.some((effect) => effect.abilityKey === 'bone-read'),
    false
  );
});

test('Eruption deals bonus damage after consecutive Attack victories', () => {
  const magma = addEruptionAbility(createPlayer('player-one', 'attack'));
  const opponent = createPlayer('player-two', 'skill');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [magma, opponent]
  };

  const first = resolveCoreClashRound(match);

  assert.equal(first.effects[0].status, 'condition-not-met');
  assert.equal(opponent.team[0].heartUnits, 4);
  assert.equal(
    magma.team[0].abilityProgress[0].data.lastDecisiveVictoryAction,
    'attack'
  );
  magma.selection = { round: 2, action: 'attack', tagTeamSlot: null };
  opponent.selection = { round: 2, action: 'skill', tagTeamSlot: null };

  const second = resolveCoreClashRound(match);

  assert.equal(second.effects[0].status, 'resolved');
  assert.equal(second.effects[0].damageSource, 'bonus');
  assert.equal(second.effects[0].damageType, 'normal');
  assert.equal(second.effects[0].appliedUnits, 1);
  assert.equal(opponent.team[0].heartUnits, 1);
  assert.equal(second.decisiveVictoryRecords[0].previousAction, 'attack');
});

test('A different decisive victory breaks Eruption consecutive Attacks', () => {
  const magma = addEruptionAbility(createPlayer('player-one', 'attack'));
  const opponent = createPlayer('player-two', 'skill');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [magma, opponent]
  };
  resolveCoreClashRound(match);
  magma.selection = { round: 2, action: 'guard', tagTeamSlot: null };
  opponent.selection = { round: 2, action: 'attack', tagTeamSlot: null };
  resolveCoreClashRound(match);
  assert.equal(
    magma.team[0].abilityProgress[0].data.lastDecisiveVictoryAction,
    'guard'
  );
  magma.selection = { round: 3, action: 'attack', tagTeamSlot: null };
  opponent.selection = { round: 3, action: 'skill', tagTeamSlot: null };

  const result = resolveCoreClashRound(match);

  assert.equal(result.effects[0].status, 'condition-not-met');
  assert.equal(result.effects[0].previousDecisiveVictoryAction, 'guard');
});

test('Losses and Draws do not clear an Eruption Attack victory', () => {
  const magma = addEruptionAbility(createPlayer('player-one', 'attack'));
  const opponent = createPlayer('player-two', 'skill');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [magma, opponent]
  };
  resolveCoreClashRound(match);
  magma.selection = { round: 2, action: 'skill', tagTeamSlot: null };
  opponent.selection = { round: 2, action: 'attack', tagTeamSlot: null };
  resolveCoreClashRound(match);
  magma.selection = { round: 3, action: 'attack', tagTeamSlot: null };
  opponent.selection = { round: 3, action: 'attack', tagTeamSlot: null };
  resolveCoreClashRound(match);
  magma.selection = { round: 4, action: 'attack', tagTeamSlot: null };
  opponent.selection = { round: 4, action: 'skill', tagTeamSlot: null };

  const result = resolveCoreClashRound(match);

  assert.equal(result.effects[0].triggered, true);
  assert.equal(result.effects[0].defeated, true);
  assert.equal(opponent.team[0].heartUnits, 0);
});

test('Eruption routes its damage through remaining Overgrowth after Shields', () => {
  const magma = addEruptionAbility(createPlayer('player-one', 'attack'));
  magma.team[0].abilityProgress = [
    {
      abilityKey: 'magma-eruption',
      abilityRevision: 1,
      activationCount: 0,
      data: { lastDecisiveVictoryAction: 'attack' }
    }
  ];
  const opponent = createPlayer('player-two', 'skill');
  opponent.team[0].shieldCount = 1;
  opponent.team[0].overgrowthUnits = 1;
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 2,
    ruleset: createRuleset(),
    players: [magma, opponent]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(opponent.team[0].shieldCount, 0);
  assert.equal(opponent.team[0].overgrowthUnits, 0);
  assert.equal(opponent.team[0].heartUnits, 6);
  assert.deepEqual(result.effects[0].layers, [
    { layer: 'overgrowth', units: 1 }
  ]);
});

test('Eruption resolution and progress are preserved in round events', async () => {
  const human = addEruptionAbility(createPlayer('player-one', null));
  human.selection = null;
  human.team[0].abilityProgress = [
    {
      abilityKey: 'magma-eruption',
      abilityRevision: 1,
      activationCount: 0,
      data: { lastDecisiveVictoryAction: 'attack' }
    }
  ];
  const opponent = createPlayer('player-two', 'skill');
  opponent.selection.round = 2;
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 2,
    ruleset: createRuleset(),
    players: [human, opponent],
    events: [],
    async save() {}
  };

  const committed = await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'attack'
  });

  assert.equal(committed.roundResult.effects[0].triggered, true);
  assert.equal(match.events[0].payload.effects[0].appliedUnits, 1);
  assert.equal(
    match.events[0].payload.decisiveVictoryRecords[0].action,
    'attack'
  );
});

test('Retaliate primes Burn after a Guard victory', () => {
  const magma = addRetaliateAbility(createPlayer('player-one', 'guard'));
  const opponent = createPlayer('player-two', 'attack');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [magma, opponent]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(magma.team[0].statuses.length, 1);
  assert.equal(magma.team[0].statuses[0].key, 'burn-primed');
  assert.equal(magma.team[0].statuses[0].data.requiredAction, 'attack');
  assert.equal(magma.team[0].statuses[0].data.pendingStatusKey, 'burn');
  assert.equal(result.effects[0].abilityKey, 'magma-retaliate');
  assert.equal(result.effects[0].statusResult, 'applied');
});

test('Retaliate refreshes one Burn Primed Status', () => {
  const magma = addRetaliateAbility(createPlayer('player-one', 'guard'));
  const opponent = createPlayer('player-two', 'attack');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [magma, opponent]
  };
  resolveCoreClashRound(match);
  magma.selection = { round: 2, action: 'guard', tagTeamSlot: null };
  opponent.selection = { round: 2, action: 'attack', tagTeamSlot: null };

  const refreshed = resolveCoreClashRound(match);

  assert.equal(magma.team[0].statuses.length, 1);
  assert.equal(refreshed.effects[0].statusResult, 'refreshed');
  assert.equal(magma.team[0].statuses[0].appliedRound, 2);
});

test('Retaliate waits through losses and Draws before applying Burn', () => {
  const magma = addRetaliateAbility(createPlayer('player-one', 'guard'));
  const opponent = createPlayer('player-two', 'attack');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [magma, opponent]
  };
  resolveCoreClashRound(match);
  magma.selection = { round: 2, action: 'skill', tagTeamSlot: null };
  opponent.selection = { round: 2, action: 'attack', tagTeamSlot: null };
  resolveCoreClashRound(match);
  assert.equal(magma.team[0].statuses[0].key, 'burn-primed');
  magma.selection = { round: 3, action: 'attack', tagTeamSlot: null };
  opponent.selection = { round: 3, action: 'attack', tagTeamSlot: null };
  resolveCoreClashRound(match);
  assert.equal(magma.team[0].statuses[0].key, 'burn-primed');
  magma.selection = { round: 4, action: 'attack', tagTeamSlot: null };
  opponent.selection = { round: 4, action: 'skill', tagTeamSlot: null };

  const applied = resolveCoreClashRound(match);

  assert.equal(magma.team[0].statuses.length, 0);
  assert.equal(opponent.team[0].statuses[0].key, 'burn');
  assert.equal(opponent.team[0].heartUnits, 1);
  assert.equal(
    applied.triggeredStatuses.find(
      (status) => status.statusKey === 'burn-primed'
    ).outcome,
    'status-applied'
  );
  assert.equal(
    applied.triggeredStatuses.some(
      (status) => status.handler === 'damage_after_decisive_clash'
    ),
    false
  );
});

test('Burn from Retaliate triggers on the following decisive Clash', () => {
  const magma = addRetaliateAbility(createPlayer('player-one', 'attack'));
  const opponent = createPlayer('player-two', 'skill', 3);
  magma.team[0].statuses = [
    {
      ...createStatusInstance('burn-primed'),
      sourcePlayerSlot: magma.slot,
      data: {
        condition: 'next-action-win',
        pendingStatusKey: 'burn',
        requiredAction: 'attack',
        sourceAbilityKey: 'magma-retaliate',
        sourceAbilityRevision: 1
      }
    }
  ];
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 2,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [magma, opponent]
  };
  const applied = resolveCoreClashRound(match);
  assert.equal(opponent.team[0].heartUnits, 1);
  assert.equal(opponent.team[0].statuses[0].key, 'burn');
  assert.equal(
    magma.team[0].removedPositiveStatuses[0].status.key,
    'burn-primed'
  );
  assert.equal(
    magma.team[0].removedPositiveStatuses[0].reason,
    'trigger-consumed'
  );
  assert.equal(applied.defeatedPlayerSlots.length, 0);
  magma.selection = { round: 3, action: 'attack', tagTeamSlot: null };
  opponent.selection = { round: 3, action: 'guard', tagTeamSlot: null };

  const triggered = resolveCoreClashRound(match);

  assert.equal(opponent.team[0].heartUnits, 0);
  assert.equal(opponent.team[0].statuses.length, 0);
  assert.equal(triggered.triggeredStatuses[0].damageSource, 'burn');
  assert.equal(triggered.triggeredStatuses[0].appliedUnits, 1);
  assert.equal(triggered.triggeredStatuses[0].defeated, true);
  assert.deepEqual(triggered.defeatedPlayerSlots, ['player-two']);
});

test('Burn uses normal damage routing and destroys a whole Shield', () => {
  const magma = createPlayer('player-one', 'skill');
  const opponent = createPlayer('player-two', 'attack');
  opponent.team[0].shieldCount = 1;
  opponent.team[0].overgrowthUnits = 1;
  opponent.team[0].statuses = [createStatusInstance('burn')];
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 2,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [magma, opponent]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(opponent.team[0].shieldCount, 0);
  assert.equal(opponent.team[0].overgrowthUnits, 1);
  assert.equal(opponent.team[0].heartUnits, 6);
  assert.equal(result.triggeredStatuses[0].damageType, 'normal');
  assert.deepEqual(result.triggeredStatuses[0].layers, [
    { layer: 'shields', units: 1, shieldsDestroyed: 1 }
  ]);
});

test('Retaliate Burn Primed stays on its Oling through a Tag', () => {
  const magma = addRetaliateAbility(
    addBloodsuckTeam(createPlayer('player-one', 'guard'))
  );
  magma.selection.tagTeamSlot = 1;
  const opponent = createPlayer('player-two', 'attack');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [magma, opponent]
  };

  resolveCoreClashRound(match);

  assert.equal(magma.activeTeamSlot, 1);
  assert.equal(magma.team[0].statuses[0].key, 'burn-primed');
  assert.equal(magma.team[1].statuses?.length || 0, 0);
});

test('Wither can block Retaliate Burn Primed as a Positive Status', () => {
  const magma = addRetaliateAbility(createPlayer('player-one', 'guard'));
  magma.statuses = [
    {
      ...createStatusInstance('blocked'),
      sourcePlayerSlot: 'player-two',
      expiresAfterRound: 2,
      durationType: 'round',
      data: { activeFromRound: 2, category: 'positive-status' }
    }
  ];
  const opponent = createPlayer('player-two', 'attack');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 2,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [magma, opponent]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(magma.team[0].statuses.length, 0);
  assert.equal(result.effects[0].status, 'blocked');
  assert.equal(result.effects[0].statusResult, 'blocked');
});

test('Retaliate stages are preserved in embedded round events', async () => {
  const human = addRetaliateAbility(createPlayer('player-one', null));
  human.selection = null;
  const opponent = createPlayer('player-two', 'attack');
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [human, opponent],
    events: [],
    async save() {}
  };

  await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'guard'
  });

  assert.equal(
    match.events[0].payload.effects[0].abilityKey,
    'magma-retaliate'
  );
  assert.equal(match.events[0].payload.effects[0].statusKey, 'burn-primed');
});

test('Ignite primes Burn after surviving a Draw with Last Stand', () => {
  const magma = addIgniteAbility(createPlayer('player-one', 'attack', 1));
  const opponent = createPlayer('player-two', 'attack');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [magma, opponent]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(magma.team[0].heartUnits, 1);
  assert.equal(magma.team[0].statuses[0].key, 'burn-primed');
  assert.equal(
    magma.team[0].statuses[0].data.condition,
    'next-decisive-action-win'
  );
  assert.equal(magma.team[0].statuses[0].durationType, 'clash');
  assert.equal(result.effects[0].abilityKey, 'magma-ignite');
  assert.equal(
    result.effects[0].handler,
    'prime_status_on_next_decisive_action_win'
  );
  assert.equal(result.damage[0].preventedBy, 'last-stand');
});

test('Ignite does not prime when its Eyes activation is Suppressed', () => {
  const magma = addIgniteAbility(createPlayer('player-one', 'attack'));
  magma.team[0].statuses = [
    {
      ...createStatusInstance('suppressed', 1, 'eyes'),
      data: {
        consumption: 'matching-activation',
        sourceAbilityKey: 'bone-splinter'
      }
    }
  ];
  const opponent = createPlayer('player-two', 'attack');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [magma, opponent]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(magma.team[0].statuses.length, 0);
  assert.equal(result.effects.length, 0);
  assert.equal(result.triggeredStatuses[0].outcome, 'activation-suppressed');
  assert.equal(result.triggeredStatuses[0].targetPart, 'eyes');
});

test('Ignite waits for a decisive Attack victory before applying Burn', () => {
  const magma = addIgniteAbility(createPlayer('player-one', 'attack'));
  const opponent = createPlayer('player-two', 'attack');
  opponent.team[0].shieldCount = 1;
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [magma, opponent]
  };
  resolveCoreClashRound(match);
  magma.selection = { round: 2, action: 'guard', tagTeamSlot: null };
  opponent.selection = { round: 2, action: 'attack', tagTeamSlot: null };
  resolveCoreClashRound(match);
  assert.equal(magma.team[0].statuses[0].key, 'burn-primed');
  magma.selection = { round: 3, action: 'attack', tagTeamSlot: null };
  opponent.selection = { round: 3, action: 'guard', tagTeamSlot: null };
  resolveCoreClashRound(match);
  assert.equal(magma.team[0].statuses[0].key, 'burn-primed');
  magma.selection = { round: 4, action: 'attack', tagTeamSlot: null };
  opponent.selection = { round: 4, action: 'attack', tagTeamSlot: null };
  resolveCoreClashRound(match);
  assert.equal(magma.team[0].statuses[0].key, 'burn-primed');
  magma.selection = { round: 5, action: 'attack', tagTeamSlot: null };
  opponent.selection = { round: 5, action: 'skill', tagTeamSlot: null };

  const applied = resolveCoreClashRound(match);

  assert.equal(magma.team[0].statuses.length, 0);
  assert.equal(opponent.team[0].statuses[0].key, 'burn');
  assert.equal(opponent.team[0].statuses[0].data.activeFromRound, 6);
  assert.equal(opponent.team[0].heartUnits, 1);
  assert.equal(
    applied.triggeredStatuses.some(
      (status) => status.handler === 'damage_after_decisive_clash'
    ),
    false
  );
});

test('Ignite Burn Primed stays on its Oling through a Tag', () => {
  const magma = addIgniteAbility(
    addBloodsuckTeam(createPlayer('player-one', 'attack'))
  );
  magma.selection.tagTeamSlot = 1;
  const opponent = createPlayer('player-two', 'attack');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [magma, opponent]
  };

  resolveCoreClashRound(match);

  assert.equal(magma.activeTeamSlot, 1);
  assert.equal(magma.team[0].statuses[0].key, 'burn-primed');
  assert.equal(magma.team[0].statuses[0].data.sourceAbilityKey, 'magma-ignite');
  assert.equal(magma.team[1].statuses?.length || 0, 0);
});

test('Wither can block Ignite Burn Primed as a Positive Status', () => {
  const magma = addIgniteAbility(createPlayer('player-one', 'attack'));
  magma.statuses = [
    {
      ...createStatusInstance('blocked'),
      sourcePlayerSlot: 'player-two',
      expiresAfterRound: 2,
      durationType: 'round',
      data: { activeFromRound: 2, category: 'positive-status' }
    }
  ];
  const opponent = createPlayer('player-two', 'attack');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 2,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [magma, opponent]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(magma.team[0].statuses?.length || 0, 0);
  assert.equal(result.effects[0].status, 'blocked');
  assert.equal(result.effects[0].statusResult, 'blocked');
});

test('Ignite stages are preserved in embedded round events', async () => {
  const human = addIgniteAbility(createPlayer('player-one', null));
  human.selection = null;
  const opponent = createPlayer('player-two', 'attack');
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [human, opponent],
    events: [],
    async save() {}
  };

  await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'attack'
  });

  assert.equal(match.events[0].payload.effects[0].abilityKey, 'magma-ignite');
  assert.equal(match.events[0].payload.effects[0].statusKey, 'burn-primed');
  assert.equal(
    match.events[0].payload.effects[0].condition,
    'next-decisive-action-win'
  );
});

test('Crush deals half a Heart of bonus damage every second Attack victory', () => {
  const stone = addCrushAbility(createPlayer('player-one', 'attack'));
  const opponent = createPlayer('player-two', 'skill');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [stone, opponent]
  };

  const first = resolveCoreClashRound(match);
  assert.equal(first.effects[0].status, 'progressed');
  assert.equal(first.effects[0].afterActivationCount, 1);
  assert.equal(opponent.team[0].heartUnits, 4);
  stone.selection = { round: 2, action: 'attack', tagTeamSlot: null };
  opponent.selection = { round: 2, action: 'skill', tagTeamSlot: null };

  const second = resolveCoreClashRound(match);

  assert.equal(second.effects[0].status, 'resolved');
  assert.equal(second.effects[0].appliedUnits, 1);
  assert.equal(second.effects[0].damageSource, 'bonus');
  assert.equal(second.effects[0].damageType, 'normal');
  assert.equal(second.effects[0].beforeActivationCount, 1);
  assert.equal(second.effects[0].afterActivationCount, 0);
  assert.equal(opponent.team[0].heartUnits, 1);
  assert.equal(stone.team[0].abilityProgress[0].activationCount, 0);
});

test('Crush progress waits through Attack losses and Draws', () => {
  const stone = addCrushAbility(createPlayer('player-one', 'attack'));
  const opponent = createPlayer('player-two', 'skill');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [stone, opponent]
  };
  resolveCoreClashRound(match);
  stone.selection = { round: 2, action: 'attack', tagTeamSlot: null };
  opponent.selection = { round: 2, action: 'guard', tagTeamSlot: null };
  resolveCoreClashRound(match);
  assert.equal(stone.team[0].abilityProgress[0].activationCount, 1);
  stone.selection = { round: 3, action: 'attack', tagTeamSlot: null };
  opponent.selection = { round: 3, action: 'attack', tagTeamSlot: null };
  resolveCoreClashRound(match);
  assert.equal(stone.team[0].abilityProgress[0].activationCount, 1);
  stone.selection = { round: 4, action: 'attack', tagTeamSlot: null };
  opponent.selection = { round: 4, action: 'skill', tagTeamSlot: null };

  const result = resolveCoreClashRound(match);

  assert.equal(result.effects[0].triggered, true);
  assert.equal(stone.team[0].abilityProgress[0].activationCount, 0);
  assert.equal(opponent.team[0].defeated, true);
});

test('Crush bonus damage uses Normal routing against a whole Shield', () => {
  const stone = addCrushAbility(createPlayer('player-one', 'attack'));
  stone.team[0].abilityProgress = [
    {
      abilityKey: 'stone-crush',
      abilityRevision: 1,
      activationCount: 1
    }
  ];
  const opponent = createPlayer('player-two', 'skill');
  opponent.team[0].shieldCount = 2;
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 2,
    ruleset: createRuleset(),
    players: [stone, opponent]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(opponent.team[0].shieldCount, 0);
  assert.equal(opponent.team[0].heartUnits, 6);
  assert.deepEqual(result.effects[0].layers, [
    { layer: 'shields', units: 1, shieldsDestroyed: 1 }
  ]);
});

test('Crush progress remains with Stone while it Tags out', () => {
  const stone = addCrushAbility(
    addBloodsuckTeam(createPlayer('player-one', 'attack'))
  );
  stone.selection.tagTeamSlot = 1;
  const opponent = createPlayer('player-two', 'skill');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    players: [stone, opponent]
  };

  resolveCoreClashRound(match);
  assert.equal(stone.activeTeamSlot, 1);
  assert.equal(stone.team[0].abilityProgress[0].activationCount, 1);
  assert.deepEqual(stone.team[1].abilityProgress, []);
  stone.activeTeamSlot = 0;
  stone.selection = { round: 2, action: 'attack', tagTeamSlot: null };
  opponent.selection = { round: 2, action: 'skill', tagTeamSlot: null };
  resolveCoreClashRound(match);

  assert.equal(stone.team[0].abilityProgress[0].activationCount, 0);
  assert.equal(opponent.team[0].heartUnits, 1);
});

test('Crush resets after triggering when base damage already defeated its target', () => {
  const stone = addCrushAbility(createPlayer('player-one', 'attack'));
  stone.team[0].abilityProgress = [
    {
      abilityKey: 'stone-crush',
      abilityRevision: 1,
      activationCount: 1
    }
  ];
  const opponent = createPlayer('player-two', 'skill', 2);
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 2,
    ruleset: createRuleset(),
    players: [stone, opponent]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(opponent.team[0].defeated, true);
  assert.equal(result.effects[0].status, 'no-target');
  assert.equal(result.effects[0].triggered, true);
  assert.equal(result.effects[0].afterActivationCount, 0);
  assert.equal(stone.team[0].abilityProgress[0].activationCount, 0);
});

test('Mouth Suppression consumes Crush cadence but not base damage', () => {
  const stone = addCrushAbility(createPlayer('player-one', 'attack'));
  stone.team[0].statuses = [
    {
      ...createStatusInstance('suppressed', 1, 'mouth'),
      data: {
        consumption: 'matching-activation',
        sourceAbilityKey: 'magma-scorch'
      }
    }
  ];
  const opponent = createPlayer('player-two', 'skill');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [stone, opponent]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(opponent.team[0].heartUnits, 4);
  assert.equal(stone.team[0].abilityProgress[0].activationCount, 1);
  assert.equal(result.effects.length, 0);
  assert.equal(result.triggeredStatuses[0].outcome, 'activation-suppressed');
});

test('Crush progress and damage are preserved in embedded round events', async () => {
  const human = addCrushAbility(createPlayer('player-one', null));
  human.selection = null;
  const opponent = createPlayer('player-two', 'skill');
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    players: [human, opponent],
    events: [],
    async save() {}
  };

  await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'attack'
  });
  opponent.selection = { round: 2, action: 'skill', tagTeamSlot: null };
  await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'attack'
  });

  assert.equal(match.events[0].payload.effects[0].status, 'progressed');
  assert.equal(match.events[0].payload.effects[0].afterActivationCount, 1);
  assert.equal(match.events[1].payload.effects[0].abilityKey, 'stone-crush');
  assert.equal(match.events[1].payload.effects[0].appliedUnits, 1);
  assert.equal(match.events[1].payload.effects[0].afterActivationCount, 0);
});

test('Fortify Wards Stone against the next bonus-damage effect', () => {
  const stone = addFortifyAbility(createPlayer('player-one', 'guard'));
  const opponent = createPlayer('player-two', 'attack');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [stone, opponent]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(stone.team[0].statuses.length, 1);
  assert.equal(stone.team[0].statuses[0].key, 'warded');
  assert.equal(stone.team[0].statuses[0].data.category, 'bonus-damage');
  assert.equal(
    stone.team[0].statuses[0].data.sourceAbilityKey,
    'stone-fortify'
  );
  assert.equal(result.effects[0].abilityKey, 'stone-fortify');
  assert.equal(result.effects[0].statusResult, 'applied');
});

test('Fortify refreshes its existing bonus-damage Ward', () => {
  const stone = addFortifyAbility(createPlayer('player-one', 'guard'));
  const opponent = createPlayer('player-two', 'attack');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [stone, opponent]
  };
  resolveCoreClashRound(match);
  stone.selection = { round: 2, action: 'guard', tagTeamSlot: null };
  opponent.selection = { round: 2, action: 'attack', tagTeamSlot: null };

  const refreshed = resolveCoreClashRound(match);

  assert.equal(stone.team[0].statuses.length, 1);
  assert.equal(stone.team[0].statuses[0].appliedRound, 2);
  assert.equal(refreshed.effects[0].statusResult, 'refreshed');
});

test('Fortify prevents Eruption bonus damage but not base Clash damage', () => {
  const magma = addEruptionAbility(createPlayer('player-one', 'attack'));
  magma.team[0].abilityProgress = [
    {
      abilityKey: 'magma-eruption',
      abilityRevision: 1,
      activationCount: 0,
      data: { lastDecisiveVictoryAction: 'attack' }
    }
  ];
  const stone = createPlayer('player-two', 'skill');
  stone.team[0].statuses = [
    {
      ...createStatusInstance('warded'),
      sourcePlayerSlot: stone.slot,
      data: {
        category: 'bonus-damage',
        sourceAbilityKey: 'stone-fortify',
        sourceAbilityRevision: 1
      }
    }
  ];
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 2,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [magma, stone]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(stone.team[0].heartUnits, 4);
  assert.equal(stone.team[0].statuses.length, 0);
  assert.equal(result.effects[0].status, 'prevented');
  assert.equal(result.effects[0].outcome, 'effect-prevented');
  assert.equal(result.effects[0].preventedByStatusKey, 'warded');
  assert.equal(result.effects[0].appliedUnits, 0);
});

test('Fortify prevents triggered Crush and Crush still resets its counter', () => {
  const stoneAttacker = addCrushAbility(createPlayer('player-one', 'attack'));
  stoneAttacker.team[0].abilityProgress = [
    {
      abilityKey: 'stone-crush',
      abilityRevision: 1,
      activationCount: 1
    }
  ];
  const defender = createPlayer('player-two', 'skill');
  defender.team[0].statuses = [
    {
      ...createStatusInstance('warded'),
      data: {
        category: 'bonus-damage',
        sourceAbilityKey: 'stone-fortify'
      }
    }
  ];
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 2,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [stoneAttacker, defender]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(defender.team[0].heartUnits, 4);
  assert.equal(defender.team[0].statuses.length, 0);
  assert.equal(result.effects[0].status, 'prevented');
  assert.equal(result.effects[0].triggered, true);
  assert.equal(result.effects[0].afterActivationCount, 0);
  assert.equal(stoneAttacker.team[0].abilityProgress[0].activationCount, 0);
});

test('Fortify is not consumed by base, Draw, Burn, or untriggered bonus damage', () => {
  const magma = addEruptionAbility(createPlayer('player-one', 'attack'));
  const stone = createPlayer('player-two', 'skill');
  stone.team[0].statuses = [
    {
      ...createStatusInstance('warded'),
      data: {
        category: 'bonus-damage',
        sourceAbilityKey: 'stone-fortify'
      }
    },
    createStatusInstance('burn')
  ];
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [magma, stone]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(stone.team[0].heartUnits, 3);
  assert.equal(stone.team[0].statuses.length, 1);
  assert.equal(stone.team[0].statuses[0].key, 'warded');
  assert.equal(result.effects[0].status, 'condition-not-met');
  assert.equal(
    result.triggeredStatuses.find((status) => status.statusKey === 'burn')
      .appliedUnits,
    1
  );
  magma.selection = { round: 2, action: 'attack', tagTeamSlot: null };
  stone.selection = { round: 2, action: 'attack', tagTeamSlot: null };
  resolveCoreClashRound(match);
  assert.equal(stone.team[0].heartUnits, 2);
  assert.equal(stone.team[0].statuses.length, 1);
  assert.equal(stone.team[0].statuses[0].key, 'warded');
});

test('Fortify remains on its Oling through a Tag', () => {
  const stone = addFortifyAbility(
    addBloodsuckTeam(createPlayer('player-one', 'guard'))
  );
  stone.selection.tagTeamSlot = 1;
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [stone, createPlayer('player-two', 'attack')]
  };

  resolveCoreClashRound(match);

  assert.equal(stone.activeTeamSlot, 1);
  assert.equal(stone.team[0].statuses[0].key, 'warded');
  assert.equal(stone.team[1].statuses?.length || 0, 0);
});

test('Wither blocks Fortify because Warded is a Positive Status', () => {
  const stone = addFortifyAbility(createPlayer('player-one', 'guard'));
  stone.statuses = [
    {
      ...createStatusInstance('blocked'),
      expiresAfterRound: 2,
      durationType: 'round',
      data: { activeFromRound: 2, category: 'positive-status' }
    }
  ];
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 2,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [stone, createPlayer('player-two', 'attack')]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(stone.team[0].statuses?.length || 0, 0);
  assert.equal(result.effects[0].status, 'blocked');
  assert.equal(result.effects[0].statusResult, 'blocked');
});

test('Body Suppression prevents Fortify but not base Clash damage', () => {
  const stone = addFortifyAbility(createPlayer('player-one', 'guard'));
  stone.team[0].statuses = [
    {
      ...createStatusInstance('suppressed', 1, 'body'),
      data: {
        consumption: 'matching-activation',
        sourceAbilityKey: 'bone-fracture'
      }
    }
  ];
  const opponent = createPlayer('player-two', 'attack');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [stone, opponent]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(opponent.team[0].heartUnits, 4);
  assert.equal(stone.team[0].statuses.length, 0);
  assert.equal(result.effects.length, 0);
  assert.equal(result.triggeredStatuses[0].outcome, 'activation-suppressed');
});

test('Fortify application is preserved in round events', async () => {
  const human = addFortifyAbility(createPlayer('player-one', null));
  human.selection = null;
  const opponent = createPlayer('player-two', 'attack');
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [human, opponent],
    events: [],
    async save() {}
  };

  await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'guard'
  });

  assert.equal(match.events[0].payload.effects[0].abilityKey, 'stone-fortify');
  assert.equal(match.events[0].payload.effects[0].statusKey, 'warded');
  assert.equal(match.events[0].payload.effects[0].category, 'bonus-damage');
});

test('Reinforce offers every Part on its active Oling', () => {
  const stone = addReinforceAbility(createPlayer('player-one', 'skill'));

  assert.deepEqual(getValidPartWardChoices(stone, 0), [
    { abilityTargetTeamSlot: 0, optionKey: 'mouth', targetPart: 'mouth' },
    { abilityTargetTeamSlot: 0, optionKey: 'body', targetPart: 'body' },
    { abilityTargetTeamSlot: 0, optionKey: 'flight', targetPart: 'flight' },
    { abilityTargetTeamSlot: 0, optionKey: 'eyes', targetPart: 'eyes' }
  ]);
});

test('Reinforce applies a part-disable Ward to the chosen Part', () => {
  const stone = addReinforceAbility(createPlayer('player-one', 'skill'));
  stone.selection.effectChoice = {
    abilityKey: 'stone-reinforce',
    targetTeamSlot: 0,
    optionKey: 'body'
  };
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [stone, createPlayer('player-two', 'guard')]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(stone.team[0].statuses[0].key, 'warded');
  assert.equal(stone.team[0].statuses[0].targetPart, 'body');
  assert.equal(stone.team[0].statuses[0].data.category, 'part-disable');
  assert.equal(result.effects[0].abilityKey, 'stone-reinforce');
  assert.equal(result.effects[0].optionKey, 'body');
});

test('Reinforce can Ward different Parts independently and refresh matches', () => {
  const stone = addReinforceAbility(createPlayer('player-one', 'skill'));
  stone.selection.effectChoice = {
    abilityKey: 'stone-reinforce',
    targetTeamSlot: 0,
    optionKey: 'body'
  };
  const opponent = createPlayer('player-two', 'guard', 10);
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [stone, opponent]
  };
  resolveCoreClashRound(match);
  stone.selection = {
    round: 2,
    action: 'skill',
    tagTeamSlot: null,
    effectChoice: {
      abilityKey: 'stone-reinforce',
      targetTeamSlot: 0,
      optionKey: 'mouth'
    }
  };
  opponent.selection = { round: 2, action: 'guard', tagTeamSlot: null };
  resolveCoreClashRound(match);
  assert.deepEqual(
    stone.team[0].statuses.map((status) => status.targetPart),
    ['body', 'mouth']
  );
  stone.selection = {
    round: 3,
    action: 'skill',
    tagTeamSlot: null,
    effectChoice: {
      abilityKey: 'stone-reinforce',
      targetTeamSlot: 0,
      optionKey: 'body'
    }
  };
  opponent.selection = { round: 3, action: 'guard', tagTeamSlot: null };

  const refreshed = resolveCoreClashRound(match);

  assert.equal(stone.team[0].statuses.length, 2);
  assert.equal(stone.team[0].statuses[0].appliedRound, 3);
  assert.equal(refreshed.effects[0].statusResult, 'refreshed');
});

test('Reinforce requires a valid Part choice for online selection', async () => {
  const human = addReinforceAbility(createPlayer('player-one', null));
  human.selection = null;
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [human, createPlayer('player-two', 'guard')],
    events: [],
    async save() {}
  };

  await assert.rejects(
    commitClashSelection({
      models: { OlingClashMatch: { findOne: async () => match } },
      account: { _id: human.accountId },
      matchCode: 'ABC-123',
      action: 'skill'
    }),
    (error) => error.code === 'oling_clash_effect_choice_required'
  );
  await assert.rejects(
    commitClashSelection({
      models: { OlingClashMatch: { findOne: async () => match } },
      account: { _id: human.accountId },
      matchCode: 'ABC-123',
      action: 'skill',
      effectChoice: {
        abilityKey: 'stone-reinforce',
        targetTeamSlot: 0,
        optionKey: 'tail'
      }
    }),
    (error) => error.code === 'oling_clash_effect_choice_invalid'
  );
});

test('Reinforce prevents matching Fracture and consumes only its Ward', () => {
  const bone = addFractureAbility(createPlayer('player-one', 'attack'));
  const stone = createPlayer('player-two', 'skill');
  stone.team[0].statuses = [
    {
      ...createStatusInstance('warded', 1, 'body'),
      sourcePlayerSlot: stone.slot,
      data: {
        category: 'part-disable',
        sourceAbilityKey: 'stone-reinforce'
      }
    }
  ];
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 2,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [bone, stone]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(stone.team[0].heartUnits, 4);
  assert.equal(stone.team[0].statuses.length, 0);
  assert.equal(result.effects[0].status, 'prevented');
  assert.equal(result.effects[0].statusResult, 'warded');
  assert.equal(result.effects[0].preventedByStatusKey, 'warded');
  assert.equal(result.effects[0].targetPart, 'body');
});

test('Reinforce ignores Suppression aimed at a different Part', () => {
  const bone = addFractureAbility(createPlayer('player-one', 'attack'));
  const stone = createPlayer('player-two', 'skill');
  stone.team[0].statuses = [
    {
      ...createStatusInstance('warded', 1, 'mouth'),
      data: {
        category: 'part-disable',
        sourceAbilityKey: 'stone-reinforce'
      }
    }
  ];
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 2,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [bone, stone]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(stone.team[0].statuses.length, 2);
  assert.equal(stone.team[0].statuses[0].targetPart, 'mouth');
  assert.equal(stone.team[0].statuses[1].key, 'suppressed');
  assert.equal(stone.team[0].statuses[1].targetPart, 'body');
  assert.equal(result.effects[0].status, 'resolved');
});

test('Reinforce prevents matching Splinter and delayed Read Suppression', () => {
  const bone = addSplinterAbility(createPlayer('player-one', 'guard'));
  const stone = createPlayer('player-two', 'attack');
  stone.team[0].statuses = [
    {
      ...createStatusInstance('warded', 1, 'body'),
      data: {
        category: 'part-disable',
        sourceAbilityKey: 'stone-reinforce'
      }
    }
  ];
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 2,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [bone, stone]
  };

  const splinter = resolveCoreClashRound(match, { random: () => 0.3 });
  assert.equal(stone.team[0].statuses.length, 0);
  assert.equal(splinter.effects[0].status, 'prevented');
  stone.team[0].statuses = [
    {
      ...createStatusInstance('warded', 1, 'eyes'),
      data: {
        category: 'part-disable',
        sourceAbilityKey: 'stone-reinforce'
      }
    }
  ];
  const applied = applyStatus({
    match,
    sourcePlayerSlot: bone.slot,
    sourceTeamSlot: 0,
    target: stone.team[0],
    statusKey: 'suppressed',
    targetPart: 'eyes',
    durationType: 'activation',
    remaining: 1,
    data: { sourceAbilityKey: 'bone-read' }
  });

  assert.equal(applied.result, 'warded');
  assert.equal(stone.team[0].statuses.length, 0);
});

test('Reinforce remains attached to its Oling through a Tag', () => {
  const stone = addReinforceAbility(
    addBloodsuckTeam(createPlayer('player-one', 'skill'))
  );
  stone.selection.effectChoice = {
    abilityKey: 'stone-reinforce',
    targetTeamSlot: 0,
    optionKey: 'flight'
  };
  stone.selection.tagTeamSlot = 1;
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [stone, createPlayer('player-two', 'guard')]
  };

  resolveCoreClashRound(match);

  assert.equal(stone.activeTeamSlot, 1);
  assert.equal(stone.team[0].statuses[0].targetPart, 'flight');
  assert.equal(stone.team[1].statuses?.length || 0, 0);
});

test('Wither and Wings Suppression can prevent Reinforce', () => {
  const stone = addReinforceAbility(createPlayer('player-one', 'skill'));
  stone.selection.effectChoice = {
    abilityKey: 'stone-reinforce',
    targetTeamSlot: 0,
    optionKey: 'eyes'
  };
  stone.statuses = [
    {
      ...createStatusInstance('blocked'),
      expiresAfterRound: 2,
      durationType: 'round',
      data: { activeFromRound: 2, category: 'positive-status' }
    }
  ];
  const opponent = createPlayer('player-two', 'guard');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 2,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [stone, opponent]
  };

  const blocked = resolveCoreClashRound(match);
  assert.equal(stone.team[0].statuses?.length || 0, 0);
  assert.equal(blocked.effects[0].status, 'blocked');
  stone.statuses = [];
  stone.team[0].statuses = [
    {
      ...createStatusInstance('suppressed', 1, 'flight'),
      data: {
        consumption: 'matching-activation',
        sourceAbilityKey: 'bone-splinter'
      }
    }
  ];
  stone.selection = {
    round: 3,
    action: 'skill',
    tagTeamSlot: null,
    effectChoice: {
      abilityKey: 'stone-reinforce',
      targetTeamSlot: 0,
      optionKey: 'eyes'
    }
  };
  opponent.selection = { round: 3, action: 'guard', tagTeamSlot: null };

  const suppressed = resolveCoreClashRound(match);

  assert.equal(stone.team[0].statuses.length, 0);
  assert.equal(suppressed.effects.length, 0);
  assert.equal(
    suppressed.triggeredStatuses[0].outcome,
    'activation-suppressed'
  );
});

test('Clash AI chooses a valid Reinforce Part', () => {
  const ai = addReinforceAbility(createPlayer('ai', 'skill'));
  ai.isAi = true;
  const match = {
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [createPlayer('human', 'guard'), ai]
  };

  assert.deepEqual(
    chooseAiEffectChoice(match, ai, 'skill', () => 0.99),
    {
      abilityKey: 'stone-reinforce',
      targetTeamSlot: 0,
      optionKey: 'eyes'
    }
  );
});

test('Reinforce choice and Ward are preserved in embedded round events', async () => {
  const human = addReinforceAbility(createPlayer('player-one', null));
  human.selection = null;
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [human, createPlayer('player-two', 'guard')],
    events: [],
    async save() {}
  };

  await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'skill',
    effectChoice: {
      abilityKey: 'stone-reinforce',
      targetTeamSlot: 0,
      optionKey: 'eyes'
    }
  });

  assert.equal(
    match.events[0].payload.effects[0].abilityKey,
    'stone-reinforce'
  );
  assert.equal(match.events[0].payload.effects[0].targetPart, 'eyes');
  assert.equal(match.events[0].payload.effects[0].category, 'part-disable');
});

test('Scorch Suppresses the opposing active Mouth after a Skill victory', () => {
  const magma = addScorchAbility(createPlayer('player-one', 'skill'));
  const target = addMendTeam(createPlayer('player-two', 'guard'));
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [magma, target]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(target.team[0].statuses.length, 1);
  assert.equal(target.team[0].statuses[0].key, 'suppressed');
  assert.equal(target.team[0].statuses[0].targetPart, 'mouth');
  assert.equal(
    target.team[0].statuses[0].data.sourceAbilityKey,
    'magma-scorch'
  );
  assert.equal(result.effects[0].abilityKey, 'magma-scorch');
  assert.equal(result.effects[0].statusResult, 'applied');
});

test('Scorch consumes on an Attack victory but preserves base damage', () => {
  const magma = addScorchAbility(createPlayer('player-one', 'skill'));
  const target = addMendTeam(createPlayer('player-two', 'guard'), [3, 5]);
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [magma, target]
  };
  resolveCoreClashRound(match);
  magma.selection = { round: 2, action: 'skill', tagTeamSlot: null };
  target.selection = { round: 2, action: 'attack', tagTeamSlot: null };

  const result = resolveCoreClashRound(match);

  assert.equal(magma.team[0].heartUnits, 4);
  assert.equal(target.team[1].heartUnits, 3);
  assert.equal(target.team[0].statuses.length, 0);
  assert.equal(result.triggeredStatuses[0].outcome, 'activation-suppressed');
  assert.equal(result.triggeredStatuses[0].targetPart, 'mouth');
  assert.equal(result.triggeredStatuses[0].preventedAbilityKey, 'moss-mend');
});

test('Scorch waits through Attack losses and Draws', () => {
  const magma = addScorchAbility(createPlayer('player-one', 'skill'));
  const target = addMendTeam(createPlayer('player-two', 'guard'));
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [magma, target]
  };
  resolveCoreClashRound(match);
  magma.selection = { round: 2, action: 'guard', tagTeamSlot: null };
  target.selection = { round: 2, action: 'attack', tagTeamSlot: null };
  resolveCoreClashRound(match);
  assert.equal(target.team[0].statuses.length, 1);
  magma.selection = { round: 3, action: 'attack', tagTeamSlot: null };
  target.selection = { round: 3, action: 'attack', tagTeamSlot: null };
  resolveCoreClashRound(match);
  assert.equal(target.team[0].statuses.length, 1);
});

test('Scorch remains on the outgoing Oling through a Tag', () => {
  const magma = addScorchAbility(createPlayer('player-one', 'skill'));
  const target = addMendTeam(createPlayer('player-two', 'guard'));
  target.selection.tagTeamSlot = 1;
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [magma, target]
  };

  resolveCoreClashRound(match);

  assert.equal(target.activeTeamSlot, 1);
  assert.equal(target.team[0].statuses[0].targetPart, 'mouth');
  assert.equal(target.team[1].statuses?.length || 0, 0);
});

test('Scorch refreshes its Mouth Suppression without replacing Fracture', () => {
  const magma = addScorchAbility(createPlayer('player-one', 'skill'));
  const target = addMendTeam(createPlayer('player-two', 'guard'));
  target.team[0].statuses = [
    {
      ...createStatusInstance('suppressed', 1, 'body'),
      data: {
        consumption: 'matching-activation',
        sourceAbilityKey: 'bone-fracture'
      }
    },
    {
      ...createStatusInstance('suppressed', 1, 'mouth'),
      data: {
        consumption: 'matching-activation',
        sourceAbilityKey: 'magma-scorch'
      }
    }
  ];
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 4,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [magma, target]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(target.team[0].statuses.length, 2);
  assert.equal(
    target.team[0].statuses.find(
      (status) => status.data.sourceAbilityKey === 'magma-scorch'
    ).appliedRound,
    4
  );
  assert.equal(result.effects[0].statusResult, 'refreshed');
});

test('Scorch cannot Suppress an Oling defeated by base Clash damage', () => {
  const magma = addScorchAbility(createPlayer('player-one', 'skill'));
  const target = addMendTeam(createPlayer('player-two', 'guard', 2));
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [magma, target]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(target.team[0].defeated, true);
  assert.equal(target.team[0].statuses?.length || 0, 0);
  assert.equal(result.effects[0].status, 'no-target');
});

test('Scorch application and consumption are preserved in round events', async () => {
  const human = addScorchAbility(createPlayer('player-one', null));
  human.selection = null;
  const opponent = addMendTeam(createPlayer('player-two', 'guard'));
  const match = {
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [human, opponent],
    events: [],
    async save() {}
  };

  await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'skill'
  });
  assert.equal(match.events[0].payload.effects[0].abilityKey, 'magma-scorch');
  assert.equal(match.events[0].payload.effects[0].targetPart, 'mouth');
  opponent.selection = { round: 2, action: 'attack', tagTeamSlot: null };
  await commitClashSelection({
    models: { OlingClashMatch: { findOne: async () => match } },
    account: { _id: human.accountId },
    matchCode: 'ABC-123',
    action: 'skill'
  });

  assert.equal(
    match.events[1].payload.triggeredStatuses[0].outcome,
    'activation-suppressed'
  );
  assert.equal(
    match.events[1].payload.triggeredStatuses[0].targetPart,
    'mouth'
  );
});

test('Scavenge marks the opponent Part used in the previous round', () => {
  const trash = addScavengeAbility(createPlayer('player-one', 'attack'));
  const opponent = createPlayer('player-two', 'skill');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 2,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [trash, opponent],
    events: [
      {
        type: 'round-resolved',
        payload: {
          actions: {
            'player-one': 'skill',
            'player-two': 'guard'
          }
        }
      }
    ]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(result.effects[0].abilityKey, 'trash-scavenge');
  assert.equal(result.effects[0].recordedPart, 'body');
  assert.equal(result.effects[0].displayStatusKey, 'steal-primed');
  assert.equal(opponent.statuses.length, 1);
  assert.equal(opponent.statuses[0].data.recordedPart, 'body');
  assert.equal(opponent.statuses[0].data.checkRound, 3);
});

test('Scavenge Steals a matching positive Part effect next round', () => {
  const trash = addScavengeAbility(
    addMendTeam(createPlayer('player-one', 'skill'), [3, 6])
  );
  const opponent = addMendTeam(createPlayer('player-two', 'attack'), [2, 6]);
  opponent.statuses = [
    {
      key: 'marked',
      revision: 1,
      sourcePlayerSlot: trash.slot,
      sourceTeamSlot: 0,
      targetPart: null,
      stacks: 1,
      appliedRound: 1,
      expiresAfterRound: 2,
      durationType: 'round',
      remaining: null,
      data: {
        checkRound: 2,
        condition: 'positive-effect-steal',
        recordedPart: 'mouth',
        sourceAbilityKey: 'trash-scavenge',
        sourceAbilityRevision: 1
      }
    }
  ];
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 2,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [trash, opponent],
    events: []
  };

  const result = resolveCoreClashRound(match);

  assert.equal(trash.team[1].heartUnits, 4);
  assert.equal(opponent.team[1].heartUnits, 2);
  assert.equal(opponent.statuses.length, 0);
  assert.equal(result.effects[0].abilityKey, 'moss-mend');
  assert.equal(result.effects[0].playerSlot, trash.slot);
  assert.equal(result.effects[0].redirectType, 'steal');
  assert.equal(result.effects[0].redirectCount, 1);
  assert.equal(result.effects[0].stolenFromPlayerSlot, opponent.slot);
});

test('Scavenge consumes its mark without redirecting a negative effect', () => {
  const trash = createPlayer('player-one', 'skill');
  const bone = addFractureAbility(createPlayer('player-two', 'attack'));
  bone.statuses = [
    {
      key: 'marked',
      revision: 1,
      sourcePlayerSlot: trash.slot,
      sourceTeamSlot: 0,
      appliedRound: 1,
      expiresAfterRound: 2,
      durationType: 'round',
      data: {
        checkRound: 2,
        condition: 'positive-effect-steal',
        recordedPart: 'mouth',
        sourceAbilityKey: 'trash-scavenge',
        sourceAbilityRevision: 1
      }
    }
  ];
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 2,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [trash, bone],
    events: []
  };

  const result = resolveCoreClashRound(match);

  assert.equal(bone.statuses.length, 0);
  assert.equal(trash.team[0].statuses[0].targetPart, 'body');
  assert.equal(result.effects[0].playerSlot, bone.slot);
  assert.equal(result.effects[0].redirected, undefined);
});

test('Return to Sender Reflects Fracture back onto its Mouth owner', () => {
  const trash = addReturnToSenderAbility(createPlayer('player-one', 'guard'));
  const bone = addFractureAbility(createPlayer('player-two', 'attack'));
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [trash, bone]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(trash.team[0].statuses?.length || 0, 0);
  assert.equal(bone.team[0].statuses.length, 1);
  assert.equal(bone.team[0].statuses[0].targetPart, 'body');
  assert.equal(result.effects[0].abilityKey, 'bone-fracture');
  assert.equal(result.effects[0].redirectType, 'reflect');
  assert.equal(result.effects[0].redirectCount, 1);
  assert.equal(
    result.effects[0].redirectedByAbilityKey,
    'trash-return-to-sender'
  );
  assert.equal(result.effects[0].reflectedFromPlayerSlot, bone.slot);
});

test('Return to Sender uses the attacker progress for reflected Eruption', () => {
  const trash = addReturnToSenderAbility(createPlayer('player-one', 'guard'));
  const magma = addEruptionAbility(createPlayer('player-two', 'attack'));
  magma.team[0].abilityProgress = [
    {
      abilityKey: 'magma-eruption',
      abilityRevision: 1,
      activationCount: 0,
      data: { lastDecisiveVictoryAction: 'attack' }
    }
  ];
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 2,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [trash, magma]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(result.effects[0].abilityKey, 'magma-eruption');
  assert.equal(result.effects[0].triggered, true);
  assert.equal(result.effects[0].appliedUnits, 1);
  assert.equal(result.effects[0].targetPlayerSlot, magma.slot);
  assert.equal(result.effects[0].redirectType, 'reflect');
  assert.equal(magma.team[0].heartUnits, 3);
});

test('Return to Sender does not Reflect an ally-targeted Mouth effect', () => {
  const trash = addReturnToSenderAbility(createPlayer('player-one', 'guard'));
  const moss = addMendTeam(createPlayer('player-two', 'attack'), [3, 6]);
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [trash, moss]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(moss.team[1].heartUnits, 3);
  assert.equal(result.effects[0].abilityKey, 'trash-return-to-sender');
  assert.equal(result.effects[0].status, 'no-effect');
  assert.equal(result.effects[0].outcome, 'no-reflectable-effect');
});

test('Return to Sender leaves a Suppressed Mouth unactivated', () => {
  const trash = addReturnToSenderAbility(createPlayer('player-one', 'guard'));
  const bone = addFractureAbility(createPlayer('player-two', 'attack'));
  bone.team[0].statuses = [
    {
      ...createStatusInstance('suppressed', 1, 'mouth'),
      data: {
        consumption: 'matching-activation',
        sourceAbilityKey: 'magma-scorch'
      }
    }
  ];
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 2,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [trash, bone]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(bone.team[0].statuses.length, 1);
  assert.equal(trash.team[0].statuses.length, 0);
  assert.equal(result.effects[0].abilityKey, 'trash-return-to-sender');
  assert.equal(result.effects[0].outcome, 'mouth-suppressed');
});

test('Junkyard applies Junk to the opposing player after a Skill victory', () => {
  const trash = addJunkyardAbility(createPlayer('player-one', 'skill'));
  const opponent = createPlayer('player-two', 'guard');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [trash, opponent]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(opponent.statuses.length, 1);
  assert.equal(opponent.statuses[0].key, 'junk');
  assert.equal(opponent.statuses[0].durationType, 'activation');
  assert.equal(opponent.statuses[0].data.category, 'part-activation');
  assert.equal(result.effects[0].abilityKey, 'trash-junkyard');
  assert.equal(result.effects[0].statusResult, 'applied');
});

test('Junk replaces the next valid Part activation but preserves base damage', () => {
  const trash = addJunkyardAbility(createPlayer('player-one', 'skill'));
  const opponent = addMendTeam(createPlayer('player-two', 'guard'), [3, 6]);
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [trash, opponent]
  };
  resolveCoreClashRound(match);
  trash.selection = { round: 2, action: 'skill', tagTeamSlot: null };
  opponent.selection = { round: 2, action: 'attack', tagTeamSlot: null };

  const result = resolveCoreClashRound(match);

  assert.equal(trash.team[0].heartUnits, 4);
  assert.equal(opponent.team[1].heartUnits, 3);
  assert.equal(opponent.statuses.length, 0);
  assert.equal(result.effects.length, 0);
  assert.equal(
    result.triggeredStatuses[0].outcome,
    'activation-replaced-with-junk'
  );
  assert.equal(result.triggeredStatuses[0].preventedAbilityKey, 'moss-mend');
});

test('Junk waits through losses and follows the player through a Tag', () => {
  const trash = addJunkyardAbility(createPlayer('player-one', 'skill'));
  const opponent = addMendTeam(createPlayer('player-two', 'guard'));
  opponent.selection.tagTeamSlot = 1;
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 1,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [trash, opponent]
  };
  resolveCoreClashRound(match);
  assert.equal(opponent.activeTeamSlot, 1);
  trash.selection = { round: 2, action: 'guard', tagTeamSlot: null };
  opponent.selection = { round: 2, action: 'attack', tagTeamSlot: null };

  resolveCoreClashRound(match);

  assert.equal(opponent.statuses.length, 1);
  assert.equal(opponent.statuses[0].key, 'junk');
});

test('Part Suppression resolves before Junk', () => {
  const trash = createPlayer('player-one', 'skill');
  const opponent = addMendTeam(createPlayer('player-two', 'attack'));
  opponent.statuses = [
    {
      ...createStatusInstance('junk'),
      sourcePlayerSlot: trash.slot,
      durationType: 'activation',
      data: {
        category: 'part-activation',
        sourceAbilityKey: 'trash-junkyard'
      }
    }
  ];
  opponent.team[0].statuses = [
    {
      ...createStatusInstance('suppressed', 1, 'mouth'),
      data: {
        consumption: 'matching-activation',
        sourceAbilityKey: 'magma-scorch'
      }
    }
  ];
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 2,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [trash, opponent]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(opponent.statuses.length, 1);
  assert.equal(opponent.team[0].statuses.length, 0);
  assert.equal(result.triggeredStatuses[0].outcome, 'activation-suppressed');
});

test('Reinforce Ward prevents Junk and allows the Part activation', () => {
  const trash = createPlayer('player-one', 'attack');
  const stone = addFortifyAbility(createPlayer('player-two', 'guard'));
  stone.statuses = [
    {
      ...createStatusInstance('junk'),
      sourcePlayerSlot: trash.slot,
      durationType: 'activation',
      data: {
        category: 'part-activation',
        sourceAbilityKey: 'trash-junkyard'
      }
    }
  ];
  stone.team[0].statuses = [
    {
      ...createStatusInstance('warded', 1, 'body'),
      sourcePlayerSlot: stone.slot,
      data: {
        category: 'part-disable',
        sourceAbilityKey: 'stone-reinforce'
      }
    }
  ];
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 2,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [trash, stone]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(stone.statuses.length, 0);
  assert.equal(stone.team[0].statuses.length, 1);
  assert.equal(stone.team[0].statuses[0].data.category, 'bonus-damage');
  assert.equal(result.effects[0].abilityKey, 'stone-fortify');
  assert.equal(result.triggeredStatuses[0].outcome, 'effect-prevented');
  assert.equal(result.triggeredStatuses[0].preventedByStatusKey, 'warded');
});

test('Salvage restores a Ward after it prevents bonus damage', () => {
  const trash = addSalvageAbility(createPlayer('player-one', 'skill'));
  trash.team[0].statuses = [
    {
      ...createStatusInstance('warded'),
      sourcePlayerSlot: trash.slot,
      data: {
        category: 'bonus-damage',
        sourceAbilityKey: 'stone-fortify'
      }
    }
  ];
  const magma = addEruptionAbility(createPlayer('player-two', 'attack'));
  magma.team[0].abilityProgress = [
    {
      abilityKey: 'magma-eruption',
      abilityRevision: 1,
      activationCount: 0,
      data: { lastDecisiveVictoryAction: 'attack' }
    }
  ];
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 2,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [trash, magma]
  };

  const warded = resolveCoreClashRound(match);

  assert.equal(warded.effects[0].status, 'prevented');
  assert.equal(trash.team[0].statuses.length, 0);
  assert.equal(trash.team[0].removedPositiveStatuses.length, 1);
  assert.equal(trash.team[0].removedPositiveStatuses[0].status.key, 'warded');
  trash.selection = { round: 3, action: 'attack', tagTeamSlot: null };
  magma.selection = { round: 3, action: 'attack', tagTeamSlot: null };

  const restored = resolveCoreClashRound(match);

  assert.equal(trash.team[0].statuses[0].key, 'warded');
  assert.deepEqual(trash.team[0].removedPositiveStatuses, []);
  assert.equal(restored.effects[0].abilityKey, 'trash-salvage');
  assert.equal(restored.effects[0].restoredStatusKey, 'warded');
  assert.equal(restored.effects[0].statusResult, 'applied');
});

test('Salvage restores only the most recently removed Positive Status', () => {
  const trash = addSalvageAbility(createPlayer('player-one', 'attack'));
  trash.team[0].removedPositiveStatuses = [
    {
      status: {
        ...createStatusInstance('burn-primed'),
        data: {
          condition: 'next-action-win',
          pendingStatusKey: 'burn',
          requiredAction: 'attack',
          sourceAbilityKey: 'magma-retaliate'
        }
      },
      removedRound: 1,
      reason: 'trigger-consumed'
    },
    {
      status: {
        ...createStatusInstance('warded'),
        data: {
          category: 'part-disable',
          sourceAbilityKey: 'stone-reinforce'
        }
      },
      removedRound: 2,
      reason: 'ward-consumed'
    }
  ];
  const opponent = createPlayer('player-two', 'attack');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 3,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [trash, opponent]
  };

  const result = resolveCoreClashRound(match);

  assert.deepEqual(
    trash.team[0].statuses.map((status) => status.key),
    ['warded']
  );
  assert.equal(trash.team[0].removedPositiveStatuses.length, 1);
  assert.equal(
    trash.team[0].removedPositiveStatuses[0].status.key,
    'burn-primed'
  );
  assert.equal(result.effects[0].remainingHistoryCount, 1);
});

test('Wither blocks Salvage without consuming its removal history', () => {
  const trash = addSalvageAbility(createPlayer('player-one', 'attack'));
  trash.statuses = [
    {
      ...createStatusInstance('blocked'),
      expiresAfterRound: 3,
      durationType: 'round',
      data: { activeFromRound: 3, category: 'positive-status' }
    }
  ];
  trash.team[0].removedPositiveStatuses = [
    {
      status: {
        ...createStatusInstance('warded'),
        data: {
          category: 'part-disable',
          sourceAbilityKey: 'stone-reinforce'
        }
      },
      removedRound: 2,
      reason: 'ward-consumed'
    }
  ];
  const opponent = createPlayer('player-two', 'attack');
  const match = {
    status: 'active',
    phase: 'resolution',
    round: 3,
    ruleset: createRuleset(),
    statusDefinitions: createCleanseStatusDefinitions(),
    players: [trash, opponent]
  };

  const result = resolveCoreClashRound(match);

  assert.equal(trash.team[0].statuses?.length || 0, 0);
  assert.equal(trash.team[0].removedPositiveStatuses.length, 1);
  assert.equal(result.effects[0].status, 'blocked');
  assert.equal(result.effects[0].statusResult, 'blocked');
  assert.equal(result.effects[0].remainingHistoryCount, 1);
});

test('Clash archive snapshots preserve the completed game identity', () => {
  const match = {
    _id: new mongoose.Types.ObjectId(),
    gameId: 'OCL-0123456789ABCDEF0123456789ABCDEF',
    matchCode: 'ABC-123',
    status: 'completed',
    phase: 'complete',
    round: 7,
    ruleset: createRuleset(),
    players: [],
    statusDefinitions: [],
    winnerAccountId: new mongoose.Types.ObjectId(),
    endReason: 'team_defeated',
    endedAt: new Date(),
    events: []
  };
  const archive = createClashArchiveSnapshot(match);
  assert.equal(archive.gameId, match.gameId);
  assert.equal(archive.roundsPlayed, 7);
  assert.equal(archive.finalState.phase, 'complete');
});

test('forfeiting a Clash archives the loss and keeps both players for rematch', async () => {
  const forfeitingPlayer = createPlayer('player-one', 'attack');
  const winningPlayer = createPlayer('player-two', 'guard');
  const match = {
    _id: new mongoose.Types.ObjectId(),
    gameId: 'OCL-0123456789ABCDEF0123456789ABCDEF',
    matchCode: 'ABC-123',
    status: 'active',
    phase: 'selection',
    phaseEndsAt: new Date(Date.now() + 10_000),
    round: 3,
    ruleset: createRuleset(),
    players: [forfeitingPlayer, winningPlayer],
    statusDefinitions: [],
    events: [],
    async save() {
      return this;
    }
  };
  let archivedSnapshot = null;
  const models = {
    OlingClashMatch: {
      async findOne() {
        return match;
      }
    },
    OlingClashArchive: {
      async findOneAndUpdate(_filter, update) {
        archivedSnapshot = update.$setOnInsert;
        return {
          _id: new mongoose.Types.ObjectId(),
          ...archivedSnapshot
        };
      }
    },
    Account: { async updateMany() {} }
  };

  const result = await forfeitClashMatch({
    models,
    account: { _id: forfeitingPlayer.accountId },
    matchCode: match.matchCode
  });

  assert.equal(archivedSnapshot.endReason, 'surrender');
  assert.equal(
    String(archivedSnapshot.winnerAccountId),
    String(winningPlayer.accountId)
  );
  assert.equal(archivedSnapshot.events.at(-1).type, 'surrendered');
  assert.equal(result.resolvedMatch.status, 'completed');
  assert.deepEqual(result.forfeitResult.defeatedPlayerSlots, ['player-one']);
  assert.equal(result.match.status, 'waiting');
  assert.equal(result.match.phase, 'waiting');
  assert.equal(result.match.players.length, 2);
  assert.equal(
    result.match.players.every((player) => !player.ready),
    true
  );
});
