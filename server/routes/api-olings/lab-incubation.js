const { OlingLabItems } = require('./lab-catalog');

const HATCH_INFLUENCE_SLOT_DEFINITIONS = {
  hatch: {
    category: 'hatching',
    subcategory: 'speed',
    effectTypes: ['hatch_speed']
  },
  rarity: {
    category: 'hatching',
    subcategory: 'rarity',
    effectTypes: ['rarity_chance']
  },
  personality: {
    category: 'hatching',
    subcategory: 'personality',
    effectTypes: ['personality_chance']
  },
  'matching-set': {
    category: 'hatching',
    subcategory: 'matching-set',
    effectTypes: ['matching_set', 'set_match']
  }
};

const HATCH_INFLUENCE_SLOTS = new Set(
  Object.keys(HATCH_INFLUENCE_SLOT_DEFINITIONS)
);

const DEFAULT_HATCH_DURATION_MS = 2 * 60 * 60 * 1000;

function normalizeInfluenceSlots(value) {
  if (!Array.isArray(value)) return [];
  const usedSlots = new Set();
  return value
    .map((item) => {
      const slotKey = String(item?.slotKey || '').trim();
      const itemKey = String(item?.itemKey || '').trim();
      if (!slotKey || !itemKey || usedSlots.has(slotKey)) return null;
      if (!HATCH_INFLUENCE_SLOTS.has(slotKey)) return null;
      usedSlots.add(slotKey);
      return {
        slotKey,
        itemKey,
        itemType: 'consumable',
        consumedAt: item?.consumedAt || null
      };
    })
    .filter(Boolean);
}

function collectLabEggSlots(lab) {
  const slots = new Map();
  const placedItems = Array.isArray(lab?.placedItems) ? lab.placedItems : [];
  placedItems.forEach((item) => {
    (item.inventorySlots || []).forEach((inventorySlot) => {
      slots.set(`${item.placedId}:root:${inventorySlot.slotId}`, inventorySlot);
    });
    (item.containerSlots || []).forEach((containerSlot) => {
      (containerSlot.inventorySlots || []).forEach((inventorySlot) => {
        slots.set(
          `${item.placedId}:${containerSlot.slotId}:${inventorySlot.slotId}`,
          inventorySlot
        );
      });
    });
  });
  return slots;
}

function findCurrentRoomEgg(lab) {
  const placedItems = Array.isArray(lab?.placedItems) ? lab.placedItems : [];

  for (const placedItem of placedItems) {
    for (const inventorySlot of placedItem.inventorySlots || []) {
      if (inventorySlot?.slotType === 'egg' && inventorySlot.itemKey) {
        return {
          eggKey: String(inventorySlot.itemKey).trim().toLowerCase(),
          hatchContext: {
            parentPlacedId: placedItem.placedId
          },
          influenceSlots: normalizeInfluenceSlots(inventorySlot.influenceSlots),
          slot: {
            parentPlacedId: placedItem.placedId,
            parentItemId: placedItem.itemId,
            slotId: inventorySlot.slotId,
            containerSlotId: null
          }
        };
      }
    }

    for (const containerSlot of placedItem.containerSlots || []) {
      for (const inventorySlot of containerSlot.inventorySlots || []) {
        if (inventorySlot?.slotType === 'egg' && inventorySlot.itemKey) {
          return {
            eggKey: String(inventorySlot.itemKey).trim().toLowerCase(),
            hatchContext: {
              parentPlacedId: placedItem.placedId,
              slotId: containerSlot.slotId
            },
            influenceSlots: normalizeInfluenceSlots(
              inventorySlot.influenceSlots
            ),
            slot: {
              parentPlacedId: placedItem.placedId,
              parentItemId: placedItem.itemId,
              slotId: inventorySlot.slotId,
              containerSlotId: containerSlot.slotId,
              containerItemId: containerSlot.itemId,
              containerPlacedId: containerSlot.placedId
            }
          };
        }
      }
    }
  }

  return null;
}

function getEggHatchDurationMs(egg) {
  const values = [
    egg?.metadata?.hatchMilliseconds,
    egg?.metadata?.hatchMs,
    Number(egg?.metadata?.hatchSeconds) * 1000,
    Number(egg?.metadata?.hatchMinutes) * 60 * 1000
  ];
  return Number(
    values.find(
      (value) => Number.isFinite(Number(value)) && Number(value) > 0
    ) || DEFAULT_HATCH_DURATION_MS
  );
}

