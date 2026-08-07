const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createActivePartyOwnerLeaseService
} = require('../../server/services/active-party-owner-leases');

const ACCOUNT_ONE = '507f1f77bcf86cd799439011';
const ACCOUNT_TWO = '507f191e810c19729de860ea';
const OWNER_HASH_ONE = 'a'.repeat(64);
const OWNER_HASH_TWO = 'b'.repeat(64);
const PENDING_LEASE_MS = 60_000;

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function getPathValue(value, path) {
  return String(path)
    .split('.')
    .reduce((current, key) => current?.[key], value);
}

function valuesEqual(left, right) {
  if (left == null || right == null) return left == null && right == null;
  if (left instanceof Date || right instanceof Date) {
    return new Date(left).getTime() === new Date(right).getTime();
  }
  return String(left) === String(right);
}

function matchesCondition(actual, expected) {
  if (
    expected &&
    typeof expected === 'object' &&
    !Array.isArray(expected) &&
    !(expected instanceof Date)
  ) {
    return Object.entries(expected).every(([operator, operand]) => {
      if (operator === '$exists') return (actual !== undefined) === operand;
      if (operator === '$lte') {
        return new Date(actual).getTime() <= new Date(operand).getTime();
      }
      if (operator === '$ne') return !valuesEqual(actual, operand);
      return false;
    });
  }

  return valuesEqual(actual, expected);
}

function matchesFilter(document, filter) {
  return Object.entries(filter || {}).every(([path, expected]) => {
    if (path === '$or') {
      return expected.some((branch) => matchesFilter(document, branch));
    }
    return matchesCondition(getPathValue(document, path), expected);
  });
}

function applyUpdate(document, update) {
  const candidate = clone(document);

  Object.entries(update.$set || {}).forEach(([path, value]) => {
    candidate[path] = clone(value);
  });
  Object.keys(update.$unset || {}).forEach((path) => {
    delete candidate[path];
  });
  Object.entries(update.$inc || {}).forEach(([path, amount]) => {
    candidate[path] = Number(candidate[path] || 0) + amount;
  });

  return candidate;
}

function createQuery(execute) {
  const query = {
    select() {
      return query;
    },
    lean() {
      return Promise.resolve(clone(execute()));
    },
    then(resolve, reject) {
      return Promise.resolve(clone(execute())).then(resolve, reject);
    }
  };
  return query;
}

function createInMemoryLeaseModel() {
  const documents = [];
  let nextId = 1;

  function duplicateKeyError() {
    const error = new Error('duplicate active party owner lease');
    error.code = 11000;
    return error;
  }

  function assertUnique(candidate, excludedId = null) {
    const duplicate = documents.some((document) => {
      if (excludedId && valuesEqual(document._id, excludedId)) return false;
      if (valuesEqual(document.partyId, candidate.partyId)) return true;
      if (valuesEqual(document.partyOwnerIdHash, candidate.partyOwnerIdHash)) {
        return true;
      }
      return (
        candidate.accountId != null &&
        document.accountId != null &&
        valuesEqual(document.accountId, candidate.accountId)
      );
    });

    if (duplicate) throw duplicateKeyError();
  }

  return {
    snapshot() {
      return clone(documents);
    },
    findOne(filter) {
      return createQuery(
        () =>
          documents.find((document) => matchesFilter(document, filter)) || null
      );
    },
    findOneAndUpdate(filter, update) {
      return createQuery(() => {
        const index = documents.findIndex((document) =>
          matchesFilter(document, filter)
        );
        if (index < 0) return null;

        const candidate = applyUpdate(documents[index], update);
        assertUnique(candidate, documents[index]._id);
        documents[index] = candidate;
        return candidate;
      });
    },
    async create(document) {
      const candidate = { _id: `lease-${nextId}`, ...clone(document) };
      assertUnique(candidate);
      nextId += 1;
      documents.push(candidate);
      return clone(candidate);
    },
    async deleteOne(filter) {
      const index = documents.findIndex((document) =>
        matchesFilter(document, filter)
      );
      if (index < 0) return { deletedCount: 0 };
      documents.splice(index, 1);
      return { deletedCount: 1 };
    },
    async updateOne(filter, update) {
      const index = documents.findIndex((document) =>
        matchesFilter(document, filter)
      );
      if (index < 0) return { modifiedCount: 0 };

      const candidate = applyUpdate(documents[index], update);
      assertUnique(candidate, documents[index]._id);
      documents[index] = candidate;
      return { modifiedCount: 1 };
    }
  };
}

