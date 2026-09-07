const {
  normalizeInfluenceSlots,
  collectLabEggSlotContexts
} = require('./lab-incubation-slots');

function consumableMatchesHatchInfluenceSlot(consumable) {
  if (!consumable) return false;
  return (
    consumable.category === 'hatching' &&
    consumable.target === 'egg' &&
    Boolean(consumable.effect?.type)
  );
}

function applyHatchInfluenceReservations(
  nextLab,
  previousLab,
  account,
  consumableDefinitions
) {
  const previousSlots = collectLabEggSlotContexts(previousLab);
  const nextSlots = collectLabEggSlotContexts(nextLab);
  const consumableDefinitionMap = new Map(
    consumableDefinitions.map((item) => [item.key, item])
  );
  const consumables = Array.isArray(account?.olings?.consumables)
    ? account.olings.consumables
    : [];
  const quantities = new Map(
    consumables.map((item) => [item.key, Number(item.quantity || 0)])
  );
  const reservations = new Map();
  const reservedAt = new Date();
  let invalidInfluence = false;

  nextSlots.forEach((nextContext, slotPath) => {
    const nextSlot = nextContext.slot;
    if (nextSlot.slotType !== 'egg') {
      nextSlot.influenceSlots = [];
      return;
    }

    const previousContext = previousSlots.get(slotPath);
    const previousSlot = previousContext?.slot;
    const sameEgg =
      previousSlot?.itemKey === nextSlot.itemKey &&
      String(previousSlot?.placedAt || '') === String(nextSlot.placedAt || '');

    nextSlot.readyNotificationDeliveredAt = sameEgg
      ? previousSlot?.readyNotificationDeliveredAt || null
      : null;

    const previousInfluences = normalizeInfluenceSlots(
      previousSlot?.influenceSlots,
      previousContext?.incubator
    );
    nextSlot.influenceSlots = normalizeInfluenceSlots(
      nextSlot.influenceSlots,
      nextContext.incubator
    )
      .map((influence) => {
        if (
          !consumableMatchesHatchInfluenceSlot(
            consumableDefinitionMap.get(influence.itemKey)
          )
        ) {
          invalidInfluence = true;
          return null;
        }
        const previousInfluence = previousInfluences.find(
          (item) =>
            item.slotKey === influence.slotKey &&
            item.itemKey === influence.itemKey
        );

        if (previousInfluence) {
          if (!previousInfluence.consumedAt) {
            reservations.set(
              influence.itemKey,
              (reservations.get(influence.itemKey) || 0) + 1
            );
          }
          return {
            ...influence,
            reservedAt: previousInfluence.consumedAt
              ? previousInfluence.reservedAt || null
              : previousInfluence.reservedAt || reservedAt,
            consumedAt: previousInfluence.consumedAt || null
          };
        }

        reservations.set(
          influence.itemKey,
          (reservations.get(influence.itemKey) || 0) + 1
        );
        return {
          ...influence,
          reservedAt,
          consumedAt: null
        };
      })
      .filter(Boolean);
  });

  if (invalidInfluence) {
    return {
      error: {
        status: 400,
        code: 'oling_lab_influence_invalid',
        message: 'That item cannot be used as an egg influence.'
      }
    };
  }

  for (const [itemKey, quantity] of reservations) {
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

  return { reservations };
}

module.exports = {
  consumableMatchesHatchInfluenceSlot,
  applyHatchInfluenceReservations
};