function getIncubatorReadyNotifications(lab, eggs = [], now = new Date()) {
  const eggMap = new Map(
    eggs.map((egg) => [
      String(egg?.key || '')
        .trim()
        .toLowerCase(),
      egg
    ])
  );
  const notifications = [];
  const nowMs = new Date(now).getTime();

  function inspectSlots(inventorySlots, incubator, locationKey) {
    (inventorySlots || []).forEach((slot) => {
      if (
        slot?.slotType !== 'egg' ||
        !slot.itemKey ||
        !slot.placedAt ||
        slot.readyNotificationDeliveredAt
      ) {
        return;
      }
      const eggKey = String(slot.itemKey).trim().toLowerCase();
      const egg = eggMap.get(eggKey) || { key: eggKey };
      const placedAtMs = new Date(slot.placedAt).getTime();
      if (!Number.isFinite(placedAtMs)) return;
      const readyAtMs = placedAtMs + getEggHatchDurationMs(egg);
      if (readyAtMs > nowMs) return;

      notifications.push({
        id: `${locationKey}:${slot.slotId}:${new Date(slot.placedAt).toISOString()}`,
        type: 'incubator_ready',
        eggKey,
        eggName: egg.name || eggKey || 'Your egg',
        image:
          egg.assets?.image ||
          `/images/olings/eggs/${egg.collection || egg.key}/egg.svg`,
        incubatorName: incubator?.name || 'Incubator',
        readyAt: new Date(readyAtMs).toISOString(),
        slot
      });
    });
  }

  (lab?.placedItems || []).forEach((placedItem) => {
    const placedDefinition = OlingLabItems[placedItem.itemId];
    if (placedDefinition?.type === 'incubator') {
      inspectSlots(
        placedItem.inventorySlots,
        placedDefinition,
        String(placedItem.placedId || placedItem.itemId)
      );
    }
    (placedItem.containerSlots || []).forEach((containerSlot) => {
      const containerDefinition = OlingLabItems[containerSlot.itemId];
      if (containerDefinition?.type !== 'incubator') return;
      inspectSlots(
        containerSlot.inventorySlots,
        containerDefinition,
        `${placedItem.placedId || placedItem.itemId}:${containerSlot.placedId || containerSlot.slotId}`
      );
    });
  });

  return notifications;
}

function consumableMatchesHatchInfluenceSlot(consumable, slotKey) {
  const slotDefinition = HATCH_INFLUENCE_SLOT_DEFINITIONS[slotKey];
  if (!consumable || !slotDefinition) return false;
  const effectType = consumable.effect?.type || '';
  return (
    consumable.category === slotDefinition.category &&
    (consumable.subcategory === slotDefinition.subcategory ||
      slotDefinition.effectTypes.includes(effectType))
  );
}

function applyHatchInfluenceDeductions(
  nextLab,
  previousLab,
  account,
  consumableDefinitions
) {
  const previousSlots = collectLabEggSlots(previousLab);
  const nextSlots = collectLabEggSlots(nextLab);
  const consumableDefinitionMap = new Map(
    consumableDefinitions.map((item) => [item.key, item])
  );
  const consumables = Array.isArray(account?.olings?.consumables)
    ? account.olings.consumables
    : [];
  const quantities = new Map(
    consumables.map((item) => [item.key, Number(item.quantity || 0)])
  );
  const deductions = new Map();
  const consumedAt = new Date();
  let invalidInfluence = false;

  nextSlots.forEach((nextSlot, slotPath) => {
    if (
      nextSlot.slotType !== 'egg' ||
      !nextSlot.itemKey ||
      !nextSlot.placedAt
    ) {
      nextSlot.influenceSlots = [];
      return;
    }

    const previousSlot = previousSlots.get(slotPath);
    const sameEgg =
      previousSlot?.itemKey === nextSlot.itemKey &&
      String(previousSlot?.placedAt || '') === String(nextSlot.placedAt || '');

    nextSlot.readyNotificationDeliveredAt = sameEgg
      ? previousSlot?.readyNotificationDeliveredAt || null
      : null;

    nextSlot.influenceSlots = normalizeInfluenceSlots(nextSlot.influenceSlots)
      .map((influence) => {
        if (
          !consumableMatchesHatchInfluenceSlot(
            consumableDefinitionMap.get(influence.itemKey),
            influence.slotKey
          )
        ) {
          invalidInfluence = true;
          return null;
        }
        const previousInfluence = sameEgg
          ? (previousSlot?.influenceSlots || []).find(
              (item) =>
                item.slotKey === influence.slotKey &&
                item.itemKey === influence.itemKey &&
                item.consumedAt
            )
          : null;

        if (previousInfluence) {
          return {
            ...influence,
            consumedAt: previousInfluence.consumedAt
          };
        }

        deductions.set(
          influence.itemKey,
          (deductions.get(influence.itemKey) || 0) + 1
        );
        return {
          ...influence,
          consumedAt
        };
      })
      .filter(Boolean);
  });

  if (invalidInfluence) {
    return {
      error: {
        status: 400,
        code: 'oling_lab_influence_invalid',
        message: 'That hatch influence item does not fit that slot.'
      }
    };
  }

  for (const [itemKey, quantity] of deductions) {
    if ((quantities.get(itemKey) || 0) < quantity) {
      return {
        error: {
          status: 403,
          code: 'oling_lab_consumable_not_owned',
          message: 'You do not own enough of that hatch influence item.'
        }
      };
    }
  }

  if (deductions.size > 0) {
    consumables.forEach((item) => {
      const quantity = deductions.get(item.key) || 0;
      if (quantity < 1) return;
      item.quantity = Math.max(0, Number(item.quantity || 0) - quantity);
      item.lastUpdatedAt = consumedAt;
    });
  }

  return { deductions };
}

module.exports = {
  HATCH_INFLUENCE_SLOT_DEFINITIONS,
  HATCH_INFLUENCE_SLOTS,
  DEFAULT_HATCH_DURATION_MS,
  normalizeInfluenceSlots,
  collectLabEggSlots,
  findCurrentRoomEgg,
  getEggHatchDurationMs,
  getIncubatorReadyNotifications,
  consumableMatchesHatchInfluenceSlot,
  applyHatchInfluenceDeductions
};
