const SESSION_ID_BYTES = 16;
const DEVICE_VALUE_MAX_LENGTH = 160;

function normalizeDeviceValue(value) {
  const normalized = String(value || '').trim();
  return normalized ? normalized.slice(0, DEVICE_VALUE_MAX_LENGTH) : null;
}

function parseBrowser(userAgent) {
  const patterns = [
    ['Edge', /Edg(?:A|iOS)?\/([\d.]+)/],
    ['Opera', /OPR\/([\d.]+)/],
    ['Chrome', /(?:Chrome|CriOS)\/([\d.]+)/],
    ['Firefox', /(?:Firefox|FxiOS)\/([\d.]+)/],
    ['Safari', /Version\/([\d.]+).*Safari/]
  ];

  for (const [name, pattern] of patterns) {
    const match = userAgent.match(pattern);
    if (match) return `${name} ${match[1].split('.')[0]}`;
  }

  return 'Unknown browser';
}

function parseOperatingSystem(userAgent) {
  if (/Windows NT/.test(userAgent)) return 'Windows';

  const android = userAgent.match(/Android ([\d.]+)/);
  if (android) return `Android ${android[1].split('.')[0]}`;

  const ios = userAgent.match(/(?:iPhone OS|CPU OS) ([\d_]+)/);
  if (ios) return `iOS ${ios[1].split('_')[0]}`;

  const mac = userAgent.match(/Mac OS X ([\d_]+)/);
  if (mac) return `macOS ${mac[1].split('_')[0]}`;

  if (/CrOS/.test(userAgent)) return 'ChromeOS';
  if (/Linux/.test(userAgent)) return 'Linux';
  return 'Unknown OS';
}

function parseDeviceType(userAgent) {
  if (/iPad|Tablet|PlayBook/i.test(userAgent)) return 'Tablet';
  if (/Mobile|iPhone|Android/i.test(userAgent)) return 'Mobile';
  return 'Desktop';
}

function getRequestDevice(req) {
  const userAgent = normalizeDeviceValue(req?.get?.('user-agent'));
  const normalizedUserAgent = userAgent || '';

  return {
    userAgent,
    browser: parseBrowser(normalizedUserAgent),
    os: parseOperatingSystem(normalizedUserAgent),
    deviceType: parseDeviceType(normalizedUserAgent)
  };
}

function createPublicSessionId(crypto) {
  return crypto.randomBytes(SESSION_ID_BYTES).toString('base64url');
}

function serializeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function serializeAccountSession(session, currentTokenHash) {
  const tokenHash = String(session?.tokenHash || '');
  const sessionId = normalizeDeviceValue(session?.sessionId);
  const device = session?.device || {};

  return {
    id: sessionId,
    manageable: Boolean(sessionId),
    current: Boolean(tokenHash && tokenHash === currentTokenHash),
    device: {
      browser: normalizeDeviceValue(device.browser) || 'Unknown browser',
      os: normalizeDeviceValue(device.os) || 'Unknown OS',
      deviceType: normalizeDeviceValue(device.deviceType) || 'Unknown device'
    },
    approximateLocation:
      normalizeDeviceValue(session?.approximateLocation) || null,
    createdAt: serializeDate(session?.createdAt),
    lastUsedAt: serializeDate(session?.lastUsedAt || session?.createdAt),
    expiresAt: serializeDate(session?.expiresAt)
  };
}

function getActiveSerializedSessions(
  account,
  currentTokenHash,
  now = new Date()
) {
  const nowMs = now.getTime();
  const sessions = Array.isArray(account?.security?.sessions)
    ? account.security.sessions
    : [];

  return sessions
    .filter((session) => {
      const expiresAt = new Date(session?.expiresAt || 0).getTime();
      return expiresAt > nowMs && !session?.revokedAt;
    })
    .map((session) => serializeAccountSession(session, currentTokenHash))
    .sort((left, right) => {
      if (left.current !== right.current) return left.current ? -1 : 1;
      return (
        new Date(right.lastUsedAt || right.createdAt || 0).getTime() -
        new Date(left.lastUsedAt || left.createdAt || 0).getTime()
      );
    });
}

module.exports = {
  createPublicSessionId,
  getActiveSerializedSessions,
  getRequestDevice,
  serializeAccountSession
};
