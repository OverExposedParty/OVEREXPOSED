const { OLING_LAYERS, normalizeKey } = require('./shared');
const {
  attachOlingBuildSetsToEggs,
  getLayerPool,
  getOlingConsumableByKey,
  getOlingDefinitions,
  getRollableOlingRarityOdds,
  listOlingConsumables,
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
  applyRarityChanceToOdds,
  createHatchInfluenceSnapshots
} = require('./hatch-influences');
const {
  getEggHatchDurationMs
} = require('../../routes/api-olings/lab-incubation-readiness');
const {
  consumeOwnedConsumable,
  consumeReservedHatchInfluences,
  consumeOwnedEgg,
  getAccountOlingState,
  getOrCreateOlingState
} = require('./account-state');
const {
  createStoredOlingError,
  findAvailableLabSlot,
  isOlingActive
} = require('./residency');
const { OlingStorageError, runStorageTransaction } = require('./storage');

function getTransactionCompatibleModel(model, transactionConnection) {
  if (!model?.db || model.db === transactionConnection) return model;

  const databaseName = String(model.db.name || '').trim();
  if (!databaseName || typeof transactionConnection?.useDb !== 'function') {
    throw new TypeError(
      `${model.modelName || 'MongoDB model'} cannot join this transaction.`
    );
  }

  const transactionDatabase = transactionConnection.useDb(databaseName, {
    useCache: true
  });
  const existingModel = transactionDatabase.models?.[model.modelName];
  if (existingModel) return existingModel;

  return transactionDatabase.model(
    model.modelName,
    model.schema,
    model.collection.name
  );
}

function canApplyOlingConsumableEffect(consumable) {
  return normalizeKey(consumable?.effect?.type) === 'energy';
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
    OlingConsumable,
    OlingTrait,
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

  if (!isOlingActive(oling)) {
    const error = createStoredOlingError('giving it a consumable');
    return {
      error: {
        status: error.status,
        code: error.code,
        message: error.message
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
    { OlingTrait, OlingEgg, OlingBuildSet },
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

async function rollOlingBuild({ OlingTrait, egg }) {
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

  return {
    build,
    buildRarities,
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
    OlingConsumable,
    OlingTrait,
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
  const olingState = await getOrCreateOlingState(OlingState, account);
  const hatchSlot = findHatchEggSlot(
    account.olings?.lab || olingState?.lab,
    hatchContext,
    normalizedEggKey
  );
  if (!hatchSlot) {
    return {
      error: {
        status: 409,
        code: 'oling_hatch_slot_changed',
        message: 'That egg is no longer in this incubator.'
      }
    };
  }
  if (!hatchSlot.placedAt) {
    return {
      error: {
        status: 409,
        code: 'oling_hatch_not_started',
        message: 'Start hatching this egg before trying to hatch it.'
      }
    };
  }
  const influenceSlots = Array.isArray(hatchSlot?.influenceSlots)
    ? hatchSlot.influenceSlots
    : [];
  const consumables = influenceSlots.length
    ? await listOlingConsumables({ OlingConsumable })
    : [];
  const startedAtMs = new Date(hatchSlot.placedAt).getTime();
  const readyAtMs =
    startedAtMs +
    getEggHatchDurationMs(eggWithBuildSets, influenceSlots, consumables);
  if (!Number.isFinite(startedAtMs) || readyAtMs > Date.now()) {
    return {
      error: {
        status: 409,
        code: 'oling_hatch_not_ready',
        message: 'That egg is still hatching.'
      }
    };
  }
  const baseEggOdds = getRollableOlingRarityOdds(eggWithBuildSets);
  const adjustedEggOdds = applyRarityChanceToOdds(
    baseEggOdds,
    influenceSlots,
    consumables
  );
  const rolledBuild = await rollOlingBuild({
    OlingTrait,
    egg: { ...eggWithBuildSets, rarityOdds: adjustedEggOdds }
  });
  if (rolledBuild.error) return rolledBuild;

  const TransactionOlingHatchReceipt = getTransactionCompatibleModel(
    OlingHatchReceipt,
    PlayerOling?.db
  );

  let hatchResult;
  try {
    hatchResult = await runStorageTransaction(models, async (session) => {
      const labSlot = await findAvailableLabSlot({
        PlayerOling,
        accountId,
        session
      });
      if (!labSlot) {
        return {
          error: {
            status: 409,
            code: 'oling_lab_roster_full',
            message:
              'Your Oling lab already has 6 active Olings. Store one before hatching another.'
          }
        };
      }

      const consumedEgg = await consumeOwnedEgg(
        { Account, OlingState },
        accountId,
        normalizedEggKey,
        { session, initialize: false }
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
      const influenceConsumption = consumeReservedHatchInfluences(
        consumedEgg.account,
        influenceSlots
      );
      if (!influenceConsumption) {
        throw new OlingStorageError(
          409,
          'oling_hatch_influence_not_owned',
          'A reserved hatch influence is no longer available.'
        );
      }

      if (
        !clearHatchEggSlot(
          consumedEgg.account.olings?.lab,
          hatchContext,
          normalizedEggKey
        )
      ) {
        throw new OlingStorageError(
          409,
          'oling_hatch_slot_changed',
          'That egg is no longer in this incubator.'
        );
      }
      consumedEgg.account.markModified('olings.lab');
      await consumedEgg.account.save({
        session,
        validateBeforeSave: false
      });
      consumedEgg.olingState = getAccountOlingState(consumedEgg.account);

      const [oling] = await PlayerOling.create(
        [
          {
            ownerId: accountId,
            eggKey: eggWithBuildSets.key,
            collection: eggWithBuildSets.collection,
            build: rolledBuild.build,
            buildRarities: rolledBuild.buildRarities,
            residency: { state: 'active', labSlot, pod: null },
            hatchedAt: new Date()
          }
        ],
        { session }
      );

      const influences = createHatchInfluenceSnapshots(
        influenceConsumption.influenceSlots,
        consumables
      );
      const [receipt] = await TransactionOlingHatchReceipt.create(
        [
          {
            ownerId: accountId,
            eggKey: eggWithBuildSets.key,
            olingId: oling._id,
            rolls: rolledBuild.rolls,
            influences,
            eggOddsSnapshot: adjustedEggOdds,
            inventoryChange: {
              eggKey: eggWithBuildSets.key,
              quantityBefore: consumedEgg.quantityBefore,
              quantityAfter: consumedEgg.quantityAfter
            },
            request: {
              ip: request.ip || null,
              userAgent: request.userAgent || null
            },
            metadata: {
              baseEggOddsSnapshot: baseEggOdds,
              influenceInventoryChanges: influenceConsumption.inventoryChanges
            }
          }
        ],
        { session }
      );

      return { consumedEgg, oling, receipt };
    });
  } catch (error) {
    if (error instanceof OlingStorageError) {
      return { error: error.toApiError() };
    }
    throw error;
  }

  if (hatchResult.error) return hatchResult;
  const { consumedEgg, oling, receipt } = hatchResult;

  const definitions = await getOlingDefinitions(
    { OlingTrait, OlingEgg, OlingBuildSet },
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
  useOlingConsumable,
  __test: { getTransactionCompatibleModel }
};
