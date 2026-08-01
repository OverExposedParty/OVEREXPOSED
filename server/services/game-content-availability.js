const {
  AVAILABILITY_MODES,
  isValidTimeZone
} = require('../../models/game-config/game-content-availability-schema');

const ANNUAL_PATTERN =
  /^XXXX-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
const AVAILABILITY_INPUT_KEYS = [
  'availabilityMode',
  'availabilityTimeZone',
  'availableFrom',
  'availableUntil'
];

function hasAvailabilityInput(body = {}) {
  return AVAILABILITY_INPUT_KEYS.some((key) =>
    Object.prototype.hasOwnProperty.call(body, key)
  );
}

function normalizeMode(value) {
  const mode = String(value || 'always')
    .trim()
    .toLowerCase();
  return AVAILABILITY_MODES.includes(mode) ? mode : null;
}

function normalizeAnnualBoundary(value) {
  if (!value || typeof value !== 'object') return null;
  const boundary = {
    month: Number(value.month),
    day: Number(value.day),
    hour: Number(value.hour ?? 0),
    minute: Number(value.minute ?? 0),
    second: Number(value.second ?? 0),
    millisecond: Number(value.millisecond ?? 0)
  };
  const valuesAreIntegers = Object.values(boundary).every(Number.isInteger);
  if (!valuesAreIntegers) return null;
  if (
    boundary.month < 1 ||
    boundary.month > 12 ||
    boundary.day < 1 ||
    boundary.hour < 0 ||
    boundary.hour > 23 ||
    boundary.minute < 0 ||
    boundary.minute > 59 ||
    boundary.second < 0 ||
    boundary.second > 59 ||
    boundary.millisecond < 0 ||
    boundary.millisecond > 999
  ) {
    return null;
  }
  const date = new Date(Date.UTC(2000, boundary.month - 1, boundary.day));
  if (
    date.getUTCMonth() !== boundary.month - 1 ||
    date.getUTCDate() !== boundary.day
  ) {
    return null;
  }
  return boundary;
}

function parseAnnualBoundary(value) {
  if (value && typeof value === 'object') {
    return normalizeAnnualBoundary(value);
  }
  const match = ANNUAL_PATTERN.exec(String(value || '').trim());
  if (!match) return null;
  return normalizeAnnualBoundary({
    month: match[1],
    day: match[2],
    hour: match[3],
    minute: match[4],
    second: match[5] || 0,
    millisecond: String(match[6] || '').padEnd(3, '0') || 0
  });
}

