const crypto = require('crypto');

const OPERATIONS = new Set(['store', 'release']);
const OUTCOMES = new Set(['succeeded', 'rejected', 'failed']);
const SAFE_KEY_PATTERN = /^[a-z0-9_-]{1,80}$/;

function normalizeSafeKey(value, fallback = null) {
  const key = String(value || '')
    .trim()
    .toLowerCase();
  return SAFE_KEY_PATTERN.test(key) ? key : fallback;
}

function hashStorageIdentifier(value) {
  const identifier = String(value || '').trim();
  if (!identifier) return null;
  const salt =
    process.env.ANALYTICS_HASH_SALT ||
    process.env.SESSION_SECRET ||
    'overexposed-oling-storage';
  return crypto
    .createHash('sha256')
    .update(`${salt}:${identifier}`)
    .digest('hex');
}

function createOlingStorageDiagnostic({
  operation,
  outcome,
  accountId = null,
  olingId = null,
  podKey = null,
  releaseOutcome = null,
  rosterActiveCount = null,
  error = null,
  requestId = null,
  now = new Date()
}) {
  const normalizedOperation = normalizeSafeKey(operation, 'unknown');
  const normalizedOutcome = normalizeSafeKey(outcome, 'failed');
  const errorCode = normalizeSafeKey(error?.code, null);
  const status = Number(error?.status);
  const activeCount = Number(rosterActiveCount);

  return {
    event: 'oling_storage_operation',
    operation: OPERATIONS.has(normalizedOperation)
      ? normalizedOperation
      : 'unknown',
    outcome: OUTCOMES.has(normalizedOutcome) ? normalizedOutcome : 'failed',
    accountHash: hashStorageIdentifier(accountId),
    olingHash: hashStorageIdentifier(olingId),
    podKey: normalizeSafeKey(podKey, null),
    releaseOutcome: normalizeSafeKey(releaseOutcome, null),
    rosterActiveCount: Number.isInteger(activeCount) ? activeCount : null,
    errorCode,
    status:
      Number.isInteger(status) && status >= 400 && status <= 599
        ? status
        : null,
    requestId:
      String(requestId || '')
        .trim()
        .slice(0, 100) || null,
    occurredAt: now.toISOString()
  };
}

function recordOlingStorageDiagnostic(input, { logger = console } = {}) {
  const diagnostic = createOlingStorageDiagnostic(input);
  const method =
    diagnostic.outcome === 'failed'
      ? 'error'
      : diagnostic.outcome === 'rejected'
        ? 'warn'
        : 'info';
  const write =
    typeof logger?.[method] === 'function' ? logger[method] : logger?.log;
  write?.call(logger, `[OLING_STORAGE] ${JSON.stringify(diagnostic)}`);
  return diagnostic;
}

module.exports = {
  createOlingStorageDiagnostic,
  hashStorageIdentifier,
  recordOlingStorageDiagnostic
};
