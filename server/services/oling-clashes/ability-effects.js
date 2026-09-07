const {
  advanceAbilityCadence,
  getAbilityProgress,
  normalizeAbilityCadence
} = require('./ability-cadence');

function toUnitCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function getMissingHeartUnits(oling) {
  return Math.max(
    0,
    toUnitCount(oling?.maxHeartUnits) - toUnitCount(oling?.heartUnits)
  );
}

function getMostDamagedLivingBenchOling(player) {
  return (player?.team || [])
    .filter(
      (oling) =>
        oling.teamSlot !== player.activeTeamSlot &&
        !oling.defeated &&
        toUnitCount(oling.heartUnits) > 0 &&
        getMissingHeartUnits(oling) > 0
    )
    .sort((left, right) => {
      const damageDifference =
        getMissingHeartUnits(right) - getMissingHeartUnits(left);
      if (damageDifference !== 0) return damageDifference;
      return toUnitCount(left.teamSlot) - toUnitCount(right.teamSlot);
    })[0];
}

function getMostDamagedLivingAlly(player) {
  return (player?.team || [])
    .filter((oling) => !oling.defeated && toUnitCount(oling.heartUnits) > 0)
    .sort((left, right) => {
      const damageDifference =
        getMissingHeartUnits(right) - getMissingHeartUnits(left);
      if (damageDifference !== 0) return damageDifference;
      return toUnitCount(left.teamSlot) - toUnitCount(right.teamSlot);
    })[0];
}

function getEffectOpponent(context) {
  return (
    context.targetPlayerOverride ||
    context.match.players.find((player) => player.slot !== context.player.slot)
  );
}

function healPermanentHearts(oling, requestedUnits) {
  const beforeHeartUnits = toUnitCount(oling?.heartUnits);
  const maxHeartUnits = Math.max(
    beforeHeartUnits,
    toUnitCount(oling?.maxHeartUnits)
  );
  const normalizedRequest = toUnitCount(requestedUnits);
  const appliedUnits = Math.min(
    normalizedRequest,
    Math.max(0, maxHeartUnits - beforeHeartUnits)
  );
  oling.heartUnits = beforeHeartUnits + appliedUnits;
  return {
    requestedUnits: normalizedRequest,
    appliedUnits,
    beforeHeartUnits,
    afterHeartUnits: oling.heartUnits,
    maxHeartUnits
  };
}

function grantOvergrowth(oling, requestedUnits) {
  const beforeOvergrowthUnits = toUnitCount(oling?.overgrowthUnits);
  const appliedUnits = toUnitCount(requestedUnits);
  oling.overgrowthUnits = beforeOvergrowthUnits + appliedUnits;
  return {
    requestedUnits: appliedUnits,
    appliedUnits,
    beforeOvergrowthUnits,
    afterOvergrowthUnits: oling.overgrowthUnits
  };
}

function grantShields(oling, requestedShieldCount, options = {}) {
  const beforeShieldCount = toUnitCount(oling?.shieldCount);
  const normalizedRequest = toUnitCount(requestedShieldCount);
  const appliedShieldCount =
    options.stacks === false
      ? Math.min(normalizedRequest, Math.max(0, 1 - beforeShieldCount))
      : normalizedRequest;
  oling.shieldCount = beforeShieldCount + appliedShieldCount;
  return {
    requestedShieldCount: normalizedRequest,
    appliedShieldCount,
    beforeShieldCount,
    afterShieldCount: oling.shieldCount
  };
}

function damageAfterRepeatedDecisiveAction(context) {
  const source = context.player.team.find(
    (oling) => oling.teamSlot === context.activation.teamSlot
  );
  const opponent = getEffectOpponent(context);
  const target = opponent?.team?.find(
    (oling) => oling.teamSlot === opponent.activeTeamSlot
  );
  const requiredAction = String(context.effect.parameters?.action || '')
    .trim()
    .toLowerCase();
  const requestedUnits = toUnitCount(context.effect.parameters?.amountUnits);
  const damageType = String(
    context.effect.parameters?.damageType ||
      context.match.ruleset?.snapshot?.damage?.defaultTypes?.bonus ||
      'normal'
  )
    .trim()
    .toLowerCase();
  const damageSource = String(
    context.effect.parameters?.damageSource || 'bonus'
  )
    .trim()
    .toLowerCase();
  const progress = source
    ? getAbilityProgress(
        source,
        context.activation.abilityKey,
        context.activation.abilityRevision
      )
    : null;
  const previousDecisiveVictoryAction =
    String(progress?.data?.lastDecisiveVictoryAction || '')
      .trim()
      .toLowerCase() || null;
  const triggered = previousDecisiveVictoryAction === requiredAction;

  if (!triggered) {
    return createEffectResult(context, {
      status: 'condition-not-met',
      targetPlayerSlot: opponent?.slot || null,
      targetTeamSlot: target?.teamSlot ?? null,
      requestedUnits,
      appliedUnits: 0,
      damageType,
      damageSource,
      requiredAction,
      previousDecisiveVictoryAction,
      triggered: false
    });
  }
  if (
    !target ||
    target.defeated ||
    toUnitCount(target.heartUnits) === 0 ||
    typeof context.applyDamage !== 'function'
  ) {
    return createEffectResult(context, {
      status: 'no-target',
      targetPlayerSlot: opponent?.slot || null,
      targetTeamSlot: target?.teamSlot ?? null,
      requestedUnits,
      appliedUnits: 0,
      damageType,
      damageSource,
      requiredAction,
      previousDecisiveVictoryAction,
      triggered: true
    });
  }

  const ward = consumeMatchingWard(context.match, target, 'bonus-damage');
  if (ward) {
    return createEffectResult(context, {
      status: 'prevented',
      outcome: 'effect-prevented',
      targetPlayerSlot: opponent.slot,
      targetTeamSlot: target.teamSlot,
      requestedUnits,
      appliedUnits: 0,
      damageType,
      damageSource,
      requiredAction,
      previousDecisiveVictoryAction,
      triggered: true,
      preventedByStatusKey: ward.statusKey,
      preventedByStatusRevision: ward.statusRevision,
      preventedByStatusName: ward.statusName,
      preventedCategory: ward.category,
      wardSourceAbilityKey: ward.sourceAbilityKey
    });
  }

  const damage = context.applyDamage(
    target,
    requestedUnits,
    damageType,
    damageSource
  );
  target.defeated = toUnitCount(target.heartUnits) === 0;
  return createEffectResult(context, {
    status: damage.appliedUnits > 0 ? 'resolved' : 'no-effect',
    targetPlayerSlot: opponent.slot,
    targetTeamSlot: target.teamSlot,
    requestedUnits,
    damageType,
    damageSource,
    requiredAction,
    previousDecisiveVictoryAction,
    triggered: true,
    defeated: target.defeated,
    ...damage
  });
}

function damageEveryNthActivation(context) {
  const source = context.player.team.find(
    (oling) => oling.teamSlot === context.activation.teamSlot
  );
  const opponent = getEffectOpponent(context);
  const target = opponent?.team?.find(
    (oling) => oling.teamSlot === opponent.activeTeamSlot
  );
  const requestedUnits = toUnitCount(context.effect.parameters?.amountUnits);
  const legacyCadence = normalizeAbilityCadence({
    every: context.effect.parameters?.activationCount
  });
  const damageType = String(
    context.effect.parameters?.damageType ||
      context.match.ruleset?.snapshot?.damage?.defaultTypes?.bonus ||
      'normal'
  )
    .trim()
    .toLowerCase();
  const damageSource = String(
    context.effect.parameters?.damageSource || 'bonus'
  )
    .trim()
    .toLowerCase();

  if (!source || source.defeated || toUnitCount(source.heartUnits) === 0) {
    return createEffectResult(context, {
      status: 'no-target',
      targetPlayerSlot: opponent?.slot || null,
      targetTeamSlot: target?.teamSlot ?? null,
      requestedUnits,
      appliedUnits: 0,
      activationThreshold: legacyCadence.every,
      damageType,
      damageSource,
      triggered: false
    });
  }

  const cadence =
    context.cadence ||
    advanceAbilityCadence(source, {
      key: context.activation.abilityKey,
      revision: context.activation.abilityRevision,
      cadence: legacyCadence
    });
  const activationThreshold = cadence.every;
  const beforeActivationCount = cadence.beforeActivationCount;
  const triggered = cadence.triggered;
  const base = {
    targetPlayerSlot: opponent?.slot || null,
    targetTeamSlot: target?.teamSlot ?? null,
    requestedUnits,
    appliedUnits: 0,
    activationThreshold,
    beforeActivationCount,
    afterActivationCount: cadence.afterActivationCount,
    damageType,
    damageSource,
    triggered
  };

  if (!triggered) {
    return createEffectResult(context, {
      ...base,
      status: 'progressed'
    });
  }
  if (
    !target ||
    target.defeated ||
    toUnitCount(target.heartUnits) === 0 ||
    typeof context.applyDamage !== 'function'
  ) {
    return createEffectResult(context, {
      ...base,
      status: 'no-target'
    });
  }

  const ward = consumeMatchingWard(context.match, target, 'bonus-damage');
  if (ward) {
    return createEffectResult(context, {
      ...base,
      status: 'prevented',
      outcome: 'effect-prevented',
      preventedByStatusKey: ward.statusKey,
      preventedByStatusRevision: ward.statusRevision,
      preventedByStatusName: ward.statusName,
      preventedCategory: ward.category,
      wardSourceAbilityKey: ward.sourceAbilityKey
    });
  }

  const damage = context.applyDamage(
    target,
    requestedUnits,
    damageType,
    damageSource
  );
  target.defeated = toUnitCount(target.heartUnits) === 0;
  return createEffectResult(context, {
    ...base,
    ...damage,
    status: damage.appliedUnits > 0 ? 'resolved' : 'no-effect',
    defeated: target.defeated
  });
}

