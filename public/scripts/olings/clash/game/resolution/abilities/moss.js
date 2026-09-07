(function (globalScope) {
  function createMossAbilities({
    advanceAbilityCadence,
    getMissingHeartUnits
  }) {
    function applyMend(team, side) {
      const target = team
        .map((oling, index) => ({ index, oling }))
        .filter(
          ({ index, oling }) =>
            index > 0 &&
            Number(oling.health.heartUnits || 0) > 0 &&
            getMissingHeartUnits(oling) > 0
        )
        .sort((left, right) => {
          const damageDifference =
            getMissingHeartUnits(right.oling) -
            getMissingHeartUnits(left.oling);
          return damageDifference || left.index - right.index;
        })[0];
      if (!target) {
        return {
          abilityKey: 'moss-mend',
          appliedUnits: 0,
          handler: 'heal_most_damaged_benched',
          mechanic: 'heal',
          playerSlot: side,
          requestedUnits: 1,
          status: 'no-target',
          targetTeamSlot: null
        };
      }
      const beforeHeartUnits = target.oling.health.heartUnits;
      target.oling.health.heartUnits = Math.min(
        target.oling.health.maxHeartUnits,
        beforeHeartUnits + 1
      );
      return {
        abilityKey: 'moss-mend',
        appliedUnits: target.oling.health.heartUnits - beforeHeartUnits,
        beforeHeartUnits,
        afterHeartUnits: target.oling.health.heartUnits,
        handler: 'heal_most_damaged_benched',
        mechanic: 'heal',
        playerSlot: side,
        requestedUnits: 1,
        status: 'resolved',
        targetName: target.oling.name,
        targetTeamSlot: target.index
      };
    }

    function applyWildGrowth(team, side, queuedTagSlot) {
      const normalizedTagSlot = Number(queuedTagSlot);
      const tagRecipient =
        Number.isInteger(normalizedTagSlot) &&
        normalizedTagSlot > 0 &&
        Number(team[normalizedTagSlot]?.health?.heartUnits || 0) > 0
          ? team[normalizedTagSlot]
          : null;
      const target = tagRecipient || team[0];
      const targetTeamSlot = tagRecipient ? normalizedTagSlot : 0;
      const beforeOvergrowthUnits = Number(
        target?.health?.overgrowthUnits || 0
      );
      target.health.overgrowthUnits = beforeOvergrowthUnits + 1;
      return {
        abilityKey: 'moss-wild-growth',
        appliedUnits: 1,
        beforeOvergrowthUnits,
        afterOvergrowthUnits: target.health.overgrowthUnits,
        handler: 'grant_overgrowth_to_self_or_tag_recipient',
        mechanic: 'grant-overgrowth',
        playerSlot: side,
        requestedUnits: 1,
        status: 'resolved',
        targetName: target.name,
        targetReason: tagRecipient ? 'tag-recipient' : 'self',
        targetTeamSlot
      };
    }

    function applyCanopy(team, side, cadenceOling = team[0]) {
      const cadence = advanceAbilityCadence(cadenceOling, 'moss-canopy', 2);
      if (!cadence.triggered) {
        return {
          abilityKey: 'moss-canopy',
          activationThreshold: cadence.every,
          afterActivationCount: cadence.afterActivationCount,
          appliedShieldCount: 0,
          beforeActivationCount: cadence.beforeActivationCount,
          handler: 'grant_shield_to_most_damaged_ally',
          mechanic: 'grant-shield',
          playerSlot: side,
          requestedShieldCount: 1,
          status: 'progressed',
          targetTeamSlot: null,
          triggered: false
        };
      }
      const target = team
        .map((oling, index) => ({ index, oling }))
        .filter(({ oling }) => Number(oling?.health?.heartUnits || 0) > 0)
        .sort((left, right) => {
          const damageDifference =
            getMissingHeartUnits(right.oling) -
            getMissingHeartUnits(left.oling);
          return damageDifference || left.index - right.index;
        })[0];
      if (!target) {
        return {
          abilityKey: 'moss-canopy',
          appliedShieldCount: 0,
          handler: 'grant_shield_to_most_damaged_ally',
          mechanic: 'grant-shield',
          playerSlot: side,
          requestedShieldCount: 1,
          status: 'no-target',
          targetTeamSlot: null
        };
      }
      const beforeShieldCount = Math.max(
        0,
        Math.floor(Number(target.oling.health.shieldCount) || 0)
      );
      target.oling.health.shieldCount = beforeShieldCount + 1;
      return {
        abilityKey: 'moss-canopy',
        activationThreshold: cadence.every,
        afterActivationCount: cadence.afterActivationCount,
        appliedShieldCount: 1,
        beforeActivationCount: cadence.beforeActivationCount,
        beforeShieldCount,
        afterShieldCount: target.oling.health.shieldCount,
        handler: 'grant_shield_to_most_damaged_ally',
        mechanic: 'grant-shield',
        playerSlot: side,
        requestedShieldCount: 1,
        status: 'resolved',
        targetName: target.oling.name,
        targetTeamSlot: target.index,
        triggered: true
      };
    }

    function getValidCleanseChoices(team) {
      return (team || []).flatMap((oling, index) => {
        if (Number(oling?.health?.heartUnits || 0) === 0) return [];
        const eligibleEffects = (oling.effects || [])
          .map((effect, effectIndex) => ({
            effect,
            effectIndex,
            signature: [
              effect.key,
              effect.targetPart || '',
              effect.sourceAbilityKey || ''
            ].join(':')
          }))
          .filter(({ effect }) => effect.type === 'negative');
        const distinctEffects = [
          ...new Map(
            eligibleEffects.map((entry) => [entry.signature, entry])
          ).values()
        ];
        return distinctEffects.map(({ effect, effectIndex }) => {
          const variants = distinctEffects.filter(
            (entry) => entry.effect.key === effect.key
          );
          const hasVariants = variants.length > 1;
          const optionKey = hasVariants
            ? [
                effect.key,
                effect.targetPart || 'any',
                effect.sourceAbilityKey || effectIndex
              ]
                .join(':')
                .toLowerCase()
            : effect.key;
          const qualifiers = hasVariants
            ? [effect.targetPart, effect.sourceAbilityKey]
                .filter(Boolean)
                .map((value) => String(value).replace(/^bone-/, ''))
            : [];
          return {
            abilityTargetTeamSlot: index,
            effectIndex,
            optionKey,
            statusKey: effect.key,
            statusName: `${effect.name || effect.key}${
              qualifiers.length ? ` (${qualifiers.join(', ')})` : ''
            }`
          };
        });
      });
    }

    function applyCleanse(team, side, effectChoice) {
      const choice = getValidCleanseChoices(team).find(
        (candidate) =>
          effectChoice?.abilityKey === 'moss-cleanse' &&
          candidate.abilityTargetTeamSlot === effectChoice.targetTeamSlot &&
          candidate.optionKey === effectChoice.optionKey
      );
      if (!choice) {
        return {
          abilityKey: 'moss-cleanse',
          handler: 'cleanse_status',
          mechanic: 'cleanse',
          playerSlot: side,
          polarity: 'negative',
          requestedCount: 1,
          removedCount: 0,
          status: 'no-target',
          targetTeamSlot: effectChoice?.targetTeamSlot ?? null,
          optionKey: effectChoice?.optionKey || null
        };
      }
      const target = team[choice.abilityTargetTeamSlot];
      const selectedEffect = target.effects[choice.effectIndex];
      const effectIndex =
        selectedEffect?.key === choice.statusKey &&
        selectedEffect.type === 'negative'
          ? choice.effectIndex
          : -1;
      const [removedEffect] = target.effects.splice(effectIndex, 1);
      return {
        abilityKey: 'moss-cleanse',
        handler: 'cleanse_status',
        mechanic: 'cleanse',
        playerSlot: side,
        polarity: 'negative',
        requestedCount: 1,
        removedCount: 1,
        status: 'resolved',
        targetName: target.name,
        targetTeamSlot: choice.abilityTargetTeamSlot,
        optionKey: choice.optionKey,
        removedStatusKey: removedEffect.key,
        removedStatusName: removedEffect.name,
        remainingStatusCount: target.effects.length
      };
    }

    return {
      applyCanopy,
      applyCleanse,
      applyMend,
      applyWildGrowth,
      getValidCleanseChoices
    };
  }

  globalScope.createOlingClashMossAbilities = createMossAbilities;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createMossAbilities;
  }
})(typeof window !== 'undefined' ? window : globalThis);
