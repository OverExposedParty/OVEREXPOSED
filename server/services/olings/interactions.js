const { OLING_LAYERS, normalizeKey } = require('./shared');
const {
  attachOlingBuildSetsToEggs,
  getLayerPool,
  getOlingConsumableByKey,
  getOlingDefinitions,
  getRollableOlingRarityOdds,
  listOlingConsumables,
  listOlingPersonalities,
  pickRandom,
  rollWeightedKey,
  serializeHatchReceipt,
  serializeOlingConsumable,
  serializePlayerOling
} = require('./definitions');
const {
  applyConsumableEffectToOling,
  getEnergyRestoreThreshold,
  getOlingEnergy
} = require('./energy');
const {
  consumeOwnedConsumable,
  consumeOwnedEgg,
  getAccountOlingState,
  getOrCreateOlingState
} = require('./account-state');

function canApplyOlingConsumableEffect(consumable) {
  return ['energy', 'xp'].includes(normalizeKey(consumable?.effect?.type));
}

function findHatchEggSlot(lab, hatchContext = {}, eggKey = '') {
  const normalizedEggKey = normalizeKey(eggKey);
  const parentPlacedId = String(hatchContext?.parentPlacedId || '').trim();
  const slotId = String(hatchContext?.slotId || '').trim();
  const placedItems = Array.isArray(lab?.placedItems) ? lab.placedItems : [];
  let fallback = null;

  for (const placedItem of placedItems) {
    const parentMatches =
      parentPlacedId && placedItem.placedId === parentPlacedId;

    for (const inventorySlot of placedItem.inventorySlots || []) {
      if (normalizeKey(inventorySlot?.itemKey) !== normalizedEggKey) continue;
      if (!fallback) fallback = inventorySlot;
      if (parentMatches && !slotId) return inventorySlot;
    }

    for (const containerSlot of placedItem.containerSlots || []) {
      const containerMatches =
        parentMatches && (!slotId || containerSlot.slotId === slotId);

      for (const inventorySlot of containerSlot.inventorySlots || []) {
        if (normalizeKey(inventorySlot?.itemKey) !== normalizedEggKey) continue;
        if (!fallback) fallback = inventorySlot;
        if (containerMatches) return inventorySlot;
      }
    }
  }

  return fallback;
}

function clearHatchEggSlot(lab, hatchContext = {}, eggKey = '') {
  const slot = findHatchEggSlot(lab, hatchContext, eggKey);
  if (!slot) return false;

  slot.itemKey = null;
  slot.itemType = null;
  slot.placedAt = null;
  slot.influenceSlots = [];
  return true;
}

function getPersonalityKeyFromInfluence(consumable) {
  const effect = consumable?.effect || {};
  if (normalizeKey(effect.type) !== 'personality_chance') return null;
  return (
    normalizeKey(effect.personalityKey) ||
    normalizeKey(consumable?.metadata?.personalityKey)
  );
}

function pickInfluencedPersonality(
  personalities,
  hatchInfluences,
  consumables
) {
  const personalityByKey = new Map(
    personalities.map((personality) => [personality.key, personality])
  );
  const consumableByKey = new Map(
    consumables.map((consumable) => [consumable.key, consumable])
  );
  const influence = (Array.isArray(hatchInfluences) ? hatchInfluences : [])
    .map((item) => {
      if (!item?.consumedAt) return null;
      const consumable = consumableByKey.get(normalizeKey(item.itemKey));
      const personalityKey = getPersonalityKeyFromInfluence(consumable);
      if (!personalityKey || !personalityByKey.has(personalityKey)) return null;
      return {
        itemKey: consumable.key,
        personalityKey,
        chance: Math.max(
          0,
          Math.min(1, Number(consumable.effect?.amount || 0) / 100)
        )
      };
    })
    .filter(Boolean)[0];

  if (!influence) {
    return {
      personality: pickRandom(personalities),
      influence: null
    };
  }

  if (Math.random() <= influence.chance) {
    return {
      personality: personalityByKey.get(influence.personalityKey),
      influence: {
        ...influence,
        applied: true
      }
    };
  }

  return {
    personality: pickRandom(personalities),
    influence: {
      ...influence,
      applied: false
    }
  };
}

