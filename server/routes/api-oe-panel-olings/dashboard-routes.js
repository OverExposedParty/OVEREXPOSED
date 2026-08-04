function registerOePanelOlingDashboardRoutes(context, helpers) {
  const { app } = context;
  const {
    OlingEgg,
    OlingTrait,
    OlingPersonality,
    OlingBuildSet,
    OlingHatchReceipt,
    PlayerOling
  } = context.models || {};
  const {
    OE_PANEL_OLING_LAYERS,
    attachOePanelBuildSetsToEggs,
    createOePanelRarityBalancer,
    createOlingSyncWarnings,
    formatOePanelJson,
    getOePanelOlingOwnerLabels,
    getOePanelOlingWarnings,
    serializeOePanelBuildSets,
    serializeOePanelOlingEgg,
    serializeOePanelOlingTrait,
    summarizeOePanelRolls
  } = helpers;

  with (context) {
    const {
      getContentSyncHealth
    } = require('../../services/content-sync-health');

    app.get('/api/oe-panel/olings', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const [
          rawEggs,
          traits,
          personalities,
          buildSets,
          hatchReceipts,
          playerOlings
        ] = await Promise.all([
          OlingEgg.find({}).sort({ collection: 1, key: 1 }).lean(),
          OlingTrait.find({}).sort({ collection: 1, layer: 1, key: 1 }).lean(),
          OlingPersonality.find({}).sort({ key: 1 }).lean(),
          OlingBuildSet.find({})
            .sort({ collection: 1, rarity: 1, key: 1 })
            .lean(),
          OlingHatchReceipt.find({}).sort({ createdAt: -1 }).limit(100).lean(),
          PlayerOling.find({}).sort({ hatchedAt: -1 }).limit(100).lean()
        ]);
        const eggs = attachOePanelBuildSetsToEggs(rawEggs, buildSets);
        const hatchCountsRaw = await OlingHatchReceipt.aggregate([
          { $group: { _id: '$eggKey', count: { $sum: 1 } } }
        ]);
        const hatchCounts = Object.fromEntries(
          hatchCountsRaw.map((row) => [row._id, row.count])
        );
        const ownerIds = [
          ...new Set(
            [...hatchReceipts, ...playerOlings]
              .map((item) => String(item.ownerId || ''))
              .filter(Boolean)
          )
        ];
        const ownerLabels = await getOePanelOlingOwnerLabels(ownerIds);
        const todayKey = new Date().toISOString().slice(0, 10);
        const contentSync = await getContentSyncHealth(context.models || {});
        const warnings = [
          ...createOlingSyncWarnings(contentSync),
          ...getOePanelOlingWarnings({
            eggs,
            traits,
            personalities
          })
        ];
        const traitsByKey = new Map(traits.map((trait) => [trait.key, trait]));

        res.apiSuccess({
          data: {
            stats: {
              totalEggs: eggs.length,
              activeEggs: eggs.filter(
                (egg) => egg.enabled && egg.status === 'published'
              ).length,
              totalEggsOpened: hatchReceipts.length
                ? await OlingHatchReceipt.countDocuments({})
                : 0,
              openedToday: await OlingHatchReceipt.countDocuments({
                createdAt: { $gte: new Date(`${todayKey}T00:00:00.000Z`) }
              }),
              totalOlings: await PlayerOling.countDocuments({}),
              favoritedOlings: await PlayerOling.countDocuments({
                favorite: true
              }),
              totalBuildSets: buildSets.length,
              totalTraits: traits.length
            },
            eggs: eggs.map((egg) => serializeOePanelOlingEgg(egg, hatchCounts)),
            traits: traits.map(serializeOePanelOlingTrait),
            buildSets: serializeOePanelBuildSets(eggs, buildSets),
            hatchReceipts: hatchReceipts.map((receipt) => ({
              id: String(receipt._id),
              createdAt: formatOePanelDateTime(receipt.createdAt),
              owner:
                ownerLabels.get(String(receipt.ownerId)) ||
                String(receipt.ownerId),
              ownerId: String(receipt.ownerId),
              eggKey: receipt.eggKey,
              olingId: receipt.olingId ? String(receipt.olingId) : '-',
              summary: summarizeOePanelRolls(receipt.rolls),
              rollsJson: formatOePanelJson(receipt.rolls),
              inventoryChangeJson: formatOePanelJson(receipt.inventoryChange),
              userAgent: receipt.request?.userAgent || '-'
            })),
            playerOlings: playerOlings.map((oling) => {
              const themes = OE_PANEL_OLING_LAYERS.map(
                (layer) => traitsByKey.get(oling.build?.[layer])?.theme
              ).filter(Boolean);
              const matchingSet =
                themes.length === OE_PANEL_OLING_LAYERS.length &&
                themes.every((theme) => theme === themes[0])
                  ? themes[0]
                  : '-';

              return {
                id: String(oling._id),
                owner:
                  ownerLabels.get(String(oling.ownerId)) ||
                  String(oling.ownerId),
                ownerId: String(oling.ownerId),
                eggKey: oling.eggKey,
                personalityKey: oling.personalityKey,
                matchingSet,
                rarities: OE_PANEL_OLING_LAYERS.map(
                  (layer) => oling.buildRarities?.[layer] || '-'
                ).join(', '),
                buildJson: formatOePanelJson(oling.build),
                battleStatsJson: formatOePanelJson(oling.battleStats),
                hatchedAt: formatOePanelDateTime(oling.hatchedAt)
              };
            }),
            rarityBalancer: createOePanelRarityBalancer(eggs),
            warnings
          }
        });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to fetch OE Panel oLings:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_olings_fetch_failed',
          message: 'Failed to fetch oLings panel data'
        });
      }
    });
  }
}

module.exports = {
  registerOePanelOlingDashboardRoutes
};