function createHarness({
  model = createInMemoryLeaseModel(),
  partyExists = async () => false,
  findHostedPartyForPrincipal = async () => null
} = {}) {
  let currentTime = new Date('2026-07-19T12:00:00.000Z');
  const service = createActivePartyOwnerLeaseService({
    models: { activePartyOwnerLeaseSchema: model },
    now: () => new Date(currentTime),
    pendingLeaseMs: PENDING_LEASE_MS,
    partyExists,
    findHostedPartyForPrincipal
  });

  return {
    model,
    service,
    setNow(value) {
      currentTime = new Date(value);
    }
  };
}

function accountPrincipal({
  accountId = ACCOUNT_ONE,
  partyOwnerIdHash = OWNER_HASH_ONE
} = {}) {
  return { type: 'account', accountId, partyOwnerIdHash };
}

function guestPrincipal(partyOwnerIdHash = OWNER_HASH_ONE) {
  return {
    type: 'guest',
    guestIdHash: partyOwnerIdHash,
    partyOwnerIdHash
  };
}

function acquire(service, partyId, principal) {
  return service.acquireActivePartyOwnerLease({
    partyId,
    principal,
    gamemode: 'truth-or-dare',
    scanExistingParties: false
  });
}

async function assertOwnerConflict(promise, expectedPartyId) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.status, 409);
    assert.equal(error.code, 'party_owner_active_party_exists');
    assert.equal(error.details.partyCode, expectedPartyId);
    assert.equal(error.details.lobbyPath, `/${expectedPartyId}`);
    if (error.details.gamemode === 'truth-or-dare') {
      assert.equal(error.details.apiRoute, 'party-game-truth-or-dare');
    }
    return true;
  });
}

test('a signed-out guest cannot create a second party in the same browser', async () => {
  const { model, service } = createHarness();

  await acquire(service, 'AAA-111', accountPrincipal());
  await assertOwnerConflict(
    acquire(service, 'BBB-222', guestPrincipal()),
    'AAA-111'
  );

  assert.equal(model.snapshot().length, 1);
  assert.equal(model.snapshot()[0].partyId, 'AAA-111');
});

test('an active non-host player receives a participant conflict', async () => {
  const room = {
    partyId: 'JON-123',
    config: { gamemode: 'truth-or-dare' },
    state: {
      hostComputerId: 'host-device',
      lastPinged: new Date('2026-07-19T11:59:30.000Z'),
      phase: 'lobby'
    },
    players: [
      {
        identity: {
          computerId: 'host-device',
          accountId: ACCOUNT_TWO
        }
      },
      {
        identity: {
          computerId: 'player-device',
          accountId: ACCOUNT_ONE
        }
      }
    ]
  };
  const query = {
    select() {
      return query;
    },
    sort() {
      return query;
    },
    lean() {
      return Promise.resolve([room]);
    }
  };
  const service = createActivePartyOwnerLeaseService({
    models: {
      activePartyOwnerLeaseSchema: createInMemoryLeaseModel(),
      waitingRoomSchema: { find: () => query }
    },
    now: () => new Date('2026-07-19T12:00:00.000Z')
  });

  await assert.rejects(
    service.assertNoActiveParticipantParty(accountPrincipal()),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.code, 'party_participant_active_party_exists');
      assert.deepEqual(error.details, {
        partyCode: 'JON-123',
        lobbyPath: '/JON-123',
        gamemode: 'truth-or-dare',
        apiRoute: 'party-game-truth-or-dare',
        playerComputerId: 'player-device'
      });
      return true;
    }
  );
});

