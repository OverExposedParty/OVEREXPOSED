const {
  getPartyRoomActiveSince,
  getPartyRoomLastActivity,
  isPartyRoomExpired
} = require('../party-room-activity');

const DEFAULT_OE_ICON = '0000:0100:0200:0300';

function createRoomArchiver({ models, partyOwnerLeases = {} }) {
  const {
    partyGameTruthOrDareSchema,
    partyGameParanoiaSchema,
    partyGameNeverHaveIEverSchema,
    partyGameMostLikelyToSchema,
    partyGameImposterSchema,
    partyGameWouldYouRatherSchema,
    partyGameMafiaSchema,
    partyGameChatLogSchema,
    archivedRoomSchema,
    waitingRoomSchema,
    Account
  } = models;
  const {
    getActivePartyOwnerLeaseReleaseToken,
    releaseActivePartyOwnerLeaseIfInactive
  } = partyOwnerLeases;

  const roomArchiveIntervalMs =
    (Number(process.env.PARTY_ROOM_ARCHIVE_INTERVAL_SECONDS) || 60) * 1000;
  let roomArchiveInterval = null;
  let roomArchiveInProgress = false;

  function getPartyGameArchiveSources() {
    return [
      {
        model: partyGameTruthOrDareSchema,
        collectionName: 'party-game-truth-or-dare'
      },
      {
        model: partyGameParanoiaSchema,
        collectionName: 'party-game-paranoia'
      },
      {
        model: partyGameNeverHaveIEverSchema,
        collectionName: 'party-game-never-have-i-ever'
      },
      {
        model: partyGameMostLikelyToSchema,
        collectionName: 'party-game-most-likely-to'
      },
      {
        model: partyGameImposterSchema,
        collectionName: 'party-game-imposter'
      },
      {
        model: partyGameWouldYouRatherSchema,
        collectionName: 'party-game-would-you-rather'
      },
      {
        model: partyGameMafiaSchema,
        collectionName: 'party-game-mafia'
      }
    ];
  }

  function getPartyGameCollectionNameForGamemode(gamemode) {
    const collectionNamesByGamemode = {
      'truth-or-dare': 'party-game-truth-or-dare',
      paranoia: 'party-game-paranoia',
      'never-have-i-ever': 'party-game-never-have-i-ever',
      'most-likely-to': 'party-game-most-likely-to',
      imposter: 'party-game-imposter',
      'would-you-rather': 'party-game-would-you-rather',
      mafia: 'party-game-mafia'
    };

    return collectionNamesByGamemode[gamemode] || 'party-game-unknown';
  }

  function toPlainObject(value) {
    if (!value) return {};
    return value.toObject ? value.toObject() : value;
  }

  function toPlainGameRules(gameRules) {
    if (!gameRules) return {};
    if (gameRules instanceof Map) return Object.fromEntries(gameRules);
    return gameRules;
  }

  function getRoomInstructions(room) {
    return (
      room.config?.userInstructions ??
      room.state?.userInstructions ??
      room.userInstructions ??
      ''
    );
  }

  function createArchivedRoom(
    roomDocument,
    sourceCollection,
    { archivedAt = new Date(), endedAt = archivedAt } = {}
  ) {
    const room = toPlainObject(roomDocument);
    const players = Array.isArray(room.players) ? room.players : [];
    const hostComputerId = room.state?.hostComputerId ?? null;
    const gamemode = room.config?.gamemode ?? room.gamemode ?? null;
    const gameId = room.session?.gameId ?? null;
    const partyId = room.partyId;
    const userInstructions = getRoomInstructions(room);
    const completionStatus =
      room.state?.phase === 'game-over'
        ? 'completed'
        : room.session?.startedAt ||
            (room.state?.phase &&
              room.state.phase !== 'lobby' &&
              Number(room.session?.playSequence) > 0)
          ? 'abandoned'
          : 'lobby-closed';

    return {
      partyId,
      gameId,
      gamemode,
      sourceCollection,
      archivedAt,
      completionStatus,
      session: {
        createdAt: room.session?.createdAt ?? null,
        startedAt: room.session?.startedAt ?? null,
        endedAt,
        serverRegion: room.session?.serverRegion ?? null,
        gameModeRelease: room.session?.gameModeRelease ?? null
      },
      config: {
        selectedPacks: Array.isArray(room.config?.selectedPacks)
          ? room.config.selectedPacks
          : [],
        roleCounts: toPlainGameRules(room.config?.roleCounts),
        gameRules: toPlainGameRules(room.config?.gameRules),
        userInstructions
      },
      state: {
        phase: room.state?.phase ?? null,
        phaseData: room.state?.phaseData ?? null,
        timer: room.state?.timer ?? null,
        userInstructions
      },
      players: players.map((player) => ({
        computerId: player.identity?.computerId ?? null,
        accountId: player.identity?.accountId ?? null,
        username: player.identity?.username ?? '',
        userIcon:
          player.identity?.userIcon ?? player.userIcon ?? DEFAULT_OE_ICON,
        isHost:
          Boolean(hostComputerId) &&
          String(player.identity?.computerId) === String(hostComputerId)
      })),
      errors: Array.isArray(room.errors) ? room.errors : []
    };
  }

  async function archiveRoomSnapshot({
    roomDocument,
    sourceCollection,
    endedAt
  }) {
    const room = toPlainObject(roomDocument);
    const gameId = room.session?.gameId ?? null;
    if (!room.partyId || !gameId) return false;

    const resolvedSourceCollection =
      sourceCollection ||
      getPartyGameCollectionNameForGamemode(room.config?.gamemode);
    const archivedAt = new Date();
    const archivedRoom = createArchivedRoom(room, resolvedSourceCollection, {
      archivedAt,
      endedAt: endedAt ?? archivedAt
    });

    await archivedRoomSchema.updateOne(
      { gameId },
      { $setOnInsert: archivedRoom },
      { upsert: true }
    );

    const archivedRecord = await archivedRoomSchema
      .findOne({ gameId })
      .select('_id players.accountId')
      .lean();
    const accountIds = (archivedRecord?.players || [])
      .map((player) => player.accountId)
      .filter(Boolean);

    if (
      archivedRecord?._id &&
      archivedRoom.completionStatus === 'completed' &&
      accountIds.length > 0
    ) {
      await Account.updateMany(
        { _id: { $in: accountIds } },
        { $addToSet: { 'gameData.matchHistory': archivedRecord._id } }
      );
    }

    return true;
  }

  async function archiveRoomDocument({
    roomDocument,
    sourceCollection,
    deleteFromModel,
    deleteRelatedDocuments = false,
    endedAt
  }) {
    const room = toPlainObject(roomDocument);
    const gameId = room.session?.gameId ?? null;
    if (!room.partyId || !gameId) return false;
    let leaseReleaseToken = null;

    if (typeof getActivePartyOwnerLeaseReleaseToken === 'function') {
      try {
        leaseReleaseToken = await getActivePartyOwnerLeaseReleaseToken(
          room.partyId
        );
      } catch (error) {
        console.warn(
          `Failed to capture the owner lease for expired party ${room.partyId}:`,
          error.message || error
        );
      }
    }

    await archiveRoomSnapshot({
      roomDocument: room,
      sourceCollection,
      endedAt
    });

    await deleteFromModel.deleteOne({ partyId: room.partyId });

    if (deleteRelatedDocuments) {
      await waitingRoomSchema.deleteOne({ partyId: room.partyId });
      try {
        await partyGameChatLogSchema.deleteOne({ partyId: room.partyId });
      } catch (error) {
        console.warn(
          `Failed to delete chat for expired party ${room.partyId}:`,
          error.message || error
        );
      }
    }

    if (
      leaseReleaseToken &&
      typeof releaseActivePartyOwnerLeaseIfInactive === 'function'
    ) {
      try {
        await releaseActivePartyOwnerLeaseIfInactive({
          partyId: room.partyId,
          releaseToken: leaseReleaseToken
        });
      } catch (error) {
        console.warn(
          `Failed to release the owner lease for expired party ${room.partyId}:`,
          error.message || error
        );
      }
    }

    return true;
  }

  function getExpiredRoomQuery(cutoffDate) {
    return {
      $or: [
        { 'state.lastPinged': { $lte: cutoffDate } },
        { lastPinged: { $lte: cutoffDate } },
        {
          'state.lastPinged': { $exists: false },
          lastPinged: { $exists: false },
          'session.createdAt': { $lte: cutoffDate }
        }
      ]
    };
  }

  async function archiveExpiredRooms() {
    if (roomArchiveInProgress) return;
    roomArchiveInProgress = true;

    try {
      const archiveStartedAt = new Date();
      const cutoffDate = getPartyRoomActiveSince(archiveStartedAt);
      const expiredRoomQuery = getExpiredRoomQuery(cutoffDate);

      for (const source of getPartyGameArchiveSources()) {
        const expiredRooms = await source.model
          .find(expiredRoomQuery)
          .limit(50)
          .lean();

        for (const room of expiredRooms) {
          if (!isPartyRoomExpired(room, archiveStartedAt)) continue;
          const lastActivity = getPartyRoomLastActivity(room);
          await archiveRoomDocument({
            roomDocument: room,
            sourceCollection: source.collectionName,
            deleteFromModel: source.model,
            deleteRelatedDocuments: true,
            endedAt:
              lastActivity == null ? archiveStartedAt : new Date(lastActivity)
          });
        }
      }

      const waitingRoomOnlyRecords = await waitingRoomSchema
        .find(expiredRoomQuery)
        .limit(50)
        .lean();

      for (const room of waitingRoomOnlyRecords) {
        if (!isPartyRoomExpired(room, archiveStartedAt)) continue;
        const lastActivity = getPartyRoomLastActivity(room);
        const matchingGames = await Promise.all(
          getPartyGameArchiveSources().map((source) =>
            source.model.exists({ partyId: room.partyId })
          )
        );

        if (matchingGames.some(Boolean)) continue;

        await archiveRoomDocument({
          roomDocument: room,
          sourceCollection: getPartyGameCollectionNameForGamemode(
            room.config?.gamemode
          ),
          deleteFromModel: waitingRoomSchema,
          deleteRelatedDocuments: false,
          endedAt:
            lastActivity == null ? archiveStartedAt : new Date(lastActivity)
        });
      }
    } catch (error) {
      console.warn(
        'Failed to archive expired party rooms:',
        error.message || error
      );
    } finally {
      roomArchiveInProgress = false;
    }
  }

  function startRoomArchiver() {
    if (roomArchiveInterval) return;

    archiveExpiredRooms();
    roomArchiveInterval = setInterval(
      archiveExpiredRooms,
      roomArchiveIntervalMs
    );
  }

  return {
    startRoomArchiver,
    archiveExpiredRooms,
    archiveRoomSnapshot
  };
}

module.exports = {
  createRoomArchiver
};
