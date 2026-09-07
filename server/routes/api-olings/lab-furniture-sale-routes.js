const FURNITURE_QUICK_SELL_RATE = 0.6;

function toPlain(value) {
  return value?.toObject?.() || value || {};
}

function inventorySlotsContainItems(inventorySlots) {
  return (inventorySlots || []).some(
    (slot) =>
      Boolean(slot?.itemKey) ||
      Number(slot?.quantity || 0) > 0 ||
      (slot?.influenceSlots || []).some((influence) =>
        Boolean(influence?.itemKey)
      )
  );
}

function findPlacedFurniture(lab, placedId, definitions) {
  const normalizedPlacedId = String(placedId || '').trim();
  if (!normalizedPlacedId) return null;

  for (const placed of lab?.placedItems || []) {
    if (String(placed?.placedId || '') === normalizedPlacedId) {
      return {
        kind: 'room',
        placed,
        parent: null,
        definition: definitions[placed.itemId] || null
      };
    }
    for (const slot of placed?.containerSlots || []) {
      if (String(slot?.placedId || '') !== normalizedPlacedId) continue;
      return {
        kind: 'container',
        placed: slot,
        parent: placed,
        definition: definitions[slot.itemId] || null
      };
    }
  }
  return null;
}

function accountStorageContainsItems(account, olingState) {
  const inventory = account?.olings || olingState?.inventory || {};
  return [...(inventory.eggs || []), ...(inventory.consumables || [])].some(
    (item) => Number(item?.quantity || 0) > 0
  );
}

function getFurnitureSaleBlock({ target, account, olingState }) {
  if (!target?.definition) {
    return {
      status: 404,
      code: 'oling_lab_furniture_not_found',
      message: 'That furniture could not be found.'
    };
  }
  if (target.kind === 'room' && target.placed?.locked) {
    return {
      status: 403,
      code: 'oling_lab_furniture_locked',
      message: 'This furniture cannot be sold.'
    };
  }
  if (inventorySlotsContainItems(target.placed?.inventorySlots)) {
    return {
      status: 409,
      code: 'oling_lab_furniture_not_empty',
      message: `Remove every item from ${target.definition.name || 'this furniture'} before selling it.`
    };
  }
  const displaysAccountInventory = (
    target.definition.inventorySlots || []
  ).some((slot) => slot?.slotType === 'storage');
  if (
    displaysAccountInventory &&
    accountStorageContainsItems(account, olingState)
  ) {
    return {
      status: 409,
      code: 'oling_lab_furniture_not_empty',
      message: `Remove every item from ${target.definition.name || 'this storage'} before selling it.`
    };
  }
  if (
    target.kind === 'room' &&
    (target.placed?.containerSlots || []).some((slot) => Boolean(slot?.itemId))
  ) {
    return {
      status: 409,
      code: 'oling_lab_furniture_has_attached_items',
      message: 'Remove every attached item before selling this furniture.'
    };
  }
  if (
    target.definition.id === 'explorer_gateway' &&
    account?.olings?.adventures?.active
  ) {
    return {
      status: 409,
      code: 'oling_lab_gateway_active',
      message:
        'Wait for the active adventure to finish before selling the Explorer Gateway.'
    };
  }
  return null;
}

function getRecordedFurniturePrice(account, olingState, itemKey) {
  const inventory = Array.isArray(account?.olings?.furniture)
    ? account.olings.furniture
    : olingState?.inventory?.furniture || [];
  const owned = inventory.find((item) => item?.key === itemKey);
  const unitPrice = Number(owned?.metadata?.opalUnitPrice);
  if (Number.isFinite(unitPrice) && unitPrice >= 0) return unitPrice;
  const totalPrice = Number(owned?.metadata?.opalPrice);
  if (Number.isFinite(totalPrice) && totalPrice >= 0) return totalPrice;

  const transactions = Array.isArray(account?.gameData?.opalTransactions)
    ? account.gameData.opalTransactions
    : [];
  for (let index = transactions.length - 1; index >= 0; index -= 1) {
    const transaction = transactions[index];
    const grant = (transaction?.metadata?.grants || []).find(
      (item) => item?.type === 'oling_furniture' && item?.key === itemKey
    );
    if (!grant) continue;
    const paid = Math.abs(Number(transaction.amount));
    if (!Number.isFinite(paid)) continue;
    return Math.floor(paid / Math.max(1, Number(grant.quantity) || 1));
  }
  return null;
}