function recordRepeatedDecisiveActionProgress(match, winnerSlot) {
  if (!winnerSlot) return [];
  const player = match.players.find(
    (candidate) => candidate.slot === winnerSlot
  );
  const active = player?.team?.find(
    (oling) => oling.teamSlot === player.activeTeamSlot
  );
  const action = String(player?.selection?.action || '')
    .trim()
    .toLowerCase();
  if (!active || !action) return [];

  const abilities = (active.snapshot?.abilities || []).filter((ability) =>
    (ability.effects || []).some(
      (effect) => effect.handler === 'damage_after_repeated_decisive_action'
    )
  );
  return abilities.map((ability) => {
    const progress = getAbilityProgress(active, ability.key, ability.revision);
    const previousAction = progress.data?.lastDecisiveVictoryAction || null;
    progress.data = {
      ...(progress.data || {}),
      lastDecisiveVictoryAction: action,
      lastDecisiveVictoryRound: toUnitCount(match.round)
    };
    return {
      playerSlot: player.slot,
      teamSlot: active.teamSlot,
      abilityKey: ability.key,
      abilityRevision: ability.revision,
      previousAction,
      action,
      round: toUnitCount(match.round)
    };
  });
}

function getSuccessfulQueuedTagTarget(player) {
  const rawTeamSlot = player?.selection?.tagTeamSlot;
  if (rawTeamSlot === null || rawTeamSlot === undefined) return null;
  const requestedTeamSlot = Number(rawTeamSlot);
  if (!Number.isInteger(requestedTeamSlot)) return null;
  return (
    player.team.find(
      (oling) =>
        oling.teamSlot === requestedTeamSlot &&
        oling.teamSlot !== player.activeTeamSlot &&
        !oling.defeated &&
        toUnitCount(oling.heartUnits) > 0
    ) || null
  );
}

function getValidHeartTransferChoices(
  player,
  sourceTeamSlot,
  requestedUnits,
  ruleset = {}
) {
  const source = player?.team?.find(
    (oling) => oling.teamSlot === sourceTeamSlot
  );
  const amountUnits = toUnitCount(requestedUnits);
  const minimumDonorHeartUnits = Math.max(
    1,
    toUnitCount(ruleset.transfer?.minimumDonorHeartUnits)
  );
  const requireFullRecipientCapacity =
    ruleset.transfer?.requireFullRecipientCapacity !== false;
  if (
    !source ||
    source.defeated ||
    toUnitCount(source.heartUnits) === 0 ||
    amountUnits === 0
  ) {
    return [];
  }

  function createChoice(optionKey, target, donor, recipient) {
    const donorAvailableUnits = Math.max(
      0,
      toUnitCount(donor.heartUnits) - minimumDonorHeartUnits
    );
    const recipientCapacityUnits = Math.max(
      0,
      toUnitCount(recipient.maxHeartUnits) - toUnitCount(recipient.heartUnits)
    );
    const transferableUnits = Math.min(
      amountUnits,
      donorAvailableUnits,
      recipientCapacityUnits
    );
    if (
      transferableUnits === 0 ||
      (requireFullRecipientCapacity && transferableUnits < amountUnits)
    ) {
      return null;
    }
    return {
      abilityTargetTeamSlot: target.teamSlot,
      optionKey,
      donorTeamSlot: donor.teamSlot,
      recipientTeamSlot: recipient.teamSlot,
      transferableUnits
    };
  }

  return player.team
    .filter(
      (oling) =>
        oling.teamSlot !== sourceTeamSlot &&
        !oling.defeated &&
        toUnitCount(oling.heartUnits) > 0
    )
    .flatMap((target) =>
      [
        createChoice('self-to-bench', target, source, target),
        createChoice('bench-to-self', target, target, source)
      ].filter(Boolean)
    );
}

function getStatusDefinition(match, status) {
  return (
    match?.statusDefinitions?.find(
      (definition) =>
        definition.key === status.key &&
        toUnitCount(definition.revision) === toUnitCount(status.revision)
    )?.snapshot || null
  );
}

function getStatusDefinitionReference(match, statusKey) {
  const normalizedKey = String(statusKey || '')
    .trim()
    .toLowerCase();
  return (
    match?.statusDefinitions?.find(
      (definition) => definition.key === normalizedKey
    ) || null
  );
}

function cloneStatusInstance(status) {
  return {
    key: status.key,
    revision: Math.max(1, toUnitCount(status.revision)),
    sourcePlayerSlot: status.sourcePlayerSlot || null,
    sourceTeamSlot:
      status.sourceTeamSlot === null || status.sourceTeamSlot === undefined
        ? null
        : toUnitCount(status.sourceTeamSlot),
    targetPart: status.targetPart || null,
    stacks: Math.max(1, toUnitCount(status.stacks || 1)),
    appliedRound: toUnitCount(status.appliedRound),
    expiresAfterRound:
      status.expiresAfterRound === null ||
      status.expiresAfterRound === undefined
        ? null
        : toUnitCount(status.expiresAfterRound),
    durationType: status.durationType || 'until-consumed',
    remaining:
      status.remaining === null || status.remaining === undefined
        ? null
        : toUnitCount(status.remaining),
    data: JSON.parse(JSON.stringify(status.data || {}))
  };
}

function recordRemovedPositiveStatus(match, target, status, reason) {
  const definition = getStatusDefinition(match, status);
  if (definition?.polarity !== 'positive' || !target) return null;
  if (!Array.isArray(target.removedPositiveStatuses)) {
    target.removedPositiveStatuses = [];
  }
  const entry = {
    status: cloneStatusInstance(status),
    removedRound: toUnitCount(match?.round),
    reason: String(reason || 'removed')
      .trim()
      .toLowerCase()
  };
  target.removedPositiveStatuses.push(entry);
  if (target.removedPositiveStatuses.length > 20) {
    target.removedPositiveStatuses.splice(
      0,
      target.removedPositiveStatuses.length - 20
    );
  }
  return entry;
}

function getStatusTargetPlayer(match, target) {
  return (
    match?.players?.find(
      (player) =>
        player === target || player.team?.some((oling) => oling === target)
    ) || null
  );
}

function getActiveEffectBlock(match, player, category) {
  const normalizedCategory = String(category || '')
    .trim()
    .toLowerCase();
  const currentRound = toUnitCount(match?.round);
  return (player?.statuses || []).find((status) => {
    const definition = getStatusDefinition(match, status);
    const parsedActiveFromRound = Number(status.data?.activeFromRound);
    const activeFromRound = Number.isFinite(parsedActiveFromRound)
      ? toUnitCount(parsedActiveFromRound)
      : toUnitCount(status.appliedRound);
    const parsedExpiresAfterRound = Number(status.expiresAfterRound);
    const expiresAfterRound = Number.isFinite(parsedExpiresAfterRound)
      ? toUnitCount(parsedExpiresAfterRound)
      : Number.MAX_SAFE_INTEGER;
    return (
      definition?.handler === 'block_effect_category' &&
      status.data?.category === normalizedCategory &&
      currentRound >= activeFromRound &&
      currentRound <= expiresAfterRound
    );
  });
}

function consumeMatchingWard(match, target, category, targetPart = null) {
  if (!Array.isArray(target?.statuses)) return null;
  const normalizedCategory = String(category || '')
    .trim()
    .toLowerCase();
  const statusIndex = target.statuses.findIndex((status) => {
    const definition = getStatusDefinition(match, status);
    return (
      definition?.handler === 'prevent_matching_effect' &&
      status.data?.category === normalizedCategory &&
      (targetPart === null || status.targetPart === targetPart)
    );
  });
  if (statusIndex < 0) return null;

  const [status] = target.statuses.splice(statusIndex, 1);
  const definition = getStatusDefinition(match, status);
  recordRemovedPositiveStatus(match, target, status, 'ward-consumed');
  return {
    statusKey: status.key,
    statusRevision: status.revision,
    statusName: definition?.name || status.key,
    category: normalizedCategory,
    sourceAbilityKey: status.data?.sourceAbilityKey || null,
    sourceAbilityRevision: status.data?.sourceAbilityRevision || null
  };
}

function applyStatus({
  match,
  sourcePlayerSlot,
  sourceTeamSlot,
  target,
  statusKey,
  targetPart = null,
  durationType = 'until-consumed',
  remaining = null,
  expiresAfterRound = null,
  data = {}
}) {
  const definition = getStatusDefinitionReference(match, statusKey);
  if (!definition || !target) return null;
  if (
    definition.snapshot?.handler === 'prevent_next_valid_activation' &&
    targetPart
  ) {
    const ward = consumeMatchingWard(match, target, 'part-disable', targetPart);
    if (ward) {
      return {
        instance: null,
        result: 'warded',
        preventedByStatusKey: ward.statusKey,
        preventedByStatusRevision: ward.statusRevision,
        preventedByStatusName: ward.statusName,
        preventedCategory: ward.category,
        wardSourceAbilityKey: ward.sourceAbilityKey
      };
    }
  }
  const targetPlayer = getStatusTargetPlayer(match, target);
  const activeBlock =
    definition.snapshot?.polarity === 'positive'
      ? getActiveEffectBlock(match, targetPlayer, 'positive-status')
      : null;
  if (activeBlock) {
    return {
      instance: null,
      result: 'blocked',
      blockedByStatusKey: activeBlock.key,
      blockedByStatusRevision: activeBlock.revision
    };
  }
  if (!Array.isArray(target.statuses)) target.statuses = [];

  const existing = target.statuses.find(
    (status) =>
      status.key === definition.key &&
      (status.targetPart || null) === (targetPart || null) &&
      (!status.data?.sourceAbilityKey ||
        status.data.sourceAbilityKey === data.sourceAbilityKey)
  );
  const values = {
    key: definition.key,
    revision: definition.revision,
    sourcePlayerSlot,
    sourceTeamSlot,
    targetPart,
    stacks: 1,
    appliedRound: toUnitCount(match?.round),
    expiresAfterRound,
    durationType,
    remaining,
    data
  };

  if (existing) {
    Object.assign(existing, values);
    return { instance: existing, result: 'refreshed' };
  }

  target.statuses.push(values);
  return { instance: target.statuses.at(-1), result: 'applied' };
}