test('the same account cannot create a second party from another browser', async () => {
  const { model, service } = createHarness();

  await acquire(service, 'AAA-111', accountPrincipal());
  await assertOwnerConflict(
    acquire(
      service,
      'BBB-222',
      accountPrincipal({ partyOwnerIdHash: OWNER_HASH_TWO })
    ),
    'AAA-111'
  );

  assert.equal(model.snapshot().length, 1);
});

test('reacquiring the same party is idempotent and renews its pending lease', async () => {
  const { model, service, setNow } = createHarness();
  const first = await acquire(service, 'aaa-111', accountPrincipal());
  const firstExpiry = first.lease.expiresAt;

  setNow('2026-07-19T12:00:30.000Z');
  const second = await acquire(service, 'AAA-111', accountPrincipal());

  assert.equal(first.acquired, true);
  assert.equal(second.acquired, false);
  assert.equal(second.lease._id, first.lease._id);
  assert.equal(second.lease.leaseToken, first.lease.leaseToken);
  assert.equal(second.lease.revision, 2);
  assert.ok(second.lease.expiresAt > firstExpiry);
  assert.equal(model.snapshot().length, 1);
});

test('concurrent creates for different parties leave exactly one winner', async () => {
  const { model, service } = createHarness();

  const results = await Promise.allSettled([
    acquire(service, 'AAA-111', accountPrincipal()),
    acquire(service, 'BBB-222', accountPrincipal())
  ]);
  const fulfilled = results.filter(({ status }) => status === 'fulfilled');
  const rejected = results.filter(({ status }) => status === 'rejected');

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.status, 409);
  assert.equal(rejected[0].reason.code, 'party_owner_active_party_exists');
  assert.equal(model.snapshot().length, 1);
  assert.equal(
    rejected[0].reason.details.partyCode,
    fulfilled[0].value.lease.partyId
  );
});

test('an expired pending lease is reclaimed without waiting for the TTL monitor', async () => {
  const partyExistenceChecks = [];
  const { model, service, setNow } = createHarness({
    partyExists: async (partyId) => {
      partyExistenceChecks.push(partyId);
      return false;
    }
  });

  await acquire(service, 'OLD-111', accountPrincipal());
  setNow('2026-07-19T12:01:01.000Z');
  const replacement = await acquire(service, 'NEW-222', accountPrincipal());

  assert.equal(replacement.acquired, true);
  assert.deepEqual(partyExistenceChecks, ['OLD-111']);
  assert.deepEqual(
    model.snapshot().map(({ partyId }) => partyId),
    ['NEW-222']
  );
});

test('an active lease is reclaimed only after partyExists reports it stale', async () => {
  const partyExistenceChecks = [];
  const { model, service } = createHarness({
    partyExists: async (partyId) => {
      partyExistenceChecks.push(partyId);
      return false;
    }
  });
  const first = await acquire(service, 'OLD-111', accountPrincipal());
  await service.activateActivePartyOwnerLease({
    partyId: 'OLD-111',
    releaseToken: first.releaseToken,
    gamemode: 'truth-or-dare'
  });

  const replacement = await acquire(service, 'NEW-222', accountPrincipal());

  assert.equal(replacement.acquired, true);
  assert.deepEqual(partyExistenceChecks, ['OLD-111']);
  assert.deepEqual(
    model.snapshot().map(({ partyId }) => partyId),
    ['NEW-222']
  );
});

test('a live party prevents an expired lease from being reclaimed', async () => {
  const { model, service, setNow } = createHarness({
    partyExists: async () => true
  });

  await acquire(service, 'OLD-111', accountPrincipal());
  setNow('2026-07-19T12:01:01.000Z');
  await assertOwnerConflict(
    acquire(service, 'NEW-222', accountPrincipal()),
    'OLD-111'
  );

  assert.deepEqual(
    model.snapshot().map(({ partyId }) => partyId),
    ['OLD-111']
  );
});