function parseFixedBoundary(value) {
  if (value === null || value === undefined || value === '') return null;
  const date =
    value instanceof Date ? new Date(value) : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function annualBoundaryValue(boundary) {
  if (!boundary) return null;
  return (
    ((((boundary.month * 32 + boundary.day) * 24 + boundary.hour) * 60 +
      boundary.minute) *
      60 +
      boundary.second) *
      1000 +
    boundary.millisecond
  );
}

function serializeAnnualBoundary(boundary) {
  const normalized = normalizeAnnualBoundary(boundary);
  if (!normalized) return null;
  const pad = (value, length = 2) => String(value).padStart(length, '0');
  return `XXXX-${pad(normalized.month)}-${pad(normalized.day)}T${pad(
    normalized.hour
  )}:${pad(normalized.minute)}:${pad(normalized.second)}`;
}

function serializeAvailability(rawAvailability = {}) {
  const availability = normalizeStoredAvailability(rawAvailability);
  if (availability.mode === 'fixed') {
    return {
      mode: 'fixed',
      timeZone: 'UTC',
      availableFrom: availability.availableFrom
        ? availability.availableFrom.toISOString()
        : null,
      availableUntil: availability.availableUntil
        ? availability.availableUntil.toISOString()
        : null
    };
  }
  if (availability.mode === 'annual') {
    return {
      mode: 'annual',
      timeZone: availability.timeZone,
      availableFrom: serializeAnnualBoundary(availability.annualFrom),
      availableUntil: serializeAnnualBoundary(availability.annualUntil)
    };
  }
  return {
    mode: 'always',
    timeZone: 'UTC',
    availableFrom: null,
    availableUntil: null
  };
}

function normalizeStoredAvailability(rawAvailability = {}) {
  const raw = rawAvailability || {};
  const mode = normalizeMode(raw.mode) || 'always';
  if (mode === 'fixed') {
    return {
      mode,
      timeZone: 'UTC',
      availableFrom: parseFixedBoundary(raw.availableFrom) || null,
      availableUntil: parseFixedBoundary(raw.availableUntil) || null,
      annualFrom: null,
      annualUntil: null
    };
  }
  if (mode === 'annual') {
    return {
      mode,
      timeZone: isValidTimeZone(raw.timeZone) ? raw.timeZone : 'UTC',
      availableFrom: null,
      availableUntil: null,
      annualFrom:
        parseAnnualBoundary(raw.annualFrom ?? raw.availableFrom) || null,
      annualUntil:
        parseAnnualBoundary(raw.annualUntil ?? raw.availableUntil) || null
    };
  }
  return {
    mode: 'always',
    timeZone: 'UTC',
    availableFrom: null,
    availableUntil: null,
    annualFrom: null,
    annualUntil: null
  };
}

function parseAvailabilityInput(body = {}, currentAvailability = {}) {
  if (!hasAvailabilityInput(body)) return { availability: null };

  const current = serializeAvailability(currentAvailability);
  const mode = normalizeMode(body.availabilityMode ?? current.mode);
  if (!mode) {
    return { error: 'Availability mode must be always, fixed, or annual.' };
  }
  if (mode === 'always') {
    return { availability: normalizeStoredAvailability({ mode }) };
  }

  const availableFromValue = Object.prototype.hasOwnProperty.call(
    body,
    'availableFrom'
  )
    ? body.availableFrom
    : current.availableFrom;
  const availableUntilValue = Object.prototype.hasOwnProperty.call(
    body,
    'availableUntil'
  )
    ? body.availableUntil
    : current.availableUntil;

  if (mode === 'fixed') {
    const availableFrom = parseFixedBoundary(availableFromValue);
    const availableUntil = parseFixedBoundary(availableUntilValue);
    if (availableFrom === undefined || availableUntil === undefined) {
      return { error: 'Fixed availability dates must be valid datetimes.' };
    }
    if (!availableFrom && !availableUntil) {
      return {
        error:
          'Fixed availability requires an Available From or Available Until.'
      };
    }
    if (availableFrom && availableUntil && availableUntil <= availableFrom) {
      return { error: 'Available Until must be later than Available From.' };
    }
    return {
      availability: normalizeStoredAvailability({
        mode,
        availableFrom,
        availableUntil
      })
    };
  }

  const timeZone = String(
    body.availabilityTimeZone ?? current.timeZone ?? 'UTC'
  ).trim();
  if (!isValidTimeZone(timeZone)) {
    return { error: 'Availability timezone must be a valid IANA timezone.' };
  }
  const annualFrom = parseAnnualBoundary(availableFromValue);
  const annualUntil = parseAnnualBoundary(availableUntilValue);
  if (!annualFrom || !annualUntil) {
    return {
      error:
        'Annual availability requires From and Until values like XXXX-10-31T18:00:00.'
    };
  }
  if (annualBoundaryValue(annualFrom) === annualBoundaryValue(annualUntil)) {
    return { error: 'Annual Available From and Available Until cannot match.' };
  }
  return {
    availability: normalizeStoredAvailability({
      mode,
      timeZone,
      annualFrom,
      annualUntil
    })
  };
}

function getZonedAnnualBoundary(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hourCycle: 'h23'
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );
  return normalizeAnnualBoundary({
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
    millisecond: parts.fractionalSecond
  });
}

function isGameContentAvailable(content = {}, at = new Date()) {
  const availability = normalizeStoredAvailability(content.availability);
  const instant = at instanceof Date ? at : new Date(at);
  if (!Number.isFinite(instant.getTime())) return false;
  if (availability.mode === 'always') return true;
  if (availability.mode === 'fixed') {
    return (
      (!availability.availableFrom || instant >= availability.availableFrom) &&
      (!availability.availableUntil || instant < availability.availableUntil)
    );
  }
  if (!availability.annualFrom || !availability.annualUntil) return false;
  const current = getZonedAnnualBoundary(instant, availability.timeZone);
  const currentValue = annualBoundaryValue(current);
  const fromValue = annualBoundaryValue(availability.annualFrom);
  const untilValue = annualBoundaryValue(availability.annualUntil);
  if (fromValue < untilValue) {
    return currentValue >= fromValue && currentValue < untilValue;
  }
  return currentValue >= fromValue || currentValue < untilValue;
}