function blockEffectCategory(context) {
  const opponent = getEffectOpponent(context);
  const statusKey = String(context.effect.parameters?.statusKey || '')
    .trim()
    .toLowerCase();
  const category = String(context.effect.parameters?.category || '')
    .trim()
    .toLowerCase();
  const duration = Math.max(
    1,
    toUnitCount(context.effect.parameters?.duration, 1)
  );
  const activeFromRound = toUnitCount(context.match.round) + 1;
  const expiresAfterRound = activeFromRound + duration - 1;
  if (!opponent || !statusKey || !category) {
    return createEffectResult(context, {
      status: 'no-target',
      targetPlayerSlot: opponent?.slot || null,
      targetTeamSlot: null,
      statusKey,
      category
    });
  }

  const applied = applyStatus({
    match: context.match,
    sourcePlayerSlot: context.player.slot,
    sourceTeamSlot: context.activation.teamSlot,
    target: opponent,
    statusKey,
    durationType: 'round',
    expiresAfterRound,
    data: {
      activeFromRound,
      category,
      sourceAbilityKey: context.activation.abilityKey
    }
  });
  if (!applied?.instance) {
    return createEffectResult(context, {
      status: applied?.result || 'no-effect',
      targetPlayerSlot: opponent.slot,
      targetTeamSlot: null,
      statusKey,
      category,
      activeFromRound,
      expiresAfterRound,
      statusResult: applied?.result || null
    });
  }

  return createEffectResult(context, {
    targetPlayerSlot: opponent.slot,
    targetTeamSlot: null,
    statusKey: applied.instance.key,
    statusRevision: applied.instance.revision,
    statusResult: applied.result,
    category,
    activeFromRound,
    expiresAfterRound,
    durationType: 'round'
  });
}

function replaceNextActivationWithJunk(context) {
  const opponent = getEffectOpponent(context);
  const statusKey = String(context.effect.parameters?.statusKey || 'junk')
    .trim()
    .toLowerCase();
  const category = String(
    context.effect.parameters?.category || 'part-activation'
  )
    .trim()
    .toLowerCase();
  const durationType = String(
    context.effect.parameters?.durationType || 'activation'
  )
    .trim()
    .toLowerCase();
  if (!opponent || !statusKey) {
    return createEffectResult(context, {
      status: 'no-target',
      targetPlayerSlot: opponent?.slot || null,
      targetTeamSlot: null,
      statusKey,
      category
    });
  }

  const applied = applyStatus({
    match: context.match,
    sourcePlayerSlot: context.player.slot,
    sourceTeamSlot: context.activation.teamSlot,
    target: opponent,
    statusKey,
    durationType,
    remaining: 1,
    data: {
      category,
      consumption: 'next-valid-activation',
      sourceAbilityKey: context.activation.abilityKey,
      sourceAbilityRevision: context.activation.abilityRevision
    }
  });
  return createEffectResult(context, {
    status: applied?.instance ? 'resolved' : applied?.result || 'no-effect',
    targetPlayerSlot: opponent.slot,
    targetTeamSlot: null,
    statusKey: applied?.instance?.key || statusKey,
    statusRevision: applied?.instance?.revision || null,
    statusResult: applied?.result || null,
    category,
    durationType,
    remaining: applied?.instance?.remaining ?? null
  });
}

const ACTION_PART = Object.freeze({
  attack: 'mouth',
  guard: 'body',
  skill: 'flight'
});

function getLastUsedPart(match, playerSlot) {
  for (let index = (match?.events || []).length - 1; index >= 0; index -= 1) {
    const event = match.events[index];
    if (event?.type !== 'round-resolved') continue;
    const action = String(event.payload?.actions?.[playerSlot] || '')
      .trim()
      .toLowerCase();
    if (ACTION_PART[action]) return ACTION_PART[action];
    if (event.payload?.outcome === 'draw' && action) return 'eyes';
  }
  return null;
}

function markPartForPositiveEffectSteal(context) {
  const opponent = getEffectOpponent(context);
  const recordedPart = getLastUsedPart(context.match, opponent?.slot);
  const statusKey = String(context.effect.parameters?.statusKey || '')
    .trim()
    .toLowerCase();
  const duration = Math.max(
    1,
    toUnitCount(context.effect.parameters?.duration || 1)
  );
  const checkRound = toUnitCount(context.match.round) + 1;
  const expiresAfterRound = checkRound + duration - 1;
  if (!opponent || !recordedPart || !statusKey) {
    return createEffectResult(context, {
      status: 'no-target',
      targetPlayerSlot: opponent?.slot || null,
      targetTeamSlot: null,
      statusKey,
      recordedPart,
      checkRound
    });
  }

  const applied = applyStatus({
    match: context.match,
    sourcePlayerSlot: context.player.slot,
    sourceTeamSlot: context.activation.teamSlot,
    target: opponent,
    statusKey,
    durationType: 'round',
    expiresAfterRound,
    data: {
      checkRound,
      condition: 'positive-effect-steal',
      displayStatusKey: 'steal-primed',
      recordedPart,
      sourceAbilityKey: context.activation.abilityKey,
      sourceAbilityRevision: context.activation.abilityRevision
    }
  });
  return createEffectResult(context, {
    status: applied?.instance ? 'resolved' : applied?.result || 'no-effect',
    targetPlayerSlot: opponent.slot,
    targetTeamSlot: null,
    statusKey: applied?.instance?.key || statusKey,
    statusRevision: applied?.instance?.revision || null,
    displayStatusKey: 'steal-primed',
    statusResult: applied?.result || null,
    durationType: 'round',
    recordedPart,
    checkRound,
    expiresAfterRound
  });
}

function primeStatusOnNextActionWin(context) {
  const target = context.player.team.find(
    (oling) => oling.teamSlot === context.activation.teamSlot
  );
  const primeStatusKey = String(
    context.effect.parameters?.primeStatusKey || 'burn-primed'
  )
    .trim()
    .toLowerCase();
  const pendingStatusKey = String(context.effect.parameters?.statusKey || '')
    .trim()
    .toLowerCase();
  const requiredAction = String(context.effect.parameters?.action || '')
    .trim()
    .toLowerCase();
  const condition =
    context.effect.handler === 'prime_status_on_next_decisive_action_win'
      ? 'next-decisive-action-win'
      : 'next-action-win';
  if (!target || target.defeated || !primeStatusKey || !pendingStatusKey) {
    return createEffectResult(context, {
      status: 'no-target',
      targetPlayerSlot: context.player.slot,
      targetTeamSlot: target?.teamSlot ?? null,
      primeStatusKey,
      pendingStatusKey,
      requiredAction
    });
  }

  const applied = applyStatus({
    match: context.match,
    sourcePlayerSlot: context.player.slot,
    sourceTeamSlot: context.activation.teamSlot,
    target,
    statusKey: primeStatusKey,
    durationType: context.effect.parameters?.durationType || 'activation',
    remaining: 1,
    data: {
      condition,
      pendingStatusKey,
      requiredAction,
      sourceAbilityKey: context.activation.abilityKey,
      sourceAbilityRevision: context.activation.abilityRevision
    }
  });
  return createEffectResult(context, {
    status: applied?.instance ? 'resolved' : applied?.result || 'no-effect',
    targetPlayerSlot: context.player.slot,
    targetTeamSlot: target.teamSlot,
    primeStatusKey,
    pendingStatusKey,
    requiredAction,
    condition,
    statusKey: applied?.instance?.key || primeStatusKey,
    statusRevision: applied?.instance?.revision || null,
    statusResult: applied?.result || null
  });
}

function captureDecisiveStatusTriggers(match) {
  return (match.players || []).flatMap((player) => {
    const active = player.team?.find(
      (oling) => oling.teamSlot === player.activeTeamSlot
    );
    return (active?.statuses || [])
      .filter(
        (status) =>
          getStatusDefinition(match, status)?.handler ===
          'damage_after_decisive_clash'
      )
      .map((status) => ({
        playerSlot: player.slot,
        teamSlot: active.teamSlot,
        status
      }));
  });
}

function resolveDecisiveStatusTriggers(
  match,
  capturedStatuses = [],
  applyDamage
) {
  return capturedStatuses.flatMap((captured) => {
    const player = match.players.find(
      (candidate) => candidate.slot === captured.playerSlot
    );
    const target = player?.team?.find(
      (oling) => oling.teamSlot === captured.teamSlot
    );
    const statusIndex = target?.statuses?.indexOf(captured.status) ?? -1;
    if (statusIndex < 0) return [];

    target.statuses.splice(statusIndex, 1);
    const definition = getStatusDefinition(match, captured.status);
    const parameters = definition?.parameters || {};
    const damageUnits = toUnitCount(parameters.damageUnits);
    const damageType = String(parameters.damageType || 'normal')
      .trim()
      .toLowerCase();
    const damageSource = String(parameters.damageSource || 'status')
      .trim()
      .toLowerCase();
    const base = {
      playerSlot: player?.slot || captured.playerSlot,
      targetTeamSlot: target?.teamSlot ?? captured.teamSlot,
      statusKey: captured.status.key,
      statusRevision: captured.status.revision,
      statusName: definition?.name || captured.status.key,
      handler: definition?.handler || null,
      status: 'consumed',
      damageUnits,
      damageType,
      damageSource
    };
    if (
      !target ||
      target.defeated ||
      toUnitCount(target.heartUnits) === 0 ||
      typeof applyDamage !== 'function'
    ) {
      return [{ ...base, outcome: 'no-target', appliedUnits: 0 }];
    }

    const damage = applyDamage(target, damageUnits, damageType, damageSource);
    target.defeated = toUnitCount(target.heartUnits) === 0;
    return [
      {
        ...base,
        ...damage,
        outcome: damage.appliedUnits > 0 ? 'damage-applied' : 'no-effect',
        defeated: target.defeated
      }
    ];
  });
}