test('attaching an account extends a guest lease across browsers', async () => {
  const { model, service } = createHarness();

  await acquire(service, 'AAA-111', guestPrincipal());
  const attached = await service.attachAccountToPartyOwnerLease({
    partyOwnerIdHash: OWNER_HASH_ONE,
    accountId: ACCOUNT_ONE
  });

  assert.deepEqual(attached, { attached: true, partyId: 'AAA-111' });
  assert.equal(model.snapshot()[0].accountId, ACCOUNT_ONE);
  assert.equal(model.snapshot()[0].revision, 2);

  await assertOwnerConflict(
    acquire(
      service,
      'BBB-222',
      accountPrincipal({ partyOwnerIdHash: OWNER_HASH_TWO })
    ),
    'AAA-111'
  );
});

test('account attachment reports the existing account lease on a unique conflict', async () => {
  const { model, service } = createHarness();

  await acquire(service, 'AAA-111', accountPrincipal());
  await acquire(service, 'BBB-222', guestPrincipal(OWNER_HASH_TWO));
  const attached = await service.attachAccountToPartyOwnerLease({
    partyOwnerIdHash: OWNER_HASH_TWO,
    accountId: ACCOUNT_ONE
  });

  assert.deepEqual(attached, {
    attached: false,
    conflict: true,
    partyId: 'AAA-111',
    gamemode: 'truth-or-dare',
    apiRoute: 'party-game-truth-or-dare'
  });
  const guestLease = model
    .snapshot()
    .find(({ partyId }) => partyId === 'BBB-222');
  assert.equal(guestLease.accountId, undefined);
});

test('account attachment re-reads a lease after losing its compare-and-swap', async () => {
  const model = createInMemoryLeaseModel();
  const updateOne = model.updateOne.bind(model);
  let injectedConcurrentAttachment = false;

  model.updateOne = async (filter, update) => {
    if (
      !injectedConcurrentAttachment &&
      valuesEqual(update.$set?.accountId, ACCOUNT_ONE)
    ) {
      injectedConcurrentAttachment = true;
      await updateOne(filter, {
        $set: { accountId: ACCOUNT_TWO },
        $inc: { revision: 1 }
      });
    }

    return updateOne(filter, update);
  };

  const { service } = createHarness({
    model,
    partyExists: async () => true
  });
  await acquire(service, 'AAA-111', guestPrincipal());

  const attached = await service.attachAccountToPartyOwnerLease({
    partyOwnerIdHash: OWNER_HASH_ONE,
    accountId: ACCOUNT_ONE
  });

  assert.deepEqual(attached, {
    attached: false,
    conflict: true,
    partyId: 'AAA-111',
    gamemode: 'truth-or-dare',
    apiRoute: 'party-game-truth-or-dare'
  });
  assert.equal(model.snapshot()[0].accountId, ACCOUNT_TWO);
});

test('account attachment retries a compare-and-swap miss while the lease remains unclaimed', async () => {
  const model = createInMemoryLeaseModel();
  const updateOne = model.updateOne.bind(model);
  let injectedConcurrentRenewal = false;

  model.updateOne = async (filter, update) => {
    if (
      !injectedConcurrentRenewal &&
      valuesEqual(update.$set?.accountId, ACCOUNT_ONE)
    ) {
      injectedConcurrentRenewal = true;
      await updateOne(filter, { $inc: { revision: 1 } });
    }

    return updateOne(filter, update);
  };

  const { service } = createHarness({ model });
  await acquire(service, 'AAA-111', guestPrincipal());

  const attached = await service.attachAccountToPartyOwnerLease({
    partyOwnerIdHash: OWNER_HASH_ONE,
    accountId: ACCOUNT_ONE
  });

  assert.deepEqual(attached, { attached: true, partyId: 'AAA-111' });
  assert.equal(model.snapshot()[0].accountId, ACCOUNT_ONE);
  assert.equal(model.snapshot()[0].revision, 3);
});

test('account attachment removes a stale browser lease instead of claiming it', async () => {
  const partyExistenceChecks = [];
  const { model, service } = createHarness({
    partyExists: async (partyId) => {
      partyExistenceChecks.push(partyId);
      return false;
    }
  });
  const staleGuestLease = await acquire(service, 'AAA-111', guestPrincipal());
  await service.activateActivePartyOwnerLease({
    partyId: 'AAA-111',
    releaseToken: staleGuestLease.releaseToken
  });

  const attached = await service.attachAccountToPartyOwnerLease({
    partyOwnerIdHash: OWNER_HASH_ONE,
    accountId: ACCOUNT_ONE
  });

  assert.deepEqual(attached, { attached: false });
  assert.deepEqual(partyExistenceChecks, ['AAA-111']);
  assert.deepEqual(model.snapshot(), []);
});

