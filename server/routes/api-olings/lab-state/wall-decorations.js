const {
  LAB_ROWS,
  OlingLabItems,
  OlingLabWallDecorations
} = require('../lab-catalog');

const MAX_WALL_DECORATIONS = 64;

function getOwnedWallDecorationQuantities(account, olingState = null) {
  const quantities = new Map();
  const sources = [
    account?.olings?.wallDecorations,
    account?.gameData?.olingInventory?.wallDecorations,
    olingState?.inventory?.wallDecorations
  ];
  sources.forEach((items) => {
    if (!Array.isArray(items)) return;
    items.forEach((item) => {
      const key = String(item?.key || '').trim();
      if (!key || !Object.hasOwn(OlingLabWallDecorations, key)) return;
      quantities.set(
        key,
        Math.max(
          quantities.get(key) || 0,
          Math.max(0, Number(item.quantity || 0))
        )
      );
    });
  });
  return quantities;
}

function rectanglesOverlap(left, right) {
  const epsilon = 0.000001;
  return (
    left.x < right.x + right.width - epsilon &&
    left.x + left.width > right.x + epsilon &&
    left.y < right.y + right.height - epsilon &&
    left.y + left.height > right.y + epsilon
  );
}

function getDecorationBounds(definition, centerX, centerY) {
  const mask = definition.collisionBounds || {
    x: 0,
    y: 0,
    width: 1,
    height: 1
  };
  const left = centerX - definition.width / 2;
  const top = centerY - definition.height / 2;
  return {
    x: left + mask.x * definition.width,
    y: top + mask.y * definition.height,
    width: mask.width * definition.width,
    height: mask.height * definition.height
  };
}

function getMajorityCell(definition, centerX, centerY, columns) {
  const visual = {
    x: centerX - definition.width / 2,
    y: centerY - definition.height / 2,
    width: definition.width,
    height: definition.height
  };
  let best = null;
  for (let row = 0; row < LAB_ROWS; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const overlapWidth = Math.max(
        0,
        Math.min(visual.x + visual.width, col + 1) - Math.max(visual.x, col)
      );
      const overlapHeight = Math.max(
        0,
        Math.min(visual.y + visual.height, row + 1) - Math.max(visual.y, row)
      );
      const area = overlapWidth * overlapHeight;
      if (!best || area > best.area) best = { row, col, area };
    }
  }
  return best;
}

function getBlockingFurnitureBounds(placedItems = []) {
  const blocked = [];
  const append = (definition, placed) => {
    if (!definition?.blocksWallDecorations || !definition.wallCollisionBounds)
      return;
    const mask = definition.wallCollisionBounds;
    blocked.push({
      x: Number(placed.col || 0) + mask.x * Number(placed.width || 1),
      y: Number(placed.row || 0) + mask.y * Number(placed.height || 1),
      width: mask.width * Number(placed.width || 1),
      height: mask.height * Number(placed.height || 1)
    });
  };
  placedItems.forEach((placed) => {
    append(OlingLabItems[placed.itemId], placed);
    (placed.containerSlots || []).forEach((slot) => {
      if (slot.itemId) append(OlingLabItems[slot.itemId], placed);
    });
  });
  return blocked;
}

function normalizePlacedWallDecorations(value, context) {
  const requested = Array.isArray(value)
    ? value.slice(0, MAX_WALL_DECORATIONS)
    : [];
  if (Array.isArray(value) && value.length > MAX_WALL_DECORATIONS) {
    return {
      error: {
        status: 400,
        code: 'oling_lab_wall_decoration_limit',
        message: 'Too many wall decorations are placed.'
      }
    };
  }
  const owned = getOwnedWallDecorationQuantities(
    context.account,
    context.olingState
  );
  const used = new Map();
  const placedIds = new Set();
  const normalized = [];
  const collisionBounds = [];
  const furnitureBounds = getBlockingFurnitureBounds(context.placedItems);

  for (const item of requested) {
    const itemId = String(item?.itemId || '').trim();
    const definition = OlingLabWallDecorations[itemId];
    if (!definition) {
      return {
        error: {
          status: 400,
          code: 'oling_lab_wall_decoration_invalid',
          message: 'That wall decoration is not available.'
        }
      };
    }
    const nextUsed = (used.get(itemId) || 0) + 1;
    if (nextUsed > (owned.get(itemId) || 0)) {
      return {
        error: {
          status: 403,
          code: 'oling_lab_wall_decoration_not_owned',
          message: 'You do not own enough of that wall decoration.'
        }
      };
    }
    used.set(itemId, nextUsed);

    const requestedAnchorCol = Number(item.anchorCol);
    const requestedAnchorRow = Number(item.anchorRow);
    const offsetX = Number(item.offsetX);
    const offsetY = Number(item.offsetY);
    if (
      !Number.isInteger(requestedAnchorCol) ||
      !Number.isInteger(requestedAnchorRow) ||
      !Number.isFinite(offsetX) ||
      !Number.isFinite(offsetY)
    ) {
      return {
        error: {
          status: 400,
          code: 'oling_lab_wall_decoration_position_invalid',
          message: 'That wall decoration position is invalid.'
        }
      };
    }
    const centerX = requestedAnchorCol + offsetX;
    const centerY = requestedAnchorRow + offsetY;
    const visualLeft = centerX - definition.width / 2;
    const visualTop = centerY - definition.height / 2;
    if (
      visualLeft < 0 ||
      visualTop < 0 ||
      visualLeft + definition.width > context.columns ||
      visualTop + definition.height > LAB_ROWS
    ) {
      return {
        error: {
          status: 400,
          code: 'oling_lab_wall_decoration_out_of_bounds',
          message: 'That wall decoration must stay inside the lab wall.'
        }
      };
    }

    const majority = getMajorityCell(
      definition,
      centerX,
      centerY,
      context.columns
    );
    if (
      !majority ||
      !context.unlockedCellSet.has(`${majority.row}:${majority.col}`)
    ) {
      return {
        error: {
          status: 403,
          code: 'oling_lab_wall_decoration_cell_locked',
          message: 'That wall space has not been unlocked.'
        }
      };
    }
    const bounds = getDecorationBounds(definition, centerX, centerY);
    if (furnitureBounds.some((blocked) => rectanglesOverlap(bounds, blocked))) {
      return {
        error: {
          status: 400,
          code: 'oling_lab_wall_decoration_furniture_overlap',
          message: 'That wall decoration cannot overlap the door.'
        }
      };
    }
    if (collisionBounds.some((placed) => rectanglesOverlap(bounds, placed))) {
      return {
        error: {
          status: 400,
          code: 'oling_lab_wall_decoration_overlap',
          message: 'Wall decorations cannot overlap.'
        }
      };
    }

    const placedId = String(item.placedId || '')
      .trim()
      .slice(0, 80);
    if (!placedId || placedIds.has(placedId)) {
      return {
        error: {
          status: 400,
          code: 'oling_lab_wall_decoration_id_invalid',
          message: 'That wall decoration has an invalid placement ID.'
        }
      };
    }
    placedIds.add(placedId);
    collisionBounds.push(bounds);
    normalized.push({
      placedId,
      itemId,
      anchorRow: majority.row,
      anchorCol: majority.col,
      offsetX: centerX - majority.col,
      offsetY: centerY - majority.row,
      placedAt: item.placedAt || new Date()
    });
  }
  return { placedWallDecorations: normalized };
}

module.exports = {
  getOwnedWallDecorationQuantities,
  getDecorationBounds,
  getMajorityCell,
  getBlockingFurnitureBounds,
  normalizePlacedWallDecorations,
  rectanglesOverlap
};
