const {
  captureDecisiveStatusTriggers,
  consumeMatchingWard,
  evaluateRepeatedActionMarks,
  expireRoundStatuses,
  getStatusDefinition,
  recordRepeatedDecisiveActionProgress,
  resolveAbilityEffects,
  resolveDecisiveStatusTriggers,
  resolvePendingReclaims,
  resolvePrimedActionWinStatuses,
  resolveRepeatedActionSuppressions
} = require('./ability-effects');
const { resetUnretainedAbilityCadences } = require('./ability-cadence');
const {
  advanceTagRecharge,
  consumeTagCharge,
  hasTagCharge,
  normalizeTagState
} = require('./tag-economy');

const ACTION_LAYER = Object.freeze({
  attack: 'mouth',
  guard: 'body',
  skill: 'flight'
});

function getActiveOling(player) {
  return player.team.find((oling) => oling.teamSlot === player.activeTeamSlot);
}

function getWinnerSlot(match, left, right) {
  if (left.selection.action === right.selection.action) return null;
  const beats = match.ruleset.snapshot.actions;
  const losingAction = beats[`${left.selection.action}Beats`];
  return losingAction === right.selection.action ? left.slot : right.slot;
}

function applyRoutedDamage(oling, units, damageType, source, ruleset) {
  const route = ruleset.damage.routing[damageType] || ['hearts'];
  const layerFields = {
    overgrowth: 'overgrowthUnits',
    hearts: 'heartUnits'
  };
  let remaining = units;
  let preventedUnits = 0;
  const layers = [];

  for (const layer of route) {
    if (remaining <= 0) break;
    if (layer === 'shields') {
      const availableShields = Number(oling.shieldCount || 0);
      const capacityUnits = Math.max(
        1,
        Number(ruleset.health?.shieldCapacityUnits || 2)
      );
      const destroyedShields = Math.min(
        availableShields,
        Math.ceil(remaining / capacityUnits)
      );
      if (destroyedShields > 0) {
        const absorbedUnits = Math.min(
          remaining,
          destroyedShields * capacityUnits
        );
        oling.shieldCount = availableShields - destroyedShields;
        remaining -= absorbedUnits;
        layers.push({
          layer,
          units: absorbedUnits,
          shieldsDestroyed: destroyedShields
        });
      }
      continue;
    }
    const field = layerFields[layer];
    if (!field) continue;
    const available = Number(oling[field] || 0);
    let removable = Math.min(available, remaining);
    if (
      layer === 'hearts' &&
      ruleset.lastStand?.enabled &&
      ruleset.lastStand.preventedDamageSources?.includes(source)
    ) {
      const minimum = Number(ruleset.lastStand.minimumHeartUnits || 1);
      removable = Math.min(removable, Math.max(0, available - minimum));
      preventedUnits = remaining - removable;
    }
    oling[field] = available - removable;
    remaining -= removable;
    if (preventedUnits) remaining -= preventedUnits;
    if (removable > 0) layers.push({ layer, units: removable });
  }

  return {
    attemptedUnits: units,
    appliedUnits: units - remaining - preventedUnits,
    unabsorbedUnits: remaining,
    preventedUnits,
    preventedBy: preventedUnits ? 'last-stand' : null,
    layers
  };
}

function consumePartSuppression(match, player, active, part, ability) {
  if (!Array.isArray(active?.statuses)) return null;
  const matchingStatuses = active.statuses
    .map((status, index) => ({ status, index }))
    .filter(({ status }) => {
      const definition = getStatusDefinition(match, status);
      return (
        definition?.handler === 'prevent_next_valid_activation' &&
        status.targetPart === part
      );
    })
    .sort((left, right) => {
      const leftConditional =
        left.status.data?.consumption === 'different-action-win';
      const rightConditional =
        right.status.data?.consumption === 'different-action-win';
      return Number(leftConditional) - Number(rightConditional);
    });
  const statusIndex = matchingStatuses[0]?.index ?? -1;
  if (statusIndex < 0) return null;

  const status = active.statuses[statusIndex];
  const remainsActive = status.data?.consumption === 'different-action-win';
  if (!remainsActive) active.statuses.splice(statusIndex, 1);
  const definition = getStatusDefinition(match, status);
  return {
    playerSlot: player.slot,
    targetTeamSlot: active.teamSlot,
    statusKey: status.key,
    statusRevision: status.revision,
    statusName: definition?.name || status.key,
    handler: definition?.handler || null,
    targetPart: part,
    preventedAbilityKey: ability.key,
    preventedAbilityRevision: ability.revision,
    status: remainsActive ? 'active' : 'consumed',
    outcome: 'activation-suppressed'
  };
}

