const assert = require('node:assert/strict');
const test = require('node:test');

const createOlingClashResolution = require('../../public/scripts/olings/clash/game/resolution');

test('Clash base actions use the Attack Skill Guard matchup', () => {
  const resolution = createOlingClashResolution();

  assert.equal(resolution.determineOutcome('attack', 'skill'), 'local');
  assert.equal(resolution.determineOutcome('skill', 'guard'), 'local');
  assert.equal(resolution.determineOutcome('guard', 'attack'), 'local');
  assert.equal(resolution.determineOutcome('skill', 'attack'), 'opponent');
  assert.equal(resolution.determineOutcome('guard', 'guard'), 'draw');
});

test('Clash normal damage breaks whole Shields before Overgrowth and Hearts', () => {
  const resolution = createOlingClashResolution();
  const damage = resolution.applyNormalDamage(
    {
      shieldCount: 1,
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 1
    },
    4
  );

  assert.deepEqual(damage.health, {
    heartUnits: 5,
    maxHeartUnits: 6,
    overgrowthUnits: 0,
    shieldCount: 0
  });
  assert.equal(damage.appliedUnits, 4);
  assert.equal(damage.destroyedShields, 1);
  assert.equal(damage.defeated, false);
});

test('Clash Shields break as whole charges and pass only excess damage', () => {
  const resolution = createOlingClashResolution();
  const createHealth = (shieldCount) => ({
    shieldCount,
    heartUnits: 6,
    maxHeartUnits: 6,
    overgrowthUnits: 0
  });

  const halfHeart = resolution.applyNormalDamage(createHealth(1), 1);
  assert.equal(halfHeart.destroyedShields, 1);
  assert.equal(halfHeart.health.heartUnits, 6);

  const oneHeart = resolution.applyNormalDamage(createHealth(1), 2);
  assert.equal(oneHeart.destroyedShields, 1);
  assert.equal(oneHeart.health.heartUnits, 6);

  const oneAndHalfHearts = resolution.applyNormalDamage(createHealth(1), 3);
  assert.equal(oneAndHalfHearts.destroyedShields, 1);
  assert.equal(oneAndHalfHearts.health.heartUnits, 5);

  const twoShields = resolution.applyNormalDamage(createHealth(2), 3);
  assert.equal(twoShields.destroyedShields, 2);
  assert.equal(twoShields.health.heartUnits, 6);
});

test('Clash Draw damage triggers Last Stand at half a Heart', () => {
  const resolution = createOlingClashResolution();
  const damage = resolution.applyNormalDamage(
    {
      shieldCount: 0,
      heartUnits: 1,
      maxHeartUnits: 6,
      overgrowthUnits: 0
    },
    1,
    { isDraw: true }
  );

  assert.equal(damage.health.heartUnits, 1);
  assert.equal(damage.appliedUnits, 0);
  assert.equal(damage.preventedUnits, 1);
  assert.equal(damage.lastStand, true);
  assert.equal(damage.defeated, false);
});

test('Clash decisive damage can defeat an Oling', () => {
  const resolution = createOlingClashResolution();
  const damage = resolution.applyNormalDamage(
    {
      shieldCount: 0,
      heartUnits: 2,
      maxHeartUnits: 6,
      overgrowthUnits: 0
    },
    2
  );

  assert.equal(damage.health.heartUnits, 0);
  assert.equal(damage.lastStand, false);
  assert.equal(damage.defeated, true);
});

test('Clash preview applies Mend to the most damaged living bench Oling', () => {
  const resolution = createOlingClashResolution();
  const createOling = (name, heartUnits, attack = 'ATTACK') => ({
    name,
    moves: { attack },
    health: {
      heartUnits,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    }
  });
  const state = {
    selections: { localAction: 'attack', opponentAction: 'skill' },
    teams: {
      local: [
        createOling('MOSSY', 6, 'MEND'),
        createOling('PEBBLE', 3),
        createOling('EMBER', 5)
      ],
      opponent: [createOling('FANG', 6)]
    }
  };
  const result = resolution.resolveClash(state);

  assert.equal(state.teams.local[1].health.heartUnits, 4);
  assert.equal(state.teams.local[2].health.heartUnits, 5);
  assert.equal(result.effects[0].abilityKey, 'moss-mend');
  assert.equal(result.effects[0].appliedUnits, 1);
  assert.equal(result.effects[0].targetTeamSlot, 1);
  assert.deepEqual(state.teams.local[0].lastMove, {
    action: 'attack',
    activationStatus: 'activated',
    outcome: 'win',
    round: 1
  });
  assert.deepEqual(state.teams.opponent[0].lastMove, {
    action: 'skill',
    activationStatus: 'failed',
    outcome: 'loss',
    round: 1
  });
});

test('Clash can resolve base tutorial damage without special ability effects', () => {
  const resolution = createOlingClashResolution();
  const createOling = (name, heartUnits, attack = 'ATTACK') => ({
    name,
    moves: { attack },
    health: {
      heartUnits,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    }
  });
  const state = {
    selections: { localAction: 'attack', opponentAction: 'skill' },
    teams: {
      local: [
        createOling('MOSSY', 6, 'MEND'),
        createOling('PEBBLE', 3),
        createOling('EMBER', 5)
      ],
      opponent: [createOling('FANG', 6)]
    }
  };

  const result = resolution.resolveClash(state, { abilityEffects: false });

  assert.equal(state.teams.local[1].health.heartUnits, 3);
  assert.equal(state.teams.opponent[0].health.heartUnits, 4);
  assert.deepEqual(result.effects, []);
  assert.deepEqual(result.triggeredStatuses, []);
  assert.equal(state.teams.local[0].lastMove.activationStatus, 'revealed');
  assert.equal(state.teams.opponent[0].lastMove.activationStatus, 'failed');
});

test('Clash preview redirects Wild Growth to the queued Tag recipient', () => {
  const resolution = createOlingClashResolution();
  const createOling = (name, heartUnits, skill = 'SKILL') => ({
    name,
    moves: { skill },
    health: {
      heartUnits,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    }
  });
  const state = {
    selections: {
      localAction: 'skill',
      localTagSlot: 2,
      opponentAction: 'guard'
    },
    teams: {
      local: [
        createOling('MOSSY', 6, 'WILD GROWTH'),
        createOling('PEBBLE', 6),
        createOling('EMBER', 6)
      ],
      opponent: [createOling('FANG', 6)]
    }
  };
  const result = resolution.resolveClash(state);

  assert.equal(state.teams.local[0].health.overgrowthUnits, 0);
  assert.equal(state.teams.local[2].health.overgrowthUnits, 1);
  assert.equal(result.effects[0].abilityKey, 'moss-wild-growth');
  assert.equal(result.effects[0].targetReason, 'tag-recipient');
  assert.equal(result.effects[0].targetTeamSlot, 2);
});

test('Clash preview keeps Wild Growth on the active Oling without a valid Tag', () => {
  const resolution = createOlingClashResolution();
  const team = [
    {
      name: 'MOSSY',
      health: { heartUnits: 6, overgrowthUnits: 0 }
    },
    {
      name: 'PEBBLE',
      health: { heartUnits: 0, overgrowthUnits: 0 }
    }
  ];

  const effect = resolution.applyWildGrowth(team, 'local', 1);

  assert.equal(team[0].health.overgrowthUnits, 1);
  assert.equal(team[1].health.overgrowthUnits, 0);
  assert.equal(effect.targetReason, 'self');
  assert.equal(effect.targetTeamSlot, 0);
});

test('Clash preview applies Canopy to the most damaged living ally on a Draw', () => {
  const resolution = createOlingClashResolution();
  const createOling = (name, heartUnits, draw = 'DRAW', shieldCount = 0) => ({
    name,
    moves: { draw },
    health: {
      heartUnits,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount
    }
  });
  const state = {
    selections: { localAction: 'guard', opponentAction: 'guard' },
    teams: {
      local: [
        createOling('MOSSY', 6, 'CANOPY'),
        createOling('PEBBLE', 3, 'DRAW', 1),
        createOling('EMBER', 5)
      ],
      opponent: [createOling('FANG', 6)]
    }
  };

  state.teams.local[0].abilityProgress = [
    {
      abilityKey: 'moss-canopy',
      abilityRevision: 2,
      activationCount: 1
    }
  ];

  const result = resolution.resolveClash(state);

  assert.equal(state.teams.local[0].health.heartUnits, 5);
  assert.equal(state.teams.local[1].health.shieldCount, 2);
  assert.equal(result.effects.length, 1);
  assert.equal(result.effects[0].abilityKey, 'moss-canopy');
  assert.equal(result.effects[0].targetTeamSlot, 1);
  assert.equal(result.effects[0].afterShieldCount, 2);
});

test('Clash preview lets Canopy target its active Oling', () => {
  const resolution = createOlingClashResolution();
  const team = [
    {
      name: 'MOSSY',
      abilityProgress: [
        {
          abilityKey: 'moss-canopy',
          abilityRevision: 2,
          activationCount: 1
        }
      ],
      health: { heartUnits: 4, maxHeartUnits: 6, shieldCount: 0 }
    },
    {
      name: 'PEBBLE',
      health: { heartUnits: 6, maxHeartUnits: 6, shieldCount: 0 }
    }
  ];

  const effect = resolution.applyCanopy(team, 'local');

  assert.equal(team[0].health.shieldCount, 1);
  assert.equal(effect.targetTeamSlot, 0);
  assert.equal(effect.appliedShieldCount, 1);
});

test('Clash preview progresses Harden after its first survived Draw', () => {
  const resolution = createOlingClashResolution();
  const createOling = (name, draw, shieldCount) => ({
    name,
    moves: { draw },
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount
    }
  });
  const state = {
    selections: { localAction: 'attack', opponentAction: 'attack' },
    teams: {
      local: [createOling('ROCKY', 'HARDEN', 2)],
      opponent: [createOling('FANG', 'DRAW', 0)]
    }
  };

  const result = resolution.resolveClash(state);

  assert.equal(result.localDamage.destroyedShields, 1);
  assert.equal(state.teams.local[0].health.shieldCount, 1);
  assert.equal(result.effects[0].abilityKey, 'stone-harden');
  assert.equal(result.effects[0].status, 'progressed');
  assert.equal(result.effects[0].afterActivationCount, 1);
});

