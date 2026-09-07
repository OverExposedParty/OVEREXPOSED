const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createOlingStorageDiagnostic,
  hashStorageIdentifier,
  recordOlingStorageDiagnostic
} = require('../../server/services/olings/storage-diagnostics');

test('storage diagnostics hash player identifiers and retain safe failure fields', () => {
  const diagnostic = createOlingStorageDiagnostic({
    operation: 'release',
    outcome: 'rejected',
    accountId: 'account-secret',
    olingId: 'oling-secret',
    podKey: 'oling_pod',
    error: {
      status: 409,
      code: 'oling_lab_roster_full',
      message: 'This message must not be logged.'
    },
    requestId: 'request-1',
    now: new Date('2026-09-01T12:00:00.000Z')
  });

  assert.equal(diagnostic.operation, 'release');
  assert.equal(diagnostic.outcome, 'rejected');
  assert.equal(diagnostic.errorCode, 'oling_lab_roster_full');
  assert.equal(diagnostic.status, 409);
  assert.equal(diagnostic.accountHash, hashStorageIdentifier('account-secret'));
  assert.equal(diagnostic.olingHash, hashStorageIdentifier('oling-secret'));
  assert.doesNotMatch(
    JSON.stringify(diagnostic),
    /account-secret|oling-secret/
  );
  assert.doesNotMatch(JSON.stringify(diagnostic), /message must not be logged/);
});

test('storage diagnostics route outcomes to structured logger levels', () => {
  const calls = [];
  const logger = {
    info(message) {
      calls.push(['info', message]);
    },
    warn(message) {
      calls.push(['warn', message]);
    },
    error(message) {
      calls.push(['error', message]);
    }
  };

  ['succeeded', 'rejected', 'failed'].forEach((outcome) => {
    recordOlingStorageDiagnostic({ operation: 'store', outcome }, { logger });
  });

  assert.deepEqual(
    calls.map(([level]) => level),
    ['info', 'warn', 'error']
  );
  calls.forEach(([, message]) => {
    assert.match(message, /^\[OLING_STORAGE\] \{"event"/);
  });
});

test('storage diagnostics reject unsafe free-form keys', () => {
  const diagnostic = createOlingStorageDiagnostic({
    operation: 'delete everything',
    outcome: 'maybe',
    podKey: '../../secret',
    error: { code: 'bad code', status: 200 }
  });

  assert.equal(diagnostic.operation, 'unknown');
  assert.equal(diagnostic.outcome, 'failed');
  assert.equal(diagnostic.podKey, null);
  assert.equal(diagnostic.errorCode, null);
  assert.equal(diagnostic.status, null);
});
