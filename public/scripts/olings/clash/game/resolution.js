(function (globalScope) {
  const loadFactory = (globalName, modulePath) => {
    if (typeof globalScope[globalName] === 'function') {
      return globalScope[globalName];
    }
    if (typeof require === 'function') return require(modulePath);
    throw new Error(`Missing Oling Clash resolution dependency: ${globalName}`);
  };
  const {
    actionPart,
    applyNormalDamage,
    decisiveDamageUnits,
    determineOutcome,
    drawDamageUnits,
    formatDamage,
    normalizeAction,
    winningAction
  } = loadFactory(
    'createOlingClashResolutionCore',
    './resolution/core'
  )();

  const {
    advanceAbilityCadence,
    consumePreventedCadence,
    getAbilityProgress,
    getMissingHeartUnits
  } = loadFactory(
    'createOlingClashAbilityCadence',
    './resolution/cadence'
  )();
  const {
    applyCanopy,
    applyCleanse,
    applyMend,
    applyWildGrowth,
    getValidCleanseChoices
  } = loadFactory(
    'createOlingClashMossAbilities',
    './resolution/abilities/moss'
  )({ advanceAbilityCadence, getMissingHeartUnits });

  function applyHarden(team, side, cadenceOling = team[0]) {
    const target = team[0];
    if (Number(target?.health?.heartUnits || 0) === 0) {
      return {
        abilityKey: 'stone-harden',
        appliedShieldCount: 0,
        handler: 'grant_shield',
        mechanic: 'grant-shield',
        playerSlot: side,
        requestedShieldCount: 1,
        status: 'no-target',
        targetTeamSlot: null
      };
    }

    const cadence = advanceAbilityCadence(cadenceOling, 'stone-harden', 2);
    if (!cadence.triggered) {
      return {
        abilityKey: 'stone-harden',
        activationThreshold: cadence.every,
        afterActivationCount: cadence.afterActivationCount,
        appliedShieldCount: 0,
        beforeActivationCount: cadence.beforeActivationCount,
        handler: 'grant_shield',
        mechanic: 'grant-shield',
        playerSlot: side,
        requestedShieldCount: 1,
        status: 'progressed',
        targetName: target.name,
        targetTeamSlot: 0,
        triggered: false
      };
    }

    const beforeShieldCount = Math.max(
      0,
      Math.floor(Number(target.health.shieldCount) || 0)
    );
    target.health.shieldCount = beforeShieldCount + 1;
    return {
      abilityKey: 'stone-harden',
      activationThreshold: cadence.every,
      afterActivationCount: cadence.afterActivationCount,
      appliedShieldCount: 1,
      beforeActivationCount: cadence.beforeActivationCount,
      beforeShieldCount,
      afterShieldCount: target.health.shieldCount,
      handler: 'grant_shield',
      mechanic: 'grant-shield',
      playerSlot: side,
      requestedShieldCount: 1,
      status: 'resolved',
      targetName: target.name,
      targetTeamSlot: 0,
      triggered: true
    };
  }

  function applyFortify(state, side) {
    const target = state.teams[side]?.[0];
    const ward = {
      abbreviation: 'WRD',
      category: 'bonus-damage',
      durationType: 'until-consumed',
      key: 'warded',
      name: 'Warded',
      remaining: 1,
      sourceAbilityKey: 'stone-fortify',
      type: 'positive'
    };
    const applied = applyStatusEffect(state, side, target, ward);
    return {
      abilityKey: 'stone-fortify',
      category: 'bonus-damage',
      durationType: 'until-consumed',
      handler: 'ward_effect_category',
      mechanic: 'ward',
      playerSlot: side,
      status: applied.effect ? 'resolved' : applied.result || 'no-effect',
      statusKey: 'warded',
      statusResult: applied.result,
      targetPlayerSlot: side,
      targetTeamSlot: target ? 0 : null
    };
  }

  function getValidPartWardChoices(team) {
    const target = team?.[0];
    if (!target || Number(target.health?.heartUnits || 0) === 0) return [];
    return ['mouth', 'body', 'flight', 'eyes'].map((part) => ({
      abilityTargetTeamSlot: 0,
      optionKey: part,
      targetPart: part
    }));
  }

  function applyReinforce(state, side, effectChoice) {
    const target = state.teams[side]?.[0];
    const choice = getValidPartWardChoices(state.teams[side]).find(
      (candidate) =>
        effectChoice?.abilityKey === 'stone-reinforce' &&
        effectChoice.targetTeamSlot === candidate.abilityTargetTeamSlot &&
        effectChoice.optionKey === candidate.optionKey
    );
    if (!target || !choice) {
      return {
        abilityKey: 'stone-reinforce',
        category: 'part-disable',
        handler: 'ward_chosen_part',
        mechanic: 'ward',
        optionKey: effectChoice?.optionKey || null,
        playerSlot: side,
        status: 'no-target',
        statusKey: 'warded',
        statusResult: null,
        targetPart: null,
        targetPlayerSlot: side,
        targetTeamSlot: target ? 0 : null
      };
    }
    const ward = {
      abbreviation: 'WRD',
      category: 'part-disable',
      durationType: 'until-consumed',
      key: 'warded',
      name: 'Warded',
      remaining: 1,
      sourceAbilityKey: 'stone-reinforce',
      targetPart: choice.targetPart,
      type: 'positive'
    };
    const applied = applyStatusEffect(state, side, target, ward);
    return {
      abilityKey: 'stone-reinforce',
      category: 'part-disable',
      durationType: 'until-consumed',
      handler: 'ward_chosen_part',
      mechanic: 'ward',
      optionKey: choice.optionKey,
      playerSlot: side,
      status: applied.effect ? 'resolved' : applied.result || 'no-effect',
      statusKey: 'warded',
      statusResult: applied.result,
      targetPart: choice.targetPart,
      targetPlayerSlot: side,
      targetTeamSlot: 0
    };
  }

  function cloneEffect(effect) {
    return JSON.parse(JSON.stringify(effect));
  }

  function rememberRemovedPositiveEffect(target, effect, reason) {
    if (!target || effect?.type !== 'positive') return null;
    if (!Array.isArray(target.removedPositiveEffects)) {
      target.removedPositiveEffects = [];
    }
    const entry = {
      effect: cloneEffect(effect),
      reason: String(reason || 'removed')
        .trim()
        .toLowerCase()
    };
    target.removedPositiveEffects.push(entry);
    if (target.removedPositiveEffects.length > 20) {
      target.removedPositiveEffects.splice(
        0,
        target.removedPositiveEffects.length - 20
      );
    }
    return entry;
  }

  function consumeMatchingWard(target, category, targetPart = null) {
    if (!Array.isArray(target?.effects)) return null;
    const index = target.effects.findIndex(
      (effect) =>
        effect.key === 'warded' &&
        effect.category === category &&
        (targetPart === null || effect.targetPart === targetPart)
    );
    if (index < 0) return null;
    const [effect] = target.effects.splice(index, 1);
    rememberRemovedPositiveEffect(target, effect, 'ward-consumed');
    return effect;
  }

  function applyEruption(state, side, targetSideOverride = null) {
    const source = state.teams[side]?.[0];
    const targetSide =
      targetSideOverride || (side === 'local' ? 'opponent' : 'local');
    const target = state.teams[targetSide]?.[0];
    const requestedUnits = 1;
    const progress = source
      ? getAbilityProgress(source, 'magma-eruption', 1)
      : null;
    const previousDecisiveVictoryAction =
      progress?.data?.lastDecisiveVictoryAction || null;
    const triggered = previousDecisiveVictoryAction === 'attack';
    const base = {
      abilityKey: 'magma-eruption',
      appliedUnits: 0,
      damageSource: 'bonus',
      damageType: 'normal',
      handler: 'damage_after_repeated_decisive_action',
      mechanic: 'damage',
      playerSlot: side,
      previousDecisiveVictoryAction,
      requestedUnits,
      requiredAction: 'attack',
      targetPlayerSlot: targetSide,
      targetTeamSlot: target ? 0 : null,
      triggered
    };
    if (!triggered) return { ...base, status: 'condition-not-met' };
    if (!target || Number(target.health?.heartUnits || 0) === 0) {
      return { ...base, status: 'no-target' };
    }

    const ward = consumeMatchingWard(target, 'bonus-damage');
    if (ward) {
      return {
        ...base,
        outcome: 'effect-prevented',
        preventedByStatusKey: ward.key,
        preventedByStatusName: ward.name,
        preventedCategory: ward.category,
        status: 'prevented',
        wardSourceAbilityKey: ward.sourceAbilityKey
      };
    }

    const damage = applyNormalDamage(target.health, requestedUnits);
    target.health = damage.health;
    return {
      ...base,
      ...damage,
      status: damage.appliedUnits > 0 ? 'resolved' : 'no-effect'
    };
  }

  function applyCrush(state, side, targetSideOverride = null) {
    const source = state.teams[side]?.[0];
    const targetSide =
      targetSideOverride || (side === 'local' ? 'opponent' : 'local');
    const target = state.teams[targetSide]?.[0];
    const requestedUnits = 1;
    const cadence = source
      ? advanceAbilityCadence(source, 'stone-crush', 1)
      : null;
    const activationThreshold = cadence?.every || 2;
    const beforeActivationCount = cadence?.beforeActivationCount || 0;
    const triggered = cadence?.triggered === true;
    const base = {
      abilityKey: 'stone-crush',
      activationThreshold,
      afterActivationCount: cadence?.afterActivationCount || 0,
      appliedUnits: 0,
      beforeActivationCount,
      damageSource: 'bonus',
      damageType: 'normal',
      handler: 'damage_every_nth_activation',
      mechanic: 'damage',
      playerSlot: side,
      requestedUnits,
      targetPlayerSlot: targetSide,
      targetTeamSlot: target ? 0 : null,
      triggered
    };
    if (!source || Number(source.health?.heartUnits || 0) === 0) {
      return { ...base, status: 'no-target' };
    }
    if (!triggered) return { ...base, status: 'progressed' };
    if (!target || Number(target.health?.heartUnits || 0) === 0) {
      return { ...base, status: 'no-target' };
    }

    const ward = consumeMatchingWard(target, 'bonus-damage');
    if (ward) {
      return {
        ...base,
        outcome: 'effect-prevented',
        preventedByStatusKey: ward.key,
        preventedByStatusName: ward.name,
        preventedCategory: ward.category,
        status: 'prevented',
        wardSourceAbilityKey: ward.sourceAbilityKey
      };
    }

    const damage = applyNormalDamage(target.health, requestedUnits);
    target.health = damage.health;
    return {
      ...base,
      ...damage,
      status: damage.appliedUnits > 0 ? 'resolved' : 'no-effect'
    };
  }

  function recordRepeatedDecisiveActionProgress(state, winner, winningAction) {
    if (winner !== 'local' && winner !== 'opponent') return [];
    const active = state.teams[winner]?.[0];
    if (
      !active ||
      String(active.moves?.attack || '')
        .trim()
        .toLowerCase() !== 'eruption'
    ) {
      return [];
    }
    const progress = getAbilityProgress(active, 'magma-eruption', 1);
    const previousAction = progress.data.lastDecisiveVictoryAction || null;
    progress.data = {
      ...progress.data,
      lastDecisiveVictoryAction: winningAction,
      lastDecisiveVictoryRound: getCurrentRound(state)
    };
    return [
      {
        abilityKey: 'magma-eruption',
        abilityRevision: 1,
        action: winningAction,
        playerSlot: winner,
        previousAction,
        round: getCurrentRound(state),
        teamSlot: 0
      }
    ];
  }

  function applyBloodsuck(team, side, cadenceOling = team[0]) {
    const target = team[0];
    if (Number(target?.health?.heartUnits || 0) === 0) {
      return {
        abilityKey: 'vampire-bloodsuck',
        appliedUnits: 0,
        handler: 'heal_every_nth_activation',
        mechanic: 'heal',
        playerSlot: side,
        requestedUnits: 1,
        status: 'no-target',
        targetTeamSlot: null
      };
    }

    const cadence = advanceAbilityCadence(cadenceOling, 'vampire-bloodsuck', 1);
    const activationThreshold = cadence.every;
    const beforeActivationCount = cadence.beforeActivationCount;
    const triggered = cadence.triggered;
    const beforeHeartUnits = Number(target.health.heartUnits || 0);
    target.health.heartUnits = triggered
      ? Math.min(target.health.maxHeartUnits, beforeHeartUnits + 1)
      : beforeHeartUnits;
    const appliedUnits = target.health.heartUnits - beforeHeartUnits;

    return {
      abilityKey: 'vampire-bloodsuck',
      appliedUnits,
      beforeHeartUnits,
      afterHeartUnits: target.health.heartUnits,
      maxHeartUnits: target.health.maxHeartUnits,
      handler: 'heal_every_nth_activation',
      mechanic: 'heal',
      playerSlot: side,
      requestedUnits: 1,
      status: triggered
        ? appliedUnits > 0
          ? 'resolved'
          : 'no-effect'
        : 'progressed',
      targetName: target.name,
      targetTeamSlot: 0,
      activationThreshold,
      beforeActivationCount,
      afterActivationCount: cadence.afterActivationCount,
      triggered
    };
  }

  function applyBloodBank(team, side) {
    const target = team[0];
    if (Number(target?.health?.heartUnits || 0) === 0) {
      return {
        abilityKey: 'vampire-blood-bank',
        appliedUnits: 0,
        handler: 'store_and_convert_resource',
        mechanic: 'store-resource',
        playerSlot: side,
        resource: 'blood',
        requestedResourceUnits: 1,
        status: 'no-target',
        targetTeamSlot: null
      };
    }

    const requestedResourceUnits = 1;
    const conversionThresholdUnits = 2;
    const convertedHeartUnits = 2;
    const beforeResourceUnits = Math.max(
      0,
      Math.floor(Number(target.health.bloodUnits) || 0)
    );
    const afterStoreResourceUnits =
      beforeResourceUnits + requestedResourceUnits;
    const conversionCount = Math.floor(
      afterStoreResourceUnits / conversionThresholdUnits
    );
    target.health.bloodUnits =
      afterStoreResourceUnits % conversionThresholdUnits;
    const beforeHeartUnits = Number(target.health.heartUnits || 0);
    const requestedUnits = conversionCount * convertedHeartUnits;
    target.health.heartUnits = Math.min(
      target.health.maxHeartUnits,
      beforeHeartUnits + requestedUnits
    );
    const appliedUnits = target.health.heartUnits - beforeHeartUnits;

    return {
      abilityKey: 'vampire-blood-bank',
      appliedUnits,
      beforeHeartUnits,
      afterHeartUnits: target.health.heartUnits,
      maxHeartUnits: target.health.maxHeartUnits,
      handler: 'store_and_convert_resource',
      mechanic: 'store-resource',
      playerSlot: side,
      requestedUnits,
      status:
        conversionCount === 0
          ? 'stored'
          : appliedUnits > 0
            ? 'resolved'
            : 'no-effect',
      targetName: target.name,
      targetTeamSlot: 0,
      resource: 'blood',
      requestedResourceUnits,
      storedResourceUnits: requestedResourceUnits,
      beforeResourceUnits,
      afterStoreResourceUnits,
      afterResourceUnits: target.health.bloodUnits,
      conversionThresholdUnits,
      conversionCount,
      converted: conversionCount > 0,
      convertedHeartUnits
    };
  }

  function getValidHeartTransferChoices(team, requestedUnits = 1) {
    const source = team?.[0];
    const amountUnits = Math.max(0, Math.floor(Number(requestedUnits) || 0));
    if (Number(source?.health?.heartUnits || 0) === 0 || amountUnits === 0) {
      return [];
    }

    function createChoice(optionKey, targetIndex, donor, recipient) {
      const donorAvailableUnits = Math.max(
        0,
        Number(donor.health.heartUnits || 0) - 1
      );
      const recipientCapacityUnits = Math.max(
        0,
        Number(recipient.health.maxHeartUnits || 0) -
          Number(recipient.health.heartUnits || 0)
      );
      const transferableUnits = Math.min(
        amountUnits,
        donorAvailableUnits,
        recipientCapacityUnits
      );
      return transferableUnits === amountUnits
        ? {
            abilityTargetTeamSlot: targetIndex,
            optionKey,
            donorTeamSlot: donor === source ? 0 : targetIndex,
            recipientTeamSlot: recipient === source ? 0 : targetIndex,
            transferableUnits
          }
        : null;
    }

    return team
      .map((oling, index) => ({ index, oling }))
      .filter(
        ({ index, oling }) =>
          index > 0 && Number(oling?.health?.heartUnits || 0) > 0
      )
      .flatMap(({ index, oling }) =>
        [
          createChoice('self-to-bench', index, source, oling),
          createChoice('bench-to-self', index, oling, source)
        ].filter(Boolean)
      );
  }

  function applyTransfusion(team, side, effectChoice) {
    const requestedUnits = 1;
    const choice = getValidHeartTransferChoices(team, requestedUnits).find(
      (candidate) =>
        effectChoice?.abilityKey === 'vampire-transfusion' &&
        candidate.abilityTargetTeamSlot === effectChoice.targetTeamSlot &&
        candidate.optionKey === effectChoice.optionKey
    );
    if (!choice) {
      return {
        abilityKey: 'vampire-transfusion',
        appliedUnits: 0,
        handler: 'transfer_hearts_between_self_and_bench',
        mechanic: 'transfer',
        playerSlot: side,
        requestedUnits,
        status: 'no-target',
        targetTeamSlot: effectChoice?.targetTeamSlot ?? null,
        optionKey: effectChoice?.optionKey || null
      };
    }

    const donor = team[choice.donorTeamSlot];
    const recipient = team[choice.recipientTeamSlot];
    const beforeDonorHeartUnits = donor.health.heartUnits;
    const beforeRecipientHeartUnits = recipient.health.heartUnits;
    donor.health.heartUnits -= choice.transferableUnits;
    recipient.health.heartUnits += choice.transferableUnits;
    return {
      abilityKey: 'vampire-transfusion',
      appliedUnits: choice.transferableUnits,
      handler: 'transfer_hearts_between_self_and_bench',
      mechanic: 'transfer',
      playerSlot: side,
      requestedUnits,
      status: 'resolved',
      targetName: team[choice.abilityTargetTeamSlot].name,
      targetTeamSlot: choice.abilityTargetTeamSlot,
      optionKey: choice.optionKey,
      donorTeamSlot: choice.donorTeamSlot,
      recipientTeamSlot: choice.recipientTeamSlot,
      beforeDonorHeartUnits,
      afterDonorHeartUnits: donor.health.heartUnits,
      beforeRecipientHeartUnits,
      afterRecipientHeartUnits: recipient.health.heartUnits
    };
  }

  function applyPartSuppression(
    state,
    side,
    abilityKey,
    targetPart,
    targetSideOverride = null
  ) {
    const targetSide =
      targetSideOverride || (side === 'local' ? 'opponent' : 'local');
    const target = state.teams[targetSide]?.[0];
    if (!target || Number(target.health?.heartUnits || 0) === 0) {
      return {
        abilityKey,
        handler: 'suppress_part',
        mechanic: 'suppress',
        playerSlot: side,
        status: 'no-target',
        statusKey: 'suppressed',
        statusResult: null,
        targetPart,
        targetPlayerSlot: targetSide,
        targetTeamSlot: target ? 0 : null
      };
    }

    const ward = consumeMatchingWard(target, 'part-disable', targetPart);
    if (ward) {
      return {
        abilityKey,
        handler: 'suppress_part',
        mechanic: 'suppress',
        outcome: 'effect-prevented',
        playerSlot: side,
        preventedByStatusKey: ward.key,
        preventedByStatusName: ward.name,
        preventedCategory: ward.category,
        status: 'prevented',
        statusKey: 'suppressed',
        statusResult: 'warded',
        targetPart,
        targetPlayerSlot: targetSide,
        targetTeamSlot: 0,
        wardSourceAbilityKey: ward.sourceAbilityKey
      };
    }

    if (!Array.isArray(target.effects)) target.effects = [];
    const existing = target.effects.find(
      (effect) =>
        effect.key === 'suppressed' &&
        effect.targetPart === targetPart &&
        (!effect.sourceAbilityKey || effect.sourceAbilityKey === abilityKey)
    );
    const suppressedEffect = {
      abbreviation: 'SUP',
      consumption: 'matching-activation',
      durationType: 'activation',
      key: 'suppressed',
      name: 'Suppressed',
      remaining: 1,
      sourceAbilityKey: abilityKey,
      targetPart,
      type: 'negative'
    };
    const statusResult = existing ? 'refreshed' : 'applied';
    if (existing) Object.assign(existing, suppressedEffect);
    else target.effects.push(suppressedEffect);

    return {
      abilityKey,
      durationType: 'activation',
      handler: 'suppress_part',
      mechanic: 'suppress',
      playerSlot: side,
      remaining: 1,
      status: 'resolved',
      statusKey: 'suppressed',
      statusResult,
      targetName: target.name,
      targetPart,
      targetPlayerSlot: targetSide,
      targetTeamSlot: 0
    };
  }

  function applyFracture(state, side, targetSideOverride = null) {
    return applyPartSuppression(
      state,
      side,
      'bone-fracture',
      'body',
      targetSideOverride
    );
  }

  function applyScorch(state, side) {
    return applyPartSuppression(state, side, 'magma-scorch', 'mouth');
  }

  function applySplinter(state, side, random = Math.random) {
    const targetSide = side === 'local' ? 'opponent' : 'local';
    const target = state.teams[targetSide]?.[0];
    const eligibleParts = ['mouth', 'body', 'flight', 'eyes'];
    if (!target || Number(target.health?.heartUnits || 0) === 0) {
      return {
        abilityKey: 'bone-splinter',
        handler: 'suppress_random_part_until_different_action_win',
        mechanic: 'suppress',
        playerSlot: side,
        status: 'no-target',
        statusKey: 'suppressed',
        statusResult: null,
        targetPart: null,
        targetPlayerSlot: targetSide,
        targetTeamSlot: target ? 0 : null
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
    const ward = consumeMatchingWard(target, 'part-disable', targetPart);
    if (ward) {
      return {
        abilityKey: 'bone-splinter',
        eligibleParts,
        handler: 'suppress_random_part_until_different_action_win',
        mechanic: 'suppress',
        outcome: 'effect-prevented',
        playerSlot: side,
        preventedByStatusKey: ward.key,
        preventedByStatusName: ward.name,
        preventedCategory: ward.category,
        status: 'prevented',
        statusKey: 'suppressed',
        statusResult: 'warded',
        targetPart,
        targetPlayerSlot: targetSide,
        targetTeamSlot: 0,
        wardSourceAbilityKey: ward.sourceAbilityKey
      };
    }
    if (!Array.isArray(target.effects)) target.effects = [];
    const existing = target.effects.find(
      (effect) =>
        effect.key === 'suppressed' &&
        effect.targetPart === targetPart &&
        effect.sourceAbilityKey === 'bone-splinter'
    );
    const suppressedEffect = {
      abbreviation: 'SUP',
      clearCondition: 'different-action-win',
      consumption: 'different-action-win',
      durationType: 'activation',
      key: 'suppressed',
      name: 'Suppressed',
      remaining: 1,
      sourceAbilityKey: 'bone-splinter',
      targetPart,
      type: 'negative'
    };
    const statusResult = existing ? 'refreshed' : 'applied';
    if (existing) Object.assign(existing, suppressedEffect);
    else target.effects.push(suppressedEffect);

    return {
      abilityKey: 'bone-splinter',
      clearCondition: 'different-action-win',
      durationType: 'activation',
      eligibleParts,
      handler: 'suppress_random_part_until_different_action_win',
      mechanic: 'suppress',
      playerSlot: side,
      remaining: 1,
      status: 'resolved',
      statusKey: 'suppressed',
      statusResult,
      targetName: target.name,
      targetPart,
      targetPlayerSlot: targetSide,
      targetTeamSlot: 0
    };
  }

  function getCurrentRound(state) {
    return Math.max(1, Math.floor(Number(state?.round) || 1));
  }

  function getPlayerEffects(state, side) {
    if (!state.playerEffects) {
      state.playerEffects = { local: [], opponent: [] };
    }
    if (!Array.isArray(state.playerEffects[side])) {
      state.playerEffects[side] = [];
    }
    return state.playerEffects[side];
  }

  function getActiveEffectBlock(state, side, category) {
    const currentRound = getCurrentRound(state);
    return getPlayerEffects(state, side).find(
      (effect) =>
        effect.key === 'blocked' &&
        effect.category === category &&
        currentRound >= Number(effect.activeFromRound || 0) &&
        currentRound <= Number(effect.expiresAfterRound || 0)
    );
  }

  function applyStatusEffect(state, side, target, effect) {
    if (!target || !effect) return { result: 'no-target' };
    if (
      effect.type === 'positive' &&
      getActiveEffectBlock(state, side, 'positive-status')
    ) {
      return {
        blockedByStatusKey: 'blocked',
        result: 'blocked'
      };
    }
    if (!Array.isArray(target.effects)) target.effects = [];
    const existing = target.effects.find(
      (candidate) =>
        candidate.key === effect.key &&
        (candidate.targetPart || null) === (effect.targetPart || null) &&
        (!candidate.sourceAbilityKey ||
          candidate.sourceAbilityKey === effect.sourceAbilityKey)
    );
    if (existing) {
      Object.assign(existing, effect);
      return { effect: existing, result: 'refreshed' };
    }
    target.effects.push(effect);
    return { effect, result: 'applied' };
  }

  function applyBurnPrime(state, side, options = {}) {
    const target = state.teams[side]?.[0];
    const abilityKey = options.abilityKey || 'magma-retaliate';
    const condition = options.condition || 'next-action-win';
    const durationType = options.durationType || 'activation';
    const handler = options.handler || 'prime_status_on_next_action_win';
    const primedEffect = {
      abbreviation: 'BRP',
      condition,
      durationType,
      key: 'burn-primed',
      name: 'Burn Primed',
      pendingStatusKey: 'burn',
      remaining: 1,
      requiredAction: 'attack',
      sourceAbilityKey: abilityKey,
      type: 'positive'
    };
    const applied = applyStatusEffect(state, side, target, primedEffect);
    return {
      abilityKey,
      condition,
      durationType,
      handler,
      mechanic: 'mark',
      pendingStatusKey: 'burn',
      playerSlot: side,
      primeStatusKey: 'burn-primed',
      requiredAction: 'attack',
      status: applied.effect ? 'resolved' : applied.result || 'no-effect',
      statusKey: 'burn-primed',
      statusResult: applied.result,
      targetPlayerSlot: side,
      targetTeamSlot: target ? 0 : null
    };
  }

  function applyRetaliate(state, side) {
    return applyBurnPrime(state, side);
  }

  function applyIgnite(state, side) {
    return applyBurnPrime(state, side, {
      abilityKey: 'magma-ignite',
      condition: 'next-decisive-action-win',
      durationType: 'clash',
      handler: 'prime_status_on_next_decisive_action_win'
    });
  }

  function captureBurnStatuses(state) {
    return ['local', 'opponent'].flatMap((side) => {
      const target = state.teams[side]?.[0];
      return (target?.effects || [])
        .filter((effect) => effect.key === 'burn')
        .map((effect) => ({ effect, side, target }));
    });
  }

  function resolvePrimedActionWinStatuses(state, winner, winningAction) {
    if (
      (winner !== 'local' && winner !== 'opponent') ||
      winningAction !== 'attack'
    ) {
      return [];
    }
    const source = state.teams[winner]?.[0];
    const targetSide = winner === 'local' ? 'opponent' : 'local';
    const target = state.teams[targetSide]?.[0];
    if (!Array.isArray(source?.effects)) return [];
    const resolved = [];
    for (let index = source.effects.length - 1; index >= 0; index -= 1) {
      const effect = source.effects[index];
      if (
        effect.key !== 'burn-primed' ||
        !['next-action-win', 'next-decisive-action-win'].includes(
          effect.condition
        ) ||
        effect.requiredAction !== winningAction
      ) {
        continue;
      }
      source.effects.splice(index, 1);
      rememberRemovedPositiveEffect(source, effect, 'trigger-consumed');
      const burn = {
        abbreviation: 'BRN',
        activeFromRound: getCurrentRound(state) + 1,
        durationType: 'clash',
        key: effect.pendingStatusKey || 'burn',
        name: 'Burn',
        remaining: 1,
        sourceAbilityKey: effect.sourceAbilityKey,
        type: 'negative'
      };
      const applied =
        target && Number(target.health?.heartUnits || 0) > 0
          ? applyStatusEffect(state, targetSide, target, burn)
          : { result: 'no-target' };
      resolved.unshift({
        activatesRound: getCurrentRound(state) + 1,
        appliedStatusKey: burn.key,
        appliedStatusResult: applied.result,
        handler: 'apply_status_on_matching_action_win',
        outcome: applied.effect ? 'status-applied' : 'no-target',
        playerSlot: winner,
        selectedAction: winningAction,
        status: 'consumed',
        statusKey: effect.key,
        statusName: effect.name,
        targetPlayerSlot: targetSide,
        targetTeamSlot: target ? 0 : null
      });
    }
    return resolved;
  }

  function resolveBurnStatuses(capturedStatuses) {
    return capturedStatuses.flatMap(({ effect, side, target }) => {
      const statusIndex = target?.effects?.indexOf(effect) ?? -1;
      if (statusIndex < 0) return [];
      target.effects.splice(statusIndex, 1);
      const base = {
        damageSource: 'burn',
        damageType: 'normal',
        damageUnits: 1,
        handler: 'damage_after_decisive_clash',
        playerSlot: side,
        status: 'consumed',
        statusKey: effect.key,
        statusName: effect.name,
        targetTeamSlot: 0
      };
      if (Number(target.health?.heartUnits || 0) === 0) {
        return [{ ...base, appliedUnits: 0, outcome: 'no-target' }];
      }
      const damage = applyNormalDamage(target.health, 1);
      target.health = damage.health;
      return [
        {
          ...base,
          ...damage,
          outcome: damage.appliedUnits > 0 ? 'damage-applied' : 'no-effect'
        }
      ];
    });
  }

  function applyWither(state, side) {
    const targetSide = side === 'local' ? 'opponent' : 'local';
    const effects = getPlayerEffects(state, targetSide);
    const activeFromRound = getCurrentRound(state) + 1;
    const expiresAfterRound = activeFromRound;
    const blockedEffect = {
      abbreviation: 'BLK',
      activeFromRound,
      category: 'positive-status',
      durationType: 'round',
      expiresAfterRound,
      key: 'blocked',
      name: 'Blocked',
      sourceAbilityKey: 'bone-wither',
      type: 'negative'
    };
    const existing = effects.find(
      (effect) =>
        effect.key === 'blocked' &&
        effect.sourceAbilityKey === 'bone-wither' &&
        effect.category === 'positive-status'
    );
    const statusResult = existing ? 'refreshed' : 'applied';
    if (existing) Object.assign(existing, blockedEffect);
    else effects.push(blockedEffect);

    return {
      abilityKey: 'bone-wither',
      activeFromRound,
      category: 'positive-status',
      durationType: 'round',
      expiresAfterRound,
      handler: 'block_effect_category',
      mechanic: 'block',
      playerSlot: side,
      status: 'resolved',
      statusKey: 'blocked',
      statusResult,
      targetPlayerSlot: targetSide,
      targetTeamSlot: null
    };
  }

  function applySalvage(state, side) {
    const target = state.teams[side]?.[0];
    const history = target?.removedPositiveEffects;
    if (
      !target ||
      Number(target.health?.heartUnits || 0) === 0 ||
      !Array.isArray(history)
    ) {
      return {
        abilityKey: 'trash-salvage',
        handler: 'restore_most_recent_positive_status',
        mechanic: 'restore',
        playerSlot: side,
        restoredStatusKey: null,
        status: 'no-target',
        targetPlayerSlot: side,
        targetTeamSlot: target ? 0 : null
      };
    }

    let historyIndex = -1;
    for (let index = history.length - 1; index >= 0; index -= 1) {
      if (history[index]?.effect?.type === 'positive') {
        historyIndex = index;
        break;
      }
    }
    if (historyIndex < 0) {
      return {
        abilityKey: 'trash-salvage',
        handler: 'restore_most_recent_positive_status',
        mechanic: 'restore',
        playerSlot: side,
        restoredStatusKey: null,
        status: 'no-target',
        targetPlayerSlot: side,
        targetTeamSlot: 0
      };
    }

    const historyEntry = history[historyIndex];
    const restoredEffect = cloneEffect(historyEntry.effect);
    const applied = applyStatusEffect(state, side, target, restoredEffect);
    if (applied.effect) history.splice(historyIndex, 1);
    return {
      abilityKey: 'trash-salvage',
      handler: 'restore_most_recent_positive_status',
      mechanic: 'restore',
      playerSlot: side,
      removalReason: historyEntry.reason || null,
      remainingHistoryCount: history.length,
      restoredStatusKey: restoredEffect.key,
      restoredStatusName: restoredEffect.name || restoredEffect.key,
      status: applied.effect ? 'resolved' : applied.result || 'no-effect',
      statusResult: applied.result,
      targetPlayerSlot: side,
      targetTeamSlot: 0
    };
  }

  function applyScavenge(state, side, targetSideOverride = null) {
    const targetSide =
      targetSideOverride || (side === 'local' ? 'opponent' : 'local');
    const recordedPart = state.lastUsedParts?.[targetSide] || null;
    const effects = getPlayerEffects(state, targetSide);
    const checkRound = getCurrentRound(state) + 1;
    if (!recordedPart) {
      return {
        abilityKey: 'trash-scavenge',
        checkRound,
        handler: 'mark_part_for_positive_effect_steal',
        mechanic: 'mark',
        playerSlot: side,
        recordedPart: null,
        status: 'no-target',
        statusKey: 'marked',
        targetPlayerSlot: targetSide,
        targetTeamSlot: null
      };
    }

    const markedEffect = {
      abbreviation: 'STL',
      checkRound,
      condition: 'positive-effect-steal',
      durationType: 'round',
      expiresAfterRound: checkRound,
      key: 'steal-primed',
      name: 'Steal Primed',
      recordedPart,
      sourceAbilityKey: 'trash-scavenge',
      sourceOlingId: state.teams[side]?.[0]?.id || null,
      sourcePlayerSlot: side,
      type: 'negative'
    };
    const existing = effects.find(
      (effect) =>
        effect.key === 'steal-primed' &&
        effect.sourceAbilityKey === 'trash-scavenge'
    );
    const statusResult = existing ? 'refreshed' : 'applied';
    if (existing) Object.assign(existing, markedEffect);
    else effects.push(markedEffect);

    return {
      abilityKey: 'trash-scavenge',
      checkRound,
      displayStatusKey: 'steal-primed',
      durationType: 'round',
      expiresAfterRound: checkRound,
      handler: 'mark_part_for_positive_effect_steal',
      mechanic: 'mark',
      playerSlot: side,
      recordedPart,
      status: 'resolved',
      statusKey: 'marked',
      statusResult,
      targetPlayerSlot: targetSide,
      targetTeamSlot: null
    };
  }

  function applyJunkyard(state, side) {
    const targetSide = side === 'local' ? 'opponent' : 'local';
    const effects = getPlayerEffects(state, targetSide);
    const junkEffect = {
      abbreviation: 'JNK',
      category: 'part-activation',
      consumption: 'next-valid-activation',
      durationType: 'activation',
      key: 'junk',
      name: 'Junk',
      remaining: 1,
      sourceAbilityKey: 'trash-junkyard',
      type: 'negative'
    };
    const existing = effects.find(
      (effect) =>
        effect.key === 'junk' && effect.sourceAbilityKey === 'trash-junkyard'
    );
    const statusResult = existing ? 'refreshed' : 'applied';
    if (existing) Object.assign(existing, junkEffect);
    else effects.push(junkEffect);

    return {
      abilityKey: 'trash-junkyard',
      category: 'part-activation',
      durationType: 'activation',
      handler: 'replace_next_activation_with_junk',
      mechanic: 'block',
      playerSlot: side,
      remaining: 1,
      status: 'resolved',
      statusKey: 'junk',
      statusResult,
      targetPlayerSlot: targetSide,
      targetTeamSlot: null
    };
  }

  function consumeScavengeSteal(state, side, part) {
    const effects = getPlayerEffects(state, side);
    const currentRound = getCurrentRound(state);
    const effectIndex = effects.findIndex(
      (effect) =>
        effect.key === 'steal-primed' &&
        effect.sourceAbilityKey === 'trash-scavenge' &&
        effect.condition === 'positive-effect-steal' &&
        Number(effect.checkRound) === currentRound &&
        effect.recordedPart === part
    );
    if (effectIndex < 0) return null;

    const [effect] = effects.splice(effectIndex, 1);
    const sourceSide = effect.sourcePlayerSlot;
    const sourceOling = state.teams[sourceSide]?.find(
      (oling) => oling.id === effect.sourceOlingId
    );
    return {
      effect,
      sourceSide:
        sourceOling && Number(sourceOling.health?.heartUnits || 0) > 0
          ? sourceSide
          : null
    };
  }

  function resolvePositivePreviewEffect(activationSide, steal, resolver) {
    const recipientSide = steal?.sourceSide || activationSide;
    const result = resolver(recipientSide);
    if (!steal?.sourceSide) return result;
    return {
      ...result,
      redirectCount: 1,
      redirectType: 'steal',
      redirected: true,
      redirectedByAbilityKey: steal.effect.sourceAbilityKey,
      stolenFromPlayerSlot: activationSide,
      stolenFromTeamSlot: 0
    };
  }

  function applyReturnToSender(state, side) {
    const sourceSide = side === 'local' ? 'opponent' : 'local';
    const source = state.teams[sourceSide]?.[0];
    const moveName = String(source?.moves?.attack || '')
      .trim()
      .toLowerCase();
    const base = {
      abilityKey: 'trash-return-to-sender',
      handler: 'reflect_opponent_mouth_effect',
      maximumRedirects: 1,
      mechanic: 'reflect',
      playerSlot: side,
      reflectedAbilityName: moveName || null,
      targetPlayerSlot: sourceSide,
      targetTeamSlot: source ? 0 : null
    };
    if (!source) {
      return { ...base, outcome: 'no-mouth-effect', status: 'no-target' };
    }
    if (
      (source.effects || []).some(
        (effect) => effect.key === 'suppressed' && effect.targetPart === 'mouth'
      )
    ) {
      return { ...base, outcome: 'mouth-suppressed', status: 'no-effect' };
    }

    let reflected = null;
    if (moveName === 'eruption') {
      reflected = applyEruption(state, sourceSide, sourceSide);
    } else if (moveName === 'crush') {
      reflected = applyCrush(state, sourceSide, sourceSide);
    } else if (moveName === 'fracture') {
      reflected = applyFracture(state, sourceSide, sourceSide);
    } else if (moveName === 'scavenge') {
      reflected = applyScavenge(state, sourceSide, sourceSide);
    }
    if (!reflected) {
      return {
        ...base,
        outcome: 'no-reflectable-effect',
        status: 'no-effect'
      };
    }
    return {
      ...reflected,
      redirectCount: 1,
      redirectType: 'reflect',
      redirected: true,
      redirectedByAbilityKey: 'trash-return-to-sender',
      reflectedFromPlayerSlot: sourceSide,
      reflectedFromTeamSlot: 0,
      maximumRedirects: 1
    };
  }

  function applyRead(state, side) {
    const targetSide = side === 'local' ? 'opponent' : 'local';
    const recordedAction = normalizeAction(
      targetSide === 'local'
        ? state.selections.localAction
        : state.selections.opponentAction
    );
    const effects = getPlayerEffects(state, targetSide);
    const checkRound = getCurrentRound(state) + 1;
    if (!recordedAction) {
      return {
        abilityKey: 'bone-read',
        handler: 'mark_repeated_action_for_suppression',
        mechanic: 'mark',
        playerSlot: side,
        status: 'no-target',
        statusKey: 'marked',
        targetPlayerSlot: targetSide,
        targetTeamSlot: null
      };
    }

    const markedEffect = {
      abbreviation: 'MRK',
      checkRound,
      condition: 'repeat-action-next-round',
      durationType: 'round',
      expiresAfterRound: checkRound,
      key: 'marked',
      name: 'Marked',
      recordedAction,
      sourceAbilityKey: 'bone-read',
      suppressionStatusKey: 'suppressed',
      type: 'negative'
    };
    const existing = effects.find(
      (effect) =>
        effect.key === 'marked' && effect.sourceAbilityKey === 'bone-read'
    );
    const statusResult = existing ? 'refreshed' : 'applied';
    if (existing) Object.assign(existing, markedEffect);
    else effects.push(markedEffect);

    return {
      abilityKey: 'bone-read',
      checkRound,
      durationType: 'round',
      handler: 'mark_repeated_action_for_suppression',
      mechanic: 'mark',
      playerSlot: side,
      recordedAction,
      status: 'resolved',
      statusKey: 'marked',
      statusResult,
      targetPlayerSlot: targetSide,
      targetTeamSlot: null
    };
  }

  function evaluateReadMarks(state) {
    const currentRound = getCurrentRound(state);
    if (!Array.isArray(state.pendingRoundStartEffects)) {
      state.pendingRoundStartEffects = [];
    }
    return ['local', 'opponent'].flatMap((side) => {
      const effects = getPlayerEffects(state, side);
      const triggered = [];
      for (let index = effects.length - 1; index >= 0; index -= 1) {
        const effect = effects[index];
        if (
          effect.key !== 'marked' ||
          effect.sourceAbilityKey !== 'bone-read' ||
          Number(effect.checkRound) !== currentRound
        ) {
          continue;
        }
        effects.splice(index, 1);
        const selectedAction = normalizeAction(
          side === 'local'
            ? state.selections.localAction
            : state.selections.opponentAction
        );
        const repeated = selectedAction === effect.recordedAction;
        triggered.unshift({
          handler: 'record_reference',
          outcome: repeated ? 'action-repeated' : 'action-changed',
          playerSlot: side,
          recordedAction: effect.recordedAction,
          selectedAction,
          status: 'removed',
          statusKey: effect.key,
          statusName: effect.name,
          targetTeamSlot: null
        });
        if (repeated) {
          state.pendingRoundStartEffects.unshift({
            abilityKey: 'bone-read',
            applyAtRound: currentRound + 1,
            sourcePlayerSlot: side === 'local' ? 'opponent' : 'local',
            statusKey: effect.suppressionStatusKey || 'suppressed',
            targetPlayerSlot: side
          });
        }
      }
      return triggered;
    });
  }

  function resolveRoundStartEffects(state, random = Math.random) {
    if (!Array.isArray(state.pendingRoundStartEffects)) {
      state.pendingRoundStartEffects = [];
    }
    const currentRound = getCurrentRound(state);
    const eligibleParts = ['mouth', 'body', 'flight', 'eyes'];
    const resolved = [];
    state.pendingRoundStartEffects = state.pendingRoundStartEffects.filter(
      (pending) => {
        if (Number(pending.applyAtRound) > currentRound) return true;
        const target = state.teams[pending.targetPlayerSlot]?.[0];
        if (!target || Number(target.health?.heartUnits || 0) === 0) {
          resolved.push({
            abilityKey: pending.abilityKey,
            handler: 'mark_repeated_action_for_suppression',
            mechanic: 'suppress',
            playerSlot: pending.sourcePlayerSlot,
            status: 'no-target',
            statusKey: pending.statusKey,
            targetPart: null,
            targetPlayerSlot: pending.targetPlayerSlot,
            targetTeamSlot: target ? 0 : null
          });
          return false;
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
        const ward = consumeMatchingWard(target, 'part-disable', targetPart);
        if (ward) {
          resolved.push({
            abilityKey: pending.abilityKey,
            activatesRound: currentRound,
            eligibleParts,
            handler: 'mark_repeated_action_for_suppression',
            mechanic: 'suppress',
            outcome: 'effect-prevented',
            playerSlot: pending.sourcePlayerSlot,
            preventedByStatusKey: ward.key,
            preventedByStatusName: ward.name,
            preventedCategory: ward.category,
            status: 'prevented',
            statusKey: pending.statusKey,
            statusResult: 'warded',
            targetName: target.name,
            targetPart,
            targetPlayerSlot: pending.targetPlayerSlot,
            targetTeamSlot: 0,
            wardSourceAbilityKey: ward.sourceAbilityKey
          });
          return false;
        }
        const suppressedEffect = {
          abbreviation: 'SUP',
          consumption: 'matching-activation',
          durationType: 'activation',
          key: 'suppressed',
          name: 'Suppressed',
          remaining: 1,
          sourceAbilityKey: pending.abilityKey,
          targetPart,
          type: 'negative'
        };
        const existing = (target.effects || []).find(
          (effect) =>
            effect.key === 'suppressed' &&
            effect.targetPart === targetPart &&
            effect.sourceAbilityKey === pending.abilityKey
        );
        const statusResult = existing ? 'refreshed' : 'applied';
        if (existing) Object.assign(existing, suppressedEffect);
        else {
          if (!Array.isArray(target.effects)) target.effects = [];
          target.effects.push(suppressedEffect);
        }
        resolved.push({
          abilityKey: pending.abilityKey,
          activatesRound: currentRound,
          eligibleParts,
          handler: 'mark_repeated_action_for_suppression',
          mechanic: 'suppress',
          playerSlot: pending.sourcePlayerSlot,
          status: 'resolved',
          statusKey: pending.statusKey,
          statusResult,
          targetName: target.name,
          targetPart,
          targetPlayerSlot: pending.targetPlayerSlot,
          targetTeamSlot: 0
        });
        return false;
      }
    );
    return resolved;
  }

  function expirePlayerEffects(state) {
    const currentRound = getCurrentRound(state);
    return ['local', 'opponent'].flatMap((side) => {
      const effects = getPlayerEffects(state, side);
      const expired = [];
      for (let index = effects.length - 1; index >= 0; index -= 1) {
        const effect = effects[index];
        if (
          effect.durationType !== 'round' ||
          Number(effect.expiresAfterRound) > currentRound
        ) {
          continue;
        }
        effects.splice(index, 1);
        expired.unshift({
          handler: effect.key === 'blocked' ? 'block_effect_category' : null,
          outcome: 'round-expired',
          playerSlot: side,
          status: 'removed',
          statusKey: effect.key,
          statusName: effect.name,
          targetTeamSlot: null
        });
      }
      return expired;
    });
  }

  function consumePartSuppression(oling, side, part, abilityName) {
    if (!Array.isArray(oling?.effects)) return null;
    const matchingEffects = oling.effects
      .map((effect, index) => ({ effect, index }))
      .filter(
        ({ effect }) =>
          effect.key === 'suppressed' && effect.targetPart === part
      )
      .sort(
        (left, right) =>
          Number(left.effect.consumption === 'different-action-win') -
          Number(right.effect.consumption === 'different-action-win')
      );
    const effectIndex = matchingEffects[0]?.index ?? -1;
    if (effectIndex < 0) return null;

    const effect = oling.effects[effectIndex];
    const remainsActive = effect.consumption === 'different-action-win';
    if (!remainsActive) oling.effects.splice(effectIndex, 1);
    return {
      handler: 'prevent_next_valid_activation',
      outcome: 'activation-suppressed',
      playerSlot: side,
      preventedAbilityName: abilityName,
      status: remainsActive ? 'active' : 'consumed',
      statusKey: effect.key,
      statusName: effect.name || effect.key,
      targetPart: part,
      targetTeamSlot: 0
    };
  }

  function consumeJunkActivation(state, side, active, part, abilityName) {
    const effects = getPlayerEffects(state, side);
    const effectIndex = effects.findIndex(
      (effect) => effect.key === 'junk' && effect.category === 'part-activation'
    );
    if (effectIndex < 0) return null;

    const [effect] = effects.splice(effectIndex, 1);
    const ward = consumeMatchingWard(active, 'part-disable', part);
    return {
      preventsActivation: !ward,
      triggeredStatus: {
        handler: 'replace_next_valid_activation_with_junk',
        outcome: ward ? 'effect-prevented' : 'activation-replaced-with-junk',
        playerSlot: side,
        preventedAbilityName: abilityName,
        preventedByStatusKey: ward?.key || null,
        preventedByStatusName: ward?.name || null,
        preventedCategory: ward?.category || null,
        status: 'consumed',
        statusKey: effect.key,
        statusName: effect.name,
        statusResult: ward ? 'warded' : 'activation-replaced',
        targetPart: part,
        targetTeamSlot: 0,
        wardSourceAbilityKey: ward?.sourceAbilityKey || null
      }
    };
  }

  function clearConditionalSuppressions(oling, side, part, outcome) {
    if (outcome !== 'win' || !Array.isArray(oling?.effects)) return [];
    const cleared = [];
    for (let index = oling.effects.length - 1; index >= 0; index -= 1) {
      const effect = oling.effects[index];
      if (
        effect.key !== 'suppressed' ||
        effect.consumption !== 'different-action-win' ||
        effect.targetPart === part
      ) {
        continue;
      }
      oling.effects.splice(index, 1);
      cleared.unshift({
        clearingPart: part,
        handler: 'prevent_next_valid_activation',
        outcome: 'different-action-win',
        playerSlot: side,
        status: 'removed',
        statusKey: effect.key,
        statusName: effect.name || effect.key,
        targetPart: effect.targetPart,
        targetTeamSlot: 0
      });
    }
    return cleared;
  }

  function syncBloodboundEffect(oling) {
    if (!oling) return;
    if (!Array.isArray(oling.effects)) oling.effects = [];
    oling.effects = oling.effects.filter(
      (effect) => !['bloodbound', 'reclaim'].includes(effect.key)
    );
    if (Number(oling.pendingReclaimUnits || 0) > 0) {
      oling.effects.push({
        abbreviation: 'BLD',
        key: 'bloodbound',
        name: 'Bloodbound',
        type: 'positive'
      });
    }
  }

  function applyReclaimDrawDamage(team, side, damage) {
    const target = team[0];
    const maximumUnits = 1;
    const heartDamageUnits = Math.max(
      0,
      Math.floor(Number(damage?.heartDamageUnits) || 0)
    );
    const beforePendingReclaimUnits = Math.max(
      0,
      Math.floor(Number(target?.pendingReclaimUnits) || 0)
    );
    const storedUnits = Math.min(
      heartDamageUnits,
      Math.max(0, maximumUnits - beforePendingReclaimUnits)
    );
    target.pendingReclaimUnits = beforePendingReclaimUnits + storedUnits;
    syncBloodboundEffect(target);
    return {
      abilityKey: 'vampire-reclaim',
      appliedUnits: 0,
      handler: 'reclaim_draw_damage_as_blood',
      mechanic: 'store-resource',
      playerSlot: side,
      resource: 'reclaim-blood',
      status: storedUnits > 0 ? 'stored' : 'no-effect',
      targetName: target.name,
      targetTeamSlot: 0,
      heartDamageUnits,
      maximumUnits,
      storedUnits,
      beforePendingReclaimUnits,
      afterPendingReclaimUnits: target.pendingReclaimUnits
    };
  }

  function resolvePendingReclaim(team, side, outcome) {
    const target = team[0];
    const pendingUnits = Math.max(
      0,
      Math.floor(Number(target?.pendingReclaimUnits) || 0)
    );
    if (!target || pendingUnits === 0) return null;

    const beforeHeartUnits = Number(target.health.heartUnits || 0);
    const recovered = outcome === 'win';
    target.health.heartUnits = recovered
      ? Math.min(target.health.maxHeartUnits, beforeHeartUnits + pendingUnits)
      : beforeHeartUnits;
    target.pendingReclaimUnits = 0;
    syncBloodboundEffect(target);
    const appliedUnits = target.health.heartUnits - beforeHeartUnits;
    return {
      abilityKey: 'vampire-reclaim',
      appliedUnits,
      beforeHeartUnits,
      afterHeartUnits: target.health.heartUnits,
      maxHeartUnits: target.health.maxHeartUnits,
      handler: 'resolve_reclaim_after_decisive',
      mechanic: recovered ? 'heal' : 'remove-resource',
      playerSlot: side,
      requestedUnits: pendingUnits,
      resource: 'reclaim-blood',
      status: recovered
        ? appliedUnits > 0
          ? 'resolved'
          : 'no-effect'
        : 'lost',
      targetName: target.name,
      targetTeamSlot: 0,
      outcome: recovered ? 'recovered' : 'lost',
      beforePendingReclaimUnits: pendingUnits,
      afterPendingReclaimUnits: 0
    };
  }

  function resolvePreviewEffects(
    state,
    winner,
    winningAction,
    damageBySide = {},
    suppressedSides = new Set(),
    random = Math.random
  ) {
    if (winner === 'draw') {
      return ['local', 'opponent'].flatMap((side) => {
        const active = state.teams[side][0];
        const moveName = String(active?.moves?.draw || '')
          .trim()
          .toLowerCase();
        if (suppressedSides.has(side)) {
          consumePreventedCadence(active, moveName);
          return [];
        }
        if (Number(active?.health?.heartUnits || 0) === 0) return [];
        const steal = consumeScavengeSteal(state, side, 'eyes');
        if (moveName === 'canopy') {
          return [
            resolvePositivePreviewEffect(side, steal, (recipientSide) =>
              applyCanopy(state.teams[recipientSide], recipientSide, active)
            )
          ];
        }
        if (moveName === 'harden') {
          return [
            resolvePositivePreviewEffect(side, steal, (recipientSide) =>
              applyHarden(state.teams[recipientSide], recipientSide, active)
            )
          ];
        }
        if (moveName === 'reclaim') {
          return [
            resolvePositivePreviewEffect(side, steal, (recipientSide) =>
              applyReclaimDrawDamage(
                state.teams[recipientSide],
                recipientSide,
                damageBySide[recipientSide]
              )
            )
          ];
        }
        if (moveName === 'salvage') {
          return [
            resolvePositivePreviewEffect(side, steal, (recipientSide) =>
              applySalvage(state, recipientSide)
            )
          ];
        }
        if (moveName === 'read') {
          return [applyRead(state, side)];
        }
        if (moveName === 'ignite') {
          return [applyIgnite(state, side)];
        }
        return [];
      });
    }
    if (winner !== 'local' && winner !== 'opponent') return [];
    const active = state.teams[winner][0];
    const moveName = String(active?.moves?.[winningAction] || '')
      .trim()
      .toLowerCase();
    if (suppressedSides.has(winner)) {
      consumePreventedCadence(active, moveName);
      return [];
    }
    const steal = consumeScavengeSteal(
      state,
      winner,
      actionPart[winningAction]
    );
    if (winningAction === 'attack' && moveName === 'eruption') {
      return [applyEruption(state, winner)];
    }
    if (winningAction === 'attack' && moveName === 'crush') {
      return [applyCrush(state, winner)];
    }
    if (winningAction === 'attack' && moveName === 'mend') {
      return [
        resolvePositivePreviewEffect(winner, steal, (recipientSide) =>
          applyMend(state.teams[recipientSide], recipientSide)
        )
      ];
    }
    if (winningAction === 'attack' && moveName === 'bloodsuck') {
      return [
        resolvePositivePreviewEffect(winner, steal, (recipientSide) =>
          applyBloodsuck(state.teams[recipientSide], recipientSide, active)
        )
      ];
    }
    if (winningAction === 'attack' && moveName === 'scavenge') {
      return [applyScavenge(state, winner)];
    }
    if (winningAction === 'attack' && moveName === 'fracture') {
      return [applyFracture(state, winner)];
    }
    if (winningAction === 'guard' && moveName === 'blood bank') {
      return [
        resolvePositivePreviewEffect(winner, steal, (recipientSide) =>
          applyBloodBank(state.teams[recipientSide], recipientSide)
        )
      ];
    }
    if (winningAction === 'guard' && moveName === 'return to sender') {
      return [applyReturnToSender(state, winner)];
    }
    if (winningAction === 'guard' && moveName === 'cleanse') {
      const effectChoice =
        winner === 'local'
          ? state.selections.localEffectChoice
          : state.selections.opponentEffectChoice;
      return [
        resolvePositivePreviewEffect(winner, steal, (recipientSide) =>
          applyCleanse(state.teams[recipientSide], recipientSide, effectChoice)
        )
      ];
    }
    if (winningAction === 'guard' && moveName === 'splinter') {
      return [applySplinter(state, winner, random)];
    }
    if (winningAction === 'guard' && moveName === 'retaliate') {
      return [
        resolvePositivePreviewEffect(winner, steal, (recipientSide) =>
          applyRetaliate(state, recipientSide)
        )
      ];
    }
    if (winningAction === 'guard' && moveName === 'fortify') {
      return [
        resolvePositivePreviewEffect(winner, steal, (recipientSide) =>
          applyFortify(state, recipientSide)
        )
      ];
    }
    if (winningAction === 'skill' && moveName === 'wild growth') {
      const queuedTagSlot =
        winner === 'local' ? state.selections.localTagSlot : null;
      return [
        resolvePositivePreviewEffect(winner, steal, (recipientSide) =>
          applyWildGrowth(
            state.teams[recipientSide],
            recipientSide,
            queuedTagSlot
          )
        )
      ];
    }
    if (winningAction === 'skill' && moveName === 'transfusion') {
      const effectChoice =
        winner === 'local'
          ? state.selections.localEffectChoice
          : state.selections.opponentEffectChoice;
      return [
        resolvePositivePreviewEffect(winner, steal, (recipientSide) =>
          applyTransfusion(
            state.teams[recipientSide],
            recipientSide,
            effectChoice
          )
        )
      ];
    }
    if (winningAction === 'skill' && moveName === 'reinforce') {
      const effectChoice =
        winner === 'local'
          ? state.selections.localEffectChoice
          : state.selections.opponentEffectChoice;
      return [
        resolvePositivePreviewEffect(winner, steal, (recipientSide) =>
          applyReinforce(state, recipientSide, effectChoice)
        )
      ];
    }
    if (winningAction === 'skill' && moveName === 'junkyard') {
      return [applyJunkyard(state, winner)];
    }
    if (winningAction === 'skill' && moveName === 'wither') {
      return [applyWither(state, winner)];
    }
    if (winningAction === 'skill' && moveName === 'scorch') {
      return [applyScorch(state, winner)];
    }
    return [];
  }

  function resolveClash(state, options = {}) {
    const localAction = normalizeAction(state.selections.localAction);
    const opponentAction = normalizeAction(state.selections.opponentAction);
    const winner = determineOutcome(localAction, opponentAction);
    if (!winner) return null;
    const abilityEffectsEnabled = options.abilityEffects !== false;
    const capturedBurnStatuses =
      !abilityEffectsEnabled || winner === 'draw'
        ? []
        : captureBurnStatuses(state);

    const localOling = state.teams.local[0];
    const opponentOling = state.teams.opponent[0];
    let localDamage = null;
    let opponentDamage = null;

    if (winner === 'draw') {
      localDamage = applyNormalDamage(localOling.health, drawDamageUnits, {
        isDraw: true
      });
      opponentDamage = applyNormalDamage(
        opponentOling.health,
        drawDamageUnits,
        { isDraw: true }
      );
      localOling.health = localDamage.health;
      opponentOling.health = opponentDamage.health;
    } else {
      const loser = winner === 'local' ? opponentOling : localOling;
      const damage = applyNormalDamage(loser.health, decisiveDamageUnits);
      loser.health = damage.health;
      if (winner === 'local') opponentDamage = damage;
      else localDamage = damage;
    }

    const winningMove = winner === 'local' ? localAction : opponentAction;
    const actionParts = { attack: 'mouth', guard: 'body', skill: 'flight' };
    const activationSides = abilityEffectsEnabled
      ? winner === 'draw'
        ? ['local', 'opponent']
        : [winner]
      : [];
    const triggeredStatuses = activationSides.flatMap((side) => {
      const active = state.teams[side][0];
      if (Number(active?.health?.heartUnits || 0) === 0) return [];
      const action =
        winner === 'draw'
          ? 'draw'
          : side === 'local'
            ? localAction
            : opponentAction;
      const part = action === 'draw' ? 'eyes' : actionParts[action];
      const abilityName = active?.moves?.[action];
      const outcome = winner === 'draw' ? 'draw' : 'win';
      const cleared = clearConditionalSuppressions(active, side, part, outcome);
      const triggered = consumePartSuppression(active, side, part, abilityName);
      const junk = triggered
        ? null
        : consumeJunkActivation(state, side, active, part, abilityName);
      return [
        ...cleared,
        ...(triggered ? [triggered] : []),
        ...(junk ? [junk.triggeredStatus] : [])
      ];
    });
    const suppressedSides = new Set(
      triggeredStatuses
        .filter((status) =>
          ['activation-suppressed', 'activation-replaced-with-junk'].includes(
            status.outcome
          )
        )
        .map((status) => status.playerSlot)
    );
    if (abilityEffectsEnabled) {
      triggeredStatuses.push(...evaluateReadMarks(state));
    }
    const effects = abilityEffectsEnabled
      ? resolvePreviewEffects(
          state,
          winner,
          winningMove,
          {
            local: localDamage,
            opponent: opponentDamage
          },
          suppressedSides,
          options.random
        )
      : [];
    if (abilityEffectsEnabled && winner !== 'draw') {
      ['local', 'opponent'].forEach((side) => {
        const reclaim = resolvePendingReclaim(
          state.teams[side],
          side,
          side === winner ? 'win' : 'loss'
        );
        if (reclaim) effects.push(reclaim);
      });
    }
    const decisiveVictoryRecords = abilityEffectsEnabled
      ? recordRepeatedDecisiveActionProgress(state, winner, winningMove)
      : [];
    if (abilityEffectsEnabled && winner !== 'draw') {
      triggeredStatuses.push(
        ...resolvePrimedActionWinStatuses(state, winner, winningMove),
        ...resolveBurnStatuses(capturedBurnStatuses)
      );
    }
    if (abilityEffectsEnabled) {
      triggeredStatuses.push(...expirePlayerEffects(state));
    }
    const lastStandNames = [];
    if (localDamage?.lastStand) lastStandNames.push(localOling.name);
    if (opponentDamage?.lastStand) lastStandNames.push(opponentOling.name);

    const getActivationStatus = (side) => {
      if (winner !== 'draw' && winner !== side) return 'failed';
      const activationStatus = triggeredStatuses.find(
        (status) =>
          status?.playerSlot === side &&
          ['activation-suppressed', 'activation-replaced-with-junk'].includes(
            status.outcome
          )
      );
      if (activationStatus?.outcome === 'activation-suppressed') {
        return 'suppressed';
      }
      if (activationStatus) return 'blocked';
      const active = state.teams[side]?.[0];
      const action = winner === 'draw' ? 'draw' : winningMove;
      const abilitySlug = String(active?.moves?.[action] || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');
      const matchesAbility = (effect) =>
        [effect?.abilityKey, effect?.redirectedByAbilityKey]
          .filter(Boolean)
          .some(
            (abilityKey) =>
              abilityKey === abilitySlug ||
              abilityKey.endsWith(`-${abilitySlug}`)
          );
      const sideEffects = effects.filter(
        (effect) =>
          (effect?.playerSlot === side ||
            effect?.stolenFromPlayerSlot === side) &&
          matchesAbility(effect)
      );
      if (
        sideEffects.length > 0 &&
        sideEffects.every(
          (effect) =>
            effect.outcome === 'effect-prevented' ||
            effect.status === 'prevented' ||
            ['blocked', 'warded'].includes(effect.statusResult)
        )
      ) {
        return 'blocked';
      }
      if (
        sideEffects.length > 0 &&
        sideEffects.every(
          (effect) =>
            effect.status === 'progressed' && effect.triggered === false
        )
      ) {
        return 'progressed';
      }
      const inactiveStatuses = new Set([
        'condition-not-met',
        'no-effect',
        'no-target',
        'prevented',
        'progressed'
      ]);
      return sideEffects.some(
        (effect) =>
          effect?.triggered !== false &&
          !inactiveStatuses.has(effect?.status) &&
          effect?.outcome !== 'effect-prevented' &&
          !['blocked', 'warded'].includes(effect?.statusResult)
      )
        ? 'activated'
        : 'revealed';
    };
    const activationStatus = {
      local: getActivationStatus('local'),
      opponent: getActivationStatus('opponent')
    };
    const resolvedRound = Math.max(1, Number(state.round || 1));

    const result = {
      activationStatus,
      detail:
        winner === 'draw'
          ? lastStandNames.length > 0
            ? `${lastStandNames.join(' + ')} LAST STAND`
            : `BOTH TAKE ${formatDamage(drawDamageUnits)}`
          : `${winner === 'local' ? opponentOling.name : localOling.name} TAKES ${formatDamage(decisiveDamageUnits)} DAMAGE`,
      label: winner === 'draw' ? 'DRAW' : `${winningMove.toUpperCase()} WINS`,
      decisiveVictoryRecords,
      effects,
      localAction,
      localDamage,
      lastAbilityTeamSlots: {
        local: Number(localOling.teamSlot ?? 0),
        opponent: Number(opponentOling.teamSlot ?? 0)
      },
      opponentAction,
      opponentDamage,
      round: resolvedRound,
      triggeredStatuses,
      winner
    };

    state.lastOutcome = result.label;
    state.lastResult = result;
    localOling.lastMove = {
      action: winner === 'draw' ? 'draw' : localAction,
      activationStatus: activationStatus.local,
      outcome: winner === 'draw' ? 'draw' : winner === 'local' ? 'win' : 'loss',
      round: resolvedRound
    };
    opponentOling.lastMove = {
      action: winner === 'draw' ? 'draw' : opponentAction,
      activationStatus: activationStatus.opponent,
      outcome:
        winner === 'draw' ? 'draw' : winner === 'opponent' ? 'win' : 'loss',
      round: resolvedRound
    };
    state.lastUsedParts = {
      local: actionPart[localAction],
      opponent: actionPart[opponentAction]
    };
    return result;
  }

  function createOlingClashResolution() {
    return {
      applyBloodBank,
      applyBloodsuck,
      applyCanopy,
      applyCleanse,
      applyCrush,
      applyEruption,
      applyFortify,
      applyFracture,
      applyHarden,
      applyIgnite,
      applyJunkyard,
      applyMend,
      applyNormalDamage,
      applyRead,
      applyRetaliate,
      applyReinforce,
      applyReturnToSender,
      applySalvage,
      applyScavenge,
      applyScorch,
      applyReclaimDrawDamage,
      applySplinter,
      applyStatusEffect,
      applyTransfusion,
      applyWither,
      applyWildGrowth,
      applyBurnPrime,
      applyPartSuppression,
      consumePartSuppression,
      consumeMatchingWard,
      consumeJunkActivation,
      clearConditionalSuppressions,
      captureBurnStatuses,
      decisiveDamageUnits,
      determineOutcome,
      drawDamageUnits,
      expirePlayerEffects,
      evaluateReadMarks,
      getActiveEffectBlock,
      getValidCleanseChoices,
      getValidHeartTransferChoices,
      getValidPartWardChoices,
      normalizeAction,
      recordRepeatedDecisiveActionProgress,
      rememberRemovedPositiveEffect,
      resolvePendingReclaim,
      resolveBurnStatuses,
      resolveClash,
      resolvePrimedActionWinStatuses,
      resolveRoundStartEffects,
      syncBloodboundEffect,
      winningAction
    };
  }

  globalScope.createOlingClashResolution = createOlingClashResolution;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createOlingClashResolution;
  }
})(typeof window !== 'undefined' ? window : globalThis);