test('Clash preview resolves Harden after Last Stand', () => {
  const resolution = createOlingClashResolution();
  const state = {
    selections: { localAction: 'guard', opponentAction: 'guard' },
    teams: {
      local: [
        {
          name: 'ROCKY',
          moves: { draw: 'HARDEN' },
          abilityProgress: [
            {
              abilityKey: 'stone-harden',
              abilityRevision: 2,
              activationCount: 1
            }
          ],
          health: {
            heartUnits: 1,
            maxHeartUnits: 6,
            overgrowthUnits: 0,
            shieldCount: 0
          }
        }
      ],
      opponent: [
        {
          name: 'FANG',
          moves: { draw: 'DRAW' },
          health: {
            heartUnits: 6,
            maxHeartUnits: 6,
            overgrowthUnits: 0,
            shieldCount: 0
          }
        }
      ]
    }
  };

  const result = resolution.resolveClash(state);

  assert.equal(result.localDamage.lastStand, true);
  assert.equal(state.teams.local[0].health.heartUnits, 1);
  assert.equal(state.teams.local[0].health.shieldCount, 1);
  assert.equal(result.effects[0].abilityKey, 'stone-harden');
});

test('Clash preview heals Bloodsuck on every second Attack victory', () => {
  const resolution = createOlingClashResolution();
  const vampire = {
    name: 'FANG',
    moves: { attack: 'BLOODSUCK' },
    health: {
      heartUnits: 4,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    }
  };
  const opponent = {
    name: 'MOSSY',
    moves: { attack: 'ATTACK' },
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    }
  };
  const state = {
    selections: { localAction: 'attack', opponentAction: 'skill' },
    teams: { local: [vampire], opponent: [opponent] }
  };

  const first = resolution.resolveClash(state);
  assert.equal(vampire.health.heartUnits, 4);
  assert.equal(first.effects[0].status, 'progressed');
  assert.equal(vampire.abilityProgress[0].activationCount, 1);

  opponent.health.heartUnits = 6;
  const second = resolution.resolveClash(state);
  assert.equal(vampire.health.heartUnits, 5);
  assert.equal(second.effects[0].status, 'resolved');
  assert.equal(second.effects[0].appliedUnits, 1);
  assert.equal(vampire.abilityProgress[0].activationCount, 0);
});

test('Clash preview resets Bloodsuck progress when healing is capped', () => {
  const resolution = createOlingClashResolution();
  const vampire = {
    name: 'FANG',
    abilityProgress: [
      {
        abilityKey: 'vampire-bloodsuck',
        abilityRevision: 1,
        activationCount: 1
      }
    ],
    health: { heartUnits: 6, maxHeartUnits: 6 }
  };

  const effect = resolution.applyBloodsuck([vampire], 'local');

  assert.equal(vampire.health.heartUnits, 6);
  assert.equal(vampire.abilityProgress[0].activationCount, 0);
  assert.equal(effect.status, 'no-effect');
  assert.equal(effect.triggered, true);
});

test('Clash preview Crush deals bonus damage every second Attack victory', () => {
  const resolution = createOlingClashResolution();
  const stone = {
    abilityProgress: [],
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack: 'CRUSH' },
    name: 'PEBBLE'
  };
  const target = {
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { skill: 'SKILL' },
    name: 'FANG'
  };
  const state = {
    selections: { localAction: 'attack', opponentAction: 'skill' },
    teams: { local: [stone], opponent: [target] }
  };

  const first = resolution.resolveClash(state);
  assert.equal(first.effects[0].status, 'progressed');
  assert.equal(first.effects[0].afterActivationCount, 1);
  assert.equal(target.health.heartUnits, 4);

  const second = resolution.resolveClash(state);

  assert.equal(second.effects[0].status, 'resolved');
  assert.equal(second.effects[0].appliedUnits, 1);
  assert.equal(second.effects[0].damageSource, 'bonus');
  assert.equal(second.effects[0].afterActivationCount, 0);
  assert.equal(target.health.heartUnits, 1);
  assert.equal(stone.abilityProgress[0].activationCount, 0);
});

test('Clash preview Crush waits through Attack losses and Draws', () => {
  const resolution = createOlingClashResolution();
  const stone = {
    abilityProgress: [],
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack: 'CRUSH' },
    name: 'PEBBLE'
  };
  const target = {
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack: 'ATTACK', guard: 'GUARD', skill: 'SKILL' },
    name: 'FANG'
  };
  const state = {
    selections: { localAction: 'attack', opponentAction: 'skill' },
    teams: { local: [stone], opponent: [target] }
  };
  resolution.resolveClash(state);
  state.selections.opponentAction = 'guard';
  resolution.resolveClash(state);
  assert.equal(stone.abilityProgress[0].activationCount, 1);
  state.selections.opponentAction = 'attack';
  resolution.resolveClash(state);
  assert.equal(stone.abilityProgress[0].activationCount, 1);
  state.selections.opponentAction = 'skill';

  const result = resolution.resolveClash(state);

  assert.equal(result.effects[0].triggered, true);
  assert.equal(stone.abilityProgress[0].activationCount, 0);
  assert.equal(target.health.heartUnits, 0);
});

test('Clash preview Crush routes bonus damage through a whole Shield', () => {
  const resolution = createOlingClashResolution();
  const stone = {
    abilityProgress: [
      {
        abilityKey: 'stone-crush',
        abilityRevision: 1,
        activationCount: 1
      }
    ],
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack: 'CRUSH' },
    name: 'PEBBLE'
  };
  const target = {
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 2
    },
    moves: { skill: 'SKILL' },
    name: 'FANG'
  };
  const state = {
    selections: { localAction: 'attack', opponentAction: 'skill' },
    teams: { local: [stone], opponent: [target] }
  };

  const result = resolution.resolveClash(state);

  assert.equal(target.health.shieldCount, 0);
  assert.equal(target.health.heartUnits, 6);
  assert.equal(result.effects[0].destroyedShields, 1);
  assert.equal(result.effects[0].appliedUnits, 1);
});

test('Clash preview Mouth Suppression consumes Crush cadence progress', () => {
  const resolution = createOlingClashResolution();
  const stone = {
    abilityProgress: [],
    effects: [
      {
        consumption: 'matching-activation',
        key: 'suppressed',
        name: 'Suppressed',
        targetPart: 'mouth',
        type: 'negative'
      }
    ],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack: 'CRUSH' },
    name: 'PEBBLE'
  };
  const target = {
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { skill: 'SKILL' },
    name: 'FANG'
  };
  const state = {
    selections: { localAction: 'attack', opponentAction: 'skill' },
    teams: { local: [stone], opponent: [target] }
  };

  const result = resolution.resolveClash(state);

  assert.equal(target.health.heartUnits, 4);
  assert.equal(stone.abilityProgress[0].activationCount, 1);
  assert.equal(result.effects.length, 0);
  assert.equal(result.triggeredStatuses[0].outcome, 'activation-suppressed');
});

test('Clash preview Fortify applies a bonus-damage Ward', () => {
  const resolution = createOlingClashResolution();
  const stone = {
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { guard: 'FORTIFY' },
    name: 'PEBBLE'
  };
  const target = {
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack: 'ATTACK' },
    name: 'FANG'
  };
  const state = {
    selections: { localAction: 'guard', opponentAction: 'attack' },
    teams: { local: [stone], opponent: [target] }
  };

  const result = resolution.resolveClash(state);

  assert.equal(stone.effects[0].key, 'warded');
  assert.equal(stone.effects[0].category, 'bonus-damage');
  assert.equal(stone.effects[0].type, 'positive');
  assert.equal(result.effects[0].abilityKey, 'stone-fortify');
  assert.equal(result.effects[0].statusResult, 'applied');
});

test('Clash preview Fortify prevents Eruption but preserves base damage', () => {
  const resolution = createOlingClashResolution();
  const magma = {
    abilityProgress: [
      {
        abilityKey: 'magma-eruption',
        abilityRevision: 1,
        activationCount: 0,
        data: { lastDecisiveVictoryAction: 'attack' }
      }
    ],
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack: 'ERUPTION' },
    name: 'EMBER'
  };
  const stone = {
    effects: [
      {
        category: 'bonus-damage',
        key: 'warded',
        name: 'Warded',
        sourceAbilityKey: 'stone-fortify',
        type: 'positive'
      }
    ],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { skill: 'SKILL' },
    name: 'PEBBLE'
  };
  const state = {
    round: 2,
    selections: { localAction: 'attack', opponentAction: 'skill' },
    teams: { local: [magma], opponent: [stone] }
  };

  const result = resolution.resolveClash(state);

  assert.equal(stone.health.heartUnits, 4);
  assert.equal(stone.effects.length, 0);
  assert.equal(result.effects[0].status, 'prevented');
  assert.equal(result.effects[0].outcome, 'effect-prevented');
  assert.equal(result.effects[0].preventedByStatusKey, 'warded');
});

test('Clash preview Fortify prevents Crush and preserves its reset', () => {
  const resolution = createOlingClashResolution();
  const attacker = {
    abilityProgress: [
      {
        abilityKey: 'stone-crush',
        abilityRevision: 1,
        activationCount: 1
      }
    ],
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack: 'CRUSH' },
    name: 'ROCKY'
  };
  const defender = {
    effects: [
      {
        category: 'bonus-damage',
        key: 'warded',
        name: 'Warded',
        sourceAbilityKey: 'stone-fortify',
        type: 'positive'
      }
    ],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { skill: 'SKILL' },
    name: 'PEBBLE'
  };
  const state = {
    selections: { localAction: 'attack', opponentAction: 'skill' },
    teams: { local: [attacker], opponent: [defender] }
  };

  const result = resolution.resolveClash(state);

  assert.equal(defender.health.heartUnits, 4);
  assert.equal(defender.effects.length, 0);
  assert.equal(result.effects[0].status, 'prevented');
  assert.equal(result.effects[0].afterActivationCount, 0);
  assert.equal(attacker.abilityProgress[0].activationCount, 0);
});