function consumeActivationReplacement(match, player, active, part, ability) {
  if (!Array.isArray(player?.statuses)) return null;
  const statusIndex = player.statuses.findIndex((status) => {
    const definition = getStatusDefinition(match, status);
    return (
      definition?.handler === 'replace_next_valid_activation_with_junk' &&
      status.data?.category === 'part-activation'
    );
  });
  if (statusIndex < 0) return null;

  const [status] = player.statuses.splice(statusIndex, 1);
  const definition = getStatusDefinition(match, status);
  const ward = consumeMatchingWard(match, active, 'part-disable', part);
  return {
    preventsActivation: !ward,
    triggeredStatus: {
      playerSlot: player.slot,
      targetTeamSlot: active.teamSlot,
      statusKey: status.key,
      statusRevision: status.revision,
      statusName: definition?.name || status.key,
      handler: definition?.handler || null,
      targetPart: part,
      preventedAbilityKey: ability.key,
      preventedAbilityRevision: ability.revision,
      status: 'consumed',
      statusResult: ward ? 'warded' : 'activation-replaced',
      outcome: ward ? 'effect-prevented' : 'activation-replaced-with-junk',
      preventedByStatusKey: ward?.statusKey || null,
      preventedByStatusRevision: ward?.statusRevision || null,
      preventedCategory: ward?.category || null,
      wardSourceAbilityKey: ward?.sourceAbilityKey || null
    }
  };
}

function clearConditionalSuppressions(match, player, active, part, outcome) {
  if (outcome !== 'win' || !Array.isArray(active?.statuses)) return [];
  const cleared = [];
  for (let index = active.statuses.length - 1; index >= 0; index -= 1) {
    const status = active.statuses[index];
    const definition = getStatusDefinition(match, status);
    if (
      definition?.handler !== 'prevent_next_valid_activation' ||
      status.data?.consumption !== 'different-action-win' ||
      status.targetPart === part
    ) {
      continue;
    }
    active.statuses.splice(index, 1);
    cleared.unshift({
      playerSlot: player.slot,
      targetTeamSlot: active.teamSlot,
      statusKey: status.key,
      statusRevision: status.revision,
      statusName: definition.name || status.key,
      handler: definition.handler,
      targetPart: status.targetPart,
      clearingPart: part,
      status: 'removed',
      outcome: 'different-action-win'
    });
  }
  return cleared;
}

function getTriggeredActivation(match, player, outcome, survived) {
  if (!survived) return { activation: null, triggeredStatuses: [] };
  const active = getActiveOling(player);
  const layer =
    outcome === 'draw' ? 'eyes' : ACTION_LAYER[player.selection.action];
  const shouldActivate = outcome === 'draw' || outcome === 'win';
  if (!shouldActivate) return { activation: null, triggeredStatuses: [] };
  const clearedStatuses = clearConditionalSuppressions(
    match,
    player,
    active,
    layer,
    outcome
  );
  const ability = active?.snapshot?.abilities?.find(
    (candidate) => candidate.layer === layer
  );
  if (!ability) {
    return { activation: null, triggeredStatuses: clearedStatuses };
  }
  const triggeredStatus = consumePartSuppression(
    match,
    player,
    active,
    layer,
    ability
  );
  const activationReplacement = triggeredStatus
    ? null
    : consumeActivationReplacement(match, player, active, layer, ability);
  const activationPrevented =
    Boolean(triggeredStatus) ||
    Boolean(activationReplacement?.preventsActivation);
  return {
    activation: {
      playerSlot: player.slot,
      teamSlot: player.activeTeamSlot,
      part: layer,
      abilityKey: ability.key,
      abilityRevision: ability.revision,
      cadence: ability.cadence,
      effects: ability.effects || [],
      prevented: activationPrevented
    },
    triggeredStatuses: [
      ...clearedStatuses,
      ...(triggeredStatus ? [triggeredStatus] : []),
      ...(activationReplacement ? [activationReplacement.triggeredStatus] : [])
    ]
  };
}

