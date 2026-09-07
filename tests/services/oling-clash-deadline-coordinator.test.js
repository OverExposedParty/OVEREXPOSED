const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createOlingClashDeadlineCoordinator
} = require('../../server/services/oling-clashes/deadline-coordinator');
const {
  emitClashUpdate
} = require('../../server/services/oling-clashes/events');

test('Clash deadline coordinator finalizes expired matches and broadcasts once', async () => {
  const emitted = [];
  const finalizedCodes = [];
  const match = {
    gameId: 'OCL-DEADLINE',
    matchCode: 'ABC-123',
    phase: 'selection',
    players: [],
    round: 2,
    status: 'active'
  };
  const models = {
    OlingClashMatch: {
      find() {
        return {
          select() {
            return this;
          },
          lean() {
            return this;
          },
          async exec() {
            return [{ matchCode: match.matchCode }];
          }
        };
      }
    }
  };
  const runtime = {
    io: {
      to(room) {
        return {
          emit(event, payload) {
            emitted.push({ event, payload, room });
          }
        };
      }
    }
  };
  const coordinator = createOlingClashDeadlineCoordinator({
    models,
    runtime,
    now: () => 1000,
    async finalize({ matchCode }) {
      finalizedCodes.push(matchCode);
      return {
        finalized: true,
        match,
        resolvedMatch: { ...match, phase: 'resolution' },
        roundResult: { round: 2 }
      };
    }
  });

  const results = await coordinator.sweep();

  assert.equal(results.length, 1);
  assert.deepEqual(finalizedCodes, ['ABC-123']);
  assert.deepEqual(
    emitted.map(({ event }) => event),
    ['oling-clash:round-resolved', 'oling-clash:round']
  );
  assert.ok(emitted.every(({ room }) => room === 'ABC-123'));
});

test('Clash deadline coordinator ignores an overlapping sweep', async () => {
  let releaseFind;
  const pendingFind = new Promise((resolve) => {
    releaseFind = resolve;
  });
  const coordinator = createOlingClashDeadlineCoordinator({
    models: {
      OlingClashMatch: {
        find() {
          return pendingFind;
        }
      }
    }
  });

  const firstSweep = coordinator.sweep();
  assert.deepEqual(await coordinator.sweep(), []);
  releaseFind([]);
  assert.deepEqual(await firstSweep, []);
});

test('Clash deadline coordinator schedules the exact stored deadline', async () => {
  let scheduledDelay = null;
  let scheduledCallback = null;
  const finalizedCodes = [];
  const coordinator = createOlingClashDeadlineCoordinator({
    now: () => 1_000,
    setTimeout(callback, delay) {
      scheduledCallback = callback;
      scheduledDelay = delay;
      return 1;
    },
    clearTimeout() {},
    async finalize({ matchCode }) {
      finalizedCodes.push(matchCode);
      return { finalized: false };
    }
  });

  assert.equal(
    coordinator.sync({
      matchCode: 'ABC-123',
      status: 'active',
      phase: 'selection',
      phaseEndsAt: new Date(1_750)
    }),
    true
  );
  assert.equal(scheduledDelay, 750);
  scheduledCallback();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(finalizedCodes, ['ABC-123']);
});

test('Clash broadcasts use revisioned patches after the initial snapshot', () => {
  const emitted = [];
  const runtime = {
    io: {
      to() {
        return {
          emit(event, payload) {
            emitted.push({ event, payload });
          }
        };
      }
    }
  };
  const match = {
    gameId: 'OCL-PATCH',
    matchCode: 'ABC-123',
    stateRevision: 1,
    derivedStateVersion: 1,
    latestRoundResult: null,
    status: 'active',
    phase: 'selection',
    phaseEndsAt: null,
    round: 2,
    players: [],
    events: []
  };

  emitClashUpdate(runtime, match);
  match.stateRevision = 2;
  match.phase = 'replacement';
  emitClashUpdate(runtime, match, 'oling-clash:replacement');

  assert.equal(emitted[0].payload.type, undefined);
  assert.equal(emitted[1].payload.type, 'patch');
  assert.equal(emitted[1].payload.baseRevision, 1);
  assert.equal(emitted[1].payload.revision, 2);
  assert.ok(
    emitted[1].payload.changes.some(
      ({ path, value }) => path.join('.') === 'phase' && value === 'replacement'
    )
  );
});