test('Clash preview Fortify ignores Burn and untriggered bonus damage', () => {
  const resolution = createOlingClashResolution();
  const magma = {
    abilityProgress: [],
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack: 'ERUPTION' },
    name: 'EMBER'
  };
  const stone = {
    effects: [
      {
        category: 'bonus-damage',
        key: 'warded',
        name: 'Warded',
        sourceAbilityKey: 'stone-fortify',
        type: 'positive'
      },
      { key: 'burn', name: 'Burn', type: 'negative' }
    ],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { skill: 'SKILL' },
    name: 'PEBBLE'
  };
  const state = {
    selections: { localAction: 'attack', opponentAction: 'skill' },
    teams: { local: [magma], opponent: [stone] }
  };

  const result = resolution.resolveClash(state);

  assert.equal(stone.health.heartUnits, 3);
  assert.equal(stone.effects.length, 1);
  assert.equal(stone.effects[0].key, 'warded');
  assert.equal(result.effects[0].status, 'condition-not-met');
  assert.equal(result.triggeredStatuses[0].damageSource, 'burn');
});

test('Clash preview Reinforce offers and Wards all four Parts', () => {
  const resolution = createOlingClashResolution();
  const stone = {
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { skill: 'REINFORCE' },
    name: 'PEBBLE'
  };
  const opponent = {
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { guard: 'GUARD' },
    name: 'FANG'
  };
  const state = {
    selections: {
      localAction: 'skill',
      localEffectChoice: {
        abilityKey: 'stone-reinforce',
        targetTeamSlot: 0,
        optionKey: 'eyes'
      },
      opponentAction: 'guard'
    },
    teams: { local: [stone], opponent: [opponent] }
  };

  const result = resolution.resolveClash(state);

  assert.deepEqual(
    resolution
      .getValidPartWardChoices([stone])
      .map((choice) => choice.optionKey),
    ['mouth', 'body', 'flight', 'eyes']
  );
  assert.equal(stone.effects[0].key, 'warded');
  assert.equal(stone.effects[0].targetPart, 'eyes');
  assert.equal(stone.effects[0].category, 'part-disable');
  assert.equal(result.effects[0].abilityKey, 'stone-reinforce');
});

test('Clash preview Reinforce prevents matching Fracture once', () => {
  const resolution = createOlingClashResolution();
  const bone = {
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack: 'FRACTURE' },
    name: 'MARROW'
  };
  const stone = {
    effects: [
      {
        category: 'part-disable',
        key: 'warded',
        name: 'Warded',
        sourceAbilityKey: 'stone-reinforce',
        targetPart: 'body',
        type: 'positive'
      }
    ],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { skill: 'SKILL' },
    name: 'PEBBLE'
  };
  const state = {
    selections: { localAction: 'attack', opponentAction: 'skill' },
    teams: { local: [bone], opponent: [stone] }
  };

  const result = resolution.resolveClash(state);

  assert.equal(stone.health.heartUnits, 4);
  assert.equal(stone.effects.length, 0);
  assert.equal(result.effects[0].status, 'prevented');
  assert.equal(result.effects[0].statusResult, 'warded');
  assert.equal(result.effects[0].targetPart, 'body');
});

test('Clash preview Reinforce ignores Suppression on another Part', () => {
  const resolution = createOlingClashResolution();
  const target = {
    effects: [
      {
        category: 'part-disable',
        key: 'warded',
        name: 'Warded',
        sourceAbilityKey: 'stone-reinforce',
        targetPart: 'eyes',
        type: 'positive'
      }
    ],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    name: 'PEBBLE'
  };
  const state = { teams: { local: [], opponent: [target] } };

  const result = resolution.applyFracture(state, 'local');

  assert.equal(result.status, 'resolved');
  assert.equal(target.effects.length, 2);
  assert.equal(target.effects[0].targetPart, 'eyes');
  assert.equal(target.effects[1].targetPart, 'body');
});

test('Clash preview Reinforce prevents matching Splinter and Read', () => {
  const resolution = createOlingClashResolution();
  const target = {
    effects: [
      {
        category: 'part-disable',
        key: 'warded',
        name: 'Warded',
        sourceAbilityKey: 'stone-reinforce',
        targetPart: 'flight',
        type: 'positive'
      }
    ],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    name: 'PEBBLE'
  };
  const state = {
    round: 3,
    pendingRoundStartEffects: [],
    teams: { local: [], opponent: [target] }
  };

  const splinter = resolution.applySplinter(state, 'local', () => 0.6);
  assert.equal(splinter.status, 'prevented');
  assert.equal(target.effects.length, 0);
  target.effects.push({
    category: 'part-disable',
    key: 'warded',
    name: 'Warded',
    sourceAbilityKey: 'stone-reinforce',
    targetPart: 'eyes',
    type: 'positive'
  });
  state.pendingRoundStartEffects.push({
    abilityKey: 'bone-read',
    applyAtRound: 3,
    sourcePlayerSlot: 'local',
    statusKey: 'suppressed',
    targetPlayerSlot: 'opponent'
  });

  const read = resolution.resolveRoundStartEffects(state, () => 0.99);

  assert.equal(read[0].status, 'prevented');
  assert.equal(read[0].targetPart, 'eyes');
  assert.equal(target.effects.length, 0);
});

test('Clash preview stores and converts Blood Bank resource', () => {
  const resolution = createOlingClashResolution();
  const vampire = {
    name: 'FANG',
    moves: { guard: 'BLOOD BANK' },
    health: {
      bloodUnits: 0,
      heartUnits: 3,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    }
  };
  const opponent = {
    name: 'MOSSY',
    moves: { guard: 'GUARD' },
    health: {
      bloodUnits: 0,
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    }
  };
  const state = {
    selections: { localAction: 'guard', opponentAction: 'attack' },
    teams: { local: [vampire], opponent: [opponent] }
  };

  const first = resolution.resolveClash(state);
  assert.equal(vampire.health.bloodUnits, 1);
  assert.equal(vampire.health.heartUnits, 3);
  assert.equal(first.effects[0].status, 'stored');

  opponent.health.heartUnits = 6;
  const second = resolution.resolveClash(state);
  assert.equal(vampire.health.bloodUnits, 0);
  assert.equal(vampire.health.heartUnits, 5);
  assert.equal(second.effects[0].status, 'resolved');
  assert.equal(second.effects[0].appliedUnits, 2);
});

test('Clash preview consumes Blood Bank conversion at full Hearts', () => {
  const resolution = createOlingClashResolution();
  const vampire = {
    name: 'FANG',
    health: { bloodUnits: 1, heartUnits: 6, maxHeartUnits: 6 }
  };

  const effect = resolution.applyBloodBank([vampire], 'local');

  assert.equal(vampire.health.bloodUnits, 0);
  assert.equal(vampire.health.heartUnits, 6);
  assert.equal(effect.status, 'no-effect');
  assert.equal(effect.converted, true);
});

test('Clash preview transfers half a Heart from self to a chosen bench Oling', () => {
  const resolution = createOlingClashResolution();
  const team = [
    { name: 'FANG', health: { heartUnits: 4, maxHeartUnits: 6 } },
    { name: 'MARROW', health: { heartUnits: 3, maxHeartUnits: 6 } }
  ];

  const effect = resolution.applyTransfusion(team, 'local', {
    abilityKey: 'vampire-transfusion',
    targetTeamSlot: 1,
    optionKey: 'self-to-bench'
  });

  assert.equal(team[0].health.heartUnits, 3);
  assert.equal(team[1].health.heartUnits, 4);
  assert.equal(effect.status, 'resolved');
  assert.equal(effect.donorTeamSlot, 0);
  assert.equal(effect.recipientTeamSlot, 1);
});

test('Clash preview transfers half a Heart from bench to self', () => {
  const resolution = createOlingClashResolution();
  const team = [
    { name: 'FANG', health: { heartUnits: 3, maxHeartUnits: 6 } },
    { name: 'MARROW', health: { heartUnits: 4, maxHeartUnits: 6 } }
  ];

  const effect = resolution.applyTransfusion(team, 'local', {
    abilityKey: 'vampire-transfusion',
    targetTeamSlot: 1,
    optionKey: 'bench-to-self'
  });

  assert.equal(team[0].health.heartUnits, 4);
  assert.equal(team[1].health.heartUnits, 3);
  assert.equal(effect.optionKey, 'bench-to-self');
});

test('Clash preview rejects Transfusion that would empty a donor or overfill a recipient', () => {
  const resolution = createOlingClashResolution();
  const choices = resolution.getValidHeartTransferChoices([
    { name: 'FANG', health: { heartUnits: 1, maxHeartUnits: 6 } },
    { name: 'MARROW', health: { heartUnits: 1, maxHeartUnits: 6 } },
    { name: 'SCRAP', health: { heartUnits: 6, maxHeartUnits: 6 } }
  ]);

  assert.deepEqual(
    choices.map(({ abilityTargetTeamSlot, optionKey }) => ({
      abilityTargetTeamSlot,
      optionKey
    })),
    [{ abilityTargetTeamSlot: 2, optionKey: 'bench-to-self' }]
  );
});