function resolvePrimedActionWinStatuses(match, winnerSlot) {
  if (!winnerSlot) return [];
  const player = match.players.find(
    (candidate) => candidate.slot === winnerSlot
  );
  const source = player?.team?.find(
    (oling) => oling.teamSlot === player.activeTeamSlot
  );
  const selectedAction = String(player?.selection?.action || '')
    .trim()
    .toLowerCase();
  const opponent = match.players.find(
    (candidate) => candidate.slot !== winnerSlot
  );
  const target = opponent?.team?.find(
    (oling) => oling.teamSlot === opponent.activeTeamSlot
  );
  if (!source || !selectedAction) return [];
  if (!Array.isArray(source.statuses)) source.statuses = [];

  const resolved = [];
  for (let index = source.statuses.length - 1; index >= 0; index -= 1) {
    const status = source.statuses[index];
    const definition = getStatusDefinition(match, status);
    if (
      definition?.handler !== 'apply_status_on_matching_action_win' ||
      !['next-action-win', 'next-decisive-action-win'].includes(
        status.data?.condition
      ) ||
      status.data?.requiredAction !== selectedAction
    ) {
      continue;
    }
    source.statuses.splice(index, 1);
    recordRemovedPositiveStatus(match, source, status, 'trigger-consumed');
    const pendingStatusKey = status.data.pendingStatusKey;
    const applied =
      target && !target.defeated
        ? applyStatus({
            match,
            sourcePlayerSlot: player.slot,
            sourceTeamSlot: source.teamSlot,
            target,
            statusKey: pendingStatusKey,
            durationType: 'clash',
            remaining: 1,
            data: {
              activeFromRound: toUnitCount(match.round) + 1,
              sourceAbilityKey: status.data.sourceAbilityKey,
              sourceAbilityRevision: status.data.sourceAbilityRevision
            }
          })
        : null;
    resolved.unshift({
      playerSlot: player.slot,
      sourceTeamSlot: source.teamSlot,
      targetPlayerSlot: opponent?.slot || null,
      targetTeamSlot: target?.teamSlot ?? null,
      statusKey: status.key,
      statusRevision: status.revision,
      statusName: definition.name || status.key,
      handler: definition.handler,
      status: 'consumed',
      outcome: applied?.instance ? 'status-applied' : 'no-target',
      selectedAction,
      appliedStatusKey: applied?.instance?.key || pendingStatusKey,
      appliedStatusRevision: applied?.instance?.revision || null,
      appliedStatusResult: applied?.result || null,
      activatesRound: toUnitCount(match.round) + 1
    });
  }
  return resolved;
}

function markRepeatedActionForSuppression(context) {
  const opponent = getEffectOpponent(context);
  const statusKey = String(context.effect.parameters?.statusKey || '')
    .trim()
    .toLowerCase();
  const suppressionStatusKey = String(
    context.effect.parameters?.suppressionStatusKey || 'suppressed'
  )
    .trim()
    .toLowerCase();
  const recordedAction = String(opponent?.selection?.action || '')
    .trim()
    .toLowerCase();
  const checkRound = toUnitCount(context.match.round) + 1;
  if (!opponent || !statusKey || !recordedAction) {
    return createEffectResult(context, {
      status: 'no-target',
      targetPlayerSlot: opponent?.slot || null,
      targetTeamSlot: null,
      statusKey,
      recordedAction: recordedAction || null
    });
  }

  const applied = applyStatus({
    match: context.match,
    sourcePlayerSlot: context.player.slot,
    sourceTeamSlot: context.activation.teamSlot,
    target: opponent,
    statusKey,
    durationType: 'round',
    expiresAfterRound: checkRound,
    data: {
      checkRound,
      condition: 'repeat-action-next-round',
      recordedAction,
      sourceAbilityKey: context.activation.abilityKey,
      sourceAbilityRevision: context.activation.abilityRevision,
      suppressionStatusKey
    }
  });
  if (!applied?.instance) {
    return createEffectResult(context, {
      status: applied?.result || 'no-effect',
      targetPlayerSlot: opponent.slot,
      targetTeamSlot: null,
      statusKey,
      checkRound,
      recordedAction,
      statusResult: applied?.result || null
    });
  }

  return createEffectResult(context, {
    targetPlayerSlot: opponent.slot,
    targetTeamSlot: null,
    statusKey: applied.instance.key,
    statusRevision: applied.instance.revision,
    statusResult: applied.result,
    checkRound,
    recordedAction,
    durationType: 'round'
  });
}

function evaluateRepeatedActionMarks(match) {
  const pendingSuppressions = [];
  const triggeredStatuses = [];
  for (const player of match.players || []) {
    if (!Array.isArray(player.statuses)) continue;
    for (let index = player.statuses.length - 1; index >= 0; index -= 1) {
      const status = player.statuses[index];
      const definition = getStatusDefinition(match, status);
      if (
        definition?.handler !== 'record_reference' ||
        status.data?.condition !== 'repeat-action-next-round' ||
        toUnitCount(status.data?.checkRound) !== toUnitCount(match.round)
      ) {
        continue;
      }
      player.statuses.splice(index, 1);
      const selectedAction = String(player.selection?.action || '')
        .trim()
        .toLowerCase();
      const repeated = selectedAction === status.data.recordedAction;
      triggeredStatuses.unshift({
        playerSlot: player.slot,
        targetTeamSlot: null,
        statusKey: status.key,
        statusRevision: status.revision,
        statusName: definition.name || status.key,
        handler: definition.handler,
        status: 'removed',
        outcome: repeated ? 'action-repeated' : 'action-changed',
        recordedAction: status.data.recordedAction,
        selectedAction
      });
      if (repeated) {
        pendingSuppressions.unshift({
          abilityKey: status.data.sourceAbilityKey || 'bone-read',
          abilityRevision: Math.max(
            1,
            toUnitCount(status.data.sourceAbilityRevision)
          ),
          sourcePlayerSlot: status.sourcePlayerSlot,
          sourceTeamSlot: status.sourceTeamSlot,
          targetPlayerSlot: player.slot,
          statusKey: status.data.suppressionStatusKey || 'suppressed'
        });
      }
    }
  }
  return { pendingSuppressions, triggeredStatuses };
}

function resolveRepeatedActionSuppressions(
  match,
  pendingSuppressions = [],
  random = Math.random
) {
  const eligibleParts = ['mouth', 'body', 'flight', 'eyes'];
  return pendingSuppressions.map((pending) => {
    const player = match.players.find(
      (candidate) => candidate.slot === pending.targetPlayerSlot
    );
    const target = player?.team?.find(
      (oling) => oling.teamSlot === player.activeTeamSlot
    );
    if (!target || target.defeated || toUnitCount(target.heartUnits) === 0) {
      return {
        playerSlot: pending.sourcePlayerSlot,
        sourceTeamSlot: pending.sourceTeamSlot,
        abilityKey: pending.abilityKey,
        abilityRevision: pending.abilityRevision,
        effectOrder: 0,
        mechanic: 'suppress',
        handler: 'mark_repeated_action_for_suppression',
        status: 'no-target',
        targetPlayerSlot: player?.slot || null,
        targetTeamSlot: target?.teamSlot ?? null,
        statusKey: pending.statusKey,
        targetPart: null
      };
    }

    const randomValue = Number(random());
    const randomIndex = Math.min(
      eligibleParts.length - 1,
      Math.floor(
        Math.max(0, Number.isFinite(randomValue) ? randomValue : 0) *
          eligibleParts.length
      )
    );
    const targetPart = eligibleParts[randomIndex];
    const applied = applyStatus({
      match,
      sourcePlayerSlot: pending.sourcePlayerSlot,
      sourceTeamSlot: pending.sourceTeamSlot,
      target,
      statusKey: pending.statusKey,
      targetPart,
      durationType: 'activation',
      remaining: 1,
      data: {
        consumption: 'matching-activation',
        sourceAbilityKey: pending.abilityKey
      }
    });
    return {
      playerSlot: pending.sourcePlayerSlot,
      sourceTeamSlot: pending.sourceTeamSlot,
      abilityKey: pending.abilityKey,
      abilityRevision: pending.abilityRevision,
      effectOrder: 0,
      mechanic: 'suppress',
      handler: 'mark_repeated_action_for_suppression',
      status: applied?.instance
        ? 'resolved'
        : applied?.result === 'warded'
          ? 'prevented'
          : applied?.result || 'no-effect',
      targetPlayerSlot: player.slot,
      targetTeamSlot: target.teamSlot,
      statusKey: pending.statusKey,
      statusRevision: applied?.instance?.revision || null,
      statusResult: applied?.result || null,
      outcome: applied?.result === 'warded' ? 'effect-prevented' : null,
      preventedByStatusKey: applied?.preventedByStatusKey || null,
      preventedByStatusRevision: applied?.preventedByStatusRevision || null,
      preventedCategory: applied?.preventedCategory || null,
      wardSourceAbilityKey: applied?.wardSourceAbilityKey || null,
      targetPart,
      eligibleParts,
      activatesRound: toUnitCount(match.round) + 1
    };
  });
}

function expireRoundStatuses(match) {
  const expired = [];
  for (const player of match.players || []) {
    if (!Array.isArray(player.statuses)) continue;
    for (let index = player.statuses.length - 1; index >= 0; index -= 1) {
      const status = player.statuses[index];
      if (
        status.durationType !== 'round' ||
        status.expiresAfterRound === null ||
        status.expiresAfterRound === undefined ||
        toUnitCount(status.expiresAfterRound) > toUnitCount(match.round)
      ) {
        continue;
      }
      player.statuses.splice(index, 1);
      const definition = getStatusDefinition(match, status);
      expired.unshift({
        playerSlot: player.slot,
        targetTeamSlot: null,
        statusKey: status.key,
        statusRevision: status.revision,
        statusName: definition?.name || status.key,
        handler: definition?.handler || null,
        status: 'removed',
        outcome: 'round-expired'
      });
    }
  }
  return expired;
}