test('account attachment reclaims a stale conflicting account lease before retrying', async () => {
  const partyExistenceChecks = [];
  const { model, service } = createHarness({
    partyExists: async (partyId) => {
      partyExistenceChecks.push(partyId);
      return partyId === 'BBB-222';
    }
  });
  const staleAccountLease = await acquire(
    service,
    'AAA-111',
    accountPrincipal()
  );
  await service.activateActivePartyOwnerLease({
    partyId: 'AAA-111',
    releaseToken: staleAccountLease.releaseToken
  });
  await acquire(service, 'BBB-222', guestPrincipal(OWNER_HASH_TWO));

  const attached = await service.attachAccountToPartyOwnerLease({
    partyOwnerIdHash: OWNER_HASH_TWO,
    accountId: ACCOUNT_ONE
  });

  assert.deepEqual(attached, { attached: true, partyId: 'BBB-222' });
  assert.deepEqual(partyExistenceChecks, ['AAA-111']);
  assert.deepEqual(
    model.snapshot().map(({ partyId, accountId }) => ({ partyId, accountId })),
    [{ partyId: 'BBB-222', accountId: ACCOUNT_ONE }]
  );
});

test('a pre-lease hosted party is backfilled and blocks new creation', async () => {
  const { model, service } = createHarness({
    findHostedPartyForPrincipal: async () => ({
      partyId: 'OLD-111',
      config: { gamemode: 'truth-or-dare' }
    })
  });

  await assertOwnerConflict(
    service.acquireActivePartyOwnerLease({
      partyId: 'NEW-222',
      principal: accountPrincipal(),
      gamemode: 'truth-or-dare'
    }),
    'OLD-111'
  );

  assert.equal(model.snapshot().length, 1);
  assert.equal(model.snapshot()[0].partyId, 'OLD-111');
  assert.equal(model.snapshot()[0].status, 'active');
});

test('live-room checks match legacy lowercase party IDs', async () => {
  const model = createInMemoryLeaseModel();
  let capturedFilter = null;
  const waitingRoomSchema = {
    findOne(filter) {
      capturedFilter = filter;
      return createQuery(() => ({
        partyId: 'abc-123',
        players: [{ identity: { computerId: 'host-device' } }],
        state: {
          hostComputerId: 'host-device',
          lastPinged: new Date()
        },
        config: { gamemode: 'truth-or-dare' }
      }));
    }
  };
  const service = createActivePartyOwnerLeaseService({
    models: {
      activePartyOwnerLeaseSchema: model,
      waitingRoomSchema
    },
    findHostedPartyForPrincipal: async () => null
  });
  const first = await service.acquireActivePartyOwnerLease({
    partyId: 'abc-123',
    principal: accountPrincipal(),
    scanExistingParties: false
  });
  await service.activateActivePartyOwnerLease({
    partyId: 'ABC-123',
    releaseToken: first.releaseToken
  });

  await assertOwnerConflict(
    service.acquireActivePartyOwnerLease({
      partyId: 'NEW-222',
      principal: accountPrincipal(),
      scanExistingParties: false
    }),
    'ABC-123'
  );

  assert.equal(capturedFilter.partyId.$options, 'i');
  assert.match('abc-123', new RegExp(capturedFilter.partyId.$regex, 'i'));
  assert.equal(model.snapshot().length, 1);
});