test('Clash preview stores Reclaim only when Draw damage reaches Hearts', () => {
  const resolution = createOlingClashResolution();
  const createOling = (name, draw, health) => ({
    effects: [],
    name,
    moves: { draw },
    pendingReclaimUnits: 0,
    health: {
      heartUnits: 4,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0,
      ...health
    }
  });
  const vampire = createOling('FANG', 'RECLAIM');
  const state = {
    selections: { localAction: 'attack', opponentAction: 'attack' },
    teams: {
      local: [vampire],
      opponent: [createOling('MOSSY', 'DRAW')]
    }
  };

  const result = resolution.resolveClash(state);

  assert.equal(vampire.health.heartUnits, 3);
  assert.equal(vampire.pendingReclaimUnits, 1);
  assert.equal(result.effects[0].status, 'stored');
  assert.equal(result.effects[0].heartDamageUnits, 1);
  assert.equal(vampire.effects[0].key, 'bloodbound');
});

test('Clash preview gives Reclaim no Blood after Shield, Overgrowth, or Last Stand', () => {
  const resolution = createOlingClashResolution();
  const healthCases = [
    { heartUnits: 4, maxHeartUnits: 6, overgrowthUnits: 0, shieldCount: 1 },
    { heartUnits: 4, maxHeartUnits: 6, overgrowthUnits: 1, shieldCount: 0 },
    { heartUnits: 1, maxHeartUnits: 6, overgrowthUnits: 0, shieldCount: 0 }
  ];

  healthCases.forEach((health) => {
    const damage = resolution.applyNormalDamage(health, 1, { isDraw: true });
    const vampire = {
      effects: [],
      health: damage.health,
      name: 'FANG',
      pendingReclaimUnits: 0
    };
    const effect = resolution.applyReclaimDrawDamage(
      [vampire],
      'local',
      damage
    );

    assert.equal(vampire.pendingReclaimUnits, 0);
    assert.equal(effect.status, 'no-effect');
    assert.equal(effect.heartDamageUnits, 0);
    assert.equal(vampire.effects.length, 0);
  });
});

test('Clash preview recovers Reclaim on the next decisive win', () => {
  const resolution = createOlingClashResolution();
  const vampire = {
    effects: [{ key: 'bloodbound', name: 'Bloodbound', type: 'positive' }],
    health: {
      heartUnits: 3,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack: 'ATTACK' },
    name: 'FANG',
    pendingReclaimUnits: 1
  };
  const opponent = {
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { skill: 'SKILL' },
    name: 'MOSSY',
    pendingReclaimUnits: 0
  };
  const state = {
    selections: { localAction: 'attack', opponentAction: 'skill' },
    teams: { local: [vampire], opponent: [opponent] }
  };

  const result = resolution.resolveClash(state);

  assert.equal(vampire.health.heartUnits, 4);
  assert.equal(vampire.pendingReclaimUnits, 0);
  assert.equal(vampire.effects.length, 0);
  assert.equal(result.effects[0].outcome, 'recovered');
  assert.equal(result.effects[0].appliedUnits, 1);
});

test('Clash preview discards Reclaim on the next decisive loss', () => {
  const resolution = createOlingClashResolution();
  const vampire = {
    effects: [{ key: 'bloodbound', name: 'Bloodbound', type: 'positive' }],
    health: {
      heartUnits: 5,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { skill: 'SKILL' },
    name: 'FANG',
    pendingReclaimUnits: 1
  };
  const opponent = {
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack: 'ATTACK' },
    name: 'MOSSY',
    pendingReclaimUnits: 0
  };
  const state = {
    selections: { localAction: 'skill', opponentAction: 'attack' },
    teams: { local: [vampire], opponent: [opponent] }
  };

  const result = resolution.resolveClash(state);

  assert.equal(vampire.health.heartUnits, 3);
  assert.equal(vampire.pendingReclaimUnits, 0);
  assert.equal(vampire.effects.length, 0);
  assert.equal(result.effects[0].outcome, 'lost');
  assert.equal(result.effects[0].status, 'lost');
});

test('Clash preview removes the chosen Negative effect with Cleanse', () => {
  const resolution = createOlingClashResolution();
  const team = [
    {
      effects: [{ key: 'warded', name: 'Warded', type: 'positive' }],
      health: { heartUnits: 6, maxHeartUnits: 6 },
      name: 'MOSSY'
    },
    {
      effects: [
        { key: 'burn', name: 'Burn', type: 'negative' },
        { key: 'suppressed', name: 'Suppressed', type: 'negative' },
        { key: 'warded', name: 'Warded', type: 'positive' }
      ],
      health: { heartUnits: 6, maxHeartUnits: 6 },
      name: 'PEBBLE'
    }
  ];

  const effect = resolution.applyCleanse(team, 'local', {
    abilityKey: 'moss-cleanse',
    targetTeamSlot: 1,
    optionKey: 'suppressed'
  });

  assert.deepEqual(
    team[1].effects.map(({ key }) => key),
    ['burn', 'warded']
  );
  assert.equal(effect.status, 'resolved');
  assert.equal(effect.removedStatusKey, 'suppressed');
  assert.equal(effect.targetTeamSlot, 1);
});

test('Clash preview Cleanse choices include self and living teammates only', () => {
  const resolution = createOlingClashResolution();
  const choices = resolution.getValidCleanseChoices([
    {
      effects: [{ key: 'burn', name: 'Burn', type: 'negative' }],
      health: { heartUnits: 6 }
    },
    {
      effects: [
        { key: 'warded', name: 'Warded', type: 'positive' },
        { key: 'suppressed', name: 'Suppressed', type: 'negative' }
      ],
      health: { heartUnits: 6 }
    },
    {
      effects: [{ key: 'burn', name: 'Burn', type: 'negative' }],
      health: { heartUnits: 0 }
    }
  ]);

  assert.deepEqual(
    choices.map(({ abilityTargetTeamSlot, optionKey }) => ({
      abilityTargetTeamSlot,
      optionKey
    })),
    [
      { abilityTargetTeamSlot: 0, optionKey: 'burn' },
      { abilityTargetTeamSlot: 1, optionKey: 'suppressed' }
    ]
  );
});

test('Clash preview Cleanse distinguishes Suppression variants', () => {
  const resolution = createOlingClashResolution();
  const team = [
    {
      effects: [
        {
          key: 'suppressed',
          name: 'Suppressed',
          sourceAbilityKey: 'bone-fracture',
          targetPart: 'body',
          type: 'negative'
        },
        {
          key: 'suppressed',
          name: 'Suppressed',
          sourceAbilityKey: 'bone-splinter',
          targetPart: 'mouth',
          type: 'negative'
        }
      ],
      health: { heartUnits: 6 },
      name: 'MOSSY'
    }
  ];

  const choices = resolution.getValidCleanseChoices(team);
  resolution.applyCleanse(team, 'local', {
    abilityKey: 'moss-cleanse',
    targetTeamSlot: 0,
    optionKey: 'suppressed:mouth:bone-splinter'
  });

  assert.deepEqual(
    choices.map((choice) => choice.optionKey),
    ['suppressed:body:bone-fracture', 'suppressed:mouth:bone-splinter']
  );
  assert.equal(team[0].effects.length, 1);
  assert.equal(team[0].effects[0].sourceAbilityKey, 'bone-fracture');
});

test('Clash preview resolves Cleanse after a Guard victory', () => {
  const resolution = createOlingClashResolution();
  const createOling = (name, guard, effects = []) => ({
    effects,
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { guard },
    name
  });
  const state = {
    selections: {
      localAction: 'guard',
      localEffectChoice: {
        abilityKey: 'moss-cleanse',
        targetTeamSlot: 0,
        optionKey: 'burn'
      },
      opponentAction: 'attack'
    },
    teams: {
      local: [
        createOling('MOSSY', 'CLEANSE', [
          { key: 'burn', name: 'Burn', type: 'negative' }
        ])
      ],
      opponent: [createOling('FANG', 'GUARD')]
    }
  };

  const result = resolution.resolveClash(state);

  assert.equal(state.teams.local[0].effects.length, 0);
  assert.equal(result.effects[0].abilityKey, 'moss-cleanse');
  assert.equal(result.effects[0].removedStatusKey, 'burn');
});

test('Clash preview applies Fracture to the opposing active Body', () => {
  const resolution = createOlingClashResolution();
  const createOling = (name, attack, effects = []) => ({
    effects,
    health: {
      bloodUnits: 0,
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack },
    name
  });
  const state = {
    selections: { localAction: 'attack', opponentAction: 'skill' },
    teams: {
      local: [createOling('MARROW', 'FRACTURE')],
      opponent: [createOling('FANG', 'ATTACK')]
    }
  };

  const result = resolution.resolveClash(state);

  assert.equal(state.teams.opponent[0].health.heartUnits, 4);
  assert.equal(state.teams.opponent[0].effects.length, 1);
  assert.equal(state.teams.opponent[0].effects[0].key, 'suppressed');
  assert.equal(state.teams.opponent[0].effects[0].targetPart, 'body');
  assert.equal(result.effects[0].abilityKey, 'bone-fracture');
  assert.equal(result.effects[0].statusResult, 'applied');
});

test('Clash preview consumes Fracture on the next successful Guard', () => {
  const resolution = createOlingClashResolution();
  const bone = {
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack: 'FRACTURE', skill: 'SKILL' },
    name: 'MARROW'
  };
  const vampire = {
    effects: [],
    health: {
      bloodUnits: 0,
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { guard: 'BLOOD BANK', skill: 'SKILL' },
    name: 'FANG'
  };
  const state = {
    selections: { localAction: 'attack', opponentAction: 'skill' },
    teams: { local: [bone], opponent: [vampire] }
  };
  resolution.resolveClash(state);
  state.selections.localAction = 'attack';
  state.selections.opponentAction = 'guard';

  const result = resolution.resolveClash(state);

  assert.equal(bone.health.heartUnits, 4);
  assert.equal(vampire.health.bloodUnits, 0);
  assert.equal(vampire.effects.length, 0);
  assert.equal(result.effects.length, 0);
  assert.equal(result.triggeredStatuses.length, 1);
  assert.equal(result.triggeredStatuses[0].targetPart, 'body');
  assert.equal(result.triggeredStatuses[0].preventedAbilityName, 'BLOOD BANK');
});