function applyQueuedTag(match, player, wasDefeated) {
  const requestedSlot = player.selection.tagTeamSlot;
  const requested = player.team.find(
    (oling) =>
      oling.teamSlot === requestedSlot &&
      oling.teamSlot !== player.activeTeamSlot &&
      !oling.defeated
  );
  const livingReplacements = player.team.filter(
    (oling) => oling.teamSlot !== player.activeTeamSlot && !oling.defeated
  );
  if (
    wasDefeated &&
    !requested &&
    !player.isAi &&
    livingReplacements.length > 1
  ) {
    return null;
  }
  const replacement = requested || livingReplacements[0];
  if (!replacement || (!wasDefeated && !requested)) return null;
  if (!wasDefeated && !hasTagCharge(player, match)) return null;
  if (!wasDefeated && !consumeTagCharge(player, match)) return null;
  const previousTeamSlot = player.activeTeamSlot;
  const outgoing = player.team.find(
    (oling) => oling.teamSlot === previousTeamSlot
  );
  resetUnretainedAbilityCadences(outgoing);
  player.activeTeamSlot = replacement.teamSlot;
  return {
    playerSlot: player.slot,
    previousTeamSlot,
    incomingTeamSlot: replacement.teamSlot,
    reason: wasDefeated ? 'defeat-replacement' : 'tag',
    tagEffectsActivate: !wasDefeated
  };
}

