const { LAB_ROWS } = require('../lab-catalog');

function serializeOlingLabItem(item) {
  return {
    id: item.id,
    name: item.name,
    type: item.type || item.category,
    category: item.category,
    rarity: item.rarity || 'common',
    layer: item.layer,
    width: item.width,
    height: item.height,
    influenceSlotCount: Number(item.influenceSlotCount) || 0,
    allowedRows: Array.isArray(item.allowedRows) ? item.allowedRows : [],
    image: item.image,
    sounds:
      typeof item.sounds?.placed === 'string'
        ? { placed: item.sounds.placed }
        : null,
    usesFullGridArtboard: item.usesFullGridArtboard,
    storageGridPlacement: item.storageGridPlacement || null,
    podStorage: item.podStorage
      ? {
          capacity: Math.max(1, Number(item.podStorage.capacity) || 1)
        }
      : null,
    restGridPlacement: item.restGridPlacement || null,
    exitGridPlacement: item.exitGridPlacement || null,
    locked: Boolean(item.locked),
    blocksWallDecorations: Boolean(item.blocksWallDecorations),
    wallCollisionBounds: item.wallCollisionBounds || null,
    containerSlots: Array.isArray(item.containerSlots)
      ? item.containerSlots
      : [],
    acceptedSlots: Array.isArray(item.acceptedSlots) ? item.acceptedSlots : [],
    inventorySlots: Array.isArray(item.inventorySlots)
      ? item.inventorySlots
      : [],
    dragInteractions: Array.isArray(item.dragInteractions)
      ? item.dragInteractions.map((interaction) => ({
          accepts: Array.isArray(interaction?.accepts)
            ? interaction.accepts.map(String)
            : [],
          action: String(interaction?.action || ''),
          collisionArea: String(interaction?.collisionArea || ''),
          snapTarget: String(interaction?.snapTarget || '')
        }))
      : []
  };
}

function serializeOlingLabWallDecoration(item) {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    category: item.category,
    rarity: item.rarity || 'common',
    layer: 'wall',
    width: item.width,
    height: item.height,
    image: item.image,
    collisionMask: item.collisionMask || null,
    collisionBounds: item.collisionBounds || { x: 0, y: 0, width: 1, height: 1 }
  };
}

function getAllowedRoomRows(item) {
  if (Array.isArray(item?.allowedRows) && item.allowedRows.length) {
    return item.allowedRows.map(Number);
  }
  if (item?.category === 'table' || item?.type === 'table') return [1];
  return Array.from({ length: LAB_ROWS }, (_, row) => row);
}

function canUseRoomRow(item, row) {
  return getAllowedRoomRows(item).includes(Number(row));
}

module.exports = {
  serializeOlingLabItem,
  serializeOlingLabWallDecoration,
  getAllowedRoomRows,
  canUseRoomRow
};
