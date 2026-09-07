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

function accountStorageContainsItems(account, olingState) {
  const inventory = olingState?.inventory || account?.olings || {};
  return [...(inventory.eggs || []), ...(inventory.consumables || [])].some(
    (item) => Number(item?.quantity || 0) > 0
  );
}

function getOlingLabRemovalBlock({
  previousLab,
  nextLab,
  account,
  olingState,
  definitions
}) {
  const nextItems = new Map(
    (nextLab?.placedItems || []).map((item) => [String(item.placedId), item])
  );

  for (const previousItem of previousLab?.placedItems || []) {
    const nextItem = nextItems.get(String(previousItem.placedId));
    if (!nextItem) {
      const definition = definitions[previousItem.itemId];
      const isAccountStorage = (definition?.inventorySlots || []).some(
        (slot) => slot?.slotType === 'storage'
      );
      if (
        inventorySlotsContainItems(previousItem.inventorySlots) ||
        (isAccountStorage && accountStorageContainsItems(account, olingState))
      ) {
        return {
          code: 'oling_lab_storage_not_empty',
          message: `Remove every item from ${definition?.name || 'this storage'} before storing it.`
        };
      }
      if (
        (previousItem.containerSlots || []).some((slot) =>
          Boolean(slot?.itemId)
        )
      ) {
        return {
          code: 'oling_lab_furniture_has_attached_items',
          message: 'Remove every attached item before storing this furniture.'
        };
      }
      continue;
    }

    for (const previousSlot of previousItem.containerSlots || []) {
      if (!previousSlot?.itemId) continue;
      const nextSlot = (nextItem.containerSlots || []).find(
        (slot) => slot?.slotId === previousSlot.slotId
      );
      if (
        nextSlot?.itemId === previousSlot.itemId ||
        !inventorySlotsContainItems(previousSlot.inventorySlots)
      ) {
        continue;
      }
      return {
        code: 'oling_lab_container_not_empty',
        message: `Remove every item from ${definitions[previousSlot.itemId]?.name || 'this item'} before storing it.`
      };
    }
  }

  return null;
}

