const assert = require('node:assert/strict');
const test = require('node:test');

const createOlingClashAudio = require('../../public/scripts/olings/clash/game/audio');

test('Clash audio registers and plays its one-shot cues', async () => {
  const registrations = [];
  const playedSounds = [];
  const audio = createOlingClashAudio({
    audioEngine: {
      register(definitions) {
        registrations.push(definitions);
      }
    },
    playSound(soundKey) {
      playedSounds.push(soundKey);
    }
  });

  assert.equal(await audio.register(), true);
  assert.equal(await audio.playAbilitySelect(), true);
  assert.equal(await audio.playAbilityDeselect(), true);
  assert.equal(await audio.playCollision(), true);
  assert.equal(await audio.playChooseAction(), true);
  assert.equal(await audio.playActionSubmitted(), true);
  assert.equal(await audio.playChooseTag(), true);
  assert.equal(await audio.playLockIn(), true);
  assert.equal(await audio.playReveal('local'), true);
  assert.equal(await audio.playReveal('draw'), true);
  assert.equal(await audio.playReveal('opponent'), true);
  assert.equal(await audio.playMatchResult('local'), true);
  assert.equal(await audio.playMatchResult('opponent'), true);
  assert.equal(await audio.playMatchResult('draw'), false);
  assert.deepEqual(playedSounds, [
    'olingClashAbilitySelect',
    'olingClashAbilityDeselect',
    'olingClashCollision',
    'olingClashPhaseChooseAction',
    'olingClashPhaseActionSubmitted',
    'olingClashPhaseChooseTag',
    'olingClashRoundLockIn',
    'olingClashRoundRevealWin',
    'olingClashRoundRevealDraw',
    'olingClashRoundRevealLoss',
    'olingClashMatchVictory',
    'olingClashMatchDefeat'
  ]);
  assert.equal(
    registrations[0].olingClashAbilitySelect.src,
    '/sounds/olings/clash/ability/select.wav'
  );
  assert.equal(
    registrations[0].olingClashAbilityDeselect.src,
    '/sounds/olings/clash/ability/deselect.wav'
  );
  assert.equal(
    registrations[0].olingClashCollision.src,
    '/sounds/olings/clash/combat/collision/default.wav'
  );
  assert.equal(
    registrations[0].olingClashKnockout.src,
    '/sounds/olings/clash/combat/knockout/default.wav'
  );
  assert.equal(
    registrations[0].olingClashRoundLockIn.src,
    '/sounds/olings/clash/round/lock-in.wav'
  );
  assert.deepEqual(
    ['ActionSubmitted', 'ChooseAction', 'ChooseTag'].map(
      (phaseType) => registrations[0][`olingClashPhase${phaseType}`].src
    ),
    [
      '/sounds/olings/clash/phase/action-submitted.wav',
      '/sounds/olings/clash/phase/choose-action.wav',
      '/sounds/olings/clash/phase/choose-tag.wav'
    ]
  );
  assert.equal(
    registrations[0].olingClashRoundRevealWin.src,
    '/sounds/olings/clash/round/reveal/win.wav'
  );
  assert.equal(
    registrations[0].olingClashRoundRevealDraw.src,
    '/sounds/olings/clash/round/reveal/draw.wav'
  );
  assert.equal(
    registrations[0].olingClashRoundRevealLoss.src,
    '/sounds/olings/clash/round/reveal/loss.wav'
  );
  assert.deepEqual(
    ['Victory', 'Defeat'].map(
      (outcome) => registrations[0][`olingClashMatch${outcome}`].src
    ),
    [
      '/sounds/olings/clash/match/victory.wav',
      '/sounds/olings/clash/match/defeat.wav'
    ]
  );
  assert.deepEqual(
    ['Heart', 'Overgrowth', 'Prevented', 'Shield', 'True'].map((damageType) => [
      damageType.toLowerCase(),
      registrations[0][`olingClashDamage${damageType}`].src
    ]),
    [
      ['heart', '/sounds/olings/clash/combat/damage/heart.wav'],
      ['overgrowth', '/sounds/olings/clash/combat/damage/overgrowth.wav'],
      ['prevented', '/sounds/olings/clash/combat/damage/prevented.wav'],
      ['shield', '/sounds/olings/clash/combat/damage/shield.wav'],
      ['true', '/sounds/olings/clash/combat/damage/true.wav']
    ]
  );
  assert.deepEqual(
    [
      ['BloodReclaim', 'blood-reclaim.wav'],
      ['BloodStore', 'blood-store.wav'],
      ['Heal', 'heal.wav'],
      ['OvergrowthGain', 'overgrowth-gain.wav'],
      ['ShieldGain', 'shield-gain.wav']
    ].map(([resourceType, filename]) => [
      resourceType,
      registrations[0][`olingClashResource${resourceType}`].src,
      `/sounds/olings/clash/resources/${filename}`
    ]),
    [
      [
        'BloodReclaim',
        '/sounds/olings/clash/resources/blood-reclaim.wav',
        '/sounds/olings/clash/resources/blood-reclaim.wav'
      ],
      [
        'BloodStore',
        '/sounds/olings/clash/resources/blood-store.wav',
        '/sounds/olings/clash/resources/blood-store.wav'
      ],
      [
        'Heal',
        '/sounds/olings/clash/resources/heal.wav',
        '/sounds/olings/clash/resources/heal.wav'
      ],
      [
        'OvergrowthGain',
        '/sounds/olings/clash/resources/overgrowth-gain.wav',
        '/sounds/olings/clash/resources/overgrowth-gain.wav'
      ],
      [
        'ShieldGain',
        '/sounds/olings/clash/resources/shield-gain.wav',
        '/sounds/olings/clash/resources/shield-gain.wav'
      ]
    ]
  );
  assert.deepEqual(
    ['Junk', 'Negative', 'Positive', 'Suppressed', 'Warded'].map(
      (statusType) => registrations[0][`olingClashStatus${statusType}`].src
    ),
    [
      '/sounds/olings/clash/status/junk.wav',
      '/sounds/olings/clash/status/negative.wav',
      '/sounds/olings/clash/status/positive.wav',
      '/sounds/olings/clash/status/suppressed.wav',
      '/sounds/olings/clash/status/warded.wav'
    ]
  );
  assert.equal(
    registrations[0].olingClashTag.src,
    '/sounds/olings/clash/tag/default.wav'
  );
  assert.equal(registrations[0].olingClashCollision.preload, true);
});