test('Clash preview keeps Fracture through an unsuccessful Guard', () => {
  const resolution = createOlingClashResolution();
  const bone = {
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack: 'FRACTURE', skill: 'SKILL' },
    name: 'MARROW'
  };
  const target = {
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { guard: 'GUARD', skill: 'SKILL' },
    name: 'FANG'
  };
  const state = {
    selections: { localAction: 'attack', opponentAction: 'skill' },
    teams: { local: [bone], opponent: [target] }
  };
  resolution.resolveClash(state);
  state.selections.localAction = 'skill';
  state.selections.opponentAction = 'guard';

  const result = resolution.resolveClash(state);

  assert.equal(result.triggeredStatuses.length, 0);
  assert.equal(target.effects.length, 1);
  assert.equal(target.effects[0].key, 'suppressed');
});

test('Clash preview Splinter deterministically selects all four Parts', () => {
  const resolution = createOlingClashResolution();
  const expectedParts = ['mouth', 'body', 'flight', 'eyes'];
  [0, 0.25, 0.5, 0.999].forEach((randomValue, index) => {
    const createOling = (name, guard) => ({
      effects: [],
      health: {
        heartUnits: 6,
        maxHeartUnits: 6,
        overgrowthUnits: 0,
        shieldCount: 0
      },
      moves: { guard },
      name
    });
    const state = {
      selections: { localAction: 'guard', opponentAction: 'attack' },
      teams: {
        local: [createOling('MARROW', 'SPLINTER')],
        opponent: [createOling('FANG', 'GUARD')]
      }
    };

    const result = resolution.resolveClash(state, {
      random: () => randomValue
    });

    assert.equal(
      state.teams.opponent[0].effects[0].targetPart,
      expectedParts[index]
    );
    assert.equal(result.effects[0].targetPart, expectedParts[index]);
  });
});

test('Clash preview Splinter blocks matching wins until a different win', () => {
  const resolution = createOlingClashResolution();
  const bone = {
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { guard: 'SPLINTER', skill: 'SKILL' },
    name: 'MARROW'
  };
  const target = {
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack: 'MEND', skill: 'WILD GROWTH' },
    name: 'MOSSY'
  };
  const state = {
    selections: { localAction: 'guard', opponentAction: 'attack' },
    teams: { local: [bone], opponent: [target] }
  };
  resolution.resolveClash(state, { random: () => 0 });
  state.selections.localAction = 'skill';
  state.selections.opponentAction = 'attack';

  const blocked = resolution.resolveClash(state);

  assert.equal(target.effects.length, 1);
  assert.equal(blocked.effects.length, 0);
  assert.equal(blocked.triggeredStatuses[0].status, 'active');
  state.selections.localAction = 'guard';
  state.selections.opponentAction = 'skill';

  const cleared = resolution.resolveClash(state);

  assert.equal(target.effects.length, 0);
  assert.equal(cleared.triggeredStatuses[0].status, 'removed');
  assert.equal(cleared.triggeredStatuses[0].clearingPart, 'flight');
  assert.equal(cleared.effects[0].abilityKey, 'moss-wild-growth');
});

test('Clash preview Splinter survives losses and Draws', () => {
  const resolution = createOlingClashResolution();
  const bone = {
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { guard: 'SPLINTER' },
    name: 'MARROW'
  };
  const target = {
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack: 'ATTACK', draw: 'DRAW', skill: 'SKILL' },
    name: 'FANG'
  };
  const state = {
    selections: { localAction: 'guard', opponentAction: 'attack' },
    teams: { local: [bone], opponent: [target] }
  };
  resolution.resolveClash(state, { random: () => 0 });
  state.selections.localAction = 'attack';
  state.selections.opponentAction = 'skill';
  resolution.resolveClash(state);
  assert.equal(target.effects.length, 1);

  state.selections.localAction = 'guard';
  state.selections.opponentAction = 'guard';
  resolution.resolveClash(state);
  assert.equal(target.effects.length, 1);
});

test('Clash preview Wither blocks Positive Statuses in the following round', () => {
  const resolution = createOlingClashResolution();
  const createOling = (name, moves) => ({
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves,
    name
  });
  const target = createOling('MOSSY', { guard: 'CLEANSE' });
  const state = {
    playerEffects: { local: [], opponent: [] },
    round: 1,
    selections: { localAction: 'skill', opponentAction: 'guard' },
    teams: {
      local: [createOling('MARROW', { skill: 'WITHER' })],
      opponent: [target]
    }
  };

  const applied = resolution.resolveClash(state);

  assert.equal(applied.effects[0].abilityKey, 'bone-wither');
  assert.equal(state.playerEffects.opponent[0].activeFromRound, 2);
  assert.equal(state.playerEffects.opponent[0].expiresAfterRound, 2);
  state.round = 2;
  const positive = resolution.applyStatusEffect(state, 'opponent', target, {
    abbreviation: 'WRD',
    key: 'warded',
    name: 'Warded',
    type: 'positive'
  });
  const negative = resolution.applyStatusEffect(state, 'opponent', target, {
    abbreviation: 'BRN',
    key: 'burn',
    name: 'Burn',
    type: 'negative'
  });

  assert.equal(positive.result, 'blocked');
  assert.equal(negative.result, 'applied');
  assert.deepEqual(
    target.effects.map((effect) => effect.key),
    ['burn']
  );
});

test('Clash preview Wither allows resources and expires after the active round', () => {
  const resolution = createOlingClashResolution();
  const createOling = (name, moves) => ({
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves,
    name
  });
  const moss = createOling('MOSSY', {
    guard: 'GUARD',
    skill: 'WILD GROWTH'
  });
  const state = {
    playerEffects: { local: [], opponent: [] },
    round: 1,
    selections: { localAction: 'skill', opponentAction: 'guard' },
    teams: {
      local: [createOling('MARROW', { attack: 'ATTACK', skill: 'WITHER' })],
      opponent: [moss]
    }
  };
  resolution.resolveClash(state);
  state.round = 2;
  state.selections.localAction = 'guard';
  state.selections.opponentAction = 'skill';

  const result = resolution.resolveClash(state);

  assert.equal(moss.health.overgrowthUnits, 1);
  assert.equal(result.effects[0].abilityKey, 'moss-wild-growth');
  assert.equal(state.playerEffects.opponent.length, 0);
  assert.equal(result.triggeredStatuses.at(-1).outcome, 'round-expired');
});

test('Clash preview Read marks the opponent Action after a Draw', () => {
  const resolution = createOlingClashResolution();
  const createOling = (name, draw = 'DRAW') => ({
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack: 'ATTACK', draw, guard: 'GUARD', skill: 'SKILL' },
    name
  });
  const state = {
    playerEffects: { local: [], opponent: [] },
    pendingRoundStartEffects: [],
    round: 1,
    selections: { localAction: 'attack', opponentAction: 'attack' },
    teams: {
      local: [createOling('MARROW', 'READ')],
      opponent: [createOling('FANG')]
    }
  };

  const result = resolution.resolveClash(state);

  assert.equal(result.effects[0].abilityKey, 'bone-read');
  assert.equal(result.effects[0].recordedAction, 'attack');
  assert.equal(state.playerEffects.opponent[0].key, 'marked');
  assert.equal(state.playerEffects.opponent[0].checkRound, 2);
  assert.equal(state.pendingRoundStartEffects.length, 0);
});

test('Clash preview Read Suppresses the incoming Oling after a repeat', () => {
  const resolution = createOlingClashResolution();
  const createOling = (name, draw = 'DRAW') => ({
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack: 'ATTACK', draw, guard: 'GUARD', skill: 'SKILL' },
    name
  });
  const outgoing = createOling('FANG');
  const incoming = createOling('SCRAP');
  const state = {
    playerEffects: { local: [], opponent: [] },
    pendingRoundStartEffects: [],
    round: 1,
    selections: { localAction: 'skill', opponentAction: 'skill' },
    teams: {
      local: [createOling('MARROW', 'READ')],
      opponent: [outgoing, incoming]
    }
  };
  resolution.resolveClash(state);
  state.teams.local[0].moves.draw = 'DRAW';
  state.round = 2;
  state.selections.localAction = 'attack';
  state.selections.opponentAction = 'skill';

  const repeated = resolution.resolveClash(state);

  assert.equal(state.playerEffects.opponent.length, 0);
  assert.equal(state.pendingRoundStartEffects.length, 1);
  assert.equal(
    repeated.triggeredStatuses.find((status) => status.statusKey === 'marked')
      .outcome,
    'action-repeated'
  );
  [state.teams.opponent[0], state.teams.opponent[1]] = [
    state.teams.opponent[1],
    state.teams.opponent[0]
  ];
  state.round = 3;
  const effects = resolution.resolveRoundStartEffects(state, () => 0.5);

  assert.equal(outgoing.effects.length, 0);
  assert.equal(incoming.effects[0].key, 'suppressed');
  assert.equal(incoming.effects[0].targetPart, 'flight');
  assert.equal(effects[0].targetName, 'SCRAP');
  assert.equal(state.pendingRoundStartEffects.length, 0);
});

test('Clash preview Read clears without Suppression after a changed Action', () => {
  const resolution = createOlingClashResolution();
  const createOling = (name, draw = 'DRAW') => ({
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack: 'ATTACK', draw, guard: 'GUARD', skill: 'SKILL' },
    name
  });
  const state = {
    playerEffects: { local: [], opponent: [] },
    pendingRoundStartEffects: [],
    round: 1,
    selections: { localAction: 'attack', opponentAction: 'attack' },
    teams: {
      local: [createOling('MARROW', 'READ')],
      opponent: [createOling('FANG')]
    }
  };
  resolution.resolveClash(state);
  state.round = 2;
  state.selections.localAction = 'skill';
  state.selections.opponentAction = 'guard';

  const changed = resolution.resolveClash(state);

  assert.equal(
    changed.triggeredStatuses.find((status) => status.statusKey === 'marked')
      .outcome,
    'action-changed'
  );
  assert.equal(state.playerEffects.opponent.length, 0);
  assert.equal(state.pendingRoundStartEffects.length, 0);
});