async function useOlingConsumable({
  models,
  accountId,
  olingId,
  consumableKey
}) {
  const {
    Account,
    OlingState,
    OlingEgg,
    OlingBuildSet,
    OlingTrait,
    OlingPersonality,
    OlingConsumable,
    PlayerOling
  } = models;
  const normalizedConsumableKey = normalizeKey(consumableKey);
  const consumable = await getOlingConsumableByKey(normalizedConsumableKey, {
    OlingConsumable
  });

  if (!consumable) {
    return {
      error: {
        status: 404,
        code: 'oling_consumable_not_found',
        message: 'That Oling consumable could not be found.'
      }
    };
  }

  if (consumable.target !== 'oling') {
    return {
      error: {
        status: 400,
        code: 'oling_consumable_target_invalid',
        message: 'That consumable cannot be used on an Oling.'
      }
    };
  }

  if (!canApplyOlingConsumableEffect(consumable)) {
    return {
      error: {
        status: 400,
        code: 'oling_consumable_effect_invalid',
        message: 'That consumable does not have a usable effect yet.'
      }
    };
  }

  const oling = await PlayerOling.findOne({
    _id: olingId,
    ownerId: accountId
  });

  if (!oling) {
    return {
      error: {
        status: 404,
        code: 'player_oling_not_found',
        message: 'That Oling could not be found.'
      }
    };
  }

  if (
    normalizeKey(consumable.effect?.type) === 'energy' &&
    getEnergyRestoreThreshold(consumable) &&
    getOlingEnergy(oling) >= getEnergyRestoreThreshold(consumable)
  ) {
    return {
      error: {
        status: 409,
        code: 'oling_energy_not_needed',
        message: 'This Oling has enough Energy for that snack right now.'
      }
    };
  }

  const consumedConsumable = await consumeOwnedConsumable(
    { Account, OlingState },
    accountId,
    normalizedConsumableKey
  );

  if (!consumedConsumable) {
    return {
      error: {
        status: 409,
        code: 'oling_consumable_not_owned',
        message: 'You do not have that consumable.'
      }
    };
  }

  applyConsumableEffectToOling(oling, consumable);
  await oling.save();

  const definitions = await getOlingDefinitions(
    { OlingTrait, OlingEgg, OlingBuildSet, OlingPersonality },
    [oling]
  );

  return {
    account: consumedConsumable.account,
    olingState: consumedConsumable.olingState,
    consumable,
    inventoryChange: {
      consumableKey: normalizedConsumableKey,
      quantityBefore: consumedConsumable.quantityBefore,
      quantityAfter: consumedConsumable.quantityAfter
    },
    oling,
    serialized: {
      consumable: serializeOlingConsumable(consumable),
      oling: serializePlayerOling(oling, definitions)
    }
  };
}

async function rollOlingBuild({
  OlingTrait,
  OlingPersonality,
  egg,
  hatchInfluences = [],
  consumables = []
}) {
  const build = {};
  const buildRarities = {};
  const rolls = {};

  for (const layer of OLING_LAYERS) {
    const rarityRolled = rollWeightedKey(getRollableOlingRarityOdds(egg));
    const pool = getLayerPool(egg, layer, rarityRolled);
    const traitKey = pickRandom(pool);

    if (!rarityRolled || !traitKey) {
      return {
        error: {
          status: 500,
          code: 'oling_egg_pool_invalid',
          message: `Egg "${egg.key}" is missing a ${layer} pool for the rolled rarity.`
        }
      };
    }

    const trait = await OlingTrait.findOne({
      key: traitKey,
      layer,
      rarity: rarityRolled,
      enabled: true,
      status: 'published'
    }).lean();

    if (!trait) {
      return {
        error: {
          status: 500,
          code: 'oling_trait_missing',
          message: `Egg "${egg.key}" references an unavailable Oling trait.`
        }
      };
    }

    build[layer] = trait.key;
    buildRarities[layer] = rarityRolled;
    rolls[layer] = {
      rarityRolled,
      traitKey: trait.key
    };
  }

  const personalityQuery = {
    enabled: true,
    status: 'published'
  };
  const dbPersonalities = await OlingPersonality.find(personalityQuery).lean();
  const personalities = dbPersonalities.length
    ? dbPersonalities
    : await listOlingPersonalities();
  const personalityRoll = pickInfluencedPersonality(
    personalities,
    hatchInfluences,
    consumables
  );
  const personality = personalityRoll.personality;

  if (!personality) {
    return {
      error: {
        status: 500,
        code: 'oling_personality_pool_invalid',
        message: `Egg "${egg.key}" has no available Oling personalities.`
      }
    };
  }

  rolls.personality = {
    personalityKey: personality.key
  };
  if (personalityRoll.influence) {
    rolls.personality.influence = personalityRoll.influence;
  }

  return {
    build,
    buildRarities,
    personalityKey: personality.key,
    rolls
  };
}