test('Clash audio staggers each affected damage material once', () => {
  const playedSounds = [];
  const scheduled = [];
  const audio = createOlingClashAudio({
    playSound(soundKey) {
      playedSounds.push(soundKey);
    },
    setTimeout(callback, delay) {
      scheduled.push({ callback, delay });
      return scheduled.length;
    }
  });

  const soundKeys = audio.playDamage([
    {
      damageType: 'normal',
      lastStand: true,
      layers: [{ key: 'shields' }, { key: 'overgrowth' }, { key: 'hearts' }]
    },
    {
      damageType: 'normal',
      layers: [{ key: 'hearts' }]
    },
    {
      damageType: 'true',
      layers: [{ key: 'hearts' }]
    }
  ]);

  assert.deepEqual(soundKeys, [
    'olingClashDamageShield',
    'olingClashDamageOvergrowth',
    'olingClashDamageHeart',
    'olingClashDamageTrue',
    'olingClashDamagePrevented'
  ]);
  assert.deepEqual(
    scheduled.map(({ delay }) => delay),
    [50, 90, 130, 170, 210]
  );
  scheduled.forEach(({ callback }) => callback());
  assert.deepEqual(playedSounds, soundKeys);
});

test('Clash audio plays knockout when the defeated Oling lands', () => {
  const playedSounds = [];
  const scheduled = [];
  const audio = createOlingClashAudio({
    playSound(soundKey) {
      playedSounds.push(soundKey);
    },
    setTimeout(callback, delay) {
      scheduled.push({ callback, delay });
      return scheduled.length;
    }
  });

  assert.deepEqual(
    audio.getKnockoutSides([
      {
        defeated: true,
        layers: [{ key: 'hearts' }],
        side: 'opponent'
      },
      { defeated: false, layers: [{ key: 'hearts' }], side: 'local' }
    ]),
    ['opponent']
  );
  audio.playDamage([
    {
      defeated: true,
      layers: [{ key: 'hearts' }],
      side: 'opponent'
    }
  ]);

  assert.deepEqual(
    scheduled.map(({ delay }) => delay),
    [50, 850]
  );
  scheduled.forEach(({ callback }) => callback());
  assert.deepEqual(playedSounds, [
    'olingClashDamageHeart',
    'olingClashKnockout'
  ]);
});