function registerOlingLabSaveRoutes(context) {
  const {
    app,
    getCurrentAccount,
    OlingEgg,
    listOlingConsumables,
    OlingConsumable,
    getOrCreateOlingState,
    OlingState,
    serializeAccount,
    serializeOlingLab,
    getLabExpansionDetails,
    getOwnedLabFurniture,
    getOwnedLabWallpapers,
    getOwnedLabWallpaperVariants,
    getOwnedWallDecorationQuantities,
    OlingLabItems,
    OlingLabWallDecorations,
    OlingLabWallpapers,
    serializeOlingLabItem,
    serializeOlingLabWallDecoration,
    serializeOlingConsumable,
    serializeOlingEgg,
    Account,
    PlayerOling,
    getPodStorageContainers = () => [],
    assignLegacyStoredOlingsToPodStorage = async () => ({
      assigned: 0,
      unassigned: 0
    }),
    getOlingDefinitions,
    serializePlayerOling,
    models,
    ensureAccountOlingDocument,
    normalizeLabPayload,
    applyHatchInfluenceReservations
  } = context;

  app.put('/api/olings/lab', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to save your Olings Lab.'
        });
      }

      const olingState = await getOrCreateOlingState(OlingState, account);
      ensureAccountOlingDocument(account, olingState);
      const normalized = normalizeLabPayload(
        req.body?.lab || req.body,
        account,
        olingState
      );
      if (normalized.error) {
        return res.apiError(normalized.error);
      }

      const previousLab = account.olings?.lab?.placedItems
        ? account.olings.lab
        : olingState?.lab;
      const removalBlock = getOlingLabRemovalBlock({
        previousLab,
        nextLab: normalized.lab,
        account,
        olingState,
        definitions: OlingLabItems
      });
      if (removalBlock) {
        return res.apiError({
          status: 409,
          ...removalBlock
        });
      }

      const previousPodStorageIds = getPodStorageContainers(
        account,
        olingState
      ).map((container) => container.placedId);
      const nextPlacedIds = new Set(
        normalized.lab.placedItems.map((item) => String(item.placedId))
      );
      const removedPodStorageIds = previousPodStorageIds.filter(
        (placedId) => !nextPlacedIds.has(placedId)
      );
      if (removedPodStorageIds.length) {
        const occupiedRack = await PlayerOling.findOne({
          ownerId: account._id,
          'residency.state': 'stored',
          'residency.pod.containerPlacedId': { $in: removedPodStorageIds }
        })
          .select('_id')
          .lean();
        if (occupiedRack) {
          return res.apiError({
            status: 409,
            code: 'oling_pod_storage_not_empty',
            message:
              'Move or release every Oling in this Pod Rack before storing the furniture.'
          });
        }
      }

      const consumables = await listOlingConsumables({ OlingConsumable });
      const reservationResult = applyHatchInfluenceReservations(
        normalized.lab,
        previousLab,
        account,
        consumables
      );
      if (reservationResult.error) {
        return res.apiError(reservationResult.error);
      }

      await Account.updateOne(
        { _id: account._id },
        {
          $set: {
            'olings.lab': normalized.lab
          }
        },
        { runValidators: false }
      );
      const updatedAccount = (await Account.findById(account._id)) || account;
      if (OlingState?.updateOne) {
        await OlingState.updateOne(
          { ownerId: updatedAccount._id },
          { $set: { lab: normalized.lab } },
          { upsert: true, runValidators: false }
        );
      }
      const updatedOlingState = await getOrCreateOlingState(
        OlingState,
        updatedAccount
      );
      const podStorageMigration = await assignLegacyStoredOlingsToPodStorage({
        models,
        accountId: updatedAccount._id,
        account: updatedAccount,
        olingState: updatedOlingState
      });
      let migratedOlings = null;
      if (podStorageMigration.assigned > 0) {
        const olings = await PlayerOling.find({ ownerId: updatedAccount._id })
          .sort({ favorite: -1, hatchedAt: -1 })
          .lean();
        const definitions = await getOlingDefinitions(models, olings);
        migratedOlings = olings.map((oling) =>
          serializePlayerOling(oling, definitions)
        );
      }
      const ownedWallpapers = getOwnedLabWallpapers(updatedAccount);
      const ownedWallpaperVariants =
        getOwnedLabWallpaperVariants(updatedAccount);
      const ownedWallDecorations = getOwnedWallDecorationQuantities(
        updatedAccount,
        updatedOlingState
      );

      const eggs = await OlingEgg.find({
        enabled: true,
        status: 'published'
      })
        .sort({ collection: 1, key: 1 })
        .lean();

      res.apiSuccess({
        message: 'Olings Lab saved.',
        podStorageMigration,
        ...(migratedOlings ? { olings: migratedOlings } : {}),
        account: serializeAccount(updatedAccount, {
          olingState: updatedOlingState
        }),
        lab: serializeOlingLab(normalized.lab, {
          ownedWallpaperKeys: ownedWallpapers,
          ownedWallpaperVariantKeys: ownedWallpaperVariants
        }),
        expansion: getLabExpansionDetails(normalized.lab, updatedAccount),
        inventory: {
          furniture: [...getOwnedLabFurniture(account, updatedOlingState)].map(
            (key) => ({ key })
          ),
          wallDecorations: [...ownedWallDecorations].map(([key, quantity]) => ({
            key,
            quantity
          })),
          wallpapers: [...ownedWallpapers].map((key) => ({ key })),
          wallpaperVariants: [...ownedWallpaperVariants].map((key) => {
            const [wallpaperKey, variantKey] = key.split(':');
            return { key, wallpaperKey, variantKey };
          }),
          consumables: Array.isArray(updatedOlingState?.inventory?.consumables)
            ? updatedOlingState.inventory.consumables
            : [],
          eggs: Array.isArray(updatedOlingState?.inventory?.eggs)
            ? updatedOlingState.inventory.eggs
            : []
        },
        catalog: Object.values(OlingLabItems).map(serializeOlingLabItem),
        wallDecorations: Object.values(OlingLabWallDecorations).map(
          serializeOlingLabWallDecoration
        ),
        wallpapers: Object.values(OlingLabWallpapers),
        consumables: consumables.map(serializeOlingConsumable),
        eggs: eggs.map(serializeOlingEgg)
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to save Olings Lab:`, err);
      res.apiError({
        status: 500,
        code: 'oling_lab_save_failed',
        message: 'Failed to save your Olings Lab'
      });
    }
  });
}

module.exports = { registerOlingLabSaveRoutes, getOlingLabRemovalBlock };