function getValidCleanseChoices(player, match, polarity = 'negative') {
  const normalizedPolarity = String(polarity || 'negative')
    .trim()
    .toLowerCase();
  return (player?.team || []).flatMap((oling) => {
    if (oling.defeated || toUnitCount(oling.heartUnits) === 0) return [];
    const eligibleStatuses = (oling.statuses || [])
      .map((status, statusIndex) => ({
        definition: getStatusDefinition(match, status),
        signature: [
          status.key,
          status.targetPart || '',
          status.data?.sourceAbilityKey || ''
        ].join(':'),
        status,
        statusIndex
      }))
      .filter(({ definition }) => definition?.polarity === normalizedPolarity);
    const distinctStatuses = [
      ...new Map(
        eligibleStatuses.map((entry) => [entry.signature, entry])
      ).values()
    ];
    const keyCounts = new Map(
      distinctStatuses.map(({ status }) => [
        status.key,
        distinctStatuses.filter((entry) => entry.status.key === status.key)
          .length
      ])
    );
    return distinctStatuses.map(({ definition, status, statusIndex }) => {
      const hasVariants = keyCounts.get(status.key) > 1;
      const sourceAbilityKey = status.data?.sourceAbilityKey || '';
      const optionKey = hasVariants
        ? [
            status.key,
            status.targetPart || 'any',
            sourceAbilityKey || statusIndex
          ]
            .join(':')
            .toLowerCase()
        : status.key;
      const qualifiers = hasVariants
        ? [status.targetPart, sourceAbilityKey]
            .filter(Boolean)
            .map((value) => String(value).replace(/^bone-/, ''))
        : [];
      return {
        abilityTargetTeamSlot: oling.teamSlot,
        optionKey,
        statusIndex,
        statusKey: status.key,
        statusRevision: status.revision,
        statusName: `${definition.name || status.key}${
          qualifiers.length ? ` (${qualifiers.join(', ')})` : ''
        }`
      };
    });
  });
}

function getValidPartWardChoices(player, sourceTeamSlot) {
  const source = player?.team?.find(
    (oling) => oling.teamSlot === sourceTeamSlot
  );
  if (!source || source.defeated || toUnitCount(source.heartUnits) === 0) {
    return [];
  }
  return ['mouth', 'body', 'flight', 'eyes'].map((part) => ({
    abilityTargetTeamSlot: source.teamSlot,
    optionKey: part,
    targetPart: part
  }));
}

function createEffectResult(context, overrides = {}) {
  return {
    playerSlot: context.player.slot,
    sourceTeamSlot: context.activation.teamSlot,
    abilityKey: context.activation.abilityKey,
    abilityRevision: context.activation.abilityRevision,
    effectOrder: toUnitCount(context.effect.order),
    mechanic: context.effect.mechanic,
    handler: context.effect.handler,
    status: 'resolved',
    ...overrides
  };
}

function wardEffectCategory(context) {
  const target = context.player.team.find(
    (oling) => oling.teamSlot === context.activation.teamSlot
  );
  const statusKey = String(context.effect.parameters?.statusKey || '')
    .trim()
    .toLowerCase();
  const category = String(context.effect.parameters?.category || '')
    .trim()
    .toLowerCase();
  const durationType = String(
    context.effect.parameters?.durationType || 'until-consumed'
  )
    .trim()
    .toLowerCase();
  if (
    !target ||
    target.defeated ||
    toUnitCount(target.heartUnits) === 0 ||
    !statusKey ||
    !category
  ) {
    return createEffectResult(context, {
      status: 'no-target',
      targetPlayerSlot: context.player.slot,
      targetTeamSlot: target?.teamSlot ?? null,
      statusKey,
      category,
      statusResult: null
    });
  }

  const applied = applyStatus({
    match: context.match,
    sourcePlayerSlot: context.player.slot,
    sourceTeamSlot: context.activation.teamSlot,
    target,
    statusKey,
    durationType,
    remaining: 1,
    data: {
      category,
      sourceAbilityKey: context.activation.abilityKey,
      sourceAbilityRevision: context.activation.abilityRevision
    }
  });
  return createEffectResult(context, {
    status: applied?.instance ? 'resolved' : applied?.result || 'no-effect',
    targetPlayerSlot: context.player.slot,
    targetTeamSlot: target.teamSlot,
    statusKey: applied?.instance?.key || statusKey,
    statusRevision: applied?.instance?.revision || null,
    category,
    durationType,
    remaining: applied?.instance?.remaining ?? null,
    statusResult: applied?.result || null
  });
}

function wardChosenPart(context) {
  const choices = getValidPartWardChoices(
    context.player,
    context.activation.teamSlot
  );
  const effectChoice = context.player.selection?.effectChoice;
  const choice = choices.find(
    (candidate) =>
      effectChoice?.abilityKey === context.activation.abilityKey &&
      candidate.abilityTargetTeamSlot === effectChoice.targetTeamSlot &&
      candidate.optionKey === effectChoice.optionKey
  );
  const target = context.player.team.find(
    (oling) => oling.teamSlot === context.activation.teamSlot
  );
  const statusKey = String(context.effect.parameters?.statusKey || '')
    .trim()
    .toLowerCase();
  const category = String(context.effect.parameters?.category || '')
    .trim()
    .toLowerCase();
  const durationType = String(
    context.effect.parameters?.durationType || 'until-consumed'
  )
    .trim()
    .toLowerCase();
  if (!choice || !target || !statusKey || !category) {
    return createEffectResult(context, {
      status: 'no-target',
      targetPlayerSlot: context.player.slot,
      targetTeamSlot: target?.teamSlot ?? null,
      optionKey: effectChoice?.optionKey || null,
      targetPart: null,
      statusKey,
      category,
      statusResult: null
    });
  }

  const applied = applyStatus({
    match: context.match,
    sourcePlayerSlot: context.player.slot,
    sourceTeamSlot: context.activation.teamSlot,
    target,
    statusKey,
    targetPart: choice.targetPart,
    durationType,
    remaining: 1,
    data: {
      category,
      sourceAbilityKey: context.activation.abilityKey,
      sourceAbilityRevision: context.activation.abilityRevision
    }
  });
  return createEffectResult(context, {
    status: applied?.instance ? 'resolved' : applied?.result || 'no-effect',
    targetPlayerSlot: context.player.slot,
    targetTeamSlot: target.teamSlot,
    optionKey: choice.optionKey,
    targetPart: choice.targetPart,
    statusKey: applied?.instance?.key || statusKey,
    statusRevision: applied?.instance?.revision || null,
    category,
    durationType,
    remaining: applied?.instance?.remaining ?? null,
    statusResult: applied?.result || null
  });
}

function healMostDamagedBenched(context) {
  const target = getMostDamagedLivingBenchOling(context.player);
  const requestedUnits = toUnitCount(context.effect.parameters?.amountUnits);
  if (!target) {
    return createEffectResult(context, {
      status: 'no-target',
      targetPlayerSlot: context.player.slot,
      targetTeamSlot: null,
      requestedUnits,
      appliedUnits: 0
    });
  }

  const healing = healPermanentHearts(target, requestedUnits);
  return createEffectResult(context, {
    status: healing.appliedUnits > 0 ? 'resolved' : 'no-effect',
    targetPlayerSlot: context.player.slot,
    targetTeamSlot: target.teamSlot,
    ...healing
  });
}

function grantOvergrowthToSelfOrTagRecipient(context) {
  const active = context.player.team.find(
    (oling) => oling.teamSlot === context.activation.teamSlot
  );
  if (!active || active.defeated || toUnitCount(active.heartUnits) === 0) {
    return createEffectResult(context, {
      status: 'no-target',
      targetPlayerSlot: context.player.slot,
      targetTeamSlot: null,
      requestedUnits: toUnitCount(context.effect.parameters?.amountUnits),
      appliedUnits: 0
    });
  }

  const tagRecipient = getSuccessfulQueuedTagTarget(context.player);
  const target = tagRecipient || active;
  return createEffectResult(context, {
    targetPlayerSlot: context.player.slot,
    targetTeamSlot: target.teamSlot,
    targetReason: tagRecipient ? 'tag-recipient' : 'self',
    ...grantOvergrowth(target, context.effect.parameters?.amountUnits)
  });
}

function grantShieldToMostDamagedAlly(context) {
  const target = getMostDamagedLivingAlly(context.player);
  const requestedShieldCount = toUnitCount(
    context.effect.parameters?.shieldCount
  );
  if (!target) {
    return createEffectResult(context, {
      status: 'no-target',
      targetPlayerSlot: context.player.slot,
      targetTeamSlot: null,
      requestedShieldCount,
      appliedShieldCount: 0
    });
  }

  const shields = grantShields(target, requestedShieldCount, {
    stacks: context.match.ruleset?.snapshot?.health?.shieldStacks !== false
  });
  return createEffectResult(context, {
    status: shields.appliedShieldCount > 0 ? 'resolved' : 'no-effect',
    targetPlayerSlot: context.player.slot,
    targetTeamSlot: target.teamSlot,
    ...shields
  });
}

function grantShieldToSelf(context) {
  const target = context.player.team.find(
    (oling) => oling.teamSlot === context.activation.teamSlot
  );
  const requestedShieldCount = toUnitCount(
    context.effect.parameters?.shieldCount
  );
  if (!target || target.defeated || toUnitCount(target.heartUnits) === 0) {
    return createEffectResult(context, {
      status: 'no-target',
      targetPlayerSlot: context.player.slot,
      targetTeamSlot: null,
      requestedShieldCount,
      appliedShieldCount: 0
    });
  }

  const shields = grantShields(target, requestedShieldCount, {
    stacks: context.match.ruleset?.snapshot?.health?.shieldStacks !== false
  });
  return createEffectResult(context, {
    status: shields.appliedShieldCount > 0 ? 'resolved' : 'no-effect',
    targetPlayerSlot: context.player.slot,
    targetTeamSlot: target.teamSlot,
    ...shields
  });
}

