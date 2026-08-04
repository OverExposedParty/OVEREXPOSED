function createOePanelOlingPayloadHelpers(context) {
  with (context) {
    function getContentSyncAlertsForArea(contentSync, area) {
      return Array.isArray(contentSync?.alerts)
        ? contentSync.alerts.filter((alert) => alert.area === area)
        : [];
    }

    function createOlingSyncWarnings(contentSync) {
      return getContentSyncAlertsForArea(contentSync, 'oLings').map(
        (alert) => ({
          severity: alert.severity || 'warning',
          area: 'JSON Sync',
          item: alert.target || 'json-backup',
          issue: alert.title,
          detail: alert.detail,
          fix: 'Export oLing consumables after confirming the database content is correct.',
          syncEndpoint: alert.syncEndpoint,
          syncConfirmMessage: alert.syncConfirmMessage,
          syncSuccessMessage: alert.syncSuccessMessage,
          syncRefreshKeys: alert.syncRefreshKeys
        })
      );
    }

    const OE_PANEL_OLING_LAYERS = ['flight', 'body', 'eyes', 'mouth'];
    const OE_PANEL_OLING_RARITIES = [
      'common',
      'uncommon',
      'rare',
      'epic',
      'legendary',
      'mythic'
    ];

    function normalizeOePanelOlingKey(value) {
      return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    }

    function parseOePanelJsonInput(value, fallback) {
      if (value === null || value === undefined || value === '')
        return fallback;
      if (typeof value === 'object') return value;

      try {
        return JSON.parse(String(value));
      } catch {
        return null;
      }
    }

    function formatOePanelJson(value) {
      return JSON.stringify(value || {}, null, 2);
    }

    function normalizeOePanelList(value) {
      if (Array.isArray(value)) {
        return value
          .map((item) => normalizeOePanelOlingKey(item))
          .filter(Boolean);
      }

      return String(value || '')
        .split(',')
        .map((item) => normalizeOePanelOlingKey(item))
        .filter(Boolean);
    }

    function normalizeOePanelOlingStatus(value, fallback = 'draft') {
      const status = String(value || fallback)
        .trim()
        .toLowerCase();
      return ['draft', 'published', 'archived'].includes(status)
        ? status
        : null;
    }

    function normalizeOePanelOlingBoolean(value, fallback = false) {
      if (value === null || value === undefined || value === '')
        return fallback;
      const parsed = parseBooleanLabel(value);
      return parsed === null ? null : parsed;
    }

    function normalizeOePanelRarityOdds(value) {
      const parsed = parseOePanelJsonInput(value, {});
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }

      return Object.fromEntries(
        OE_PANEL_OLING_RARITIES.map((rarity) => [
          rarity,
          Math.max(0, Number(parsed[rarity]) || 0)
        ])
      );
    }

    function getOePanelSetRarities(egg = {}) {
      const rarities = (Array.isArray(egg.sets) ? egg.sets : [])
        .map((set) =>
          String(set?.rarity || '')
            .trim()
            .toLowerCase()
        )
        .filter((rarity) => OE_PANEL_OLING_RARITIES.includes(rarity));

      return [...new Set(rarities)];
    }

    function getOePanelRollableRarityOdds(egg = {}) {
      const setRarities = new Set(getOePanelSetRarities(egg));

      return Object.fromEntries(
        OE_PANEL_OLING_RARITIES.filter((rarity) => setRarities.has(rarity)).map(
          (rarity) => [
            rarity,
            Math.max(0, Number(egg.rarityOdds?.[rarity]) || 0)
          ]
        )
      );
    }

    function getOePanelSetDerivedPools(egg = {}) {
      const pools = Object.fromEntries(
        OE_PANEL_OLING_LAYERS.map((layer) => [
          layer,
          Object.fromEntries(
            OE_PANEL_OLING_RARITIES.map((rarity) => [rarity, []])
          )
        ])
      );

      (Array.isArray(egg.sets) ? egg.sets : []).forEach((set) => {
        const rarity = String(set?.rarity || '')
          .trim()
          .toLowerCase();
        if (!OE_PANEL_OLING_RARITIES.includes(rarity)) return;

        OE_PANEL_OLING_LAYERS.forEach((layer) => {
          const traitKey = normalizeOePanelOlingKey(set?.traits?.[layer]);
          if (!traitKey || pools[layer][rarity].includes(traitKey)) return;
          pools[layer][rarity].push(traitKey);
        });
      });

      return pools;
    }

    function attachOePanelBuildSetsToEggs(eggs = [], buildSets = []) {
      const buildSetsByKey = new Map(buildSets.map((set) => [set.key, set]));

      return eggs.map((egg) => ({
        ...egg,
        setKeys: Array.isArray(egg.setKeys) ? egg.setKeys : [],
        sets: (Array.isArray(egg.setKeys) ? egg.setKeys : [])
          .map((setKey) => buildSetsByKey.get(normalizeOePanelOlingKey(setKey)))
          .filter(Boolean)
      }));
    }

    function normalizeOePanelBuildSets(value) {
      const parsed = parseOePanelJsonInput(value, []);
      if (!Array.isArray(parsed)) return null;

      return parsed
        .map((set) => {
          const key = normalizeOePanelOlingKey(set?.key);
          const name = String(set?.name || key).trim();
          const rarity = String(set?.rarity || 'common')
            .trim()
            .toLowerCase();
          const traits = set?.traits || {};

          if (
            !key ||
            !name ||
            !OE_PANEL_OLING_RARITIES.includes(rarity) ||
            OE_PANEL_OLING_LAYERS.some(
              (layer) => !normalizeOePanelOlingKey(traits[layer])
            )
          ) {
            return null;
          }

          return {
            key,
            name,
            rarity,
            traits: Object.fromEntries(
              OE_PANEL_OLING_LAYERS.map((layer) => [
                layer,
                normalizeOePanelOlingKey(traits[layer])
              ])
            ),
            status: set.status || 'published',
            enabled: set.enabled !== false,
            assets:
              set.assets &&
              typeof set.assets === 'object' &&
              !Array.isArray(set.assets)
                ? set.assets
                : {},
            metadata:
              set.metadata && typeof set.metadata === 'object'
                ? set.metadata
                : {}
          };
        })
        .filter(Boolean);
    }

    function createOePanelEggPayload(body = {}, existing = null) {
      const key = existing?.key || normalizeOePanelOlingKey(body.key);
      const name = String(body.name || existing?.name || '').trim();
      const collection = normalizeOePanelOlingKey(
        body.collection || existing?.collection || 'base'
      );
      const status = normalizeOePanelOlingStatus(body.status, existing?.status);
      const enabled = normalizeOePanelOlingBoolean(
        body.enabled,
        existing?.enabled === true
      );
      const rarityOdds = Object.prototype.hasOwnProperty.call(
        body,
        'rarityOddsJson'
      )
        ? normalizeOePanelRarityOdds(body.rarityOddsJson)
        : existing?.rarityOdds;
      const hasSetsJson = Object.prototype.hasOwnProperty.call(
        body,
        'setsJson'
      );
      const sets = hasSetsJson
        ? normalizeOePanelBuildSets(body.setsJson)
        : null;
      const setKeys = hasSetsJson
        ? sets?.map((set) => set.key) || []
        : existing?.setKeys || [];
      const assets = Object.prototype.hasOwnProperty.call(body, 'assetsJson')
        ? parseOePanelJsonInput(body.assetsJson, {})
        : existing?.assets || {};
      const metadata = Object.prototype.hasOwnProperty.call(
        body,
        'metadataJson'
      )
        ? parseOePanelJsonInput(body.metadataJson, {})
        : existing?.metadata || {};
      const personalityPool = Object.prototype.hasOwnProperty.call(
        body,
        'personalityPool'
      )
        ? normalizeOePanelList(body.personalityPool)
        : existing?.personalityPool || [];

      if (!key) return { error: 'Egg key is required.' };
      if (!name) return { error: 'Egg name is required.' };
      if (!collection) return { error: 'Egg collection is required.' };
      if (!status)
        return { error: 'Egg status must be draft, published, or archived.' };
      if (enabled === null) return { error: 'Active must be yes or no.' };
      if (!rarityOdds) return { error: 'Rarity odds must be valid JSON.' };
      if (hasSetsJson && !sets)
        return { error: 'Build sets must be valid JSON.' };
      if (!assets || typeof assets !== 'object' || Array.isArray(assets)) {
        return { error: 'Assets must be valid JSON object.' };
      }
      if (
        !metadata ||
        typeof metadata !== 'object' ||
        Array.isArray(metadata)
      ) {
        return { error: 'Metadata must be valid JSON object.' };
      }

      if (body.image && !assets.image) {
        assets.image = String(body.image).trim();
      }

      return {
        egg: {
          key,
          name,
          collection,
          status,
          enabled,
          rarityOdds,
          setKeys,
          personalityPool,
          assets,
          metadata
        },
        buildSets: sets
      };
    }

    function createOePanelTraitUpdatePayload(body = {}) {
      const update = {};
      const jsonFields = {
        bodyStatsJson: 'body',
        attackJson: 'attack',
        modifiersJson: 'modifiers',
        passiveJson: 'passive',
        assetsJson: 'assets'
      };

      ['name', 'collection', 'theme', 'rarity', 'status', 'flavor'].forEach(
        (field) => {
          if (!Object.prototype.hasOwnProperty.call(body, field)) return;
          const value = String(body[field] || '').trim();
          if (['collection', 'theme'].includes(field)) {
            update[field] = normalizeOePanelOlingKey(value);
          } else {
            update[field] = value;
          }
        }
      );

      if (Object.prototype.hasOwnProperty.call(body, 'enabled')) {
        const enabled = normalizeOePanelOlingBoolean(body.enabled, true);
        if (enabled === null) return { error: 'Active must be yes or no.' };
        update.enabled = enabled;
      }

      if (update.rarity && !OE_PANEL_OLING_RARITIES.includes(update.rarity)) {
        return { error: 'Trait rarity is invalid.' };
      }

      if (
        update.status &&
        !['draft', 'published', 'archived'].includes(update.status)
      ) {
        return { error: 'Trait status must be draft, published, or archived.' };
      }

      for (const [inputKey, updateKey] of Object.entries(jsonFields)) {
        if (!Object.prototype.hasOwnProperty.call(body, inputKey)) continue;
        const parsed = parseOePanelJsonInput(body[inputKey], {});
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return { error: `${inputKey} must be a valid JSON object.` };
        }
        update[updateKey] = parsed;
      }

      return { update };
    }

    return {
      OE_PANEL_OLING_LAYERS,
      OE_PANEL_OLING_RARITIES,
      attachOePanelBuildSetsToEggs,
      createOePanelEggPayload,
      createOePanelTraitUpdatePayload,
      createOlingSyncWarnings,
      formatOePanelJson,
      getOePanelRollableRarityOdds,
      getOePanelSetRarities,
      getOePanelSetDerivedPools,
      normalizeOePanelOlingBoolean,
      normalizeOePanelOlingKey
    };
  }
}

module.exports = {
  createOePanelOlingPayloadHelpers
};
