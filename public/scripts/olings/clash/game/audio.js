(function (globalScope) {
  const soundKeys = Object.freeze({
    abilityDeselect: 'olingClashAbilityDeselect',
    abilitySelect: 'olingClashAbilitySelect',
    collision: 'olingClashCollision',
    knockout: 'olingClashKnockout',
    damageHeart: 'olingClashDamageHeart',
    damageOvergrowth: 'olingClashDamageOvergrowth',
    damagePrevented: 'olingClashDamagePrevented',
    damageShield: 'olingClashDamageShield',
    damageTrue: 'olingClashDamageTrue',
    matchDefeat: 'olingClashMatchDefeat',
    matchVictory: 'olingClashMatchVictory',
    phaseActionSubmitted: 'olingClashPhaseActionSubmitted',
    phaseChooseAction: 'olingClashPhaseChooseAction',
    phaseChooseTag: 'olingClashPhaseChooseTag',
    resourceBloodReclaim: 'olingClashResourceBloodReclaim',
    resourceBloodStore: 'olingClashResourceBloodStore',
    resourceHeal: 'olingClashResourceHeal',
    resourceOvergrowthGain: 'olingClashResourceOvergrowthGain',
    resourceShieldGain: 'olingClashResourceShieldGain',
    statusJunk: 'olingClashStatusJunk',
    statusNegative: 'olingClashStatusNegative',
    statusPositive: 'olingClashStatusPositive',
    statusSuppressed: 'olingClashStatusSuppressed',
    statusWarded: 'olingClashStatusWarded',
    tag: 'olingClashTag',
    lockIn: 'olingClashRoundLockIn',
    revealDraw: 'olingClashRoundRevealDraw',
    revealLoss: 'olingClashRoundRevealLoss',
    revealWin: 'olingClashRoundRevealWin'
  });
  const soundDefinitions = Object.freeze({
    [soundKeys.abilityDeselect]: Object.freeze({
      src: '/sounds/olings/clash/ability/deselect.wav',
      group: 'ui',
      volume: 0.8,
      preload: true,
      cooldown: 40,
      maxInstances: 1
    }),
    [soundKeys.abilitySelect]: Object.freeze({
      src: '/sounds/olings/clash/ability/select.wav',
      group: 'ui',
      volume: 0.8,
      preload: true,
      cooldown: 40,
      maxInstances: 1
    }),
    [soundKeys.collision]: Object.freeze({
      src: '/sounds/olings/clash/combat/collision/default.wav',
      group: 'ui',
      volume: 1,
      preload: true,
      cooldown: 100,
      maxInstances: 1
    }),
    [soundKeys.knockout]: Object.freeze({
      src: '/sounds/olings/clash/combat/knockout/default.wav',
      group: 'ui',
      volume: 0.85,
      preload: true,
      cooldown: 60,
      maxInstances: 2
    }),
    [soundKeys.damageHeart]: Object.freeze({
      src: '/sounds/olings/clash/combat/damage/heart.wav',
      group: 'ui',
      volume: 0.65,
      preload: true,
      cooldown: 40,
      maxInstances: 1
    }),
    [soundKeys.damageOvergrowth]: Object.freeze({
      src: '/sounds/olings/clash/combat/damage/overgrowth.wav',
      group: 'ui',
      volume: 0.65,
      preload: true,
      cooldown: 40,
      maxInstances: 1
    }),
    [soundKeys.damagePrevented]: Object.freeze({
      src: '/sounds/olings/clash/combat/damage/prevented.wav',
      group: 'ui',
      volume: 0.65,
      preload: true,
      cooldown: 40,
      maxInstances: 1
    }),
    [soundKeys.damageShield]: Object.freeze({
      src: '/sounds/olings/clash/combat/damage/shield.wav',
      group: 'ui',
      volume: 0.65,
      preload: true,
      cooldown: 40,
      maxInstances: 1
    }),
    [soundKeys.damageTrue]: Object.freeze({
      src: '/sounds/olings/clash/combat/damage/true.wav',
      group: 'ui',
      volume: 0.65,
      preload: true,
      cooldown: 40,
      maxInstances: 1
    }),
    [soundKeys.matchDefeat]: Object.freeze({
      src: '/sounds/olings/clash/match/defeat.wav',
      group: 'ui',
      volume: 1,
      preload: true,
      cooldown: 500,
      maxInstances: 1
    }),
    [soundKeys.matchVictory]: Object.freeze({
      src: '/sounds/olings/clash/match/victory.wav',
      group: 'ui',
      volume: 1,
      preload: true,
      cooldown: 500,
      maxInstances: 1
    }),
    [soundKeys.phaseActionSubmitted]: Object.freeze({
      src: '/sounds/olings/clash/phase/action-submitted.wav',
      group: 'ui',
      volume: 0.75,
      preload: true,
      cooldown: 100,
      maxInstances: 1
    }),
    [soundKeys.phaseChooseAction]: Object.freeze({
      src: '/sounds/olings/clash/phase/choose-action.wav',
      group: 'ui',
      volume: 0.75,
      preload: true,
      cooldown: 100,
      maxInstances: 1
    }),
    [soundKeys.phaseChooseTag]: Object.freeze({
      src: '/sounds/olings/clash/phase/choose-tag.wav',
      group: 'ui',
      volume: 0.8,
      preload: true,
      cooldown: 100,
      maxInstances: 1
    }),
    [soundKeys.resourceBloodReclaim]: Object.freeze({
      src: '/sounds/olings/clash/resources/blood-reclaim.wav',
      group: 'ui',
      volume: 0.75,
      preload: true,
      cooldown: 80,
      maxInstances: 1
    }),
    [soundKeys.resourceBloodStore]: Object.freeze({
      src: '/sounds/olings/clash/resources/blood-store.wav',
      group: 'ui',
      volume: 0.75,
      preload: true,
      cooldown: 80,
      maxInstances: 1
    }),
    [soundKeys.resourceHeal]: Object.freeze({
      src: '/sounds/olings/clash/resources/heal.wav',
      group: 'ui',
      volume: 0.75,
      preload: true,
      cooldown: 80,
      maxInstances: 1
    }),
    [soundKeys.resourceOvergrowthGain]: Object.freeze({
      src: '/sounds/olings/clash/resources/overgrowth-gain.wav',
      group: 'ui',
      volume: 0.75,
      preload: true,
      cooldown: 80,
      maxInstances: 1
    }),
    [soundKeys.resourceShieldGain]: Object.freeze({
      src: '/sounds/olings/clash/resources/shield-gain.wav',
      group: 'ui',
      volume: 0.75,
      preload: true,
      cooldown: 80,
      maxInstances: 1
    }),
    [soundKeys.statusJunk]: Object.freeze({
      src: '/sounds/olings/clash/status/junk.wav',
      group: 'ui',
      volume: 0.75,
      preload: true,
      cooldown: 80,
      maxInstances: 1
    }),
    [soundKeys.statusNegative]: Object.freeze({
      src: '/sounds/olings/clash/status/negative.wav',
      group: 'ui',
      volume: 0.75,
      preload: true,
      cooldown: 80,
      maxInstances: 1
    }),
    [soundKeys.statusPositive]: Object.freeze({
      src: '/sounds/olings/clash/status/positive.wav',
      group: 'ui',
      volume: 0.75,
      preload: true,
      cooldown: 80,
      maxInstances: 1
    }),
    [soundKeys.statusSuppressed]: Object.freeze({
      src: '/sounds/olings/clash/status/suppressed.wav',
      group: 'ui',
      volume: 0.75,
      preload: true,
      cooldown: 80,
      maxInstances: 1
    }),
    [soundKeys.statusWarded]: Object.freeze({
      src: '/sounds/olings/clash/status/warded.wav',
      group: 'ui',
      volume: 0.75,
      preload: true,
      cooldown: 80,
      maxInstances: 1
    }),
    [soundKeys.tag]: Object.freeze({
      src: '/sounds/olings/clash/tag/default.wav',
      group: 'ui',
      volume: 0.85,
      preload: true,
      cooldown: 200,
      maxInstances: 1
    }),
    [soundKeys.lockIn]: Object.freeze({
      src: '/sounds/olings/clash/round/lock-in.wav',
      group: 'ui',
      volume: 1,
      preload: true,
      cooldown: 100,
      maxInstances: 1
    }),
    [soundKeys.revealDraw]: Object.freeze({
      src: '/sounds/olings/clash/round/reveal/draw.wav',
      group: 'ui',
      volume: 1,
      preload: true,
      cooldown: 100,
      maxInstances: 1
    }),
    [soundKeys.revealLoss]: Object.freeze({
      src: '/sounds/olings/clash/round/reveal/loss.wav',
      group: 'ui',
      volume: 1,
      preload: true,
      cooldown: 100,
      maxInstances: 1
    }),
    [soundKeys.revealWin]: Object.freeze({
      src: '/sounds/olings/clash/round/reveal/win.wav',
      group: 'ui',
      volume: 1,
      preload: true,
      cooldown: 100,
      maxInstances: 1
    })
  });

  function createOlingClashAudio(options = {}) {
    const audioEngine = options.audioEngine || globalScope.OEAudio;
    const playSound = options.playSound || globalScope.playSoundEffect;
    const schedule =
      typeof options.setTimeout === 'function'
        ? options.setTimeout
        : globalScope.setTimeout.bind(globalScope);
    const cancel =
      typeof options.clearTimeout === 'function'
        ? options.clearTimeout
        : globalScope.clearTimeout.bind(globalScope);
    const damageDelayMs = Math.max(0, Number(options.damageDelayMs) || 50);
    const damageStaggerMs = Math.max(0, Number(options.damageStaggerMs) || 40);
    const knockoutDelayMs = Math.max(
      0,
      Number(options.knockoutDelayMs) || 850
    );
    const knockoutStaggerMs = Math.max(
      0,
      Number(options.knockoutStaggerMs) || 120
    );
    const resourceDelayMs = Math.max(
      0,
      Number(options.resourceDelayMs) || 80
    );
    const resourceStaggerMs = Math.max(
      0,
      Number(options.resourceStaggerMs) || 80
    );
    const statusDelayMs = Math.max(0, Number(options.statusDelayMs) || 80);
    const statusStaggerMs = Math.max(
      0,
      Number(options.statusStaggerMs) || 80
    );
    const damageTimers = new Set();
    const resourceTimers = new Set();
    const statusTimers = new Set();

    function register() {
      if (typeof audioEngine?.register !== 'function') {
        return Promise.resolve(false);
      }

      return Promise.resolve(audioEngine.register(soundDefinitions))
        .then(() => true)
        .catch(() => false);
    }

    function play(soundKey) {
      if (typeof playSound !== 'function') return Promise.resolve(false);

      try {
        return Promise.resolve(playSound(soundKey))
          .then(() => true)
          .catch(() => false);
      } catch (_error) {
        return Promise.resolve(false);
      }
    }

    function getRevealSoundKey(winner) {
      if (winner === 'local') return soundKeys.revealWin;
      if (winner === 'opponent') return soundKeys.revealLoss;
      return soundKeys.revealDraw;
    }

    function getMatchResultSoundKey(winner) {
      if (winner === 'local') return soundKeys.matchVictory;
      if (winner === 'opponent') return soundKeys.matchDefeat;
      return null;
    }

    function getDamageSoundKeys(packets = []) {
      const cues = new Set();
      packets.forEach((packet) => {
        const layers = Array.isArray(packet?.layers) ? packet.layers : [];
        if (String(packet?.damageType || '').toLowerCase() === 'true') {
          if (layers.length > 0) cues.add(soundKeys.damageTrue);
        } else {
          layers.forEach((layer) => {
            if (layer?.key === 'shields') cues.add(soundKeys.damageShield);
            if (layer?.key === 'overgrowth') {
              cues.add(soundKeys.damageOvergrowth);
            }
            if (layer?.key === 'hearts') cues.add(soundKeys.damageHeart);
          });
        }
        if (packet?.lastStand) cues.add(soundKeys.damagePrevented);
      });

      return [
        soundKeys.damageShield,
        soundKeys.damageOvergrowth,
        soundKeys.damageHeart,
        soundKeys.damageTrue,
        soundKeys.damagePrevented
      ].filter((soundKey) => cues.has(soundKey));
    }

    function getKnockoutSides(packets = []) {
      return [
        ...new Set(
          packets
            .filter(
              (packet) =>
                packet?.defeated && ['local', 'opponent'].includes(packet.side)
            )
            .map((packet) => packet.side)
        )
      ];
    }

    function getResourceSoundKeys(effects = []) {
      const cues = new Set();
      effects.forEach((effect) => {
        const recipientSide = effect?.targetPlayerSlot || effect?.playerSlot;
        if (recipientSide !== 'local') return;

        const appliedUnits = Math.max(
          0,
          Math.floor(Number(effect?.appliedUnits) || 0)
        );
        const resource = String(effect?.resource || '').toLowerCase();

        if (
          effect?.mechanic === 'store-resource' &&
          ((resource === 'blood' &&
            Number(effect?.storedResourceUnits) > 0) ||
            (resource === 'reclaim-blood' && Number(effect?.storedUnits) > 0))
        ) {
          cues.add(soundKeys.resourceBloodStore);
        }
        if (
          effect?.mechanic === 'grant-overgrowth' &&
          appliedUnits > 0
        ) {
          cues.add(soundKeys.resourceOvergrowthGain);
        }
        if (
          effect?.mechanic === 'grant-shield' &&
          Number(effect?.appliedShieldCount) > 0
        ) {
          cues.add(soundKeys.resourceShieldGain);
        }
        if (
          effect?.mechanic === 'heal' &&
          appliedUnits > 0 &&
          resource !== 'reclaim-blood'
        ) {
          cues.add(soundKeys.resourceHeal);
        }
        if (
          resource === 'reclaim-blood' &&
          effect?.outcome === 'recovered' &&
          appliedUnits > 0
        ) {
          cues.add(soundKeys.resourceBloodReclaim);
        }
        if (
          resource === 'blood' &&
          effect?.converted &&
          appliedUnits > 0
        ) {
          cues.add(soundKeys.resourceHeal);
        }
      });

      return [
        soundKeys.resourceBloodStore,
        soundKeys.resourceOvergrowthGain,
        soundKeys.resourceShieldGain,
        soundKeys.resourceHeal,
        soundKeys.resourceBloodReclaim
      ].filter((soundKey) => cues.has(soundKey));
    }

    function getAppliedStatusKey(record = {}) {
      if (
        record.outcome === 'status-applied' &&
        ['applied', 'refreshed'].includes(record.appliedStatusResult)
      ) {
        return record.appliedStatusKey || null;
      }
      if (
        record.status !== 'resolved' ||
        !['applied', 'refreshed'].includes(record.statusResult)
      ) {
        return null;
      }
      return record.displayStatusKey || record.statusKey || null;
    }

    function getStatusSoundKeys(result = {}) {
      const cues = new Set();
      const positiveStatusKeys = new Set([
        'burn-primed',
        'fortified',
        'reinforced',
        'warded'
      ]);
      const negativeStatusKeys = new Set([
        'blocked',
        'burn',
        'junk',
        'marked',
        'steal-primed',
        'suppressed'
      ]);
      const records = [
        ...(Array.isArray(result?.effects) ? result.effects : []),
        ...(Array.isArray(result?.triggeredStatuses)
          ? result.triggeredStatuses
          : [])
      ];

      records.forEach((record) => {
        const recipientSide = record?.targetPlayerSlot || record?.playerSlot;
        if (recipientSide !== 'local') return;

        const statusKey = String(getAppliedStatusKey(record) || '')
          .trim()
          .toLowerCase();
        if (!statusKey) return;
        if (statusKey === 'warded') {
          cues.add(soundKeys.statusWarded);
        } else if (statusKey === 'suppressed') {
          cues.add(soundKeys.statusSuppressed);
        } else if (statusKey === 'junk') {
          cues.add(soundKeys.statusJunk);
        } else if (positiveStatusKeys.has(statusKey)) {
          cues.add(soundKeys.statusPositive);
        } else if (negativeStatusKeys.has(statusKey)) {
          cues.add(soundKeys.statusNegative);
        }
      });

      return [
        soundKeys.statusPositive,
        soundKeys.statusWarded,
        soundKeys.statusNegative,
        soundKeys.statusSuppressed,
        soundKeys.statusJunk
      ].filter((soundKey) => cues.has(soundKey));
    }

    function clearDamage() {
      damageTimers.forEach(cancel);
      damageTimers.clear();
    }

    function clearResources() {
      resourceTimers.forEach(cancel);
      resourceTimers.clear();
    }

    function clearStatuses() {
      statusTimers.forEach(cancel);
      statusTimers.clear();
    }

    function playDamage(packets) {
      clearDamage();
      const damageSoundKeys = getDamageSoundKeys(packets);
      damageSoundKeys.forEach((soundKey, index) => {
        let timer;
        timer = schedule(
          () => {
            damageTimers.delete(timer);
            play(soundKey);
          },
          damageDelayMs + index * damageStaggerMs
        );
        damageTimers.add(timer);
      });
      getKnockoutSides(packets).forEach((_side, index) => {
        let timer;
        timer = schedule(
          () => {
            damageTimers.delete(timer);
            play(soundKeys.knockout);
          },
          knockoutDelayMs + index * knockoutStaggerMs
        );
        damageTimers.add(timer);
      });
      return damageSoundKeys;
    }

    function playResources(effects, damagePackets = []) {
      clearResources();
      const resourceSoundKeys = getResourceSoundKeys(effects);
      const damageSoundKeys = getDamageSoundKeys(damagePackets);
      const startDelay =
        damageSoundKeys.length > 0
          ? damageDelayMs +
            (damageSoundKeys.length - 1) * damageStaggerMs +
            resourceDelayMs
          : resourceDelayMs;
      resourceSoundKeys.forEach((soundKey, index) => {
        let timer;
        timer = schedule(
          () => {
            resourceTimers.delete(timer);
            play(soundKey);
          },
          startDelay + index * resourceStaggerMs
        );
        resourceTimers.add(timer);
      });
      return resourceSoundKeys;
    }

    function playStatuses(result, damagePackets = []) {
      clearStatuses();
      const statusSoundKeys = getStatusSoundKeys(result);
      const damageSoundKeys = getDamageSoundKeys(damagePackets);
      const resourceSoundKeys = getResourceSoundKeys(result?.effects);
      const resourceStartDelay =
        damageSoundKeys.length > 0
          ? damageDelayMs +
            (damageSoundKeys.length - 1) * damageStaggerMs +
            resourceDelayMs
          : resourceDelayMs;
      const startDelay =
        resourceStartDelay +
        (resourceSoundKeys.length > 0
          ? (resourceSoundKeys.length - 1) * resourceStaggerMs + statusDelayMs
          : 0);
      statusSoundKeys.forEach((soundKey, index) => {
        let timer;
        timer = schedule(
          () => {
            statusTimers.delete(timer);
            play(soundKey);
          },
          startDelay + index * statusStaggerMs
        );
        statusTimers.add(timer);
      });
      return statusSoundKeys;
    }

    function clear() {
      clearDamage();
      clearResources();
      clearStatuses();
    }

    return {
      clear,
      getDamageSoundKeys,
      getKnockoutSides,
      getResourceSoundKeys,
      getStatusSoundKeys,
      getMatchResultSoundKey,
      getRevealSoundKey,
      playAbilityDeselect: () => play(soundKeys.abilityDeselect),
      playAbilitySelect: () => play(soundKeys.abilitySelect),
      playActionSubmitted: () => play(soundKeys.phaseActionSubmitted),
      playChooseAction: () => play(soundKeys.phaseChooseAction),
      playChooseTag: () => play(soundKeys.phaseChooseTag),
      playCollision: () => play(soundKeys.collision),
      playDamage,
      playLockIn: () => play(soundKeys.lockIn),
      playMatchResult: (winner) => {
        const soundKey = getMatchResultSoundKey(winner);
        return soundKey ? play(soundKey) : Promise.resolve(false);
      },
      playResources,
      playStatuses,
      playTag: () => play(soundKeys.tag),
      playReveal: (winner) => play(getRevealSoundKey(winner)),
      register,
      soundDefinitions,
      soundKeys
    };
  }

  globalScope.createOlingClashAudio = createOlingClashAudio;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createOlingClashAudio;
  }
})(typeof window !== 'undefined' ? window : globalThis);