async function getFurnitureCataloguePrice(Product, itemKey) {
  if (!Product || !itemKey) return null;
  const product = await Product.findOne({
    $or: [
      {
        'digitalEntitlement.grants': {
          $elemMatch: { type: 'oling_furniture', key: itemKey }
        }
      },
      {
        'variants.digitalEntitlement.grants': {
          $elemMatch: { type: 'oling_furniture', key: itemKey }
        }
      }
    ]
  }).lean();
  if (!product) return null;
  const entitlements = [
    ...(product.variants || []).map(
      (variant) => variant.digitalEntitlement || {}
    ),
    product.digitalEntitlement || {}
  ];
  const entitlement = entitlements.find((entry) =>
    (entry.grants || []).some(
      (grant) => grant.type === 'oling_furniture' && grant.key === itemKey
    )
  );
  const grant = (entitlement?.grants || []).find(
    (entry) => entry.type === 'oling_furniture' && entry.key === itemKey
  );
  const price = Number(entitlement?.opalPrice?.amount);
  if (!Number.isFinite(price) || price < 0 || !grant) return null;
  return Math.floor(price / Math.max(1, Number(grant.quantity) || 1));
}

async function createFurnitureSaleQuote({
  account,
  olingState,
  target,
  Product,
  starterFurnitureKeys = []
}) {
  const itemKey = target.definition.id;
  let paidPrice = getRecordedFurniturePrice(account, olingState, itemKey);
  if (paidPrice === null && starterFurnitureKeys.includes(itemKey)) {
    paidPrice = 0;
  }
  if (paidPrice === null) {
    paidPrice = await getFurnitureCataloguePrice(Product, itemKey);
  }
  if (paidPrice === null) return null;
  paidPrice = Math.max(0, Math.floor(paidPrice));
  return {
    placedId: String(target.placed.placedId),
    itemKey,
    furnitureName: target.definition.name || itemKey,
    paidPrice,
    rate: FURNITURE_QUICK_SELL_RATE,
    payout: Math.floor(paidPrice * FURNITURE_QUICK_SELL_RATE)
  };
}

function removePlacedFurniture(lab, target) {
  const nextLab = toPlain(lab);
  nextLab.placedItems = (nextLab.placedItems || []).map(toPlain);
  if (target.kind === 'room') {
    nextLab.placedItems = nextLab.placedItems.filter(
      (placed) => String(placed.placedId) !== String(target.placed.placedId)
    );
  } else {
    const parent = nextLab.placedItems.find(
      (placed) => String(placed.placedId) === String(target.parent.placedId)
    );
    const slot = (parent?.containerSlots || []).find(
      (item) => String(item?.placedId) === String(target.placed.placedId)
    );
    if (slot) {
      slot.itemId = null;
      slot.itemType = null;
      slot.inventorySlots = [];
      slot.placedId = null;
      slot.placedAt = null;
    }
  }
  nextLab.updatedAt = new Date();
  return nextLab;
}

function decrementFurnitureInventory(items, itemKey, now = new Date()) {
  return (items || [])
    .map((item) => {
      const plain = toPlain(item);
      if (plain.key !== itemKey) return plain;
      return {
        ...plain,
        quantity: Math.max(0, Number(plain.quantity || 0) - 1),
        lastUpdatedAt: now
      };
    })
    .filter((item) => Number(item?.quantity || 0) > 0);
}

