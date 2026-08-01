const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const DEFAULT_PRESET = '30d';
const VALID_PRESETS = new Set(['today', '7d', '30d', '90d', 'all', 'custom']);
const VALID_METRICS = new Set(['games', 'players']);
const FALLBACK_COLOURS = [
  '#FF6B8A',
  '#62C6FF',
  '#FFD166',
  '#8DE2B2',
  '#B895FF',
  '#FF9F68',
  '#5FE0D0',
  '#F084D5',
  '#9DCB5A',
  '#7F9CFF',
  '#E7B65A',
  '#76D6F2'
];

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function parseInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

function parseExcludedGamemodes(value) {
  const values = Array.isArray(value) ? value : [value];
  return [
    ...new Set(
      values
        .flatMap((entry) => String(entry || '').split(','))
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 100)
    )
  ];
}

function parseDate(value, label) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { error: `${label} must be a valid ISO date.` };
  }
  return { date };
}

function getPresetRange(preset, now) {
  if (preset === 'all') return { from: null, to: null };

  if (preset === 'today') {
    const from = new Date(now);
    from.setUTCHours(0, 0, 0, 0);
    return {
      from,
      to: new Date(from.getTime() + DAY_IN_MILLISECONDS)
    };
  }

  const days = preset === '7d' ? 7 : preset === '90d' ? 90 : 30;
  return {
    from: new Date(now.getTime() - days * DAY_IN_MILLISECONDS),
    to: now
  };
}

function parseGamemodeDistributionQuery(query = {}, now = new Date()) {
  const requestedPreset = String(query.preset || '').toLowerCase();
  const requestedMetric = String(query.metric || '').toLowerCase();
  if (requestedPreset && !VALID_PRESETS.has(requestedPreset)) {
    return { error: 'Date preset is invalid.' };
  }
  if (requestedMetric && !VALID_METRICS.has(requestedMetric)) {
    return { error: 'Metric must be games or players.' };
  }

  const preset = requestedPreset || DEFAULT_PRESET;
  const metric = requestedMetric || 'games';
  const parsedFrom = parseDate(query.from, 'From date');
  const parsedTo = parseDate(query.to, 'To date');

  if (parsedFrom?.error) return { error: parsedFrom.error };
  if (parsedTo?.error) return { error: parsedTo.error };
  if (preset === 'custom' && (!parsedFrom?.date || !parsedTo?.date)) {
    return { error: 'Custom ranges require both a from and to date.' };
  }

  const presetRange = getPresetRange(preset, now);
  const from = parsedFrom?.date || presetRange.from;
  const to = parsedTo?.date || presetRange.to;

  if (from && to && from >= to) {
    return { error: 'From date must be earlier than the to date.' };
  }

  return {
    filters: {
      preset,
      metric,
      from,
      to,
      excludedGamemodes: parseExcludedGamemodes(query.exclude),
      includeUnknown: parseBoolean(query.includeUnknown, false),
      minimumCount: parseInteger(query.minimumCount, 0, 0, 1000000),
      topN: parseInteger(query.topN, 0, 0, 50),
      search: String(query.search || '')
        .trim()
        .toLowerCase()
        .slice(0, 100)
    }
  };
}

function getFallbackColour(key) {
  const hash = Array.from(String(key || 'unknown')).reduce(
    (total, character) => (total * 31 + character.charCodeAt(0)) >>> 0,
    0
  );
  return FALLBACK_COLOURS[hash % FALLBACK_COLOURS.length];
}

function normalizeHexColour(value, fallback) {
  const colour = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(colour) ? colour : fallback;
}

function createGamemodeMatch(filters) {
  const match = {};
  if (filters.from || filters.to) {
    match.archivedAt = {};
    if (filters.from) match.archivedAt.$gte = filters.from;
    if (filters.to) match.archivedAt.$lt = filters.to;
  }

  const gamemodeConditions = [];
  if (!filters.includeUnknown) {
    gamemodeConditions.push({ gamemode: { $type: 'string', $ne: '' } });
  }
  if (filters.excludedGamemodes.length) {
    gamemodeConditions.push({
      gamemode: { $nin: filters.excludedGamemodes }
    });
  }
  if (gamemodeConditions.length) {
    match.$and = gamemodeConditions;
  }

  return match;
}

function createGamemodeDistributionPipeline(filters) {
  return [
    { $match: createGamemodeMatch(filters) },
    {
      $group: {
        _id: {
          $cond: [
            {
              $and: [
                { $eq: [{ $type: '$gamemode' }, 'string'] },
                { $ne: ['$gamemode', ''] }
              ]
            },
            { $toLower: '$gamemode' },
            'unknown'
          ]
        },
        games: { $sum: 1 },
        players: { $sum: { $size: { $ifNull: ['$players', []] } } }
      }
    },
    { $sort: { games: -1, _id: 1 } }
  ];
}