test('Clash preview consecutive Reads evaluate before recording a new mark', () => {
  const resolution = createOlingClashResolution();
  const createOling = (name, draw = 'DRAW') => ({
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack: 'ATTACK', draw },
    name
  });
  const state = {
    playerEffects: { local: [], opponent: [] },
    pendingRoundStartEffects: [],
    round: 1,
    selections: { localAction: 'attack', opponentAction: 'attack' },
    teams: {
      local: [createOling('MARROW', 'READ')],
      opponent: [createOling('FANG')]
    }
  };
  resolution.resolveClash(state);
  state.round = 2;

  const second = resolution.resolveClash(state);

  assert.equal(
    second.triggeredStatuses.find((status) => status.statusKey === 'marked')
      .outcome,
    'action-repeated'
  );
  assert.equal(state.pendingRoundStartEffects.length, 1);
  assert.equal(state.playerEffects.opponent.length, 1);
  assert.equal(state.playerEffects.opponent[0].checkRound, 3);
});

test('Clash preview Eruption triggers after consecutive Attack victories', () => {
  const resolution = createOlingClashResolution();
  const createOling = (name, attack = 'ATTACK') => ({
    abilityProgress: [],
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack, guard: 'GUARD', skill: 'SKILL' },
    name
  });
  const magma = createOling('EMBER', 'ERUPTION');
  const opponent = createOling('FANG');
  const state = {
    round: 1,
    selections: { localAction: 'attack', opponentAction: 'skill' },
    teams: { local: [magma], opponent: [opponent] }
  };

  const first = resolution.resolveClash(state);

  assert.equal(first.effects[0].status, 'condition-not-met');
  assert.equal(opponent.health.heartUnits, 4);
  assert.equal(
    magma.abilityProgress[0].data.lastDecisiveVictoryAction,
    'attack'
  );
  state.round = 2;
  const second = resolution.resolveClash(state);

  assert.equal(second.effects[0].status, 'resolved');
  assert.equal(second.effects[0].appliedUnits, 1);
  assert.equal(opponent.health.heartUnits, 1);
  assert.equal(second.decisiveVictoryRecords[0].previousAction, 'attack');
});

test('Clash preview different decisive victories break Eruption chains', () => {
  const resolution = createOlingClashResolution();
  const createOling = (name, attack = 'ATTACK') => ({
    abilityProgress: [],
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack, guard: 'GUARD', skill: 'SKILL' },
    name
  });
  const magma = createOling('EMBER', 'ERUPTION');
  const state = {
    round: 1,
    selections: { localAction: 'attack', opponentAction: 'skill' },
    teams: { local: [magma], opponent: [createOling('FANG')] }
  };
  resolution.resolveClash(state);
  state.round = 2;
  state.selections.localAction = 'guard';
  state.selections.opponentAction = 'attack';
  resolution.resolveClash(state);
  state.round = 3;
  state.selections.localAction = 'attack';
  state.selections.opponentAction = 'skill';

  const result = resolution.resolveClash(state);

  assert.equal(result.effects[0].status, 'condition-not-met');
  assert.equal(result.effects[0].previousDecisiveVictoryAction, 'guard');
});

test('Clash preview Eruption uses normal damage routing', () => {
  const resolution = createOlingClashResolution();
  const magma = {
    abilityProgress: [
      {
        abilityKey: 'magma-eruption',
        abilityRevision: 1,
        activationCount: 0,
        data: { lastDecisiveVictoryAction: 'attack' }
      }
    ],
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack: 'ERUPTION' },
    name: 'EMBER'
  };
  const target = {
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 1,
      shieldCount: 1
    },
    moves: { skill: 'SKILL' },
    name: 'FANG'
  };
  const state = {
    round: 2,
    selections: { localAction: 'attack', opponentAction: 'skill' },
    teams: { local: [magma], opponent: [target] }
  };

  const result = resolution.resolveClash(state);

  assert.equal(target.health.shieldCount, 0);
  assert.equal(target.health.overgrowthUnits, 0);
  assert.equal(target.health.heartUnits, 6);
  assert.equal(result.effects[0].damageType, 'normal');
});

test('Clash preview keeps Eruption history on the Oling that earned it', () => {
  const resolution = createOlingClashResolution();
  const createMagma = (name) => ({
    abilityProgress: [],
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack: 'ERUPTION' },
    name
  });
  const first = createMagma('EMBER');
  const second = createMagma('CINDER');
  const target = {
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { skill: 'SKILL' },
    name: 'FANG'
  };
  const state = {
    round: 1,
    selections: { localAction: 'attack', opponentAction: 'skill' },
    teams: { local: [first, second], opponent: [target] }
  };
  resolution.resolveClash(state);
  [state.teams.local[0], state.teams.local[1]] = [second, first];
  state.round = 2;

  const result = resolution.resolveClash(state);

  assert.equal(result.effects[0].status, 'condition-not-met');
  assert.equal(
    second.abilityProgress[0].data.lastDecisiveVictoryAction,
    'attack'
  );
  assert.equal(first.abilityProgress[0].data.lastDecisiveVictoryRound, 1);
});

test('Clash preview Retaliate primes Burn after a Guard victory', () => {
  const resolution = createOlingClashResolution();
  const createOling = (name, moves) => ({
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves,
    name
  });
  const magma = createOling('EMBER', { guard: 'RETALIATE' });
  const state = {
    round: 1,
    selections: { localAction: 'guard', opponentAction: 'attack' },
    teams: {
      local: [magma],
      opponent: [createOling('FANG', { attack: 'ATTACK' })]
    }
  };

  const result = resolution.resolveClash(state);

  assert.equal(magma.effects[0].key, 'burn-primed');
  assert.equal(magma.effects[0].type, 'positive');
  assert.equal(result.effects[0].abilityKey, 'magma-retaliate');
  assert.equal(result.effects[0].statusResult, 'applied');
});

test('Clash preview Retaliate applies Burn without triggering it immediately', () => {
  const resolution = createOlingClashResolution();
  const createOling = (name, moves) => ({
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves,
    name
  });
  const magma = createOling('EMBER', {
    attack: 'ATTACK',
    guard: 'RETALIATE',
    skill: 'SKILL'
  });
  const target = createOling('FANG', {
    attack: 'ATTACK',
    skill: 'SKILL'
  });
  const state = {
    round: 1,
    selections: { localAction: 'guard', opponentAction: 'attack' },
    teams: { local: [magma], opponent: [target] }
  };
  resolution.resolveClash(state);
  state.round = 2;
  state.selections.localAction = 'skill';
  state.selections.opponentAction = 'attack';
  resolution.resolveClash(state);
  assert.equal(magma.effects[0].key, 'burn-primed');
  state.round = 3;
  state.selections.localAction = 'attack';
  state.selections.opponentAction = 'attack';
  resolution.resolveClash(state);
  assert.equal(magma.effects[0].key, 'burn-primed');
  state.round = 4;
  state.selections.localAction = 'attack';
  state.selections.opponentAction = 'skill';

  const applied = resolution.resolveClash(state);

  assert.equal(magma.effects.length, 0);
  assert.equal(magma.removedPositiveEffects[0].effect.key, 'burn-primed');
  assert.equal(magma.removedPositiveEffects[0].reason, 'trigger-consumed');
  assert.equal(target.effects[0].key, 'burn');
  assert.equal(target.health.heartUnits, 1);
  assert.equal(
    applied.triggeredStatuses.some(
      (status) => status.handler === 'damage_after_decisive_clash'
    ),
    false
  );
});

test('Clash preview Ignite primes Burn after a Last Stand Draw', () => {
  const resolution = createOlingClashResolution();
  const magma = {
    effects: [],
    health: {
      heartUnits: 1,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack: 'ATTACK', draw: 'IGNITE' },
    name: 'EMBER'
  };
  const opponent = {
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack: 'ATTACK', draw: 'DRAW' },
    name: 'FANG'
  };
  const state = {
    round: 1,
    selections: { localAction: 'attack', opponentAction: 'attack' },
    teams: { local: [magma], opponent: [opponent] }
  };

  const result = resolution.resolveClash(state);

  assert.equal(magma.health.heartUnits, 1);
  assert.equal(magma.effects[0].key, 'burn-primed');
  assert.equal(magma.effects[0].condition, 'next-decisive-action-win');
  assert.equal(magma.effects[0].durationType, 'clash');
  assert.equal(result.effects[0].abilityKey, 'magma-ignite');
  assert.equal(result.localDamage.lastStand, true);
});

test('Clash preview Ignite is prevented by Eyes Suppression', () => {
  const resolution = createOlingClashResolution();
  const magma = {
    effects: [
      {
        consumption: 'matching-activation',
        key: 'suppressed',
        name: 'Suppressed',
        targetPart: 'eyes',
        type: 'negative'
      }
    ],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack: 'ATTACK', draw: 'IGNITE' },
    name: 'EMBER'
  };
  const opponent = {
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack: 'ATTACK', draw: 'DRAW' },
    name: 'FANG'
  };
  const state = {
    round: 1,
    selections: { localAction: 'attack', opponentAction: 'attack' },
    teams: { local: [magma], opponent: [opponent] }
  };

  const result = resolution.resolveClash(state);

  assert.equal(magma.effects.length, 0);
  assert.equal(result.effects.length, 0);
  assert.equal(result.triggeredStatuses[0].outcome, 'activation-suppressed');
  assert.equal(result.triggeredStatuses[0].targetPart, 'eyes');
});

