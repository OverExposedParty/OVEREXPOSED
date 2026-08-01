function registerOlingLabPublicCatalogRoutes(context) {
  const {
    app,
    OlingEgg,
    OlingBuildSet,
    listPublishedOlingEggs,
    serializeOlingEgg,
    OlingTrait,
    listPublishedOlingTraits,
    serializeOlingTrait,
    OlingPersonality,
    listPublishedOlingPersonalities,
    serializeOlingPersonality,
    OlingConsumable,
    listOlingConsumables,
    serializeOlingConsumable
  } = context;

  app.get('/api/olings/eggs', async (req, res) => {
    try {
      const eggs = await listPublishedOlingEggs({ OlingEgg, OlingBuildSet });

      res.apiSuccess({
        eggs: eggs.map(serializeOlingEgg)
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to fetch Oling eggs:`, err);
      res.apiError({
        status: 500,
        code: 'oling_eggs_fetch_failed',
        message: 'Failed to fetch Oling eggs'
      });
    }
  });

  app.get('/api/olings/traits', async (req, res) => {
    try {
      const traits = await listPublishedOlingTraits({ OlingTrait });

      res.apiSuccess({
        traits: traits.map(serializeOlingTrait)
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to fetch Oling traits:`, err);
      res.apiError({
        status: 500,
        code: 'oling_traits_fetch_failed',
        message: 'Failed to fetch Oling traits'
      });
    }
  });

  app.get('/api/olings/personalities', async (req, res) => {
    try {
      const personalityDefinitions = await listPublishedOlingPersonalities({
        OlingPersonality
      });

      res.apiSuccess({
        personalities: personalityDefinitions.map(serializeOlingPersonality)
      });
    } catch (err) {
      console.error(
        `[REQ ${req.id}] Failed to fetch Oling personalities:`,
        err
      );
      res.apiError({
        status: 500,
        code: 'oling_personalities_fetch_failed',
        message: 'Failed to fetch Oling personalities'
      });
    }
  });

  app.get('/api/olings/consumables', async (req, res) => {
    try {
      const consumables = await listOlingConsumables({ OlingConsumable });

      res.apiSuccess({
        consumables: consumables.map(serializeOlingConsumable)
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to fetch Oling consumables:`, err);
      res.apiError({
        status: 500,
        code: 'oling_consumables_fetch_failed',
        message: 'Failed to fetch Oling consumables'
      });
    }
  });
}

module.exports = { registerOlingLabPublicCatalogRoutes };