test('rooms beyond the shared inactivity window no longer keep owner leases active', async () => {
  const model = createInMemoryLeaseModel();
  const waitingRoomSchema = {
    findOne() {
      return createQuery(() => ({
        partyId: 'OLD-123',
        players: [{ identity: { computerId: 'host-device' } }],
        state: {
          hostComputerId: 'host-device',
          lastPinged: new Date('2026-07-19T11:39:59.000Z')
        },
        config: { gamemode: 'truth-or-dare' }
      }));
    }
  };
  const service = createActivePartyOwnerLeaseService({
    models: {
      activePartyOwnerLeaseSchema: model,
      waitingRoomSchema
    },
    now: () => new Date('2026-07-19T12:00:00.000Z'),
    findHostedPartyForPrincipal: async () => null
  });
  const first = await service.acquireActivePartyOwnerLease({
    partyId: 'OLD-123',
    principal: accountPrincipal(),
    scanExistingParties: false
  });
  await service.activateActivePartyOwnerLease({
    partyId: 'OLD-123',
    releaseToken: first.releaseToken,
    gamemode: 'truth-or-dare'
  });

  const replacement = await service.acquireActivePartyOwnerLease({
    partyId: 'NEW-123',
    principal: accountPrincipal(),
    scanExistingParties: false
  });

  assert.equal(replacement.acquired, true);
  assert.deepEqual(
    model.snapshot().map(({ partyId }) => partyId),
    ['NEW-123']
  );
});

test('a recently pinged hostless game room does not keep an owner lease active', async () => {
  const model = createInMemoryLeaseModel();
  const partyGameTruthOrDareSchema = {
    findOne() {
      return createQuery(() => ({
        partyId: 'OLD-123',
        players: [],
        state: {
          hostComputerId: null,
          lastPinged: new Date('2026-07-19T11:59:59.000Z')
        },
        session: { createdAt: new Date('2026-07-19T11:50:00.000Z') }
      }));
    }
  };
  const service = createActivePartyOwnerLeaseService({
    models: {
      activePartyOwnerLeaseSchema: model,
      partyGameTruthOrDareSchema
    },
    now: () => new Date('2026-07-19T12:00:00.000Z'),
    findHostedPartyForPrincipal: async () => null
  });
  const first = await service.acquireActivePartyOwnerLease({
    partyId: 'OLD-123',
    principal: accountPrincipal(),
    scanExistingParties: false
  });
  await service.activateActivePartyOwnerLease({
    partyId: 'OLD-123',
    releaseToken: first.releaseToken,
    gamemode: 'truth-or-dare'
  });

  const replacement = await service.acquireActivePartyOwnerLease({
    partyId: 'NEW-123',
    principal: accountPrincipal(),
    scanExistingParties: false
  });

  assert.equal(replacement.acquired, true);
  assert.deepEqual(
    model.snapshot().map(({ partyId }) => partyId),
    ['NEW-123']
  );
});

test('a delayed release token cannot delete a newer reused party lease', async () => {
  const { model, service } = createHarness();
  const first = await acquire(service, 'AAA-111', accountPrincipal());

  assert.equal(
    await service.releaseActivePartyOwnerLeaseIfInactive({
      partyId: 'AAA-111',
      releaseToken: first.releaseToken
    }),
    true
  );

  const replacement = await acquire(
    service,
    'AAA-111',
    guestPrincipal(OWNER_HASH_TWO)
  );
  assert.notEqual(
    replacement.releaseToken.leaseToken,
    first.releaseToken.leaseToken
  );
  assert.equal(
    await service.releaseActivePartyOwnerLeaseIfInactive({
      partyId: 'AAA-111',
      releaseToken: first.releaseToken
    }),
    false
  );
  assert.equal(model.snapshot().length, 1);
  assert.equal(
    model.snapshot()[0].leaseToken,
    replacement.releaseToken.leaseToken
  );
});

test('a delayed release token cannot delete the same lease after renewal', async () => {
  const { model, service } = createHarness();
  const first = await acquire(service, 'AAA-111', accountPrincipal());
  const renewed = await acquire(service, 'AAA-111', accountPrincipal());

  assert.equal(renewed.releaseToken.leaseToken, first.releaseToken.leaseToken);
  assert.ok(renewed.releaseToken.revision > first.releaseToken.revision);
  assert.equal(
    await service.releaseActivePartyOwnerLeaseIfInactive({
      partyId: 'AAA-111',
      releaseToken: first.releaseToken
    }),
    false
  );
  assert.equal(model.snapshot().length, 1);
  assert.equal(model.snapshot()[0].revision, renewed.releaseToken.revision);
});
