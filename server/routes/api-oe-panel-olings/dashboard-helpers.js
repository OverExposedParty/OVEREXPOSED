function createOePanelOlingDashboardHelpers(context, payloadHelpers) {
  const { OlingBuildSet } = context.models || {};
  const {
    OE_PANEL_OLING_LAYERS,
    OE_PANEL_OLING_RARITIES,
    formatOePanelJson,
    getOePanelRollableRarityOdds,
    getOePanelSetRarities,
    getOePanelSetDerivedPools
  } = payloadHelpers;

  with (context) {
    async function upsertOePanelBuildSets(buildSets = [], collection = 'base') {
      if (!Array.isArray(buildSets) || !buildSets.length) return [];

      const imported = [];
      for (const set of buildSets) {
        const importedSet = await OlingBuildSet.findOneAndUpdate(
          { key: set.key },
          {
            $set: {
              ...set,
              collection,
              status: set.status || 'published',
              enabled: set.enabled !== false
            }
          },
          { new: true, runValidators: true, upsert: true }
        );
        imported.push(importedSet);
      }

      return imported;
    }

    function serializeOePanelBuildSet(set, egg = null) {
      const assignedEgg = egg || {};

      return {
        egg: assignedEgg.name || assignedEgg.key || '-',
        eggKey: assignedEgg.key || '-',
        setKey: set.key,
        name: set.name,
        rarity: set.rarity,
        galleryStatus: `${set.rarity || '-'} / ${
          assignedEgg.name || assignedEgg.key || 'Unassigned'
        }`,
        preview:
          set.assets?.image ||
          set.metadata?.image ||
          OE_PANEL_OLING_LAYERS.map(
            (layer) => set.metadata?.layers?.[layer]
          ).filter(Boolean),
        theme: set.key,
        body: set.traits?.body || '-',
        eyes: set.traits?.eyes || '-',
        mouth: set.traits?.mouth || '-',
        flight: set.traits?.flight || '-',
        traitSummary: OE_PANEL_OLING_LAYERS.map(
          (layer) => set.traits?.[layer] || '-'
        ).join(', '),
        metadataJson: formatOePanelJson(set.metadata)
      };
    }

    function serializeOePanelOlingEgg(egg, hatchCounts = {}) {
      const opened = Number(hatchCounts[egg.key] || 0);
      return {
        key: egg.key,
        name: egg.name,
        collection: egg.collection,
        status: egg.status,
        enabled: egg.enabled ? 'Yes' : 'No',
        opened: String(opened),
        assignedSets: (egg.setKeys || []).join(', '),
        setRarities: getOePanelSetRarities(egg).join(', '),
        rarityOddsJson: formatOePanelJson(egg.rarityOdds),
        poolsJson: formatOePanelJson(getOePanelSetDerivedPools(egg)),
        setsJson: JSON.stringify(egg.sets || [], null, 2),
        personalityPool: Array.isArray(egg.personalityPool)
          ? egg.personalityPool.join(', ')
          : '',
        assetsJson: formatOePanelJson(egg.assets),
        metadataJson: formatOePanelJson(egg.metadata),
        createdAt: formatOePanelDateTime(egg.createdAt),
        updatedAt: formatOePanelDateTime(egg.updatedAt)
      };
    }

    function serializeOePanelOlingTrait(trait) {
      return {
        key: trait.key,
        name: trait.name,
        collection: trait.collection,
        theme: trait.theme,
        layer: trait.layer,
        rarity: trait.rarity,
        status: trait.status,
        enabled: trait.enabled ? 'Yes' : 'No',
        bodyStatsJson: formatOePanelJson(trait.body),
        attackJson: formatOePanelJson(trait.attack),
        modifiersJson: formatOePanelJson(trait.modifiers),
        passiveJson: formatOePanelJson(trait.passive),
        assetsJson: formatOePanelJson(trait.assets),
        flavor: trait.flavor || '-'
      };
    }

    function serializeOePanelBuildSets(eggs = [], buildSets = []) {
      const assignedEggsBySetKey = new Map();
      eggs.forEach((egg) => {
        (egg.setKeys || []).forEach((setKey) => {
          assignedEggsBySetKey.set(setKey, egg);
        });
      });

      const serializedAssignedSets = eggs.flatMap((egg) =>
        (egg.sets || []).map((set) => serializeOePanelBuildSet(set, egg))
      );
      const assignedSetKeys = new Set(
        serializedAssignedSets.map((set) => set.setKey)
      );
      const serializedUnassignedSets = buildSets
        .filter((set) => !assignedSetKeys.has(set.key))
        .map((set) =>
          serializeOePanelBuildSet(set, assignedEggsBySetKey.get(set.key))
        );

      return [...serializedAssignedSets, ...serializedUnassignedSets];
    }

    function getOePanelOlingWarnings({ eggs, traits, personalities }) {
      const warnings = [];
      const traitsByKey = new Map(traits.map((trait) => [trait.key, trait]));
      const personalityKeys = new Set(
        personalities.map((personality) => personality.key)
      );

      eggs.forEach((egg) => {
        const setRarities = getOePanelSetRarities(egg);
        const derivedPools = getOePanelSetDerivedPools(egg);
        const rollableOdds = getOePanelRollableRarityOdds(egg);

        if (egg.status === 'published' && !egg.enabled) {
          warnings.push({
            severity: 'warning',
            area: 'Egg',
            item: egg.key,
            issue: 'Published egg is inactive.',
            detail: 'Players cannot hatch this egg while it is inactive.',
            fix: 'Enable the egg or move it back to draft.'
          });
        }

        if (!Object.values(rollableOdds).some((weight) => Number(weight) > 0)) {
          warnings.push({
            severity: 'high',
            area: 'Egg',
            item: egg.key,
            issue: 'No assigned set rarity has enabled odds.',
            detail:
              "The hatch roller only uses rarities from this egg's assigned sets.",
            fix: 'Assign at least one set with a rarity that has odds above 0.'
          });
        }

        OE_PANEL_OLING_RARITIES.forEach((rarity) => {
          const odds = Number(egg.rarityOdds?.[rarity]) || 0;
          if (odds > 0 && !setRarities.includes(rarity)) {
            warnings.push({
              severity: 'info',
              area: 'Egg Odds',
              item: `${egg.key} / ${rarity}`,
              issue: 'Rarity odds are ignored.',
              detail: 'No assigned set uses this rarity, so it cannot roll.',
              fix: 'Assign a set with this rarity or set the odds value to 0.'
            });
          }
        });

        OE_PANEL_OLING_LAYERS.forEach((layer) => {
          setRarities.forEach((rarity) => {
            const odds = Number(rollableOdds[rarity]) || 0;
            const pool = derivedPools?.[layer]?.[rarity] || [];
            if (odds > 0 && !pool.length) {
              warnings.push({
                severity: 'high',
                area: 'Layer Pool',
                item: `${egg.key} / ${layer} / ${rarity}`,
                issue: 'Rarity can roll but the layer pool is empty.',
                detail: 'A hatch can fail if this rarity is rolled.',
                fix: 'Add traits to this pool or set this rarity odds value to 0.'
              });
            }

            pool.forEach((traitKey) => {
              const trait = traitsByKey.get(traitKey);
              if (!trait) {
                warnings.push({
                  severity: 'high',
                  area: 'Layer Pool',
                  item: `${egg.key} / ${layer}`,
                  issue: `Missing trait "${traitKey}".`,
                  detail: 'The egg references a trait that does not exist.',
                  fix: 'Create the trait or remove it from the pool.'
                });
                return;
              }
              if (trait.layer !== layer || trait.rarity !== rarity) {
                warnings.push({
                  severity: 'warning',
                  area: 'Layer Pool',
                  item: traitKey,
                  issue: 'Trait layer or rarity does not match its pool.',
                  detail: `${trait.layer}/${trait.rarity} is placed in ${layer}/${rarity}.`,
                  fix: 'Move the trait to the matching pool or edit the trait.'
                });
              }
              if (!trait.enabled || trait.status !== 'published') {
                warnings.push({
                  severity: 'warning',
                  area: 'Layer Pool',
                  item: traitKey,
                  issue: 'Pool contains an unavailable trait.',
                  detail: 'Public hatching requires enabled, published traits.',
                  fix: 'Publish and enable the trait or remove it from the pool.'
                });
              }
            });
          });
        });

        (egg.sets || []).forEach((set) => {
          OE_PANEL_OLING_LAYERS.forEach((layer) => {
            const traitKey = set.traits?.[layer];
            if (!traitsByKey.has(traitKey)) {
              warnings.push({
                severity: 'warning',
                area: 'Build Set',
                item: `${egg.key} / ${set.key}`,
                issue: `Set references missing ${layer} trait.`,
                detail: traitKey || 'No trait key set.',
                fix: 'Update the build set JSON for this egg.'
              });
            }
          });
        });

        (egg.personalityPool || []).forEach((personalityKey) => {
          if (!personalityKeys.has(personalityKey)) {
            warnings.push({
              severity: 'warning',
              area: 'Personality Pool',
              item: egg.key,
              issue: `Missing personality "${personalityKey}".`,
              detail: 'This personality cannot be selected during hatching.',
              fix: 'Create the personality or remove it from the pool.'
            });
          }
        });
      });

      return warnings;
    }

    function createOePanelRarityBalancer(eggs = []) {
      return eggs.flatMap((egg) => {
        const rarityOdds = getOePanelRollableRarityOdds(egg);
        const totalWeight = Object.values(rarityOdds).reduce(
          (sum, weight) => sum + Math.max(0, Number(weight) || 0),
          0
        );
        const pools = getOePanelSetDerivedPools(egg);

        return getOePanelSetRarities(egg).map((rarity) => {
          const counts = Object.fromEntries(
            OE_PANEL_OLING_LAYERS.map((layer) => [
              layer,
              (pools[layer]?.[rarity] || []).length
            ])
          );
          const possibleBuilds = OE_PANEL_OLING_LAYERS.reduce(
            (total, layer) => total * Math.max(0, counts[layer] || 0),
            1
          );
          const weight = Math.max(0, Number(rarityOdds[rarity]) || 0);

          return {
            egg: egg.name || egg.key,
            eggKey: egg.key,
            rarity,
            weight: String(weight),
            odds:
              totalWeight > 0
                ? `${((weight / totalWeight) * 100).toFixed(2)}%`
                : '0%',
            body: String(counts.body || 0),
            eyes: String(counts.eyes || 0),
            mouth: String(counts.mouth || 0),
            flight: String(counts.flight || 0),
            possibleBuilds: String(weight > 0 ? possibleBuilds : 0)
          };
        });
      });
    }

    async function getOePanelOlingOwnerLabels(ownerIds) {
      const owners = ownerIds.length
        ? await Account.find({ _id: { $in: ownerIds } })
            .select({ username: 1, email: 1 })
            .lean()
        : [];
      return new Map(
        owners.map((owner) => [
          String(owner._id),
          owner.username || owner.email || String(owner._id)
        ])
      );
    }

    function summarizeOePanelRolls(rolls = {}) {
      return OE_PANEL_OLING_LAYERS.map(
        (layer) => `${layer}: ${rolls[layer]?.traitKey || '-'}`
      ).join(', ');
    }


    return {
      createOePanelRarityBalancer,
      getOePanelOlingOwnerLabels,
      getOePanelOlingWarnings,
      serializeOePanelBuildSets,
      serializeOePanelOlingEgg,
      serializeOePanelOlingTrait,
      summarizeOePanelRolls,
      upsertOePanelBuildSets
    };
  }
}

module.exports = {
  createOePanelOlingDashboardHelpers
};
