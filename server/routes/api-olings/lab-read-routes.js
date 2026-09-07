const { createOlingLabTutorial } = require('./lab-tutorial');
const {
  normalizeOlingLabVisibility
} = require('../../services/oling-lab-access');

function registerOlingLabReadRoutes(context) {
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
    listOlingPodDefinitions,
    serializeOlingPodDefinition
  } = context;

  const getPodDefinitions = () =>
    listOlingPodDefinitions().map(serializeOlingPodDefinition);

  app.get('/api/olings/lab/tutorial', async (req, res) => {
    try {
      const eggs = await OlingEgg.find({
        enabled: true,
        status: 'published'
      })
        .sort({ collection: 1, key: 1 })
        .lean();
      const consumables = await listOlingConsumables({ OlingConsumable });
      const serializedEggs = eggs.map(serializeOlingEgg);
      const tutorialEgg = serializedEggs[0];

      res.apiSuccess({
        tutorial: true,
        lab: serializeOlingLab(createOlingLabTutorial()),
        expansion: null,
        inventory: {
          furniture: Object.keys(OlingLabItems).map((key) => ({ key })),
          wallDecorations: Object.values(OlingLabWallDecorations).map(
            (item) => ({ key: item.id, quantity: 1 })
          ),
          wallpapers: Object.keys(OlingLabWallpapers).map((key) => ({ key })),
          wallpaperVariants: Object.values(OlingLabWallpapers).flatMap(
            (wallpaper) =>
              Object.keys(wallpaper.variants || {}).map((variantKey) => ({
                key: `${wallpaper.key}:${variantKey}`,
                wallpaperKey: wallpaper.key,
                variantKey
              }))
          ),
          consumables: [],
          eggs: tutorialEgg ? [{ key: tutorialEgg.key, quantity: 2 }] : [],
          pods: []
        },
        catalog: Object.values(OlingLabItems).map(serializeOlingLabItem),
        wallDecorations: Object.values(OlingLabWallDecorations).map(
          serializeOlingLabWallDecoration
        ),
        wallpapers: Object.values(OlingLabWallpapers),
        consumables: consumables.map(serializeOlingConsumable),
        podDefinitions: getPodDefinitions(),
        eggs: serializedEggs,
        olings: []
      });
    } catch (err) {
      console.error(
        `[REQ ${req.id}] Failed to fetch Olings Lab tutorial:`,
        err
      );
      res.apiError({
        status: 500,
        code: 'oling_lab_tutorial_fetch_failed',
        message: 'Failed to load the Olings Lab tutorial'
      });
    }
  });

  app.get('/api/olings/lab', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to use your Olings Lab.'
        });
      }

      const eggs = await OlingEgg.find({
        enabled: true,
        status: 'published'
      })
        .sort({ collection: 1, key: 1 })
        .lean();
      const consumables = await listOlingConsumables({ OlingConsumable });
      const olingState = await getOrCreateOlingState(OlingState, account);
      const ownedWallpapers = getOwnedLabWallpapers(account);
      const ownedWallpaperVariants = getOwnedLabWallpaperVariants(account);
      const ownedWallDecorations = getOwnedWallDecorationQuantities(
        account,
        olingState
      );

      res.apiSuccess({
        owner: {
          username: account.username,
          displayName: account.profile?.displayName || account.username
        },
        viewer: { isOwner: true },
        privacy: {
          visibility: normalizeOlingLabVisibility(
            olingState?.lab?.visibility ?? account.olings?.lab?.visibility
          )
        },
        account: serializeAccount(account, { olingState }),
        lab: serializeOlingLab(olingState?.lab, {
          ownedWallpaperKeys: ownedWallpapers,
          ownedWallpaperVariantKeys: ownedWallpaperVariants
        }),
        expansion: getLabExpansionDetails(olingState?.lab, account),
        inventory: {
          furniture: [...getOwnedLabFurniture(account, olingState)].map(
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
          consumables: Array.isArray(olingState?.inventory?.consumables)
            ? olingState.inventory.consumables
            : [],
          eggs: Array.isArray(olingState?.inventory?.eggs)
            ? olingState.inventory.eggs
            : [],
          pods: Array.isArray(account.olings?.pods)
            ? account.olings.pods
            : Array.isArray(olingState?.inventory?.pods)
              ? olingState.inventory.pods
              : []
        },
        catalog: Object.values(OlingLabItems).map(serializeOlingLabItem),
        wallDecorations: Object.values(OlingLabWallDecorations).map(
          serializeOlingLabWallDecoration
        ),
        wallpapers: Object.values(OlingLabWallpapers),
        consumables: consumables.map(serializeOlingConsumable),
        podDefinitions: getPodDefinitions(),
        eggs: eggs.map(serializeOlingEgg)
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to fetch Olings Lab:`, err);
      res.apiError({
        status: 500,
        code: 'oling_lab_fetch_failed',
        message: 'Failed to fetch your Olings Lab'
      });
    }
  });
}

module.exports = { registerOlingLabReadRoutes };