function getAvailabilityState(content = {}, at = new Date()) {
  const availability = normalizeStoredAvailability(content.availability);
  if (availability.mode === 'always') return 'always';
  if (availability.mode === 'annual') {
    return isGameContentAvailable(content, at) ? 'available' : 'out-of-season';
  }
  if (isGameContentAvailable(content, at)) return 'available';
  if (availability.availableFrom && at < availability.availableFrom) {
    return 'upcoming';
  }
  return 'expired';
}

function filterAvailableContent(
  items,
  { at = new Date(), includeKeys = [], getKey = (item) => item.key } = {}
) {
  const included = new Set(includeKeys.map(String));
  return (Array.isArray(items) ? items : []).filter(
    (item) =>
      included.has(String(getKey(item))) || isGameContentAvailable(item, at)
  );
}

async function resolveLeanFind(model, query) {
  if (!model?.find) return [];
  const result = model.find(query);
  const resolved = typeof result?.lean === 'function' ? result.lean() : result;
  return (await resolved) || [];
}

async function getUnavailableScheduledContent(model, query, at = new Date()) {
  const records = await resolveLeanFind(model, {
    ...query,
    enabled: true,
    status: 'published'
  });
  return {
    availableKeys: new Set(
      records
        .filter((record) => isGameContentAvailable(record, at))
        .map((record) => String(record.key || record.slug))
    ),
    unavailableScheduled: records.filter((record) => {
      const mode = normalizeStoredAvailability(record.availability).mode;
      return mode !== 'always' && !isGameContentAvailable(record, at);
    })
  };
}

async function pruneUnavailablePartyContent({
  config,
  GamePack,
  GameRule,
  GameRole,
  at = new Date()
}) {
  const gamemode = String(config?.gamemode || '')
    .trim()
    .toLowerCase();
  if (!gamemode) return config;

  const [packResult, ruleResult, roleResult] = await Promise.all([
    getUnavailableScheduledContent(GamePack, { gameType: gamemode }, at),
    getUnavailableScheduledContent(
      GameRule,
      {
        $or: [
          { gameType: gamemode },
          { scope: 'gamemode', appliesTo: gamemode },
          { scope: 'global', appliesTo: gamemode },
          { scope: 'global', appliesTo: 'online' }
        ]
      },
      at
    ),
    gamemode === 'mafia'
      ? getUnavailableScheduledContent(GameRole, { gameType: gamemode }, at)
      : Promise.resolve([])
  ]);

  const unavailablePackKeys = new Set();
  for (const pack of packResult.unavailableScheduled) {
    if (pack.slug) unavailablePackKeys.add(String(pack.slug));
    if (pack.key) unavailablePackKeys.add(String(pack.key));
  }
  if (Array.isArray(config.selectedPacks)) {
    config.selectedPacks = config.selectedPacks.filter(
      (key) => !unavailablePackKeys.has(String(key))
    );
  }

  const unavailableRuleKeys = new Set(
    ruleResult.unavailableScheduled
      .map((rule) => String(rule.key))
      .filter((key) => !ruleResult.availableKeys.has(key))
  );
  const rawRules =
    config.gameRules instanceof Map
      ? Object.fromEntries(config.gameRules)
      : { ...(config.gameRules || {}) };
  for (const key of unavailableRuleKeys) {
    delete rawRules[key];
    delete rawRules[`${key}-game-rule-time-limit`];
  }
  config.gameRules = rawRules;

  if (gamemode === 'mafia') {
    const unavailableRoleKeys = new Set(
      roleResult.unavailableScheduled.map((role) => String(role.key))
    );
    const roleCounts =
      config.roleCounts instanceof Map
        ? Object.fromEntries(config.roleCounts)
        : { ...(config.roleCounts || {}) };
    for (const key of unavailableRoleKeys) delete roleCounts[key];
    config.roleCounts = roleCounts;
  }

  return config;
}

module.exports = {
  ANNUAL_PATTERN,
  filterAvailableContent,
  getAvailabilityState,
  hasAvailabilityInput,
  isGameContentAvailable,
  normalizeStoredAvailability,
  parseAnnualBoundary,
  parseAvailabilityInput,
  pruneUnavailablePartyContent,
  serializeAnnualBoundary,
  serializeAvailability
};
