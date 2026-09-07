(function (globalScope) {
  const decisiveDamageUnits = 2;
  const drawDamageUnits = 1;
  const winningAction = Object.freeze({
    attack: 'skill',
    guard: 'attack',
    skill: 'guard'
  });
  const actionPart = Object.freeze({
    attack: 'mouth',
    guard: 'body',
    skill: 'flight'
  });

  function normalizeAction(value) {
    const action = String(value || '')
      .trim()
      .toLowerCase();
    return Object.hasOwn(winningAction, action) ? action : null;
  }

  function determineOutcome(localAction, opponentAction) {
    const local = normalizeAction(localAction);
    const opponent = normalizeAction(opponentAction);
    if (!local || !opponent) return null;
    if (local === opponent) return 'draw';
    return winningAction[local] === opponent ? 'local' : 'opponent';
  }

  function consumeUnits(health, key, remainingUnits) {
    const consumedUnits = Math.min(health[key], remainingUnits);
    health[key] -= consumedUnits;
    return remainingUnits - consumedUnits;
  }

  function applyNormalDamage(currentHealth, amountUnits, options = {}) {
    const health = { ...currentHealth };
    health.shieldCount = Math.max(
      0,
      Math.floor(Number(health.shieldCount) || 0)
    );
    const requestedUnits = Math.max(0, Math.floor(Number(amountUnits) || 0));
    let remainingUnits = requestedUnits;
    const shieldCapacityUnits = Math.max(
      1,
      Math.floor(Number(options.shieldCapacityUnits) || 2)
    );
    const beforeShieldCount = health.shieldCount;
    const destroyedShields = Math.min(
      health.shieldCount,
      Math.ceil(remainingUnits / shieldCapacityUnits)
    );
    if (destroyedShields > 0) {
      health.shieldCount -= destroyedShields;
      remainingUnits = Math.max(
        0,
        remainingUnits - destroyedShields * shieldCapacityUnits
      );
    }
    const shieldDamageUnits = Math.min(
      requestedUnits,
      (beforeShieldCount - health.shieldCount) * shieldCapacityUnits
    );
    const beforeOvergrowthUnits = health.overgrowthUnits;
    remainingUnits = consumeUnits(health, 'overgrowthUnits', remainingUnits);
    const minimumHeartUnits = options.isDraw ? 1 : 0;
    const beforeHeartUnits = health.heartUnits;
    const availableHeartUnits = Math.max(
      0,
      health.heartUnits - minimumHeartUnits
    );
    const heartDamageUnits = Math.min(availableHeartUnits, remainingUnits);
    health.heartUnits -= heartDamageUnits;
    remainingUnits -= heartDamageUnits;
    return {
      appliedUnits: requestedUnits - remainingUnits,
      defeated: health.heartUnits === 0,
      destroyedShields,
      heartDamageUnits: beforeHeartUnits - health.heartUnits,
      health,
      lastStand: Boolean(options.isDraw && remainingUnits > 0),
      overgrowthDamageUnits: beforeOvergrowthUnits - health.overgrowthUnits,
      preventedUnits: remainingUnits,
      requestedUnits,
      shieldDamageUnits
    };
  }

  function formatDamage(units) {
    if (units === 1) return '1/2 HEART';
    return `${units / 2} ${units === 2 ? 'HEART' : 'HEARTS'}`;
  }

  function createCore() {
    return {
      actionPart,
      applyNormalDamage,
      decisiveDamageUnits,
      determineOutcome,
      drawDamageUnits,
      formatDamage,
      normalizeAction,
      winningAction
    };
  }

  globalScope.createOlingClashResolutionCore = createCore;
  if (typeof module !== 'undefined' && module.exports)
    module.exports = createCore;
})(typeof window !== 'undefined' ? window : globalThis);