function healEveryNthActivation(context) {
  const target = context.player.team.find(
    (oling) => oling.teamSlot === context.activation.teamSlot
  );
  const requestedUnits = toUnitCount(context.effect.parameters?.amountUnits);
  const legacyCadence = normalizeAbilityCadence({
    every: context.effect.parameters?.activationCount
  });
  if (!target || target.defeated || toUnitCount(target.heartUnits) === 0) {
    return createEffectResult(context, {
      status: 'no-target',
      targetPlayerSlot: context.player.slot,
      targetTeamSlot: null,
      requestedUnits,
      appliedUnits: 0,
      activationThreshold: legacyCadence.every
    });
  }

  const cadence =
    context.cadence ||
    advanceAbilityCadence(target, {
      key: context.activation.abilityKey,
      revision: context.activation.abilityRevision,
      cadence: legacyCadence
    });
  const activationThreshold = cadence.every;
  const beforeActivationCount = cadence.beforeActivationCount;
  const reachedThreshold = cadence.triggered;
  const healing = reachedThreshold
    ? healPermanentHearts(target, requestedUnits)
    : {
        requestedUnits,
        appliedUnits: 0,
        beforeHeartUnits: toUnitCount(target.heartUnits),
        afterHeartUnits: toUnitCount(target.heartUnits),
        maxHeartUnits: toUnitCount(target.maxHeartUnits)
      };

  return createEffectResult(context, {
    status: reachedThreshold
      ? healing.appliedUnits > 0
        ? 'resolved'
        : 'no-effect'
      : 'progressed',
    targetPlayerSlot: context.player.slot,
    targetTeamSlot: target.teamSlot,
    activationThreshold,
    beforeActivationCount,
    afterActivationCount: cadence.afterActivationCount,
    triggered: reachedThreshold,
    ...healing
  });
}

function storeAndConvertResource(context) {
  const target = context.player.team.find(
    (oling) => oling.teamSlot === context.activation.teamSlot
  );
  const resource = String(context.effect.parameters?.resource || '')
    .trim()
    .toLowerCase();
  const resourceFields = { blood: 'bloodUnits' };
  const resourceField = resourceFields[resource];
  const requestedResourceUnits = toUnitCount(
    context.effect.parameters?.amountUnits
  );
  const conversionThresholdUnits = Math.max(
    1,
    toUnitCount(context.effect.parameters?.conversionThresholdUnits)
  );
  const convertedHeartUnits = toUnitCount(
    context.effect.parameters?.convertedHeartUnits
  );
  if (
    !target ||
    target.defeated ||
    toUnitCount(target.heartUnits) === 0 ||
    !resourceField
  ) {
    return createEffectResult(context, {
      status: 'no-target',
      targetPlayerSlot: context.player.slot,
      targetTeamSlot: null,
      resource,
      requestedResourceUnits,
      storedResourceUnits: 0,
      conversionThresholdUnits,
      conversionCount: 0,
      converted: false,
      requestedUnits: 0,
      appliedUnits: 0
    });
  }

  const beforeResourceUnits = toUnitCount(target[resourceField]);
  const afterStoreResourceUnits = beforeResourceUnits + requestedResourceUnits;
  const conversionCount = Math.floor(
    afterStoreResourceUnits / conversionThresholdUnits
  );
  target[resourceField] = afterStoreResourceUnits % conversionThresholdUnits;
  const requestedHeartUnits = conversionCount * convertedHeartUnits;
  const healing = healPermanentHearts(target, requestedHeartUnits);

  return createEffectResult(context, {
    status:
      conversionCount === 0
        ? 'stored'
        : healing.appliedUnits > 0
          ? 'resolved'
          : 'no-effect',
    targetPlayerSlot: context.player.slot,
    targetTeamSlot: target.teamSlot,
    resource,
    requestedResourceUnits,
    storedResourceUnits: requestedResourceUnits,
    beforeResourceUnits,
    afterStoreResourceUnits,
    afterResourceUnits: target[resourceField],
    conversionThresholdUnits,
    conversionCount,
    converted: conversionCount > 0,
    convertedHeartUnits,
    ...healing
  });
}

function transferHeartsBetweenSelfAndBench(context) {
  const requestedUnits = toUnitCount(context.effect.parameters?.amountUnits);
  const effectChoice = context.player.selection?.effectChoice;
  const validChoices = getValidHeartTransferChoices(
    context.player,
    context.activation.teamSlot,
    requestedUnits,
    context.match.ruleset?.snapshot
  );
  const choice = validChoices.find(
    (candidate) =>
      effectChoice?.abilityKey === context.activation.abilityKey &&
      candidate.abilityTargetTeamSlot === effectChoice.targetTeamSlot &&
      candidate.optionKey === effectChoice.optionKey
  );
  if (!choice) {
    return createEffectResult(context, {
      status: 'no-target',
      targetPlayerSlot: context.player.slot,
      targetTeamSlot: effectChoice?.targetTeamSlot ?? null,
      optionKey: effectChoice?.optionKey || null,
      requestedUnits,
      appliedUnits: 0
    });
  }

  const donor = context.player.team.find(
    (oling) => oling.teamSlot === choice.donorTeamSlot
  );
  const recipient = context.player.team.find(
    (oling) => oling.teamSlot === choice.recipientTeamSlot
  );
  const beforeDonorHeartUnits = toUnitCount(donor.heartUnits);
  const beforeRecipientHeartUnits = toUnitCount(recipient.heartUnits);
  const appliedUnits = choice.transferableUnits;
  donor.heartUnits = beforeDonorHeartUnits - appliedUnits;
  recipient.heartUnits = beforeRecipientHeartUnits + appliedUnits;

  return createEffectResult(context, {
    targetPlayerSlot: context.player.slot,
    targetTeamSlot: choice.abilityTargetTeamSlot,
    optionKey: choice.optionKey,
    requestedUnits,
    appliedUnits,
    donorTeamSlot: donor.teamSlot,
    recipientTeamSlot: recipient.teamSlot,
    beforeDonorHeartUnits,
    afterDonorHeartUnits: donor.heartUnits,
    beforeRecipientHeartUnits,
    afterRecipientHeartUnits: recipient.heartUnits
  });
}

function cleanseStatus(context) {
  const requestedCount = Math.max(
    1,
    toUnitCount(context.effect.parameters?.count)
  );
  const polarity = String(context.effect.parameters?.polarity || 'negative')
    .trim()
    .toLowerCase();
  const effectChoice = context.player.selection?.effectChoice;
  const choice = getValidCleanseChoices(
    context.player,
    context.match,
    polarity
  ).find(
    (candidate) =>
      effectChoice?.abilityKey === context.activation.abilityKey &&
      candidate.abilityTargetTeamSlot === effectChoice.targetTeamSlot &&
      candidate.optionKey === effectChoice.optionKey
  );
  if (!choice) {
    return createEffectResult(context, {
      status: 'no-target',
      targetPlayerSlot: context.player.slot,
      targetTeamSlot: effectChoice?.targetTeamSlot ?? null,
      optionKey: effectChoice?.optionKey || null,
      requestedCount,
      removedCount: 0,
      polarity
    });
  }

  const target = context.player.team.find(
    (oling) => oling.teamSlot === choice.abilityTargetTeamSlot
  );
  const selectedStatus = target.statuses[choice.statusIndex];
  const statusIndex =
    selectedStatus?.key === choice.statusKey &&
    getStatusDefinition(context.match, selectedStatus)?.polarity === polarity
      ? choice.statusIndex
      : -1;
  if (statusIndex < 0) {
    return createEffectResult(context, {
      status: 'no-target',
      targetPlayerSlot: context.player.slot,
      targetTeamSlot: target.teamSlot,
      optionKey: choice.optionKey,
      requestedCount,
      removedCount: 0,
      polarity
    });
  }

  const [removedStatus] = target.statuses.splice(statusIndex, 1);
  return createEffectResult(context, {
    targetPlayerSlot: context.player.slot,
    targetTeamSlot: target.teamSlot,
    optionKey: choice.optionKey,
    requestedCount,
    removedCount: 1,
    polarity,
    removedStatusKey: removedStatus.key,
    removedStatusRevision: removedStatus.revision,
    removedStatusName: choice.statusName,
    remainingStatusCount: target.statuses.length
  });
}

function suppressPart(context) {
  const opponent = getEffectOpponent(context);
  const target = opponent?.team?.find(
    (oling) => oling.teamSlot === opponent.activeTeamSlot
  );
  const statusKey = String(context.effect.parameters?.statusKey || '')
    .trim()
    .toLowerCase();
  const targetPart = String(context.effect.target?.part || '')
    .trim()
    .toLowerCase();
  const durationType = String(
    context.effect.parameters?.durationType || 'activation'
  )
    .trim()
    .toLowerCase();

  if (
    !target ||
    target.defeated ||
    toUnitCount(target.heartUnits) === 0 ||
    !targetPart
  ) {
    return createEffectResult(context, {
      status: 'no-target',
      targetPlayerSlot: opponent?.slot || null,
      targetTeamSlot: target?.teamSlot ?? null,
      statusKey,
      targetPart,
      statusResult: null
    });
  }

  const applied = applyStatus({
    match: context.match,
    sourcePlayerSlot: context.player.slot,
    sourceTeamSlot: context.activation.teamSlot,
    target,
    statusKey,
    targetPart,
    durationType,
    remaining: 1,
    data: {
      consumption: 'matching-activation',
      sourceAbilityKey: context.activation.abilityKey
    }
  });
  if (!applied?.instance) {
    return createEffectResult(context, {
      status: applied?.result === 'warded' ? 'prevented' : 'no-effect',
      outcome: applied?.result === 'warded' ? 'effect-prevented' : null,
      targetPlayerSlot: opponent.slot,
      targetTeamSlot: target.teamSlot,
      statusKey,
      targetPart,
      statusResult: applied?.result || 'definition-unavailable',
      preventedByStatusKey: applied?.preventedByStatusKey || null,
      preventedByStatusRevision: applied?.preventedByStatusRevision || null,
      preventedCategory: applied?.preventedCategory || null,
      wardSourceAbilityKey: applied?.wardSourceAbilityKey || null
    });
  }

  return createEffectResult(context, {
    targetPlayerSlot: opponent.slot,
    targetTeamSlot: target.teamSlot,
    statusKey: applied.instance.key,
    statusRevision: applied.instance.revision,
    targetPart,
    durationType: applied.instance.durationType,
    remaining: applied.instance.remaining,
    statusResult: applied.result
  });
}