function resolveCoreClashRound(match, options = {}) {
  const [left, right] = match.players;
  const winnerSlot = getWinnerSlot(match, left, right);
  const isDraw = !winnerSlot;
  const damageType = isDraw
    ? match.ruleset.snapshot.damage.defaultTypes.draw
    : match.ruleset.snapshot.damage.defaultTypes.clash;
  const damageSource = isDraw ? 'draw' : 'clash';
  const damageUnits = isDraw
    ? match.ruleset.snapshot.damage.drawUnits
    : match.ruleset.snapshot.damage.decisiveUnits;
  const damage = [];
  const decisiveStatusTriggers = isDraw
    ? []
    : captureDecisiveStatusTriggers(match);
  const applyDamage = (target, units, type, source) =>
    applyRoutedDamage(target, units, type, source, match.ruleset.snapshot);

  for (const player of match.players) {
    if (!isDraw && player.slot === winnerSlot) continue;
    const active = getActiveOling(player);
    const result = applyRoutedDamage(
      active,
      damageUnits,
      damageType,
      damageSource,
      match.ruleset.snapshot
    );
    active.defeated = active.heartUnits <= 0;
    damage.push({
      playerSlot: player.slot,
      teamSlot: player.activeTeamSlot,
      ...result
    });
  }

  const activationResults = match.players.map((player) =>
    getTriggeredActivation(
      match,
      player,
      isDraw ? 'draw' : player.slot === winnerSlot ? 'win' : 'loss',
      !getActiveOling(player).defeated
    )
  );
  const activationAttempts = activationResults
    .map((result) => result.activation)
    .filter(Boolean);
  const activations = activationAttempts.filter(
    (activation) => !activation.prevented
  );
  const repeatedActions = evaluateRepeatedActionMarks(match);
  const triggeredStatuses = [
    ...activationResults.flatMap((result) => result.triggeredStatuses),
    ...repeatedActions.triggeredStatuses
  ];
  const activationEffects = resolveAbilityEffects(match, activationAttempts, {
    applyDamage,
    damage,
    random: options.random
  });
  const reclaimEffects = isDraw
    ? []
    : resolvePendingReclaims(match, winnerSlot);
  const effects = [...activationEffects, ...reclaimEffects];
  const decisiveVictoryRecords = isDraw
    ? []
    : recordRepeatedDecisiveActionProgress(match, winnerSlot);
  const primedActionStatuses = isDraw
    ? []
    : resolvePrimedActionWinStatuses(match, winnerSlot);
  const resolvedDecisiveStatuses = isDraw
    ? []
    : resolveDecisiveStatusTriggers(match, decisiveStatusTriggers, applyDamage);
  triggeredStatuses.push(...primedActionStatuses, ...resolvedDecisiveStatuses);
  triggeredStatuses.push(...expireRoundStatuses(match));
  const tagStatesBefore = new Map(
    match.players.map((player) => {
      const tagState = normalizeTagState(player, match);
      return [player.slot, tagState];
    })
  );
  const tags = match.players
    .map((player) =>
      applyQueuedTag(match, player, getActiveOling(player).defeated)
    )
    .filter(Boolean);
  const rechargeUpdates = new Map(
    match.players.map((player) => {
      const before = tagStatesBefore.get(player.slot);
      const update = advanceTagRecharge(player, match, {
        eligible: !isDraw && before?.charges < before?.maximumCharges
      });
      return [player.slot, update];
    })
  );
  const tagChargeUpdates = match.players
    .map((player) => {
      const before = tagStatesBefore.get(player.slot);
      const after = normalizeTagState(player, match);
      const rechargeUpdate = rechargeUpdates.get(player.slot);
      if (
        before?.charges === after.charges &&
        before?.rechargeProgress === after.rechargeProgress &&
        !rechargeUpdate?.restoredCharges
      ) {
        return null;
      }
      return {
        playerSlot: player.slot,
        charges: after.charges,
        rechargeProgress: after.rechargeProgress,
        maximumCharges: after.maximumCharges,
        decisiveClashesPerCharge: after.decisiveClashesPerCharge,
        restoredCharges: Number(rechargeUpdate?.restoredCharges || 0)
      };
    })
    .filter(Boolean);
  const defeatedTeams = match.players.filter((player) =>
    player.team.every((oling) => oling.defeated)
  );
  const pendingReplacementPlayerSlots = defeatedTeams.length
    ? []
    : match.players
        .filter((player) => {
          const active = getActiveOling(player);
          return (
            active?.defeated && player.team.some((oling) => !oling.defeated)
          );
        })
        .map((player) => player.slot);
  if (!defeatedTeams.length) {
    effects.push(
      ...resolveRepeatedActionSuppressions(
        match,
        repeatedActions.pendingSuppressions,
        typeof options.random === 'function' ? options.random : Math.random
      )
    );
  }
  const result = {
    round: match.round,
    actions: Object.fromEntries(
      match.players.map((player) => [player.slot, player.selection.action])
    ),
    outcome: isDraw ? 'draw' : 'decisive',
    winnerSlot,
    damageSource,
    damageType,
    damage,
    activations,
    effects,
    decisiveVictoryRecords,
    triggeredStatuses,
    tags,
    tagChargeUpdates,
    pendingReplacementPlayerSlots,
    defeatedPlayerSlots: defeatedTeams.map((player) => player.slot)
  };

  match.players.forEach((player) => {
    player.selection = null;
    player.selectionDraft = null;
  });
  if (defeatedTeams.length) {
    const winner = match.players.find(
      (player) =>
        !defeatedTeams.some((defeated) => defeated.slot === player.slot)
    );
    match.status = 'completed';
    match.phase = 'complete';
    match.endedAt = new Date();
    match.winnerAccountId = winner?.accountId || null;
    match.endReason = 'team_defeated';
  } else if (pendingReplacementPlayerSlots.length) {
    match.phase = 'replacement';
  } else {
    match.round += 1;
    match.phase = 'selection';
  }
  return result;
}

module.exports = {
  ACTION_LAYER,
  applyRoutedDamage,
  getActiveOling,
  getWinnerSlot,
  resolveCoreClashRound
};
