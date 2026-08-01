const { CHANGE_STREAM_BACKOFF_MS } = require('../../constants');

function createChangeStreamService({
  io,
  debugLog,
  models,
  getConnections,
  attachDbReconnectHooks
}) {
  const { OverexposurePost } = models;
  const changeStreams = new Map();
  const changeStreamRestartTimers = new Map();
  const changeStreamRetryCounts = new Map();
  const changeStreamDefinitions = [];

  function closeChangeStream(key) {
    const stream = changeStreams.get(key);
    if (!stream) return;

    try {
      stream.removeAllListeners();
      stream.close();
    } catch (err) {
      console.warn(
        `⚠️ Failed to close change stream "${key}":`,
        err.message || err
      );
    }

    changeStreams.delete(key);
  }

  function scheduleChangeStreamRestart(definition, reason) {
    const { key, label } = definition;

    if (changeStreamRestartTimers.has(key)) {
      return;
    }

    closeChangeStream(key);

    const attempt = (changeStreamRetryCounts.get(key) || 0) + 1;
    changeStreamRetryCounts.set(key, attempt);
    const delay =
      CHANGE_STREAM_BACKOFF_MS[
        Math.min(attempt - 1, CHANGE_STREAM_BACKOFF_MS.length - 1)
      ];

    console.warn(
      `🔁 Restarting "${label}" stream in ${delay}ms (reason: ${reason}, attempt: ${attempt})`
    );

    const timer = setTimeout(() => {
      changeStreamRestartTimers.delete(key);
      registerResilientChangeStream(definition);
    }, delay);

    changeStreamRestartTimers.set(key, timer);
  }

  function registerResilientChangeStream(definition) {
    const { key, label, open, onChange } = definition;

    closeChangeStream(key);

    const pendingTimer = changeStreamRestartTimers.get(key);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      changeStreamRestartTimers.delete(key);
    }

    let stream;
    try {
      stream = open();
    } catch (err) {
      console.error(`❌ Failed to open "${label}" stream:`, err);
      scheduleChangeStreamRestart(definition, 'open-failed');
      return;
    }

    changeStreams.set(key, stream);
    changeStreamRetryCounts.set(key, 0);

    stream.on('change', onChange);
    stream.on('error', (err) => {
      console.error(`❌ ${label} stream error:`, err);
      scheduleChangeStreamRestart(definition, 'error');
    });
    stream.on('close', () => {
      console.warn(`⚠️ ${label} stream closed`);
      scheduleChangeStreamRestart(definition, 'close');
    });
    stream.on('end', () => {
      console.warn(`⚠️ ${label} stream ended`);
      scheduleChangeStreamRestart(definition, 'end');
    });

    debugLog(`👁 Watching ${label} stream`);
  }

  function restartAllChangeStreams(reason = 'manual-restart') {
    if (!changeStreamDefinitions.length) return;
    console.warn(`♻️ Restarting all change streams (${reason})`);
    changeStreamDefinitions.forEach(registerResilientChangeStream);
  }

  async function startChangeStreams() {
    const {
      overexposureDb,
      accountsDb,
      olingsDb,
      partyGamesDb,
      shopDb,
      moderationDb,
      socialDb
    } = getConnections();
    if (
      !overexposureDb ||
      !accountsDb ||
      !olingsDb ||
      !partyGamesDb ||
      !shopDb ||
      !moderationDb ||
      !socialDb
    ) {
      throw new Error(
        'Cannot start change streams before database connection is ready'
      );
    }

    const waitingRoomDB = partyGamesDb.collection('waiting-room');
    const partyGameTruthOrDareDB = partyGamesDb.collection(
      'party-game-truth-or-dare'
    );
    const partyGameParanoiaDB = partyGamesDb.collection('party-game-paranoia');
    const partyGameNeverHaveIEverDB = partyGamesDb.collection(
      'party-game-never-have-i-ever'
    );
    const partyGameMostLikelyToDB = partyGamesDb.collection(
      'party-game-most-likely-to'
    );
    const partyGameImposterDB = partyGamesDb.collection('party-game-imposter');
    const partyGameWouldYouRatherDB = partyGamesDb.collection(
      'party-game-would-you-rather'
    );
    const partyGameMafiaDB = partyGamesDb.collection('party-game-mafia');
    const partyGameChatLogDB = partyGamesDb.collection('party-game-chat-log');

    const openWatchStream = (collection) => {
      if (collection?.collection?.watch) {
        return collection.collection.watch([], {
          fullDocument: 'updateLookup'
        });
      }
      return collection.watch([], { fullDocument: 'updateLookup' });
    };

    const partyChangeHandler = (label) => (change) => {
      const partyCode = change.fullDocument?.partyId;
      if (!partyCode) {
        console.warn(`⚠️ ${label} change missing partyCode`);
        return;
      }

      io.to(partyCode).emit('party-updated', {
        type: change.operationType,
        source: label,
        emittedPartyCode: change.fullDocument || null,
        documentKey: change.documentKey
      });
      debugLog(`🔄 ${label} change sent to ${partyCode}`);
    };

    const chatLogChangeHandler = (change) => {
      const partyCode = change.fullDocument?.partyId;

      if (!partyCode && change.operationType === 'delete') {
        console.warn('⚠️ chat-log delete missing partyId');
        return;
      }

      if (['insert', 'update'].includes(change.operationType)) {
        io.to(partyCode).emit('chat-updated', {
          type: change.operationType,
          chatLog: change.fullDocument,
          documentKey: change.documentKey
        });
        debugLog(`💬 chat-log ${change.operationType} sent to ${partyCode}`);
      }

      if (change.operationType === 'delete') {
        io.to(partyCode).emit('chat-updated', {
          type: 'delete',
          chatLog: null,
          documentKey: change.documentKey
        });
        debugLog(`❌ chat-log delete sent to ${partyCode}`);
      }
    };

    changeStreamDefinitions.length = 0;
    changeStreamDefinitions.push(
      {
        key: 'overexposurePosts',
        label: 'overexposurePosts',
        open: () =>
          OverexposurePost.watch([], { fullDocument: 'updateLookup' }),
        onChange: (change) => io.emit('overexposure-posts-updated', change)
      },
      {
        key: 'party-game-truth-or-dare',
        label: 'party-game-truth-or-dare',
        open: () => openWatchStream(partyGameTruthOrDareDB),
        onChange: partyChangeHandler('party-game-truth-or-dare')
      },
      {
        key: 'party-game-paranoia',
        label: 'party-game-paranoia',
        open: () => openWatchStream(partyGameParanoiaDB),
        onChange: partyChangeHandler('party-game-paranoia')
      },
      {
        key: 'party-game-never-have-i-ever',
        label: 'party-game-never-have-i-ever',
        open: () => openWatchStream(partyGameNeverHaveIEverDB),
        onChange: partyChangeHandler('party-game-never-have-i-ever')
      },
      {
        key: 'party-game-most-likely-to',
        label: 'party-game-most-likely-to',
        open: () => openWatchStream(partyGameMostLikelyToDB),
        onChange: partyChangeHandler('party-game-most-likely-to')
      },
      {
        key: 'party-game-imposter',
        label: 'party-game-imposter',
        open: () => openWatchStream(partyGameImposterDB),
        onChange: partyChangeHandler('party-game-imposter')
      },
      {
        key: 'party-game-would-you-rather',
        label: 'party-game-would-you-rather',
        open: () => openWatchStream(partyGameWouldYouRatherDB),
        onChange: partyChangeHandler('party-game-would-you-rather')
      },
      {
        key: 'party-game-mafia',
        label: 'party-game-mafia',
        open: () => openWatchStream(partyGameMafiaDB),
        onChange: partyChangeHandler('party-game-mafia')
      },
      {
        key: 'party-game-chat-log',
        label: 'party-game-chat-log',
        open: () => openWatchStream(partyGameChatLogDB),
        onChange: chatLogChangeHandler
      },
      {
        key: 'waiting-room',
        label: 'waiting-room',
        open: () => openWatchStream(waitingRoomDB),
        onChange: partyChangeHandler('waiting-room')
      }
    );

    attachDbReconnectHooks();
    restartAllChangeStreams('startup');
  }


  return {
    restartAllChangeStreams,
    startChangeStreams
  };
}

module.exports = {
  createChangeStreamService
};