function suppressRandomPartUntilDifferentActionWin(context) {
  const opponent = getEffectOpponent(context);
  const target = opponent?.team?.find(
    (oling) => oling.teamSlot === opponent.activeTeamSlot
  );
  const statusKey = String(context.effect.parameters?.statusKey || '')
    .trim()
    .toLowerCase();
  const durationType = String(
    context.effect.parameters?.durationType || 'activation'
  )
    .trim()
    .toLowerCase();
  const eligibleParts = ['mouth', 'body', 'flight', 'eyes'];

  if (!target || target.defeated || toUnitCount(target.heartUnits) === 0) {
    return createEffectResult(context, {
      status: 'no-target',
      targetPlayerSlot: opponent?.slot || null,
      targetTeamSlot: target?.teamSlot ?? null,
      statusKey,
      targetPart: null,
      statusResult: null
    });
  }

  const random =
    typeof context.random === 'function' ? context.random : Math.random;
  const randomValue = Number(random());
  const randomIndex = Math.min(
    eligibleParts.length - 1,
    Math.floor(
      Math.max(0, Number.isFinite(randomValue) ? randomValue : 0) *
        eligibleParts.length
    )
  );
  const targetPart = eligibleParts[randomIndex];
  const applied = applyStatus({
    match: context.match,
    sourcePlayerSlot: context.player.slot,
    sourceTeamSlot: context.activation.teamSlot,
    target,
    statusKey,
    targetPart,
    durationType,
    remaining: 1,
    data: {
      consumption: 'different-action-win',
      sourceAbilityKey: context.activation.abilityKey
    }
  });
  if (!applied?.instance) {
    return createEffectResult(context, {
      status: applied?.result === 'warded' ? 'prevented' : 'no-effect',
      outcome: applied?.result === 'warded' ? 'effect-prevented' : null,
      targetPlayerSlot: opponent.slot,
      targetTeamSlot: target.teamSlot,
      statusKey,
      targetPart,
      statusResult: applied?.result || 'definition-unavailable',
      preventedByStatusKey: applied?.preventedByStatusKey || null,
      preventedByStatusRevision: applied?.preventedByStatusRevision || null,
      preventedCategory: applied?.preventedCategory || null,
      wardSourceAbilityKey: applied?.wardSourceAbilityKey || null
    });
  }

  return createEffectResult(context, {
    targetPlayerSlot: opponent.slot,
    targetTeamSlot: target.teamSlot,
    statusKey: applied.instance.key,
    statusRevision: applied.instance.revision,
    targetPart,
    eligibleParts,
    durationType: applied.instance.durationType,
    remaining: applied.instance.remaining,
    clearCondition: 'different-action-win',
    statusResult: applied.result
  });
}

function reclaimDrawDamageAsBlood(context) {
  const target = context.player.team.find(
    (oling) => oling.teamSlot === context.activation.teamSlot
  );
  const maximumUnits = Math.max(
    1,
    toUnitCount(context.effect.parameters?.maximumUnits)
  );
  const damage = context.damage.find(
    (entry) =>
      entry.playerSlot === context.player.slot &&
      entry.teamSlot === context.activation.teamSlot
  );
  const heartDamageUnits = toUnitCount(
    damage?.layers?.find((layer) => layer.layer === 'hearts')?.units
  );
  if (!target || target.defeated || toUnitCount(target.heartUnits) === 0) {
    return createEffectResult(context, {
      status: 'no-target',
      targetPlayerSlot: context.player.slot,
      targetTeamSlot: null,
      resource: 'reclaim-blood',
      heartDamageUnits,
      maximumUnits,
      storedUnits: 0,
      beforePendingReclaimUnits: 0,
      afterPendingReclaimUnits: 0
    });
  }

  const beforePendingReclaimUnits = toUnitCount(target.pendingReclaimUnits);
  const storedUnits = Math.min(
    heartDamageUnits,
    Math.max(0, maximumUnits - beforePendingReclaimUnits)
  );
  target.pendingReclaimUnits = beforePendingReclaimUnits + storedUnits;
  return createEffectResult(context, {
    status: storedUnits > 0 ? 'stored' : 'no-effect',
    targetPlayerSlot: context.player.slot,
    targetTeamSlot: target.teamSlot,
    resource: 'reclaim-blood',
    heartDamageUnits,
    maximumUnits,
    storedUnits,
    beforePendingReclaimUnits,
    afterPendingReclaimUnits: target.pendingReclaimUnits
  });
}

function resolvePendingReclaims(match, winnerSlot) {
  return match.players.flatMap((player) => {
    const target = player.team.find(
      (oling) => oling.teamSlot === player.activeTeamSlot
    );
    const pendingUnits = toUnitCount(target?.pendingReclaimUnits);
    if (!target || pendingUnits === 0) return [];

    const ability = target.snapshot?.abilities?.find(
      (candidate) => candidate.key === 'vampire-reclaim'
    );
    const beforeHeartUnits = toUnitCount(target.heartUnits);
    const wonDecisiveClash = player.slot === winnerSlot;
    const healing = wonDecisiveClash
      ? healPermanentHearts(target, pendingUnits)
      : {
          requestedUnits: pendingUnits,
          appliedUnits: 0,
          beforeHeartUnits,
          afterHeartUnits: beforeHeartUnits,
          maxHeartUnits: toUnitCount(target.maxHeartUnits)
        };
    target.pendingReclaimUnits = 0;

    return [
      {
        playerSlot: player.slot,
        sourceTeamSlot: target.teamSlot,
        abilityKey: 'vampire-reclaim',
        abilityRevision: Math.max(1, toUnitCount(ability?.revision)),
        effectOrder: 0,
        mechanic: wonDecisiveClash ? 'heal' : 'remove-resource',
        handler: 'resolve_reclaim_after_decisive',
        status: wonDecisiveClash
          ? healing.appliedUnits > 0
            ? 'resolved'
            : 'no-effect'
          : 'lost',
        targetPlayerSlot: player.slot,
        targetTeamSlot: target.teamSlot,
        resource: 'reclaim-blood',
        outcome: wonDecisiveClash ? 'recovered' : 'lost',
        beforePendingReclaimUnits: pendingUnits,
        afterPendingReclaimUnits: 0,
        ...healing
      }
    ];
  });
}

function restoreMostRecentPositiveStatus(context) {
  const target = context.player.team.find(
    (oling) => oling.teamSlot === context.activation.teamSlot
  );
  const history = target?.removedPositiveStatuses;
  if (
    !target ||
    target.defeated ||
    toUnitCount(target.heartUnits) === 0 ||
    !Array.isArray(history)
  ) {
    return createEffectResult(context, {
      status: 'no-target',
      targetPlayerSlot: context.player.slot,
      targetTeamSlot: target?.teamSlot ?? null,
      restoredStatusKey: null,
      restoredStatusRevision: null
    });
  }

  let historyIndex = -1;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const storedStatus = history[index]?.status;
    if (
      getStatusDefinition(context.match, storedStatus)?.polarity === 'positive'
    ) {
      historyIndex = index;
      break;
    }
  }
  if (historyIndex < 0) {
    return createEffectResult(context, {
      status: 'no-target',
      targetPlayerSlot: context.player.slot,
      targetTeamSlot: target.teamSlot,
      restoredStatusKey: null,
      restoredStatusRevision: null
    });
  }

  const historyEntry = history[historyIndex];
  const storedStatus = historyEntry.status;
  const originalDuration =
    storedStatus.expiresAfterRound === null ||
    storedStatus.expiresAfterRound === undefined
      ? null
      : Math.max(
          0,
          toUnitCount(storedStatus.expiresAfterRound) -
            toUnitCount(storedStatus.appliedRound)
        );
  const expiresAfterRound =
    originalDuration === null
      ? null
      : toUnitCount(context.match.round) + originalDuration;
  const applied = applyStatus({
    match: context.match,
    sourcePlayerSlot: storedStatus.sourcePlayerSlot,
    sourceTeamSlot: storedStatus.sourceTeamSlot,
    target,
    statusKey: storedStatus.key,
    targetPart: storedStatus.targetPart,
    durationType: storedStatus.durationType,
    remaining: storedStatus.remaining,
    expiresAfterRound,
    data: JSON.parse(JSON.stringify(storedStatus.data || {}))
  });
  if (applied?.instance) history.splice(historyIndex, 1);
  return createEffectResult(context, {
    status: applied?.instance ? 'resolved' : applied?.result || 'no-effect',
    targetPlayerSlot: context.player.slot,
    targetTeamSlot: target.teamSlot,
    restoredStatusKey: storedStatus.key,
    restoredStatusRevision: storedStatus.revision,
    restoredStatusName:
      getStatusDefinition(context.match, storedStatus)?.name ||
      storedStatus.key,
    removedRound: toUnitCount(historyEntry.removedRound),
    removalReason: historyEntry.reason || null,
    statusResult: applied?.result || null,
    remainingHistoryCount: history.length
  });
}

function hasPartSuppression(match, oling, part) {
  return (oling?.statuses || []).some((status) => {
    const definition = getStatusDefinition(match, status);
    return (
      definition?.handler === 'prevent_next_valid_activation' &&
      status.targetPart === part
    );
  });
}

