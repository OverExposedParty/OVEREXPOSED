(function (globalScope) {
  const healthAssetRoot = '/images/olings/clash/ui/health';
  const layerDefinitions = Object.freeze({
    shields: Object.freeze({
      asset: `${healthAssetRoot}/shields/default.svg`,
      label: 'Shield'
    }),
    overgrowth: Object.freeze({
      asset: `${healthAssetRoot}/hearts/overgrowth/full.svg`,
      label: 'Overgrowth'
    }),
    hearts: Object.freeze({
      asset: `${healthAssetRoot}/hearts/normal/full.svg`,
      label: 'Heart'
    })
  });

  function toCount(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
  }

  function formatHeartUnits(units) {
    const count = toCount(units);
    const whole = Math.floor(count / 2);
    const half = count % 2 === 1;
    if (whole === 0 && half) return '1/2';
    return half ? `${whole} 1/2` : String(whole);
  }

  function getLayerLosses(damage = {}) {
    const damageRecord =
      damage && typeof damage === 'object' ? damage : Object.freeze({});
    const routedLayers = Array.isArray(damageRecord.layers)
      ? damageRecord.layers
      : [];
    const routedShieldCount = routedLayers
      .filter((layer) => layer.layer === 'shields')
      .reduce((total, layer) => total + toCount(layer.shieldsDestroyed), 0);
    const routedUnits = (layerKey) =>
      routedLayers
        .filter((layer) => layer.layer === layerKey)
        .reduce((total, layer) => total + toCount(layer.units), 0);

    const shieldCount =
      routedShieldCount || toCount(damageRecord.destroyedShields);
    const overgrowthUnits =
      routedUnits('overgrowth') || toCount(damageRecord.overgrowthDamageUnits);
    const heartUnits =
      routedUnits('hearts') || toCount(damageRecord.heartDamageUnits);
    return [
      shieldCount > 0
        ? { amount: shieldCount, key: 'shields', unitType: 'count' }
        : null,
      overgrowthUnits > 0
        ? { amount: overgrowthUnits, key: 'overgrowth', unitType: 'hearts' }
        : null,
      heartUnits > 0
        ? { amount: heartUnits, key: 'hearts', unitType: 'hearts' }
        : null
    ].filter(Boolean);
  }

  function hasDamageFeedback(damage) {
    return getLayerLosses(damage).length > 0 || Boolean(damage?.lastStand);
  }

  function createPacket(side, damage, fallbackDamageType = 'normal') {
    if (!['local', 'opponent'].includes(side) || !hasDamageFeedback(damage)) {
      return null;
    }
    return {
      damageType: damage.damageType || fallbackDamageType || 'normal',
      defeated: Boolean(damage.defeated),
      lastStand: Boolean(damage.lastStand),
      layers: getLayerLosses(damage),
      side,
      source: damage.damageSource || null
    };
  }

  function collectDamagePackets(result = {}) {
    const packets = [];
    const addPacket = (side, damage, damageType) => {
      const packet = createPacket(side, damage, damageType);
      if (packet) packets.push(packet);
    };

    addPacket('local', result.localDamage, result.damageType);
    addPacket('opponent', result.opponentDamage, result.damageType);
    (result.damage || []).forEach((damage) => {
      if (toCount(damage.teamSlot) !== 0) return;
      addPacket(damage.playerSlot, damage, result.damageType);
    });
    (result.effects || []).forEach((effect) => {
      if (toCount(effect.targetTeamSlot) !== 0) return;
      addPacket(effect.targetPlayerSlot, effect, effect.damageType);
    });
    (result.triggeredStatuses || []).forEach((status) => {
      if (toCount(status.targetTeamSlot) !== 0) return;
      addPacket(
        status.targetPlayerSlot || status.playerSlot,
        status,
        status.damageType
      );
    });
    return packets;
  }

  function createOlingClashDamageFeedback(options = {}) {
    const lifetimeMs = Math.max(200, Number(options.lifetimeMs) || 850);
    const sceneShakeMs = 360;
    const staggerMs = Math.max(0, Number(options.staggerMs) || 170);
    const sceneShakeTimers = new Map();
    const timers = new Set();
    const heldBursts = new Set();
    const rootElementCache = new WeakMap();
    const feedbackLayerCache = new WeakMap();
    const burstPool = [];
    const indicatorPools = new Map();
    const maximumPoolSize = 8;

    function schedule(callback, delayMs) {
      if (delayMs <= 0) {
        callback();
        return null;
      }
      const timer = globalScope.setTimeout(() => {
        timers.delete(timer);
        callback();
      }, delayMs);
      timers.add(timer);
      return timer;
    }

    function getSceneLayers(root) {
      if (!root) return [];
      let elements = rootElementCache.get(root);
      if (!elements) {
        elements = {
          fighters: {
            local: root.querySelector?.('[data-clash-fighter="local"]'),
            opponent: root.querySelector?.('[data-clash-fighter="opponent"]')
          },
          sceneLayers: Array.from(
            root.querySelectorAll?.('.olings-clash-scene-layer') || []
          )
        };
        rootElementCache.set(root, elements);
      }
      return elements.sceneLayers;
    }

    function getFighter(root, side) {
      getSceneLayers(root);
      return rootElementCache.get(root)?.fighters?.[side] || null;
    }

    function clearSceneShake(root) {
      const timer = sceneShakeTimers.get(root);
      if (timer !== undefined) {
        globalScope.clearTimeout(timer);
        timers.delete(timer);
        sceneShakeTimers.delete(root);
      }
      getSceneLayers(root).forEach((layer) =>
        layer.classList.remove('is-clash-shaking', 'is-clash-draw-shaking')
      );
    }

    function shakeScene(root, { isDraw = false } = {}) {
      const sceneLayers = getSceneLayers(root);
      if (!sceneLayers.length) return false;

      clearSceneShake(root);
      void root.offsetWidth;
      const shakeClass = isDraw ? 'is-clash-draw-shaking' : 'is-clash-shaking';
      sceneLayers.forEach((layer) => layer.classList.add(shakeClass));
      const timer = schedule(() => {
        sceneLayers.forEach((layer) => layer.classList.remove(shakeClass));
        sceneShakeTimers.delete(root);
      }, sceneShakeMs);
      sceneShakeTimers.set(root, timer);
      return true;
    }

    function getFeedbackLayer(fighter) {
      let layer = feedbackLayerCache.get(fighter);
      if (layer?.isConnected) return layer;
      layer = fighter.querySelector(':scope > .olings-clash-damage-feedback');
      if (layer) {
        feedbackLayerCache.set(fighter, layer);
        return layer;
      }
      layer = fighter.ownerDocument.createElement('div');
      layer.className = 'olings-clash-damage-feedback';
      layer.setAttribute('aria-hidden', 'true');
      fighter.append(layer);
      feedbackLayerCache.set(fighter, layer);
      return layer;
    }

    function createIndicator(documentRef, layer, index, count, side) {
      const definition = layerDefinitions[layer.key];
      const pool = indicatorPools.get(layer.key) || [];
      const indicator = pool.pop() || documentRef.createElement('span');
      indicatorPools.set(layer.key, pool);
      indicator.className = `olings-clash-damage-indicator is-${layer.key}`;
      indicator.style.animationPlayState = '';
      indicator.style.setProperty('--clash-damage-index', String(index));
      indicator.style.setProperty('--clash-damage-count', String(count));
      const direction = side === 'local' ? -1 : 1;
      const offsetY = (index - (count - 1) / 2) * 30 - 18;
      indicator.style.setProperty(
        '--clash-damage-x',
        `${direction * (34 + index * 5)}px`
      );
      indicator.style.setProperty(
        '--clash-damage-pop-x',
        `${direction * (14 + index * 2)}px`
      );
      indicator.style.setProperty(
        '--clash-damage-pop-y',
        `${offsetY * 0.34}px`
      );
      indicator.style.setProperty('--clash-damage-y', `${offsetY}px`);
      indicator.style.setProperty(
        '--clash-damage-fall-x',
        `${direction * (38 + index * 6)}px`
      );
      indicator.style.setProperty('--clash-damage-fall-y', `${offsetY + 16}px`);
      indicator.setAttribute(
        'aria-label',
        `${definition.label} lost ${layer.amount}`
      );

      const icon =
        indicator.querySelector('img') || documentRef.createElement('img');
      icon.src = definition.asset;
      icon.alt = '';
      icon.draggable = false;
      const value =
        indicator.querySelector('strong') ||
        documentRef.createElement('strong');
      value.textContent = `-${
        layer.unitType === 'count'
          ? layer.amount
          : formatHeartUnits(layer.amount)
      }`;
      if (!icon.parentElement || !value.parentElement) {
        indicator.replaceChildren(icon, value);
      }
      return indicator;
    }

    function recycleBurst(burst) {
      if (!burst) return false;
      heldBursts.delete(burst);
      burst.classList.remove('is-tutorial-held');
      burst
        .querySelectorAll('.olings-clash-damage-indicator')
        .forEach((indicator) => {
          const layerKey = Object.keys(layerDefinitions).find((key) =>
            indicator.classList.contains(`is-${key}`)
          );
          indicator.remove();
          indicator.style.animationPlayState = '';
          if (!layerKey) return;
          const pool = indicatorPools.get(layerKey) || [];
          if (pool.length < maximumPoolSize * 3) pool.push(indicator);
          indicatorPools.set(layerKey, pool);
        });
      burst.replaceChildren();
      burst.remove();
      if (burstPool.length < maximumPoolSize) burstPool.push(burst);
      return true;
    }

    function triggerRecoil(fighter) {
      if (fighter.classList.contains('is-clash-combatant')) return;
      fighter.classList.remove('is-taking-hit');
      void fighter.offsetWidth;
      fighter.classList.add('is-taking-hit');
      schedule(() => fighter.classList.remove('is-taking-hit'), 240);
    }

    function emitPacket(root, packet) {
      const fighter = getFighter(root, packet.side);
      if (!fighter) return null;
      const feedbackLayer = getFeedbackLayer(fighter);
      const burst =
        burstPool.pop() || fighter.ownerDocument.createElement('div');
      burst.className = `olings-clash-damage-burst is-${packet.damageType}`;
      burst.dataset.damageSide = packet.side;
      packet.layers.forEach((layer, index) => {
        burst.append(
          createIndicator(
            fighter.ownerDocument,
            layer,
            index,
            packet.layers.length,
            packet.side
          )
        );
      });
      if (packet.lastStand) {
        const lastStand = fighter.ownerDocument.createElement('strong');
        lastStand.className = 'olings-clash-damage-last-stand';
        lastStand.textContent = 'LAST STAND';
        burst.append(lastStand);
      }
      feedbackLayer.append(burst);
      triggerRecoil(fighter);
      schedule(() => {
        if (!heldBursts.has(burst)) recycleBurst(burst);
      }, lifetimeMs);
      return burst;
    }

    function holdLatest(root, options = {}) {
      const side = ['local', 'opponent'].includes(options.side)
        ? options.side
        : 'opponent';
      const layer = String(options.layer || 'hearts').toLowerCase();
      if (options.lastStand) {
        const bursts = root?.querySelectorAll?.(
          `[data-clash-fighter="${side}"] .olings-clash-damage-burst`
        );
        const burst = [...(bursts || [])]
          .reverse()
          .find((candidate) =>
            candidate.querySelector('.olings-clash-damage-last-stand')
          );
        if (!burst) return null;
        burst
          .querySelectorAll('*')
          .forEach((element) => (element.style.animationPlayState = 'paused'));
        burst.classList.add('is-tutorial-held');
        heldBursts.add(burst);
        return burst;
      }
      const indicators = root?.querySelectorAll?.(
        `[data-clash-fighter="${side}"] .olings-clash-damage-indicator.is-${layer}`
      );
      const indicator = indicators?.[indicators.length - 1];
      const burst = indicator?.closest('.olings-clash-damage-burst');
      if (!indicator || !burst) return null;

      indicator.style.animationPlayState = 'paused';
      burst.classList.add('is-tutorial-held');
      heldBursts.add(burst);
      return burst;
    }

    function releaseHeld(burst) {
      if (!burst || !heldBursts.has(burst)) return false;
      heldBursts.delete(burst);
      burst.classList.remove('is-tutorial-held');
      const indicators = [
        ...burst.querySelectorAll('.olings-clash-damage-indicator')
      ];
      burst.querySelectorAll('*').forEach((element) => {
        element.style.animationPlayState = 'running';
      });
      const removeBurst = () => recycleBurst(burst);
      indicators[0]?.addEventListener('animationend', removeBurst, {
        once: true
      });
      schedule(removeBurst, lifetimeMs);
      return true;
    }

    function emitResult(root, result) {
      const packets = collectDamagePackets(result);
      const sideCounts = { local: 0, opponent: 0 };
      if (packets.length > 0) {
        shakeScene(root, { isDraw: result?.winner === 'draw' });
      }
      packets.forEach((packet) => {
        const sequence = sideCounts[packet.side];
        sideCounts[packet.side] += 1;
        schedule(() => emitPacket(root, packet), sequence * staggerMs);
      });
      return packets;
    }

    function clear(root = null) {
      const shakeRoots = root ? [root] : Array.from(sceneShakeTimers.keys());
      timers.forEach((timer) => globalScope.clearTimeout(timer));
      timers.clear();
      heldBursts.forEach((burst) => recycleBurst(burst));
      heldBursts.clear();
      shakeRoots.forEach((shakeRoot) => clearSceneShake(shakeRoot));
      sceneShakeTimers.clear();
      root
        ?.querySelectorAll?.('.olings-clash-damage-feedback')
        .forEach((layer) => {
          layer
            .querySelectorAll('.olings-clash-damage-burst')
            .forEach((burst) => recycleBurst(burst));
          layer.remove();
        });
      root
        ?.querySelectorAll?.('.olings-clash-fighter.is-taking-hit')
        .forEach((fighter) => fighter.classList.remove('is-taking-hit'));
    }

    return {
      clear,
      collectDamagePackets,
      emitPacket,
      emitResult,
      formatHeartUnits,
      getLayerLosses,
      holdLatest,
      releaseHeld,
      getPoolStats: () => ({
        bursts: burstPool.length,
        indicators: [...indicatorPools.values()].reduce(
          (total, pool) => total + pool.length,
          0
        )
      }),
      shakeScene
    };
  }

  globalScope.createOlingClashDamageFeedback = createOlingClashDamageFeedback;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createOlingClashDamageFeedback;
  }
})(typeof window !== 'undefined' ? window : globalThis);
