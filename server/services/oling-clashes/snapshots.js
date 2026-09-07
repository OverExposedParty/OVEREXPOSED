const { getOlingDefinitions, serializeOlingTrait } = require('../olings');
const {
  createStoredOlingError,
  isOlingActive
} = require('../olings/residency');
const { normalizeAbilityCadence } = require('./ability-cadence');

const TEAM_SIZE = 3;
const OLING_LAYERS = ['body', 'eyes', 'mouth', 'flight'];

function toSnapshot(value, excludedKeys = []) {
  const plain = value?.toObject ? value.toObject() : { ...(value || {}) };
  for (const key of ['_id', '__v', 'createdAt', 'updatedAt', ...excludedKeys]) {
    delete plain[key];
  }
  return plain;
}

function snapshotClashAbility(ability) {
  const snapshot = toSnapshot(ability, ['isCurrent', 'enabled', 'status']);
  if (snapshot.cadence) {
    snapshot.cadence = normalizeAbilityCadence(snapshot.cadence);
  } else {
    delete snapshot.cadence;
  }
  return snapshot;
}

function abilityCadencesMatch(left, right) {
  if (!left || !right) return !left && !right;
  const normalizedLeft = normalizeAbilityCadence(left);
  const normalizedRight = normalizeAbilityCadence(right);
  return (
    normalizedLeft.every === normalizedRight.every &&
    normalizedLeft.mode === normalizedRight.mode &&
    normalizedLeft.retainWhileBenched === normalizedRight.retainWhileBenched &&
    normalizedLeft.consumeWhenPrevented === normalizedRight.consumeWhenPrevented
  );
}

async function hydrateClashAbilitySnapshots(models, match) {
  if (!match || typeof models?.OlingClashAbility?.find !== 'function') {
    return match;
  }

  const references = new Map();
  for (const player of match.players || []) {
    for (const oling of player.team || []) {
      for (const ability of oling.snapshot?.abilities || []) {
        const revision = Number(ability?.revision);
        if (!ability?.key || !Number.isInteger(revision) || revision < 1) {
          continue;
        }
        references.set(`${ability.key}:${revision}`, {
          key: ability.key,
          revision
        });
      }
    }
  }
  if (references.size === 0) return match;

  const query = models.OlingClashAbility.find({
    $or: [...references.values()]
  });
  const definitions = await (typeof query?.lean === 'function'
    ? query.lean()
    : query);
  const definitionsByRevision = new Map(
    (definitions || []).map((ability) => [
      `${ability.key}:${Number(ability.revision)}`,
      ability
    ])
  );
  let hydrated = false;

  for (const player of match.players || []) {
    for (const oling of player.team || []) {
      for (const ability of oling.snapshot?.abilities || []) {
        const definition = definitionsByRevision.get(
          `${ability?.key}:${Number(ability?.revision)}`
        );
        if (!definition) continue;
        const definitionCadence = definition.cadence
          ? normalizeAbilityCadence(definition.cadence)
          : undefined;
        if (abilityCadencesMatch(ability.cadence, definitionCadence)) continue;
        ability.cadence = definitionCadence;
        hydrated = true;
      }
    }
  }

  if (hydrated) match.markModified?.('players');
  return match;
}

async function getCurrentClashContent(models, rulesetKey = 'standard') {
  const [ruleset, statuses] = await Promise.all([
    models.OlingClashRuleset.findOne({
      key: String(rulesetKey || 'standard')
        .trim()
        .toLowerCase(),
      isCurrent: true,
      status: 'published'
    }).lean(),
    models.OlingClashStatus.find({
      isCurrent: true,
      status: 'published'
    })
      .sort({ key: 1 })
      .lean()
  ]);

  if (!ruleset) {
    const error = new Error('The selected Oling Clash ruleset is unavailable.');
    error.status = 503;
    error.code = 'oling_clash_ruleset_unavailable';
    throw error;
  }

  return {
    ruleset: {
      key: ruleset.key,
      revision: ruleset.revision,
      snapshot: toSnapshot(ruleset, ['isCurrent', 'status', 'key', 'revision'])
    },
    statusDefinitions: statuses.map((status) => ({
      key: status.key,
      revision: status.revision,
      snapshot: toSnapshot(status, ['isCurrent', 'enabled', 'status'])
    }))
  };
}

async function snapshotClashTeam(models, account, olingIds, ruleset) {
  const uniqueIds = [...new Set((olingIds || []).map(String).filter(Boolean))];
  if (uniqueIds.length !== TEAM_SIZE) {
    const error = new Error(`Select exactly ${TEAM_SIZE} unique Olings.`);
    error.status = 400;
    error.code = 'oling_clash_team_invalid';
    throw error;
  }

  const olings = await models.PlayerOling.find({
    _id: { $in: uniqueIds },
    ownerId: account._id
  }).lean();
  const byId = new Map(olings.map((oling) => [String(oling._id), oling]));
  const orderedOlings = uniqueIds.map((id) => byId.get(id)).filter(Boolean);
  if (orderedOlings.length !== TEAM_SIZE) {
    const error = new Error('One or more selected Olings could not be found.');
    error.status = 404;
    error.code = 'player_oling_not_found';
    throw error;
  }
  if (orderedOlings.some((oling) => !isOlingActive(oling))) {
    throw createStoredOlingError('selecting it for an Oling Clash');
  }

  const definitions = await getOlingDefinitions(models, orderedOlings);
  const startingHeartUnits = Number(
    ruleset?.snapshot?.health?.startingHeartUnits || 6
  );

  return orderedOlings.map((oling, teamSlot) => {
    const abilities = OLING_LAYERS.map((layer) =>
      definitions.clashAbilitiesByTraitKey.get(oling.build?.[layer])
    ).filter(Boolean);
    if (abilities.length !== OLING_LAYERS.length) {
      const error = new Error(
        `${oling.name || 'That Oling'} does not have a complete Clash ability set.`
      );
      error.status = 409;
      error.code = 'oling_clash_abilities_incomplete';
      throw error;
    }

    return {
      teamSlot,
      playerOlingId: oling._id,
      snapshot: {
        name: oling.name || null,
        build: oling.build,
        equipment: oling.equipment || {},
        traits: Object.fromEntries(
          OLING_LAYERS.map((layer) => [
            layer,
            serializeOlingTrait(
              definitions.traitsByKey.get(oling.build?.[layer])
            )
          ])
        ),
        abilities: abilities.map(snapshotClashAbility)
      },
      maxHeartUnits: startingHeartUnits,
      heartUnits: startingHeartUnits,
      overgrowthUnits: 0,
      bloodUnits: 0,
      pendingReclaimUnits: 0,
      shieldCount: 0,
      defeated: false,
      abilityProgress: [],
      removedPositiveStatuses: [],
      statuses: []
    };
  });
}

module.exports = {
  OLING_LAYERS,
  TEAM_SIZE,
  getCurrentClashContent,
  hydrateClashAbilitySnapshots,
  snapshotClashAbility,
  snapshotClashTeam,
  toSnapshot
};