function buildGamemodeDistribution({
  aggregationRows,
  gameModes,
  filters,
  formatLabel
}) {
  const modeConfigByKey = new Map(
    gameModes.map((mode) => [String(mode.gameType || '').toLowerCase(), mode])
  );
  const observedKeys = aggregationRows.map((row) =>
    String(row._id || 'unknown').toLowerCase()
  );
  const availableKeys = [
    ...new Set([
      ...gameModes.map((mode) => String(mode.gameType || '').toLowerCase()),
      ...observedKeys
    ])
  ].filter(Boolean);
  const availableGamemodes = availableKeys
    .map((key) => {
      const mode = modeConfigByKey.get(key);
      return {
        key,
        label: mode?.name || (key === 'unknown' ? 'Unknown' : formatLabel(key))
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));

  let elements = aggregationRows.map((row) => {
    const key = String(row._id || 'unknown').toLowerCase();
    const mode = modeConfigByKey.get(key);
    const fallbackColour = getFallbackColour(key);
    return {
      key,
      label: mode?.name || (key === 'unknown' ? 'Unknown' : formatLabel(key)),
      games: Number(row.games || 0),
      players: Number(row.players || 0),
      value:
        filters.metric === 'players'
          ? Number(row.players || 0)
          : Number(row.games || 0),
      colour: normalizeHexColour(mode?.colours?.primary, fallbackColour),
      secondaryColour: normalizeHexColour(
        mode?.colours?.secondary,
        fallbackColour
      )
    };
  });

  if (filters.search) {
    elements = elements.filter((element) =>
      `${element.key} ${element.label}`.toLowerCase().includes(filters.search)
    );
  }
  if (filters.minimumCount > 0) {
    elements = elements.filter(
      (element) => element.value >= filters.minimumCount
    );
  }

  elements.sort(
    (left, right) =>
      right.value - left.value || left.label.localeCompare(right.label)
  );

  if (filters.topN > 0 && elements.length > filters.topN) {
    const visibleElements = elements.slice(0, filters.topN);
    const otherElements = elements.slice(filters.topN);
    visibleElements.push({
      key: 'other',
      label: 'Other',
      games: otherElements.reduce((total, element) => total + element.games, 0),
      players: otherElements.reduce(
        (total, element) => total + element.players,
        0
      ),
      value: otherElements.reduce((total, element) => total + element.value, 0),
      colour: '#8D93A1',
      secondaryColour: '#6F7480',
      groupedKeys: otherElements.map((element) => element.key)
    });
    elements = visibleElements;
  }

  const total = elements.reduce((sum, element) => sum + element.value, 0);
  elements = elements.map((element) => ({
    ...element,
    percentage: total ? Number(((element.value / total) * 100).toFixed(1)) : 0
  }));

  return { total, elements, availableGamemodes };
}

function registerGamemodeDistributionRoute(context) {
  const {
    app,
    archivedRoomSchema,
    GameMode,
    requireOePanelAccount,
    formatPartyGameLabel
  } = context;

  app.get(
    '/api/oe-panel/party-games/gamemode-distribution',
    async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const parsed = parseGamemodeDistributionQuery(req.query);
        if (parsed.error) {
          return res.apiError({
            status: 400,
            code: 'oe_panel_gamemode_distribution_filter_invalid',
            message: parsed.error
          });
        }

        const [aggregationRows, gameModes] = await Promise.all([
          archivedRoomSchema.aggregate(
            createGamemodeDistributionPipeline(parsed.filters)
          ),
          GameMode.find({})
            .select('gameType name colours status enabled sortOrder')
            .sort({ sortOrder: 1, gameType: 1 })
            .lean()
        ]);
        const distribution = buildGamemodeDistribution({
          aggregationRows,
          gameModes,
          filters: parsed.filters,
          formatLabel: formatPartyGameLabel
        });

        res.apiSuccess({
          data: {
            ...distribution,
            metric: parsed.filters.metric,
            range: {
              preset: parsed.filters.preset,
              from: parsed.filters.from?.toISOString() || null,
              to: parsed.filters.to?.toISOString() || null
            }
          }
        });
      } catch (err) {
        console.error(
          `[REQ ${req.id}] Failed to fetch gamemode distribution:`,
          err
        );
        res.apiError({
          status: 500,
          code: 'oe_panel_gamemode_distribution_fetch_failed',
          message: 'Failed to fetch gamemode distribution'
        });
      }
    }
  );
}

module.exports = {
  buildGamemodeDistribution,
  createGamemodeDistributionPipeline,
  parseGamemodeDistributionQuery,
  registerGamemodeDistributionRoute
};
