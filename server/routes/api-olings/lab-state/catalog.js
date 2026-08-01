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
    allowedRows: Array.isArray(item.allowedRows) ? item.allowedRows : [],
    image: item.image,
    usesFullGridArtboard: item.usesFullGridArtboard,
    storageGridPlacement: item.storageGridPlacement || null,
    restGridPlacement: item.restGridPlacement || null,
    exitGridPlacement: item.exitGridPlacement || null,
    locked: Boolean(item.locked),
    containerSlots: Array.isArray(item.containerSlots)
      ? item.containerSlots
      : [],
    acceptedSlots: Array.isArray(item.acceptedSlots) ? item.acceptedSlots : [],
    inventorySlots: Array.isArray(item.inventorySlots)
      ? item.inventorySlots
      : []
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
  getAllowedRoomRows,
  canUseRoomRow
};