function registerOlingLabFurnitureSaleRoutes(context) {
  const {
    app,
    getCurrentAccount,
    getOrCreateOlingState,
    ensureAccountOlingDocument,
    getOwnedLabFurniture,
    serializeAccount,
    serializeOlingLab,
    OlingLabItems,
    STARTER_FURNITURE_KEYS,
    OlingState,
    PlayerOling,
    Product
  } = context;

  async function loadSale(req, res) {
    const account = await getCurrentAccount(req);
    if (!account) {
      res.apiError({
        status: 401,
        code: 'account_required',
        message: 'Sign in to sell furniture.'
      });
      return null;
    }
    const olingState = await getOrCreateOlingState(OlingState, account);
    ensureAccountOlingDocument(account, olingState);
    const lab = olingState?.lab?.placedItems
      ? olingState.lab
      : account.olings?.lab;
    const target = findPlacedFurniture(lab, req.body?.placedId, OlingLabItems);
    const block = getFurnitureSaleBlock({ target, account, olingState });
    if (block) {
      res.apiError(block);
      return null;
    }
    const placedId = String(target.placed.placedId);
    if (target.definition.podStorage) {
      const storedOling = await PlayerOling.findOne({
        ownerId: account._id,
        'residency.state': 'stored',
        'residency.pod.containerPlacedId': placedId
      })
        .select('_id')
        .lean();
      if (storedOling) {
        res.apiError({
          status: 409,
          code: 'oling_pod_storage_not_empty',
          message:
            'Move or release every Oling in this Pod Rack before selling it.'
        });
        return null;
      }
    }
    if (
      target.definition.type === 'bed' ||
      target.definition.category === 'bed'
    ) {
      const sleepingOling = await PlayerOling.findOne({
        ownerId: account._id,
        'care.isSleeping': true,
        'care.sleepBedPlacedId': placedId
      })
        .select('_id')
        .lean();
      if (sleepingOling) {
        res.apiError({
          status: 409,
          code: 'oling_lab_bed_occupied',
          message: 'Wake every Oling using this bed before selling it.'
        });
        return null;
      }
    }
    const owned = getOwnedLabFurniture(account, olingState);
    if (!owned.has(target.definition.id)) {
      res.apiError({
        status: 403,
        code: 'oling_lab_furniture_not_owned',
        message: 'You do not own this furniture.'
      });
      return null;
    }
    const quote = await createFurnitureSaleQuote({
      account,
      olingState,
      target,
      Product,
      starterFurnitureKeys: STARTER_FURNITURE_KEYS
    });
    if (!quote) {
      res.apiError({
        status: 400,
        code: 'oling_lab_furniture_sale_unavailable',
        message: 'The purchase price for this furniture could not be verified.'
      });
      return null;
    }
    return { account, olingState, lab, target, quote };
  }

  app.post('/api/olings/lab/furniture-sale/quote', async (req, res) => {
    try {
      const sale = await loadSale(req, res);
      if (sale) res.apiSuccess({ quote: sale.quote });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to quote furniture sale:`, err);
      res.apiError({
        status: 500,
        code: 'oling_lab_furniture_sale_quote_failed',
        message: 'Could not price that furniture.'
      });
    }
  });

  app.post('/api/olings/lab/furniture-sale', async (req, res) => {
    try {
      const sale = await loadSale(req, res);
      if (!sale) return;
      const { account, olingState, lab, target, quote } = sale;
      const now = new Date();
      const nextLab = removePlacedFurniture(lab, target);
      const currentFurniture = Array.isArray(account.olings?.furniture)
        ? account.olings.furniture
        : olingState?.inventory?.furniture || [];
      const nextFurniture = decrementFurnitureInventory(
        currentFurniture,
        quote.itemKey,
        now
      );
      const currentBalance = Math.max(
        0,
        Number(account.gameData?.opals?.balance || 0)
      );
      const balanceAfter = currentBalance + quote.payout;
      const transactions = Array.isArray(account.gameData?.opalTransactions)
        ? account.gameData.opalTransactions
        : [];
      const stillOwned = nextFurniture.some(
        (item) => item?.key === quote.itemKey && Number(item.quantity) > 0
      );
      const unlocks = Array.isArray(account.gameData?.inGamePurchasesAndUnlocks)
        ? account.gameData.inGamePurchasesAndUnlocks
        : [];
      account.set('olings.lab', nextLab);
      account.set('olings.furniture', nextFurniture);
      if (!stillOwned && !STARTER_FURNITURE_KEYS.includes(quote.itemKey)) {
        account.set(
          'gameData.inGamePurchasesAndUnlocks',
          unlocks.filter(
            (unlock) =>
              !(
                unlock?.type === 'oling_furniture' &&
                unlock?.key === quote.itemKey
              )
          )
        );
      }
      account.set('gameData.opals.balance', balanceAfter);
      account.set(
        'gameData.opals.lifetimeEarned',
        Math.max(0, Number(account.gameData?.opals?.lifetimeEarned || 0)) +
          quote.payout
      );
      account.set('gameData.opalTransactions', [
        ...transactions,
        {
          type: 'refund',
          amount: quote.payout,
          reason: `Quick sold ${quote.furnitureName}`,
          sourceType: 'refund',
          sourceId: quote.itemKey,
          balanceAfter,
          metadata: {
            itemType: 'furniture',
            itemKey: quote.itemKey,
            placedId: quote.placedId,
            paidPrice: quote.paidPrice,
            rate: FURNITURE_QUICK_SELL_RATE
          },
          createdAt: now
        }
      ]);
      await account.save({ validateBeforeSave: false });
      if (OlingState?.updateOne) {
        await OlingState.updateOne(
          { ownerId: account._id },
          {
            $set: {
              lab: nextLab,
              'inventory.furniture': nextFurniture
            }
          },
          { upsert: true, runValidators: false }
        );
      }
      const stateForOwnership = {
        inventory: { furniture: nextFurniture },
        lab: nextLab
      };
      res.apiSuccess({
        message: `${quote.furnitureName} sold for ${quote.payout} Opals.`,
        quote: { ...quote, balanceAfter },
        account: serializeAccount(account),
        lab: serializeOlingLab(nextLab),
        inventory: {
          furniture: [...getOwnedLabFurniture(account, stateForOwnership)].map(
            (key) => ({ key })
          )
        }
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to sell furniture:`, err);
      res.apiError({
        status: 500,
        code: 'oling_lab_furniture_sale_failed',
        message: 'Could not sell that furniture.'
      });
    }
  });
}

module.exports = {
  FURNITURE_QUICK_SELL_RATE,
  findPlacedFurniture,
  getFurnitureSaleBlock,
  getRecordedFurniturePrice,
  createFurnitureSaleQuote,
  removePlacedFurniture,
  decrementFurnitureInventory,
  registerOlingLabFurnitureSaleRoutes
};
