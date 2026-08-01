const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPartyRouteHandlers,
  shouldUseDisconnectGrace
} = require('../../server/game-engine/party-runtime/routes');
const {
  registerPartySockets
} = require('../../server/sockets/register-party-sockets');

function createRouteHandlers() {
  return createPartyRouteHandlers({
    app: {},
    io: {
      sockets: {
        sockets: new Map()
      }
    },
    getPartyPlayerId(player) {
      return player?.identity?.computerId ?? player?.computerId ?? null;
    }
  });
}

test('disconnectSocketPartyMemberships ignores sockets with no tracked memberships', async () => {
  const { disconnectSocketPartyMemberships } = createRouteHandlers();

  await assert.doesNotReject(() =>
    disconnectSocketPartyMemberships('untracked-socket')
  );
});

test('game-over page refreshes keep the host during reconnect grace', () => {
  assert.equal(
    shouldUseDisconnectGrace({
      config: { gamemode: 'most-likely-to' },
      state: { isPlaying: false, phase: 'game-over' }
    }),
    true
  );
});

test('ordinary lobby exits do not use reconnect grace', () => {
  assert.equal(
    shouldUseDisconnectGrace({
      config: { gamemode: 'most-likely-to' },
      state: { isPlaying: false, phase: 'lobby' }
    }),
    false
  );
});

test('party socket disconnect handler logs cleanup failures without throwing', async () => {
  let disconnectHandler = null;
  const originalConsoleError = console.error;
  const loggedErrors = [];

  console.error = (...args) => {
    loggedErrors.push(args);
  };

  try {
    registerPartySockets({
      io: {
        on(eventName, handler) {
          if (eventName === 'connection') {
            handler({
              id: 'socket-1',
              rooms: new Set(['socket-1']),
              on(socketEventName, socketHandler) {
                if (socketEventName === 'disconnect') {
                  disconnectHandler = socketHandler;
                }
              },
              join() {},
              leave() {},
              emit() {},
              to() {
                return {
                  emit() {}
                };
              }
            });
          }
        }
      },
      debugLog() {},
      async disconnectSocketPartyMemberships() {
        throw new Error('cleanup failed');
      }
    });

    await assert.doesNotReject(() => disconnectHandler());
    assert.equal(loggedErrors.length, 1);
    assert.match(String(loggedErrors[0][0]), /Failed to clean up/);
  } finally {
    console.error = originalConsoleError;
  }
});

test('party sockets do not accept client-declared party deletion', () => {
  const registeredEvents = [];

  registerPartySockets({
    io: {
      on(eventName, handler) {
        if (eventName !== 'connection') return;
        handler({
          id: 'socket-1',
          rooms: new Set(['socket-1']),
          on(socketEventName) {
            registeredEvents.push(socketEventName);
          },
          join() {},
          leave() {},
          emit() {},
          to() {
            return { emit() {} };
          }
        });
      }
    },
    debugLog() {},
    async disconnectSocketPartyMemberships() {}
  });

  assert.equal(registeredEvents.includes('delete-party'), false);
});