test('Clash preview Ignite waits for a decisive Attack victory', () => {
  const resolution = createOlingClashResolution();
  const createOling = (name, moves) => ({
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves,
    name
  });
  const magma = createOling('EMBER', {
    attack: 'ATTACK',
    draw: 'IGNITE',
    guard: 'GUARD',
    skill: 'SKILL'
  });
  const target = createOling('FANG', {
    attack: 'ATTACK',
    draw: 'DRAW',
    guard: 'GUARD',
    skill: 'SKILL'
  });
  target.health.shieldCount = 1;
  const state = {
    round: 1,
    selections: { localAction: 'attack', opponentAction: 'attack' },
    teams: { local: [magma], opponent: [target] }
  };
  resolution.resolveClash(state);
  state.round = 2;
  state.selections.localAction = 'guard';
  state.selections.opponentAction = 'attack';
  resolution.resolveClash(state);
  assert.equal(magma.effects[0].key, 'burn-primed');
  state.round = 3;
  state.selections.localAction = 'attack';
  state.selections.opponentAction = 'guard';
  resolution.resolveClash(state);
  assert.equal(magma.effects[0].key, 'burn-primed');
  state.round = 4;
  state.selections.localAction = 'attack';
  state.selections.opponentAction = 'attack';
  resolution.resolveClash(state);
  assert.equal(magma.effects[0].key, 'burn-primed');
  state.round = 5;
  state.selections.localAction = 'attack';
  state.selections.opponentAction = 'skill';

  const applied = resolution.resolveClash(state);

  assert.equal(magma.effects.length, 0);
  assert.equal(target.effects[0].key, 'burn');
  assert.equal(target.effects[0].sourceAbilityKey, 'magma-ignite');
  assert.equal(target.health.heartUnits, 1);
  assert.equal(
    applied.triggeredStatuses.some(
      (status) => status.handler === 'damage_after_decisive_clash'
    ),
    false
  );
});

