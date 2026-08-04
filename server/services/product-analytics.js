const crypto = require('crypto');
const {
  ANALYTICS_EVENT_NAMES,
  ANALYTICS_RETENTION_DAYS
} = require('../../models/analytics/analytics-event-contract');

const EVENT_NAME_SET = new Set(ANALYTICS_EVENT_NAMES);
const EVENT_ID_PATTERN = /^[a-z0-9_-]{8,100}$/i;
const KEY_PATTERN = /^[a-z0-9_.:-]{1,120}$/i;
const GAME_MODES = new Set([
  'truth-or-dare',
  'paranoia',
  'never-have-i-ever',
  'most-likely-to',
  'imposter',
  'would-you-rather',
  'mafia'
]);
const PLAY_MODES = new Set(['offline', 'online', 'website']);
const AUTH_FLOWS = new Set(['signin', 'signup', 'post_signup']);
const AUTH_PROVIDERS = new Set(['email', 'google', 'discord']);
const AUTH_ENTRY_POINTS = new Set([
  'direct_auth_url',
  'account_notification',
  'account_container',
  'protected_page',
  'auth_page_tab',
  'unknown'
]);

const PROPERTY_FIELDS = Object.freeze({
  notification: new Set([
    'notificationKey',
    'notificationType',
    'category',
    'variant',
    'action',
    'reason',
    'flow',
    'provider'
  ]),
  auth: new Set(['flow', 'provider', 'entryPoint', 'outcome', 'reason']),
  game: new Set([
    'packKey',
    'ruleKey',
    'enabled',
    'value',
    'previousValue',
    'changedFromDefault',
    'selectedPacks',
    'availablePacks',
    'selectedRules',
    'questionId',
    'questionType',
    'displayedMs',
    'activeMs',
    'outcome',
    'reason'
  ])
});

function cleanString(value, maxLength = 200) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  if (!cleaned) return null;
  return cleaned.slice(0, maxLength);
}

function cleanKey(value, maxLength = 120) {
  const cleaned = cleanString(value, maxLength);
  return cleaned && KEY_PATTERN.test(cleaned) ? cleaned : null;
}

function cleanNumber(value, min = 0, max = 24 * 60 * 60 * 1000) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function cleanPrimitive(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(-1000000, Math.min(1000000, value));
  }
  return cleanString(value, 160);
}

function cleanKeyArray(value, limit = 40) {
  if (!Array.isArray(value)) return null;
  return Array.from(
    new Set(value.map((item) => cleanKey(item)).filter(Boolean))
  ).slice(0, limit);
}

function cleanRuleValues(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value)
    .slice(0, 50)
    .map(([key, item]) => [cleanKey(key), cleanPrimitive(item)])
    .filter(([key, item]) => key && item !== null);
  return Object.fromEntries(entries);
}

function sanitizeProperties(eventName, properties) {
  const namespace = eventName.split('.')[0];
  const allowedFields = PROPERTY_FIELDS[namespace];
  if (!allowedFields || !properties || typeof properties !== 'object') {
    return {};
  }

  const sanitized = {};
  Object.entries(properties).forEach(([key, value]) => {
    if (!allowedFields.has(key)) return;

    if (['selectedPacks', 'availablePacks'].includes(key)) {
      const items = cleanKeyArray(value);
      if (items) sanitized[key] = items;
      return;
    }
    if (key === 'selectedRules') {
      const rules = cleanRuleValues(value);
      if (rules) sanitized[key] = rules;
      return;
    }
    if (['displayedMs', 'activeMs'].includes(key)) {
      const duration = cleanNumber(value);
      if (duration !== null) sanitized[key] = duration;
      return;
    }
    if (['enabled', 'changedFromDefault'].includes(key)) {
      if (typeof value === 'boolean') sanitized[key] = value;
      return;
    }
    if (['value', 'previousValue'].includes(key)) {
      const primitive = cleanPrimitive(value);
      if (primitive !== null) sanitized[key] = primitive;
      return;
    }

    const cleaned = cleanKey(value);
    if (cleaned) sanitized[key] = cleaned;
  });

  if (namespace === 'auth') {
    if (sanitized.flow && !AUTH_FLOWS.has(sanitized.flow)) {
      delete sanitized.flow;
    }
    if (sanitized.provider && !AUTH_PROVIDERS.has(sanitized.provider)) {
      delete sanitized.provider;
    }
    if (sanitized.entryPoint && !AUTH_ENTRY_POINTS.has(sanitized.entryPoint)) {
      delete sanitized.entryPoint;
    }
  }

  return sanitized;
}