test('Clash audio plays successful health and resource effects once', () => {
  const playedSounds = [];
  const scheduled = [];
  const audio = createOlingClashAudio({
    playSound(soundKey) {
      playedSounds.push(soundKey);
    },
    setTimeout(callback, delay) {
      scheduled.push({ callback, delay });
      return scheduled.length;
    }
  });

  const soundKeys = audio.playResources([
    {
      mechanic: 'store-resource',
      playerSlot: 'local',
      resource: 'blood',
      storedResourceUnits: 1,
      converted: true,
      appliedUnits: 2
    },
    { mechanic: 'grant-overgrowth', playerSlot: 'local', appliedUnits: 1 },
    { mechanic: 'grant-overgrowth', playerSlot: 'local', appliedUnits: 1 },
    {
      mechanic: 'grant-shield',
      playerSlot: 'local',
      appliedShieldCount: 1
    },
    { mechanic: 'heal', playerSlot: 'local', appliedUnits: 1 },
    {
      mechanic: 'heal',
      playerSlot: 'local',
      resource: 'reclaim-blood',
      outcome: 'recovered',
      appliedUnits: 1
    },
    { mechanic: 'heal', playerSlot: 'local', appliedUnits: 0 },
    {
      mechanic: 'grant-shield',
      playerSlot: 'local',
      appliedShieldCount: 0
    }
  ]);

  assert.deepEqual(soundKeys, [
    'olingClashResourceBloodStore',
    'olingClashResourceOvergrowthGain',
    'olingClashResourceShieldGain',
    'olingClashResourceHeal',
    'olingClashResourceBloodReclaim'
  ]);
  assert.deepEqual(
    scheduled.map(({ delay }) => delay),
    [80, 160, 240, 320, 400]
  );
  scheduled.forEach(({ callback }) => callback());
  assert.deepEqual(playedSounds, soundKeys);
});

test('Clash audio delays resource cues until its damage sequence finishes', () => {
  const scheduled = [];
  const audio = createOlingClashAudio({
    playSound() {},
    setTimeout(callback, delay) {
      scheduled.push({ callback, delay });
      return scheduled.length;
    }
  });
  const damagePackets = [
    {
      damageType: 'normal',
      layers: [{ key: 'shields' }, { key: 'hearts' }]
    }
  ];

  audio.playResources(
    [
      {
        mechanic: 'grant-shield',
        playerSlot: 'local',
        appliedShieldCount: 1
      }
    ],
    damagePackets
  );

  assert.deepEqual(
    scheduled.map(({ delay }) => delay),
    [170]
  );
});

test('Clash audio stores Reclaim blood without playing a heal cue', () => {
  const scheduled = [];
  const audio = createOlingClashAudio({
    playSound() {},
    setTimeout(callback, delay) {
      scheduled.push({ callback, delay });
      return scheduled.length;
    }
  });

  const soundKeys = audio.playResources([
    {
      mechanic: 'store-resource',
      playerSlot: 'local',
      resource: 'reclaim-blood',
      status: 'stored',
      storedUnits: 1,
      appliedUnits: 0
    }
  ]);

  assert.deepEqual(soundKeys, ['olingClashResourceBloodStore']);
});

test('Clash audio only plays gains received by the local team', () => {
  const scheduled = [];
  const audio = createOlingClashAudio({
    playSound() {},
    setTimeout(callback, delay) {
      scheduled.push({ callback, delay });
      return scheduled.length;
    }
  });

  const soundKeys = audio.playResources([
    { mechanic: 'heal', playerSlot: 'opponent', appliedUnits: 1 },
    {
      mechanic: 'grant-shield',
      playerSlot: 'local',
      targetPlayerSlot: 'opponent',
      appliedShieldCount: 1
    },
    {
      mechanic: 'grant-overgrowth',
      playerSlot: 'opponent',
      targetPlayerSlot: 'local',
      appliedUnits: 1
    }
  ]);

  assert.deepEqual(soundKeys, ['olingClashResourceOvergrowthGain']);
  assert.equal(scheduled.length, 1);
});