function reflectOpponentMouthEffect(context) {
  const sourcePlayer = context.match.players.find(
    (player) => player.slot !== context.player.slot
  );
  const sourceOling = sourcePlayer?.team?.find(
    (oling) => oling.teamSlot === sourcePlayer.activeTeamSlot
  );
  const ability = sourceOling?.snapshot?.abilities?.find(
    (candidate) => candidate.layer === 'mouth'
  );
  const maximumRedirects = Math.max(
    1,
    toUnitCount(context.effect.parameters?.maximumRedirects || 1)
  );
  if (!sourcePlayer || !sourceOling || !ability) {
    return createEffectResult(context, {
      status: 'no-target',
      outcome: 'no-mouth-effect',
      targetPlayerSlot: sourcePlayer?.slot || null,
      targetTeamSlot: sourceOling?.teamSlot ?? null,
      maximumRedirects
    });
  }
  if (hasPartSuppression(context.match, sourceOling, 'mouth')) {
    return createEffectResult(context, {
      status: 'no-effect',
      outcome: 'mouth-suppressed',
      targetPlayerSlot: sourcePlayer.slot,
      targetTeamSlot: sourceOling.teamSlot,
      reflectedAbilityKey: ability.key,
      reflectedAbilityRevision: ability.revision,
      maximumRedirects
    });
  }

  const reflectedActivation = {
    playerSlot: sourcePlayer.slot,
    teamSlot: sourceOling.teamSlot,
    part: 'mouth',
    abilityKey: ability.key,
    abilityRevision: ability.revision,
    effects: ability.effects || []
  };
  const reflectableEffects = [...(ability.effects || [])]
    .filter(
      (effect) =>
        String(effect.target?.side || '')
          .trim()
          .toLowerCase() === 'opponent'
    )
    .sort((left, right) => toUnitCount(left.order) - toUnitCount(right.order));
  const reflectedResults = reflectableEffects.flatMap((effect) => {
    const handler = effectHandlers[effect.handler];
    if (!handler) return [];
    const resolved = handler({
      activation: reflectedActivation,
      applyDamage: context.applyDamage,
      damage: context.damage || [],
      effect,
      match: context.match,
      player: sourcePlayer,
      random: context.random,
      targetPlayerOverride: sourcePlayer
    });
    const results = Array.isArray(resolved) ? resolved : [resolved];
    return results.map((result) => ({
      ...result,
      redirectCount: 1,
      redirectType: 'reflect',
      redirected: true,
      redirectedByAbilityKey: context.activation.abilityKey,
      redirectedByAbilityRevision: context.activation.abilityRevision,
      reflectedFromPlayerSlot: sourcePlayer.slot,
      reflectedFromTeamSlot: sourceOling.teamSlot,
      maximumRedirects
    }));
  });
  if (reflectedResults.length) return reflectedResults;

  return createEffectResult(context, {
    status: 'no-effect',
    outcome: 'no-reflectable-effect',
    targetPlayerSlot: sourcePlayer.slot,
    targetTeamSlot: sourceOling.teamSlot,
    reflectedAbilityKey: ability.key,
    reflectedAbilityRevision: ability.revision,
    maximumRedirects
  });
}

const effectHandlers = Object.freeze({
  block_effect_category: blockEffectCategory,
  cleanse_status: cleanseStatus,
  damage_after_repeated_decisive_action: damageAfterRepeatedDecisiveAction,
  damage_every_nth_activation: damageEveryNthActivation,
  grant_overgrowth_to_self_or_tag_recipient:
    grantOvergrowthToSelfOrTagRecipient,
  grant_shield: grantShieldToSelf,
  grant_shield_to_most_damaged_ally: grantShieldToMostDamagedAlly,
  heal_every_nth_activation: healEveryNthActivation,
  heal_most_damaged_benched: healMostDamagedBenched,
  mark_part_for_positive_effect_steal: markPartForPositiveEffectSteal,
  mark_repeated_action_for_suppression: markRepeatedActionForSuppression,
  prime_status_on_next_action_win: primeStatusOnNextActionWin,
  prime_status_on_next_decisive_action_win: primeStatusOnNextActionWin,
  reclaim_draw_damage_as_blood: reclaimDrawDamageAsBlood,
  reflect_opponent_mouth_effect: reflectOpponentMouthEffect,
  replace_next_activation_with_junk: replaceNextActivationWithJunk,
  restore_most_recent_positive_status: restoreMostRecentPositiveStatus,
  suppress_part: suppressPart,
  suppress_random_part_until_different_action_win:
    suppressRandomPartUntilDifferentActionWin,
  store_and_convert_resource: storeAndConvertResource,
  transfer_hearts_between_self_and_bench: transferHeartsBetweenSelfAndBench,
  ward_chosen_part: wardChosenPart,
  ward_effect_category: wardEffectCategory
});

function consumePositiveEffectSteal(match, activation) {
  const targetPlayer = match.players.find(
    (player) => player.slot === activation.playerSlot
  );
  if (!Array.isArray(targetPlayer?.statuses)) return null;
  const currentRound = toUnitCount(match.round);
  const statusIndex = targetPlayer.statuses.findIndex((status) => {
    const definition = getStatusDefinition(match, status);
    return (
      definition?.handler === 'record_reference' &&
      status.data?.condition === 'positive-effect-steal' &&
      status.data?.sourceAbilityKey === 'trash-scavenge' &&
      toUnitCount(status.data?.checkRound) === currentRound &&
      status.data?.recordedPart === activation.part
    );
  });
  if (statusIndex < 0) return null;

  const [status] = targetPlayer.statuses.splice(statusIndex, 1);
  const sourcePlayer = match.players.find(
    (player) => player.slot === status.sourcePlayerSlot
  );
  const sourceOling = sourcePlayer?.team?.find(
    (oling) => oling.teamSlot === status.sourceTeamSlot
  );
  return {
    sourceOling:
      sourceOling &&
      !sourceOling.defeated &&
      toUnitCount(sourceOling.heartUnits) > 0
        ? sourceOling
        : null,
    sourcePlayer,
    status,
    targetPlayer
  };
}

function isPositiveEffect(effect) {
  return (
    String(effect?.target?.side || '')
      .trim()
      .toLowerCase() === 'ally'
  );
}

function resolveAbilityEffects(match, activations = [], options = {}) {
  const results = [];

  for (const activation of activations) {
    const player = match.players.find(
      (candidate) => candidate.slot === activation.playerSlot
    );
    if (!player) continue;

    const sourceOling = player.team.find(
      (oling) => oling.teamSlot === activation.teamSlot
    );
    const cadence =
      activation.cadence && sourceOling
        ? advanceAbilityCadence(
            sourceOling,
            {
              key: activation.abilityKey,
              revision: activation.abilityRevision,
              cadence: activation.cadence
            },
            { prevented: activation.prevented === true }
          )
        : null;
    if (activation.prevented) continue;

    const steal = consumePositiveEffectSteal(match, activation);

    const effects = [...(activation.effects || [])].sort(
      (left, right) => toUnitCount(left.order) - toUnitCount(right.order)
    );
    if (cadence && !cadence.triggered) {
      results.push(
        ...effects.map((effect) =>
          createEffectResult(
            { activation, effect, match, player },
            {
              status: 'progressed',
              activationThreshold: cadence.every,
              beforeActivationCount: cadence.beforeActivationCount,
              afterActivationCount: cadence.afterActivationCount,
              cadenceMode: cadence.mode,
              triggered: false
            }
          )
        )
      );
      continue;
    }
    for (const effect of effects) {
      const handler = effectHandlers[effect.handler];
      if (!handler) continue;
      const isStolen = Boolean(
        steal?.sourcePlayer && steal.sourceOling && isPositiveEffect(effect)
      );
      const resolvingPlayer = isStolen ? steal.sourcePlayer : player;
      const resolvingActivation = isStolen
        ? {
            ...activation,
            playerSlot: resolvingPlayer.slot,
            teamSlot: steal.sourceOling.teamSlot
          }
        : activation;
      const result = handler({
        activation: resolvingActivation,
        applyDamage: options.applyDamage,
        damage: options.damage || [],
        effect,
        cadence,
        match,
        player: resolvingPlayer,
        random:
          typeof options.random === 'function' ? options.random : Math.random
      });
      const resolvedResults = (Array.isArray(result) ? result : [result]).map(
        (resolvedResult) =>
          cadence
            ? {
                ...resolvedResult,
                activationThreshold: cadence.every,
                beforeActivationCount: cadence.beforeActivationCount,
                afterActivationCount: cadence.afterActivationCount,
                cadenceMode: cadence.mode,
                triggered: cadence.triggered
              }
            : resolvedResult
      );
      results.push(
        ...resolvedResults.map((resolvedResult) =>
          isStolen
            ? {
                ...resolvedResult,
                redirectCount: 1,
                redirectType: 'steal',
                redirected: true,
                redirectedByAbilityKey: steal.status.data?.sourceAbilityKey,
                redirectedByAbilityRevision:
                  steal.status.data?.sourceAbilityRevision,
                stolenFromPlayerSlot: player.slot,
                stolenFromTeamSlot: activation.teamSlot
              }
            : resolvedResult
        )
      );
    }
  }

  return results;
}

module.exports = {
  applyStatus,
  blockEffectCategory,
  captureDecisiveStatusTriggers,
  cleanseStatus,
  consumeMatchingWard,
  damageAfterRepeatedDecisiveAction,
  damageEveryNthActivation,
  expireRoundStatuses,
  evaluateRepeatedActionMarks,
  getAbilityProgress,
  getSuccessfulQueuedTagTarget,
  getMissingHeartUnits,
  getMostDamagedLivingAlly,
  getMostDamagedLivingBenchOling,
  getStatusDefinition,
  getActiveEffectBlock,
  getValidCleanseChoices,
  getValidHeartTransferChoices,
  getValidPartWardChoices,
  grantOvergrowth,
  grantShields,
  healPermanentHearts,
  markRepeatedActionForSuppression,
  markPartForPositiveEffectSteal,
  primeStatusOnNextActionWin,
  reclaimDrawDamageAsBlood,
  recordRepeatedDecisiveActionProgress,
  recordRemovedPositiveStatus,
  resolvePendingReclaims,
  reflectOpponentMouthEffect,
  replaceNextActivationWithJunk,
  restoreMostRecentPositiveStatus,
  resolveDecisiveStatusTriggers,
  resolvePrimedActionWinStatuses,
  resolveRepeatedActionSuppressions,
  storeAndConvertResource,
  suppressPart,
  suppressRandomPartUntilDifferentActionWin,
  transferHeartsBetweenSelfAndBench,
  wardEffectCategory,
  wardChosenPart,
  resolveAbilityEffects
};