function sanitizeContext(context) {
  const source = context && typeof context === 'object' ? context : {};
  const rawPagePath = cleanString(source.pagePath, 500);
  const pagePath = rawPagePath?.split(/[?#]/, 1)[0] || null;
  const gameMode = cleanKey(source.gameMode, 80);
  const playMode = cleanKey(source.playMode, 20);
  const timezoneOffsetMinutes = cleanNumber(
    source.timezoneOffsetMinutes,
    -14 * 60,
    14 * 60
  );

  return {
    ...(pagePath?.startsWith('/') ? { pagePath } : {}),
    ...(gameMode && GAME_MODES.has(gameMode) ? { gameMode } : {}),
    ...(playMode && PLAY_MODES.has(playMode) ? { playMode } : {}),
    ...(timezoneOffsetMinutes !== null ? { timezoneOffsetMinutes } : {})
  };
}

function hashAnalyticsIdentifier(value) {
  const cleaned = cleanString(value, 160);
  if (!cleaned) return null;
  const salt =
    process.env.ANALYTICS_HASH_SALT ||
    process.env.SESSION_SECRET ||
    'overexposed-product-analytics';
  return crypto.createHash('sha256').update(`${salt}:${cleaned}`).digest('hex');
}

function normalizeOccurredAt(value, receivedAt) {
  const occurredAt = new Date(value || receivedAt);
  const minimum = receivedAt.getTime() - 7 * 24 * 60 * 60 * 1000;
  const maximum = receivedAt.getTime() + 5 * 60 * 1000;
  if (!Number.isFinite(occurredAt.getTime())) return receivedAt;
  if (occurredAt.getTime() < minimum || occurredAt.getTime() > maximum) {
    return receivedAt;
  }
  return occurredAt;
}

function normalizeAnalyticsEvent(event, { accountId = null, receivedAt } = {}) {
  if (!event || typeof event !== 'object') return null;
  const eventId = cleanString(event.eventId, 100);
  const eventName = cleanString(event.eventName, 80);
  if (
    !eventId ||
    !EVENT_ID_PATTERN.test(eventId) ||
    !eventName ||
    !EVENT_NAME_SET.has(eventName)
  ) {
    return null;
  }

  const now = receivedAt instanceof Date ? receivedAt : new Date();
  return {
    eventId,
    eventName,
    schemaVersion: 1,
    accountId: accountId || null,
    anonymousIdHash: hashAnalyticsIdentifier(event.anonymousId),
    sessionIdHash: hashAnalyticsIdentifier(event.sessionId),
    context: sanitizeContext(event.context),
    properties: sanitizeProperties(eventName, event.properties),
    occurredAt: normalizeOccurredAt(event.occurredAt, now),
    receivedAt: now,
    expiresAt: new Date(
      now.getTime() + ANALYTICS_RETENTION_DAYS * 24 * 60 * 60 * 1000
    )
  };
}

function normalizeAnalyticsBatch(events, options = {}) {
  if (!Array.isArray(events)) return [];
  return events
    .slice(0, 40)
    .map((event) => normalizeAnalyticsEvent(event, options))
    .filter(Boolean);
}

async function storeAnalyticsEvents(AnalyticsEvent, events) {
  if (!AnalyticsEvent || !events.length) return 0;
  const result = await AnalyticsEvent.bulkWrite(
    events.map((event) => ({
      updateOne: {
        filter: { eventId: event.eventId },
        update: { $setOnInsert: event },
        upsert: true
      }
    })),
    { ordered: false }
  );
  return Number(result.upsertedCount || 0);
}

function formatAnalyticsLabel(value) {
  return String(value || 'unknown')
    .replace(/[-_.]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

async function getProductAnalyticsSummary(
  AnalyticsEvent,
  { since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } = {}
) {
  if (!AnalyticsEvent) {
    return {
      auth: [],
      notifications: [],
      packs: [],
      questions: [],
      rules: []
    };
  }

  const matchPeriod = { occurredAt: { $gte: since } };
  const [
    notificationGroups,
    authGroups,
    gameStarts,
    packGroups,
    ruleGroups,
    questionGroups
  ] = await Promise.all([
    AnalyticsEvent.aggregate([
      {
        $match: {
          ...matchPeriod,
          eventName: { $regex: '^notification\\.' },
          'properties.notificationKey': { $type: 'string', $ne: '' }
        }
      },
      {
        $group: {
          _id: '$properties.notificationKey',
          impressions: {
            $sum: {
              $cond: [{ $eq: ['$eventName', 'notification.impression'] }, 1, 0]
            }
          },
          dismissals: {
            $sum: {
              $cond: [{ $eq: ['$eventName', 'notification.dismissed'] }, 1, 0]
            }
          },
          actionClicks: {
            $sum: {
              $cond: [
                { $eq: ['$eventName', 'notification.action_clicked'] },
                1,
                0
              ]
            }
          },
          conversions: {
            $sum: {
              $cond: [{ $eq: ['$eventName', 'notification.conversion'] }, 1, 0]
            }
          },
          autoExpired: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$eventName', 'notification.closed'] },
                    { $eq: ['$properties.reason', 'auto_expired'] }
                  ]
                },
                1,
                0
              ]
            }
          },
          sessions: { $addToSet: '$sessionIdHash' }
        }
      },
      { $sort: { impressions: -1, _id: 1 } },
      { $limit: 50 }
    ]),
    AnalyticsEvent.aggregate([
      {
        $match: {
          ...matchPeriod,
          eventName: { $regex: '^auth\\.' }
        }
      },
      {
        $group: {
          _id: {
            entryPoint: { $ifNull: ['$properties.entryPoint', 'unknown'] },
            provider: { $ifNull: ['$properties.provider', 'unknown'] },
            flow: { $ifNull: ['$properties.flow', 'signin'] }
          },
          attempts: {
            $sum: {
              $cond: [{ $eq: ['$eventName', 'auth.attempted'] }, 1, 0]
            }
          },
          completed: {
            $sum: {
              $cond: [{ $eq: ['$eventName', 'auth.completed'] }, 1, 0]
            }
          },
          failed: {
            $sum: {
              $cond: [{ $eq: ['$eventName', 'auth.failed'] }, 1, 0]
            }
          }
        }
      },
      { $sort: { completed: -1, attempts: -1 } },
      { $limit: 50 }
    ]),
    AnalyticsEvent.aggregate([
      { $match: { ...matchPeriod, eventName: 'game.started' } },
      { $group: { _id: '$context.gameMode', starts: { $sum: 1 } } }
    ]),
    AnalyticsEvent.aggregate([
      { $match: { ...matchPeriod, eventName: 'game.started' } },
      { $unwind: '$properties.selectedPacks' },
      {
        $group: {
          _id: {
            gameMode: '$context.gameMode',
            packKey: '$properties.selectedPacks'
          },
          starts: { $sum: 1 }
        }
      },
      { $sort: { starts: -1 } },
      { $limit: 100 }
    ]),
    AnalyticsEvent.aggregate([
      { $match: { ...matchPeriod, eventName: 'game.started' } },
      {
        $project: {
          gameMode: '$context.gameMode',
          rules: {
            $objectToArray: {
              $ifNull: ['$properties.selectedRules', {}]
            }
          }
        }
      },
      { $unwind: '$rules' },
      {
        $group: {
          _id: {
            gameMode: '$gameMode',
            ruleKey: '$rules.k',
            value: { $toString: '$rules.v' }
          },
          starts: { $sum: 1 }
        }
      },
      { $sort: { starts: -1 } },
      { $limit: 120 }
    ]),
    AnalyticsEvent.aggregate([
      {
        $match: {
          ...matchPeriod,
          eventName: {
            $in: [
              'game.question_shown',
              'game.question_advanced',
              'game.question_abandoned'
            ]
          },
          'properties.questionId': { $type: 'string', $ne: '' }
        }
      },
      {
        $group: {
          _id: {
            gameMode: '$context.gameMode',
            packKey: '$properties.packKey',
            questionId: '$properties.questionId'
          },
          views: {
            $sum: {
              $cond: [{ $eq: ['$eventName', 'game.question_shown'] }, 1, 0]
            }
          },
          advances: {
            $sum: {
              $cond: [{ $eq: ['$eventName', 'game.question_advanced'] }, 1, 0]
            }
          },
          abandons: {
            $sum: {
              $cond: [{ $eq: ['$eventName', 'game.question_abandoned'] }, 1, 0]
            }
          },
          averageDisplayedMs: { $avg: '$properties.displayedMs' },
          averageActiveMs: { $avg: '$properties.activeMs' }
        }
      },
      { $sort: { views: -1, averageActiveMs: -1 } },
      { $limit: 100 }
    ])
  ]);

  const startsByGameMode = new Map(
    gameStarts.map((row) => [String(row._id || ''), Number(row.starts || 0)])
  );
  const toPercent = (value, total) =>
    total > 0 ? `${Math.round((Number(value || 0) / total) * 100)}%` : '0%';
  const toDuration = (value) => {
    const seconds = Math.round(Number(value || 0) / 1000);
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  return {
    notifications: notificationGroups.map((row) => ({
      notification: formatAnalyticsLabel(row._id),
      impressions: Number(row.impressions || 0),
      uniqueSessions: Array.isArray(row.sessions)
        ? row.sessions.filter(Boolean).length
        : 0,
      dismissals: Number(row.dismissals || 0),
      dismissRate: toPercent(row.dismissals, row.impressions),
      actionClicks: Number(row.actionClicks || 0),
      clickRate: toPercent(row.actionClicks, row.impressions),
      conversions: Number(row.conversions || 0),
      conversionRate: toPercent(row.conversions, row.impressions),
      autoExpired: Number(row.autoExpired || 0)
    })),
    auth: authGroups.map((row) => ({
      flow: formatAnalyticsLabel(row._id.flow),
      entryPoint: formatAnalyticsLabel(row._id.entryPoint),
      provider: formatAnalyticsLabel(row._id.provider),
      attempts: Number(row.attempts || 0),
      completed: Number(row.completed || 0),
      failed: Number(row.failed || 0),
      completionRate: toPercent(row.completed, row.attempts)
    })),
    packs: packGroups.map((row) => {
      const total = startsByGameMode.get(String(row._id.gameMode || '')) || 0;
      return {
        gameMode: formatAnalyticsLabel(row._id.gameMode),
        pack: formatAnalyticsLabel(row._id.packKey),
        starts: Number(row.starts || 0),
        gameStarts: total,
        selectionRate: toPercent(row.starts, total)
      };
    }),
    rules: ruleGroups.map((row) => {
      const total = startsByGameMode.get(String(row._id.gameMode || '')) || 0;
      return {
        gameMode: formatAnalyticsLabel(row._id.gameMode),
        rule: formatAnalyticsLabel(row._id.ruleKey),
        value: String(row._id.value ?? '-'),
        starts: Number(row.starts || 0),
        usageRate: toPercent(row.starts, total)
      };
    }),
    questions: questionGroups.map((row) => ({
      gameMode: formatAnalyticsLabel(row._id.gameMode),
      pack: formatAnalyticsLabel(row._id.packKey),
      questionId: row._id.questionId,
      views: Number(row.views || 0),
      averageDisplayed: toDuration(row.averageDisplayedMs),
      averageActive: toDuration(row.averageActiveMs),
      abandonRate: toPercent(row.abandons, row.views)
    }))
  };
}

module.exports = {
  AUTH_ENTRY_POINTS,
  EVENT_NAME_SET,
  getProductAnalyticsSummary,
  normalizeAnalyticsBatch,
  normalizeAnalyticsEvent,
  sanitizeContext,
  sanitizeProperties,
  storeAnalyticsEvents
};
