function registerOePanelOlingSimulationRoutes(context, helpers) {
  const { app } = context;
  const { OlingEgg } = context.models || {};
  const { OE_PANEL_OLING_LAYERS, getOePanelRollableRarityOdds, getOePanelSetDerivedPools, normalizeOePanelOlingBoolean, normalizeOePanelOlingKey, pickOePanelRandom, pickOePanelWeightedRarity } = helpers;

  with (context) {
    app.post('/api/oe-panel/olings/simulate', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const eggKey = normalizeOePanelOlingKey(req.body?.eggKey);
        const rolls = Math.min(
          5000,
          Math.max(1, Math.floor(Number(req.body?.rolls) || 100))
        );
        const includeDrafts = normalizeOePanelOlingBoolean(
          req.body?.includeDrafts,
          true
        );
        const egg = await OlingEgg.findOne({
          key: eggKey,
          ...(includeDrafts ? {} : { enabled: true, status: 'published' })
        }).lean();

        if (!egg) {
          return res.apiError({
            status: 404,
            code: 'oe_panel_oling_simulation_egg_not_found',
            message: 'oLing egg not found for simulation.'
          });
        }

        const summary = {
          rarities: {},
          traits: {},
          failedRolls: 0
        };

        for (let index = 0; index < rolls; index += 1) {
          OE_PANEL_OLING_LAYERS.forEach((layer) => {
            const rarity = pickOePanelWeightedRarity(
              getOePanelRollableRarityOdds(egg)
            );
            const trait = pickOePanelRandom(
              getOePanelSetDerivedPools(egg)?.[layer]?.[rarity] || []
            );
            if (!rarity || !trait) {
              summary.failedRolls += 1;
              return;
            }
            summary.rarities[rarity] =
              Number(summary.rarities[rarity] || 0) + 1;
            summary.traits[trait] = Number(summary.traits[trait] || 0) + 1;
          });
        }

        await createAdminLog(AdminLog, account, {
          action: 'Ran oLing hatch simulation',
          area: 'oLings',
          target: { type: 'oling_egg', id: egg.key, label: egg.name },
          previousValue: '-',
          newValue: { rolls, summary },
          severity: 'low',
          metadata: { collection: 'oling-eggs', simulation: true }
        });

        res.apiSuccess({
          data: {
            simulation: {
              eggKey: egg.key,
              rolls,
              summary
            }
          },
          message: `Simulated ${rolls} hatch${rolls === 1 ? '' : 'es'}.`
        });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to simulate oLing hatch:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_oling_simulation_failed',
          message: 'Failed to simulate oLing hatches'
        });
      }
    });
  }
}

module.exports = {
  registerOePanelOlingSimulationRoutes
};