test('Clash preview Burn triggers on the next decisive Clash', () => {
  const resolution = createOlingClashResolution();
  const magma = {
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { attack: 'ATTACK' },
    name: 'EMBER'
  };
  const target = {
    effects: [
      {
        abbreviation: 'BRN',
        key: 'burn',
        name: 'Burn',
        type: 'negative'
      }
    ],
    health: {
      heartUnits: 1,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { guard: 'GUARD' },
    name: 'FANG'
  };
  const state = {
    round: 2,
    selections: { localAction: 'attack', opponentAction: 'guard' },
    teams: { local: [magma], opponent: [target] }
  };

  const result = resolution.resolveClash(state);

  assert.equal(target.health.heartUnits, 0);
  assert.equal(target.effects.length, 0);
  assert.equal(result.triggeredStatuses[0].damageSource, 'burn');
  assert.equal(result.triggeredStatuses[0].appliedUnits, 1);
});

test('Clash preview Burn destroys a whole Shield through normal routing', () => {
  const resolution = createOlingClashResolution();
  const createOling = (name, health, moves, effects = []) => ({
    effects,
    health,
    moves,
    name
  });
  const target = createOling(
    'FANG',
    {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 1,
      shieldCount: 1
    },
    { attack: 'ATTACK' },
    [{ key: 'burn', name: 'Burn', type: 'negative' }]
  );
  const state = {
    round: 2,
    selections: { localAction: 'skill', opponentAction: 'attack' },
    teams: {
      local: [
        createOling(
          'EMBER',
          {
            heartUnits: 6,
            maxHeartUnits: 6,
            overgrowthUnits: 0,
            shieldCount: 0
          },
          { skill: 'SKILL' }
        )
      ],
      opponent: [target]
    }
  };

  const result = resolution.resolveClash(state);

  assert.equal(target.health.shieldCount, 0);
  assert.equal(target.health.overgrowthUnits, 1);
  assert.equal(target.health.heartUnits, 6);
  assert.equal(result.triggeredStatuses[0].damageType, 'normal');
});

test('Clash preview Wither blocks Retaliate Burn Primed', () => {
  const resolution = createOlingClashResolution();
  const magma = {
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { guard: 'RETALIATE' },
    name: 'EMBER'
  };
  const state = {
    playerEffects: {
      local: [
        {
          activeFromRound: 2,
          category: 'positive-status',
          expiresAfterRound: 2,
          key: 'blocked',
          type: 'negative'
        }
      ],
      opponent: []
    },
    round: 2,
    selections: { localAction: 'guard', opponentAction: 'attack' },
    teams: {
      local: [magma],
      opponent: [
        {
          effects: [],
          health: {
            heartUnits: 6,
            maxHeartUnits: 6,
            overgrowthUnits: 0,
            shieldCount: 0
          },
          moves: { attack: 'ATTACK' },
          name: 'FANG'
        }
      ]
    }
  };

  const result = resolution.resolveClash(state);

  assert.equal(magma.effects.length, 0);
  assert.equal(result.effects[0].status, 'blocked');
});

test('Clash preview Scorch Suppresses the opposing Mouth', () => {
  const resolution = createOlingClashResolution();
  const createOling = (name, moves) => ({
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves,
    name
  });
  const target = createOling('MOSSY', { attack: 'MEND', guard: 'GUARD' });
  const state = {
    round: 1,
    selections: { localAction: 'skill', opponentAction: 'guard' },
    teams: {
      local: [createOling('EMBER', { skill: 'SCORCH' })],
      opponent: [target]
    }
  };

  const result = resolution.resolveClash(state);

  assert.equal(target.effects[0].key, 'suppressed');
  assert.equal(target.effects[0].targetPart, 'mouth');
  assert.equal(target.effects[0].sourceAbilityKey, 'magma-scorch');
  assert.equal(result.effects[0].abilityKey, 'magma-scorch');
  assert.equal(result.effects[0].statusResult, 'applied');
});

test('Clash preview Scorch blocks a Mouth effect but not Attack damage', () => {
  const resolution = createOlingClashResolution();
  const createOling = (name, health, moves) => ({
    effects: [],
    health: {
      heartUnits: health,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves,
    name
  });
  const magma = createOling('EMBER', 6, { skill: 'SCORCH' });
  const target = createOling('MOSSY', 6, {
    attack: 'MEND',
    guard: 'GUARD'
  });
  const bench = createOling('PEBBLE', 3, {});
  const state = {
    round: 1,
    selections: { localAction: 'skill', opponentAction: 'guard' },
    teams: { local: [magma], opponent: [target, bench] }
  };
  resolution.resolveClash(state);
  state.round = 2;
  state.selections.localAction = 'skill';
  state.selections.opponentAction = 'attack';

  const blocked = resolution.resolveClash(state);

  assert.equal(magma.health.heartUnits, 4);
  assert.equal(bench.health.heartUnits, 3);
  assert.equal(target.effects.length, 0);
  assert.equal(blocked.effects.length, 0);
  assert.equal(blocked.triggeredStatuses[0].targetPart, 'mouth');
  assert.equal(blocked.triggeredStatuses[0].status, 'consumed');
});

test('Clash preview Scorch waits through Attack losses and Draws', () => {
  const resolution = createOlingClashResolution();
  const createOling = (name, moves) => ({
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves,
    name
  });
  const magma = createOling('EMBER', {
    attack: 'ATTACK',
    guard: 'GUARD',
    skill: 'SCORCH'
  });
  const target = createOling('MOSSY', {
    attack: 'MEND',
    guard: 'GUARD'
  });
  const state = {
    round: 1,
    selections: { localAction: 'skill', opponentAction: 'guard' },
    teams: { local: [magma], opponent: [target] }
  };
  resolution.resolveClash(state);
  state.round = 2;
  state.selections.localAction = 'guard';
  state.selections.opponentAction = 'attack';
  resolution.resolveClash(state);
  assert.equal(target.effects[0].targetPart, 'mouth');
  state.round = 3;
  state.selections.localAction = 'attack';
  state.selections.opponentAction = 'attack';
  resolution.resolveClash(state);
  assert.equal(target.effects[0].targetPart, 'mouth');
});

test('Clash preview Scorch refreshes only its matching Suppression', () => {
  const resolution = createOlingClashResolution();
  const target = {
    effects: [
      {
        key: 'suppressed',
        sourceAbilityKey: 'bone-fracture',
        targetPart: 'body',
        type: 'negative'
      },
      {
        appliedRound: 1,
        key: 'suppressed',
        sourceAbilityKey: 'magma-scorch',
        targetPart: 'mouth',
        type: 'negative'
      }
    ],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { guard: 'GUARD' },
    name: 'MOSSY'
  };
  const state = {
    round: 4,
    selections: { localAction: 'skill', opponentAction: 'guard' },
    teams: {
      local: [
        {
          effects: [],
          health: {
            heartUnits: 6,
            maxHeartUnits: 6,
            overgrowthUnits: 0,
            shieldCount: 0
          },
          moves: { skill: 'SCORCH' },
          name: 'EMBER'
        }
      ],
      opponent: [target]
    }
  };

  const result = resolution.resolveClash(state);

  assert.equal(target.effects.length, 2);
  assert.equal(result.effects[0].statusResult, 'refreshed');
  assert.equal(
    target.effects.find((effect) => effect.sourceAbilityKey === 'bone-fracture')
      .targetPart,
    'body'
  );
});

test('Clash preview Scavenge marks the previously used Part', () => {
  const resolution = createOlingClashResolution();
  const createOling = (id, name, moves) => ({
    id,
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves,
    name
  });
  const state = {
    lastUsedParts: { local: 'flight', opponent: 'body' },
    playerEffects: { local: [], opponent: [] },
    round: 2,
    selections: { localAction: 'attack', opponentAction: 'skill' },
    teams: {
      local: [createOling('scrap', 'SCRAP', { attack: 'SCAVENGE' })],
      opponent: [createOling('mossy', 'MOSSY', { skill: 'SKILL' })]
    }
  };

  const result = resolution.resolveClash(state);

  assert.equal(result.effects[0].abilityKey, 'trash-scavenge');
  assert.equal(result.effects[0].recordedPart, 'body');
  assert.equal(state.playerEffects.opponent[0].key, 'steal-primed');
  assert.equal(state.playerEffects.opponent[0].checkRound, 3);
});

test('Clash preview Scavenge redirects a matching positive effect', () => {
  const resolution = createOlingClashResolution();
  const createOling = (id, name, heartUnits, moves) => ({
    id,
    effects: [],
    health: {
      heartUnits,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves,
    name
  });
  const state = {
    lastUsedParts: { local: 'mouth', opponent: 'flight' },
    playerEffects: {
      local: [],
      opponent: [
        {
          checkRound: 3,
          condition: 'positive-effect-steal',
          durationType: 'round',
          expiresAfterRound: 3,
          key: 'steal-primed',
          recordedPart: 'mouth',
          sourceAbilityKey: 'trash-scavenge',
          sourceOlingId: 'scrap',
          sourcePlayerSlot: 'local',
          type: 'negative'
        }
      ]
    },
    round: 3,
    selections: { localAction: 'skill', opponentAction: 'attack' },
    teams: {
      local: [
        createOling('scrap', 'SCRAP', 6, { skill: 'SKILL' }),
        createOling('pebble', 'PEBBLE', 3, {})
      ],
      opponent: [
        createOling('mossy', 'MOSSY', 6, { attack: 'MEND' }),
        createOling('ember', 'EMBER', 2, {})
      ]
    }
  };

  const result = resolution.resolveClash(state);

  assert.equal(state.teams.local[1].health.heartUnits, 4);
  assert.equal(state.teams.opponent[1].health.heartUnits, 2);
  assert.equal(state.playerEffects.opponent.length, 0);
  assert.equal(result.effects[0].redirectType, 'steal');
  assert.equal(result.effects[0].redirectCount, 1);
  assert.equal(result.effects[0].stolenFromPlayerSlot, 'opponent');
});

test('Clash preview Return to Sender Reflects Fracture to its owner', () => {
  const resolution = createOlingClashResolution();
  const createOling = (name, moves) => ({
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves,
    name
  });
  const trash = createOling('SCRAP', { guard: 'RETURN TO SENDER' });
  const bone = createOling('MARROW', { attack: 'FRACTURE' });
  const state = {
    round: 1,
    selections: { localAction: 'guard', opponentAction: 'attack' },
    teams: { local: [trash], opponent: [bone] }
  };

  const result = resolution.resolveClash(state);

  assert.equal(trash.effects.length, 0);
  assert.equal(bone.effects[0].key, 'suppressed');
  assert.equal(bone.effects[0].targetPart, 'body');
  assert.equal(result.effects[0].abilityKey, 'bone-fracture');
  assert.equal(result.effects[0].redirectType, 'reflect');
  assert.equal(
    result.effects[0].redirectedByAbilityKey,
    'trash-return-to-sender'
  );
});

test('Clash preview Return to Sender ignores Mend', () => {
  const resolution = createOlingClashResolution();
  const createOling = (name, heartUnits, moves) => ({
    effects: [],
    health: {
      heartUnits,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves,
    name
  });
  const mossBench = createOling('MOSS BENCH', 3, {});
  const state = {
    round: 1,
    selections: { localAction: 'guard', opponentAction: 'attack' },
    teams: {
      local: [createOling('SCRAP', 6, { guard: 'RETURN TO SENDER' })],
      opponent: [createOling('MOSSY', 6, { attack: 'MEND' }), mossBench]
    }
  };

  const result = resolution.resolveClash(state);

  assert.equal(mossBench.health.heartUnits, 3);
  assert.equal(result.effects[0].abilityKey, 'trash-return-to-sender');
  assert.equal(result.effects[0].outcome, 'no-reflectable-effect');
});

test('Clash preview Junkyard applies Junk to the opposing player', () => {
  const resolution = createOlingClashResolution();
  const createOling = (name, moves) => ({
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves,
    name
  });
  const state = {
    playerEffects: { local: [], opponent: [] },
    round: 1,
    selections: { localAction: 'skill', opponentAction: 'guard' },
    teams: {
      local: [createOling('SCRAP', { skill: 'JUNKYARD' })],
      opponent: [createOling('MOSSY', { guard: 'GUARD' })]
    }
  };

  const result = resolution.resolveClash(state);

  assert.equal(state.playerEffects.opponent[0].key, 'junk');
  assert.equal(state.playerEffects.opponent[0].durationType, 'activation');
  assert.equal(result.effects[0].abilityKey, 'trash-junkyard');
  assert.equal(result.effects[0].statusResult, 'applied');
});

test('Clash preview Junk consumes instead of the next Part effect', () => {
  const resolution = createOlingClashResolution();
  const createOling = (name, heartUnits, moves) => ({
    effects: [],
    health: {
      heartUnits,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves,
    name
  });
  const state = {
    playerEffects: { local: [], opponent: [] },
    round: 1,
    selections: { localAction: 'skill', opponentAction: 'guard' },
    teams: {
      local: [createOling('SCRAP', 6, { skill: 'JUNKYARD' })],
      opponent: [
        createOling('MOSSY', 6, { attack: 'MEND', guard: 'GUARD' }),
        createOling('PEBBLE', 3, {})
      ]
    }
  };
  resolution.resolveClash(state);
  state.round = 2;
  state.selections.localAction = 'skill';
  state.selections.opponentAction = 'attack';

  const result = resolution.resolveClash(state);

  assert.equal(state.teams.local[0].health.heartUnits, 4);
  assert.equal(state.teams.opponent[1].health.heartUnits, 3);
  assert.equal(state.playerEffects.opponent.length, 0);
  assert.equal(result.effects.length, 0);
  assert.equal(
    result.triggeredStatuses[0].outcome,
    'activation-replaced-with-junk'
  );
});

test('Clash preview Salvage restores a consumed Ward', () => {
  const resolution = createOlingClashResolution();
  const createOling = (name, moves) => ({
    abilityProgress: [],
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves,
    name,
    removedPositiveEffects: []
  });
  const trash = createOling('SCRAP', { draw: 'SALVAGE', skill: 'SKILL' });
  trash.effects = [
    {
      category: 'bonus-damage',
      key: 'warded',
      name: 'Warded',
      sourceAbilityKey: 'stone-fortify',
      type: 'positive'
    }
  ];
  const magma = createOling('EMBER', {
    attack: 'ERUPTION',
    draw: 'DRAW'
  });
  magma.abilityProgress = [
    {
      abilityKey: 'magma-eruption',
      abilityRevision: 1,
      activationCount: 0,
      data: { lastDecisiveVictoryAction: 'attack' }
    }
  ];
  const state = {
    playerEffects: { local: [], opponent: [] },
    round: 2,
    selections: { localAction: 'skill', opponentAction: 'attack' },
    teams: { local: [trash], opponent: [magma] }
  };

  const warded = resolution.resolveClash(state);

  assert.equal(warded.effects[0].status, 'prevented');
  assert.equal(trash.effects.length, 0);
  assert.equal(trash.removedPositiveEffects[0].effect.key, 'warded');
  state.round = 3;
  state.selections.localAction = 'attack';
  state.selections.opponentAction = 'attack';

  const restored = resolution.resolveClash(state);

  assert.equal(trash.effects[0].key, 'warded');
  assert.deepEqual(trash.removedPositiveEffects, []);
  assert.equal(restored.effects[0].abilityKey, 'trash-salvage');
  assert.equal(restored.effects[0].restoredStatusKey, 'warded');
  assert.equal(restored.effects[0].statusResult, 'applied');
});

test('Clash preview Salvage restores only the newest Positive Status', () => {
  const resolution = createOlingClashResolution();
  const trash = {
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { draw: 'SALVAGE' },
    name: 'SCRAP',
    removedPositiveEffects: [
      {
        effect: {
          key: 'burn-primed',
          name: 'Burn Primed',
          type: 'positive'
        },
        reason: 'trigger-consumed'
      },
      {
        effect: { key: 'warded', name: 'Warded', type: 'positive' },
        reason: 'ward-consumed'
      }
    ]
  };
  const opponent = {
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { draw: 'DRAW' },
    name: 'FANG'
  };
  const state = {
    playerEffects: { local: [], opponent: [] },
    round: 3,
    selections: { localAction: 'attack', opponentAction: 'attack' },
    teams: { local: [trash], opponent: [opponent] }
  };

  const result = resolution.resolveClash(state);

  assert.deepEqual(
    trash.effects.map((effect) => effect.key),
    ['warded']
  );
  assert.equal(trash.removedPositiveEffects.length, 1);
  assert.equal(trash.removedPositiveEffects[0].effect.key, 'burn-primed');
  assert.equal(result.effects[0].remainingHistoryCount, 1);
});

test('Clash preview Wither blocks Salvage without consuming its history', () => {
  const resolution = createOlingClashResolution();
  const trash = {
    effects: [],
    health: {
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    moves: { draw: 'SALVAGE' },
    name: 'SCRAP',
    removedPositiveEffects: [
      {
        effect: { key: 'warded', name: 'Warded', type: 'positive' },
        reason: 'ward-consumed'
      }
    ]
  };
  const state = {
    playerEffects: {
      local: [
        {
          activeFromRound: 3,
          category: 'positive-status',
          expiresAfterRound: 3,
          key: 'blocked',
          type: 'negative'
        }
      ],
      opponent: []
    },
    round: 3,
    selections: { localAction: 'attack', opponentAction: 'attack' },
    teams: {
      local: [trash],
      opponent: [
        {
          effects: [],
          health: {
            heartUnits: 6,
            maxHeartUnits: 6,
            overgrowthUnits: 0,
            shieldCount: 0
          },
          moves: { draw: 'DRAW' },
          name: 'FANG'
        }
      ]
    }
  };

  const result = resolution.resolveClash(state);

  assert.equal(trash.effects.length, 0);
  assert.equal(trash.removedPositiveEffects.length, 1);
  assert.equal(result.effects[0].status, 'blocked');
  assert.equal(result.effects[0].statusResult, 'blocked');
});