test('Clash audio maps newly applied local statuses to specific cues', () => {
  const playedSounds = [];
  const scheduled = [];
  const audio = createOlingClashAudio({
    playSound(soundKey) {
      playedSounds.push(soundKey);
    },
    setTimeout(callback, delay) {
      scheduled.push({ callback, delay });
      return scheduled.length;
    }
  });

  const soundKeys = audio.playStatuses({
    effects: [
      {
        status: 'resolved',
        statusKey: 'burn-primed',
        statusResult: 'applied',
        targetPlayerSlot: 'local'
      },
      {
        status: 'resolved',
        statusKey: 'warded',
        statusResult: 'refreshed',
        targetPlayerSlot: 'local'
      },
      {
        status: 'resolved',
        statusKey: 'suppressed',
        statusResult: 'applied',
        targetPlayerSlot: 'local'
      },
      {
        status: 'resolved',
        statusKey: 'junk',
        statusResult: 'applied',
        targetPlayerSlot: 'local'
      },
      {
        status: 'resolved',
        statusKey: 'blocked',
        statusResult: 'applied',
        targetPlayerSlot: 'opponent'
      }
    ],
    triggeredStatuses: [
      {
        appliedStatusKey: 'burn',
        appliedStatusResult: 'applied',
        outcome: 'status-applied',
        targetPlayerSlot: 'local'
      }
    ]
  });

  assert.deepEqual(soundKeys, [
    'olingClashStatusPositive',
    'olingClashStatusWarded',
    'olingClashStatusNegative',
    'olingClashStatusSuppressed',
    'olingClashStatusJunk'
  ]);
  assert.deepEqual(
    scheduled.map(({ delay }) => delay),
    [80, 160, 240, 320, 400]
  );
  scheduled.forEach(({ callback }) => callback());
  assert.deepEqual(playedSounds, soundKeys);
});

test('Clash audio ignores removed, consumed and unsuccessful statuses', () => {
  const scheduled = [];
  const audio = createOlingClashAudio({
    playSound() {},
    setTimeout(callback, delay) {
      scheduled.push({ callback, delay });
      return scheduled.length;
    }
  });

  const soundKeys = audio.playStatuses({
    effects: [
      {
        status: 'prevented',
        statusKey: 'suppressed',
        statusResult: 'warded',
        targetPlayerSlot: 'local'
      },
      {
        status: 'blocked',
        statusKey: 'burn-primed',
        statusResult: 'blocked',
        targetPlayerSlot: 'local'
      }
    ],
    triggeredStatuses: [
      {
        status: 'consumed',
        statusKey: 'burn',
        targetPlayerSlot: 'local'
      },
      {
        status: 'removed',
        statusKey: 'marked',
        targetPlayerSlot: 'local'
      }
    ]
  });

  assert.deepEqual(soundKeys, []);
  assert.equal(scheduled.length, 0);
});

test('Clash audio waits for damage and resource cues before statuses', () => {
  const scheduled = [];
  const audio = createOlingClashAudio({
    playSound() {},
    setTimeout(callback, delay) {
      scheduled.push({ callback, delay });
      return scheduled.length;
    }
  });
  const result = {
    effects: [
      {
        mechanic: 'heal',
        playerSlot: 'local',
        appliedUnits: 1
      },
      {
        status: 'resolved',
        statusKey: 'warded',
        statusResult: 'applied',
        targetPlayerSlot: 'local'
      }
    ]
  };
  const damagePackets = [{ damageType: 'normal', layers: [{ key: 'hearts' }] }];

  audio.playStatuses(result, damagePackets);

  assert.deepEqual(
    scheduled.map(({ delay }) => delay),
    [210]
  );
});

test('Clash audio plays one Tag collision cue immediately', async () => {
  const playedSounds = [];
  const audio = createOlingClashAudio({
    playSound(soundKey) {
      playedSounds.push(soundKey);
    }
  });

  assert.equal(await audio.playTag(), true);
  assert.deepEqual(playedSounds, ['olingClashTag']);
});
