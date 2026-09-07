const { OlingLabItems } = require('./lab-catalog');
const { DEFAULT_HATCH_DURATION_MS } = require('./lab-incubation-config');
const {
  applyHatchSpeedToDuration
} = require('../../services/olings/hatch-influences');

function getEggHatchDurationMs(egg, influenceSlots = [], consumables = []) {
  const values = [
    egg?.metadata?.hatchMilliseconds,
    egg?.metadata?.hatchMs,
    Number(egg?.metadata?.hatchSeconds) * 1000,
    Number(egg?.metadata?.hatchMinutes) * 60 * 1000
  ];
  const baseDurationMs = Number(
    values.find(
      (value) => Number.isFinite(Number(value)) && Number(value) > 0
    ) || DEFAULT_HATCH_DURATION_MS
  );
  return applyHatchSpeedToDuration(baseDurationMs, influenceSlots, consumables);
}

function getIncubatorReadyNotifications(
  lab,
  eggs = [],
  now = new Date(),
  consumables = []
) {
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
      const readyAtMs =
        placedAtMs +
        getEggHatchDurationMs(egg, slot.influenceSlots, consumables);
      if (readyAtMs > nowMs) return;

      notifications.push({
        id: `${locationKey}:${slot.slotId}:${new Date(slot.placedAt).toISOString()}`,
        type: 'incubator_ready',
        eggKey,
        eggName: egg.name || eggKey || 'Your egg',
        image:
          egg.assets?.image ||
          `/images/olings/lab/eggs/${egg.collection || egg.key}/egg.svg`,
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

module.exports = {
  getEggHatchDurationMs,
  getIncubatorReadyNotifications
};