async function hatchOling({
  models,
  accountId,
  eggKey,
  hatchContext = {},
  request = {}
}) {
  const {
    Account,
    OlingState,
    OlingEgg,
    OlingBuildSet,
    OlingTrait,
    OlingPersonality,
    OlingConsumable,
    PlayerOling,
    OlingHatchReceipt
  } = models;
  const normalizedEggKey = normalizeKey(eggKey);

  const egg = await OlingEgg.findOne({
    key: normalizedEggKey,
    enabled: true,
    status: 'published'
  }).lean();

  if (!egg) {
    return {
      error: {
        status: 404,
        code: 'oling_egg_not_found',
        message: 'That Oling egg could not be found.'
      }
    };
  }

  const [eggWithBuildSets] = await attachOlingBuildSetsToEggs(
    { OlingBuildSet },
    [egg],
    { publicOnly: true }
  );
  const account = await Account.findById(accountId);
  if (!account) {
    return {
      error: {
        status: 404,
        code: 'account_not_found',
        message: 'That account could not be found.'
      }
    };
  }
  await getOrCreateOlingState(OlingState, account);
  const hatchEggSlot = findHatchEggSlot(
    account.olings?.lab,
    hatchContext,
    normalizedEggKey
  );
  const hatchInfluences = Array.isArray(hatchEggSlot?.influenceSlots)
    ? hatchEggSlot.influenceSlots
    : [];
  const consumables = await listOlingConsumables({ OlingConsumable });

  const rolledBuild = await rollOlingBuild({
    OlingTrait,
    OlingPersonality,
    egg: eggWithBuildSets,
    hatchInfluences,
    consumables
  });
  if (rolledBuild.error) return rolledBuild;

  const consumedEgg = await consumeOwnedEgg(
    { Account, OlingState },
    accountId,
    normalizedEggKey
  );
  if (!consumedEgg) {
    return {
      error: {
        status: 409,
        code: 'oling_egg_not_owned',
        message: 'You do not have that Oling egg to hatch.'
      }
    };
  }
  if (
    clearHatchEggSlot(
      consumedEgg.account.olings?.lab,
      hatchContext,
      normalizedEggKey
    )
  ) {
    consumedEgg.account.markModified('olings.lab');
    await consumedEgg.account.save({ validateBeforeSave: false });
    consumedEgg.olingState = getAccountOlingState(consumedEgg.account);
  }

  const oling = await PlayerOling.create({
    ownerId: accountId,
    eggKey: eggWithBuildSets.key,
    collection: eggWithBuildSets.collection,
    personalityKey: rolledBuild.personalityKey,
    build: rolledBuild.build,
    buildRarities: rolledBuild.buildRarities,
    hatchedAt: new Date()
  });

  const receipt = await OlingHatchReceipt.create({
    ownerId: accountId,
    eggKey: eggWithBuildSets.key,
    olingId: oling._id,
    rolls: rolledBuild.rolls,
    eggOddsSnapshot: getRollableOlingRarityOdds(eggWithBuildSets),
    inventoryChange: {
      eggKey: eggWithBuildSets.key,
      quantityBefore: consumedEgg.quantityBefore,
      quantityAfter: consumedEgg.quantityAfter
    },
    request: {
      ip: request.ip || null,
      userAgent: request.userAgent || null
    }
  });

  const definitions = await getOlingDefinitions(
    { OlingTrait, OlingEgg, OlingBuildSet, OlingPersonality },
    [oling]
  );

  return {
    account: consumedEgg.account,
    olingState: consumedEgg.olingState,
    oling,
    receipt,
    serialized: {
      oling: serializePlayerOling(oling, definitions),
      receipt: serializeHatchReceipt(receipt)
    }
  };
}


module.exports = {
  hatchOling,
  useOlingConsumable
};
