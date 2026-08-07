const crypto = require('crypto');
const {
  PARTY_ROOM_INACTIVITY_MS,
  isPartyRoomActive
} = require('./party-room-activity');

const DEFAULT_PENDING_LEASE_MS =
  (Number(process.env.PARTY_OWNER_LEASE_PENDING_SECONDS) || 120) * 1000;
const MAX_ACQUIRE_ATTEMPTS = 5;
const MAX_ATTACH_ATTEMPTS = 5;
const ACTIVE_PARTICIPANT_WINDOW_MS = PARTY_ROOM_INACTIVITY_MS;
const PARTY_GAME_API_ROUTES = new Set([
  'party-game-truth-or-dare',
  'party-game-paranoia',
  'party-game-never-have-i-ever',
  'party-game-most-likely-to',
  'party-game-imposter',
  'party-game-would-you-rather',
  'party-game-mafia'
]);

function isDuplicateKeyError(error) {
  return error?.code === 11000;
}

function createActivePartyOwnerLeaseService({
  models,
  now = () => new Date(),
  pendingLeaseMs = DEFAULT_PENDING_LEASE_MS,
  partyExists,
  findHostedPartyForPrincipal,
  findJoinedPartyForPrincipal
}) {
  const {
    activePartyOwnerLeaseSchema: ActivePartyOwnerLease,
    waitingRoomSchema,
    partyGameTruthOrDareSchema,
    partyGameParanoiaSchema,
    partyGameNeverHaveIEverSchema,
    partyGameMostLikelyToSchema,
    partyGameImposterSchema,
    partyGameWouldYouRatherSchema,
    partyGameMafiaSchema
  } = models;
  const gameRoomSources = [
    ['party-game-truth-or-dare', partyGameTruthOrDareSchema],
    ['party-game-paranoia', partyGameParanoiaSchema],
    ['party-game-never-have-i-ever', partyGameNeverHaveIEverSchema],
    ['party-game-most-likely-to', partyGameMostLikelyToSchema],
    ['party-game-imposter', partyGameImposterSchema],
    ['party-game-would-you-rather', partyGameWouldYouRatherSchema],
    ['party-game-mafia', partyGameMafiaSchema]
  ].filter(([, model]) => Boolean(model));
  const gameRoomModels = gameRoomSources.map(([, model]) => model);
  const activeRoomSources = [
    ...(waitingRoomSchema ? [['waiting-room', waitingRoomSchema]] : []),
    ...gameRoomSources
  ];
  const activeRoomModels = activeRoomSources.map(([, model]) => model);

  function getNow() {
    const value = now();
    return value instanceof Date ? value : new Date(value);
  }

  function toPlainObject(value) {
    return value?.toObject ? value.toObject() : value;
  }

  async function resolveQuery(
    query,
    { includePrivateLeaseFields = false } = {}
  ) {
    let result = query;

    if (includePrivateLeaseFields && result?.select) {
      result = result.select('+accountId +partyOwnerIdHash +leaseToken');
    }

    if (result?.lean) {
      result = result.lean();
    }

    return toPlainObject(await result);
  }

  function normalizePartyId(value) {
    return String(value || '')
      .trim()
      .toUpperCase();
  }

  function getPartyIdLookup(partyId) {
    const escapedPartyId = normalizePartyId(partyId).replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );
    return { $regex: `^${escapedPartyId}$`, $options: 'i' };
  }

  function getPrincipalIdentity(principal) {
    const partyOwnerIdHash = String(
      principal?.partyOwnerIdHash || principal?.guestIdHash || ''
    ).trim();

    if (!partyOwnerIdHash) {
      const error = new Error('A persistent party owner identity is required.');
      error.status = 500;
      error.code = 'party_owner_identity_missing';
      throw error;
    }

    return {
      partyOwnerIdHash,
      accountId:
        principal?.type === 'account' && principal.accountId
          ? String(principal.accountId)
          : null
    };
  }

  function buildLeaseIdentityFilter(identity) {
    return [
      { partyOwnerIdHash: identity.partyOwnerIdHash },
      ...(identity.accountId ? [{ accountId: identity.accountId }] : [])
    ];
  }

  function buildConflictingLeaseFilter(partyId, identity) {
    return {
      $or: [{ partyId }, ...buildLeaseIdentityFilter(identity)]
    };
  }

  async function findLease(filter) {
    return resolveQuery(ActivePartyOwnerLease.findOne(filter), {
      includePrivateLeaseFields: true
    });
  }

  function leaseMatchesPrincipal(lease, identity) {
    return (
      String(lease?.partyOwnerIdHash || '') === identity.partyOwnerIdHash ||
      Boolean(
        identity.accountId &&
        String(lease?.accountId || '') === identity.accountId
      )
    );
  }

  function getSafeLeaseDetails(lease) {
    const partyCode = normalizePartyId(lease?.partyId);
    const gamemode = String(lease?.gamemode || '').trim();
    const apiRoute = `party-game-${gamemode}`;
    return {
      partyCode,
      lobbyPath: partyCode ? `/${partyCode}` : '/',
      ...(gamemode ? { gamemode } : {}),
      ...(PARTY_GAME_API_ROUTES.has(apiRoute) ? { apiRoute } : {})
    };
  }

  function createOwnerConflictError(lease) {
    const error = new Error('You already own an active party.');
    error.status = 409;
    error.code = 'party_owner_active_party_exists';
    error.details = getSafeLeaseDetails(lease);
    return error;
  }

  function createAccountAttachmentConflict(lease) {
    const details = getSafeLeaseDetails(lease);
    return {
      attached: false,
      conflict: true,
      partyId: details.partyCode,
      ...(details.gamemode ? { gamemode: details.gamemode } : {}),
      ...(details.apiRoute ? { apiRoute: details.apiRoute } : {})
    };
  }

  function hasResolvablePartyHost(room) {
    const hostComputerId = String(room?.state?.hostComputerId || '').trim();
    return Boolean(
      hostComputerId &&
      Array.isArray(room?.players) &&
      room.players.some(
        (player) =>
          String(player?.identity?.computerId || '') === hostComputerId
      )
    );
  }

  async function defaultPartyExists(partyId) {
    const partyIdFilter = { partyId: getPartyIdLookup(partyId) };
    if (waitingRoomSchema) {
      const waitingRoom = await resolveQuery(
        waitingRoomSchema
          .findOne(partyIdFilter)
          .select(
            'partyId players.identity.computerId state.hostComputerId state.lastPinged lastPinged session.createdAt config.gamemode'
          )
      );
      if (
        hasResolvablePartyHost(waitingRoom) &&
        isPartyRoomActive(waitingRoom, getNow())
      ) {
        return true;
      }
    }

    const gameRooms = await Promise.all(
      gameRoomModels.map((model) =>
        resolveQuery(
          model
            .findOne(partyIdFilter)
            .select(
              'partyId players.identity.computerId state.hostComputerId state.lastPinged lastPinged session.createdAt'
            )
        )
      )
    );
    return gameRooms.some(
      (room) =>
        hasResolvablePartyHost(room) && isPartyRoomActive(room, getNow())
    );
  }

  const doesPartyExist = partyExists || defaultPartyExists;

  function roomHostMatchesIdentity(room, identity) {
    const hostComputerId = room?.state?.hostComputerId;
    if (!hostComputerId || !Array.isArray(room?.players)) return false;

    const host = room.players.find(
      (player) =>
        String(player?.identity?.computerId || '') === String(hostComputerId)
    );
    if (!host) return false;

    return Boolean(
      (identity.accountId &&
        String(host.identity?.accountId || '') === identity.accountId) ||
      String(host.identity?.partyOwnerIdHash || '') ===
        identity.partyOwnerIdHash ||
      String(host.identity?.guestIdHash || '') === identity.partyOwnerIdHash
    );
  }

  async function defaultFindHostedPartyForPrincipal({
    identity,
    excludePartyId
  }) {
    const normalizedExcludedPartyId = normalizePartyId(excludePartyId);
    const identityFilters = [
      ...(identity.accountId
        ? [{ 'players.identity.accountId': identity.accountId }]
        : []),
      { 'players.identity.partyOwnerIdHash': identity.partyOwnerIdHash },
      { 'players.identity.guestIdHash': identity.partyOwnerIdHash }
    ];
    const filter = { $or: identityFilters };

    const roomGroups = await Promise.all(
      activeRoomModels.map(async (model) => {
        let query = model
          .find(filter)
          .select(
            'partyId config.gamemode state.hostComputerId state.lastPinged session.createdAt players.identity.computerId players.identity.accountId +players.identity.partyOwnerIdHash +players.identity.guestIdHash'
          );
        if (query?.sort) query = query.sort({ 'state.lastPinged': -1 });
        if (query?.lean) query = query.lean();
        const rooms = await query;
        return Array.isArray(rooms) ? rooms : [];
      })
    );

    return (
      roomGroups
        .flat()
        .filter(
          (room) =>
            roomHostMatchesIdentity(room, identity) &&
            isPartyRoomActive(room, getNow()) &&
            (!normalizedExcludedPartyId ||
              normalizePartyId(room.partyId) !== normalizedExcludedPartyId)
        )
        .sort(
          (left, right) =>
            new Date(right.state?.lastPinged || right.session?.createdAt || 0) -
            new Date(left.state?.lastPinged || left.session?.createdAt || 0)
        )[0] || null
    );
  }

  const findHostedParty =
    findHostedPartyForPrincipal || defaultFindHostedPartyForPrincipal;

  function playerMatchesIdentity(player, identity) {
    return Boolean(
      (identity.accountId &&
        String(player?.identity?.accountId || '') === identity.accountId) ||
      String(player?.identity?.partyOwnerIdHash || '') ===
        identity.partyOwnerIdHash ||
      String(player?.identity?.guestIdHash || '') === identity.partyOwnerIdHash
    );
  }

  function getParticipantApiRoute(sourceName, gamemode) {
    if (sourceName !== 'waiting-room') return sourceName;
    const candidate = `party-game-${String(gamemode || '').trim()}`;
    return PARTY_GAME_API_ROUTES.has(candidate) ? candidate : null;
  }

  async function defaultFindJoinedPartyForPrincipal({ identity }) {
    const identityFilters = [
      ...(identity.accountId
        ? [{ 'players.identity.accountId': identity.accountId }]
        : []),
      { 'players.identity.partyOwnerIdHash': identity.partyOwnerIdHash },
      { 'players.identity.guestIdHash': identity.partyOwnerIdHash }
    ];
    const roomGroups = await Promise.all(
      activeRoomSources.map(async ([sourceName, model]) => {
        let query = model
          .find({ $or: identityFilters })
          .select(
            'partyId config.gamemode state.hostComputerId state.lastPinged players.identity.computerId players.identity.accountId +players.identity.partyOwnerIdHash +players.identity.guestIdHash'
          );
        if (query?.sort) query = query.sort({ 'state.lastPinged': -1 });
        if (query?.lean) query = query.lean();
        const rooms = await query;
        return (Array.isArray(rooms) ? rooms : []).map((room) => ({
          room,
          sourceName
        }));
      })
    );

    return (
      roomGroups
        .flat()
        .map(({ room, sourceName }) => {
          if (!isPartyRoomActive(room, getNow())) return null;
          const hostComputerId = room?.state?.hostComputerId;
          const player = room?.players?.find(
            (candidate) =>
              playerMatchesIdentity(candidate, identity) &&
              String(candidate?.identity?.computerId || '') !==
                String(hostComputerId || '')
          );
          if (!player) return null;

          const gamemode = String(room?.config?.gamemode || '').trim();
          return {
            partyCode: normalizePartyId(room?.partyId),
            lobbyPath: room?.partyId
              ? `/${normalizePartyId(room.partyId)}`
              : '/',
            gamemode,
            apiRoute: getParticipantApiRoute(sourceName, gamemode),
            playerComputerId: String(player.identity?.computerId || ''),
            lastPinged: room?.state?.lastPinged || null
          };
        })
        .filter(
          (party) =>
            party?.partyCode && party?.apiRoute && party?.playerComputerId
        )
        .sort(
          (left, right) =>
            new Date(right.lastPinged || 0) - new Date(left.lastPinged || 0)
        )[0] || null
    );
  }

  const findJoinedParty =
    findJoinedPartyForPrincipal || defaultFindJoinedPartyForPrincipal;

  function createParticipantConflictError(party) {
    const error = new Error('You are already in an active party.');
    error.status = 409;
    error.code = 'party_participant_active_party_exists';
    error.details = {
      partyCode: normalizePartyId(party?.partyCode || party?.partyId),
      lobbyPath:
        party?.lobbyPath ||
        (party?.partyCode || party?.partyId
          ? `/${normalizePartyId(party.partyCode || party.partyId)}`
          : '/'),
      ...(party?.gamemode ? { gamemode: party.gamemode } : {}),
      ...(party?.apiRoute ? { apiRoute: party.apiRoute } : {}),
      ...(party?.playerComputerId
        ? { playerComputerId: party.playerComputerId }
        : {})
    };
    return error;
  }

  async function assertNoActiveParticipantParty(principal) {
    const identity = getPrincipalIdentity(principal);
    const party = await findJoinedParty({ identity });
    if (party) throw createParticipantConflictError(party);
    return true;
  }

  function getPendingExpiry(date = getNow()) {
    return new Date(date.getTime() + pendingLeaseMs);
  }

  function buildLeaseDocument({
    partyId,
    identity,
    gamemode = null,
    status = 'pending'
  }) {
    const currentTime = getNow();
    return {
      partyId,
      partyOwnerIdHash: identity.partyOwnerIdHash,
      ...(identity.accountId ? { accountId: identity.accountId } : {}),
      leaseToken: crypto.randomUUID(),
      status,
      gamemode: gamemode || null,
      ...(status === 'pending'
        ? { expiresAt: getPendingExpiry(currentTime) }
        : { activatedAt: currentTime }),
      revision: 1,
      createdAt: currentTime,
      updatedAt: currentTime
    };
  }

  async function touchSamePartyLease(lease) {
    const currentTime = getNow();
    const set = { updatedAt: currentTime };
    if (lease.status === 'pending') {
      set.expiresAt = getPendingExpiry(currentTime);
    }

    return resolveQuery(
      ActivePartyOwnerLease.findOneAndUpdate(
        {
          _id: lease._id,
          leaseToken: lease.leaseToken,
          revision: lease.revision
        },
        {
          $set: set,
          $inc: { revision: 1 }
        },
        { new: true }
      ),
      { includePrivateLeaseFields: true }
    );
  }

  async function deleteStaleLease(lease, currentTime) {
    const filter = {
      _id: lease._id,
      leaseToken: lease.leaseToken,
      revision: lease.revision,
      status: lease.status
    };

    if (lease.status === 'pending') {
      filter.expiresAt = { $lte: currentTime };
    }

    const result = await ActivePartyOwnerLease.deleteOne(filter);
    return Boolean(result?.deletedCount);
  }

  async function isLeaseLive(lease, currentTime) {
    const pendingUntil = lease?.expiresAt ? new Date(lease.expiresAt) : null;
    const provisioning =
      lease?.status === 'pending' && pendingUntil && pendingUntil > currentTime;

    return provisioning
      ? true
      : doesPartyExist(normalizePartyId(lease?.partyId));
  }

  async function getLiveLeaseOrDeleteStale(lease) {
    if (!lease) return null;

    const currentTime = getNow();
    if (await isLeaseLive(lease, currentTime)) return lease;

    await deleteStaleLease(lease, currentTime);
    return null;
  }

  async function createLegacyPartyLease(room, identity) {
    const partyId = normalizePartyId(room?.partyId);
    if (!partyId) return null;

    return toPlainObject(
      await ActivePartyOwnerLease.create(
        buildLeaseDocument({
          partyId,
          identity,
          gamemode: room?.config?.gamemode,
          status: 'active'
        })
      )
    );
  }

  async function acquireActivePartyOwnerLease({
    partyId: requestedPartyId,
    principal,
    gamemode = null,
    scanExistingParties = true
  }) {
    if (!ActivePartyOwnerLease) {
      const error = new Error('Party owner lease storage is unavailable.');
      error.status = 503;
      error.code = 'party_owner_lease_unavailable';
      throw error;
    }

    const partyId = normalizePartyId(requestedPartyId);
    const identity = getPrincipalIdentity(principal);
    let legacyScanComplete = !scanExistingParties;

    for (let attempt = 0; attempt < MAX_ACQUIRE_ATTEMPTS; attempt += 1) {
      const existingLease = await findLease(
        buildConflictingLeaseFilter(partyId, identity)
      );

      if (existingLease) {
        if (
          normalizePartyId(existingLease.partyId) === partyId &&
          leaseMatchesPrincipal(existingLease, identity)
        ) {
          const touchedLease = await touchSamePartyLease(existingLease);
          if (!touchedLease) continue;
          return {
            acquired: false,
            lease: touchedLease,
            releaseToken: {
              leaseId: touchedLease._id,
              leaseToken: touchedLease.leaseToken,
              revision: touchedLease.revision
            }
          };
        }

        const currentTime = getNow();
        const liveParty = await isLeaseLive(existingLease, currentTime);

        if (liveParty) {
          throw createOwnerConflictError(existingLease);
        }

        if (await deleteStaleLease(existingLease, currentTime)) {
          continue;
        }

        continue;
      }

      if (!legacyScanComplete) {
        const legacyParty = await findHostedParty({
          identity,
          excludePartyId: partyId
        });
        legacyScanComplete = true;

        if (legacyParty) {
          try {
            const legacyLease = await createLegacyPartyLease(
              legacyParty,
              identity
            );
            throw createOwnerConflictError(legacyLease);
          } catch (error) {
            if (error?.code === 'party_owner_active_party_exists') throw error;
            if (isDuplicateKeyError(error)) continue;
            throw error;
          }
        }
      }

      try {
        const lease = toPlainObject(
          await ActivePartyOwnerLease.create(
            buildLeaseDocument({ partyId, identity, gamemode })
          )
        );
        return {
          acquired: true,
          lease,
          releaseToken: {
            leaseId: lease._id,
            leaseToken: lease.leaseToken,
            revision: lease.revision
          }
        };
      } catch (error) {
        if (isDuplicateKeyError(error)) continue;
        throw error;
      }
    }

    const conflict = await findLease(
      buildConflictingLeaseFilter(partyId, identity)
    );
    if (conflict) throw createOwnerConflictError(conflict);

    const error = new Error('Failed to acquire the party owner lease.');
    error.status = 503;
    error.code = 'party_owner_lease_acquire_failed';
    throw error;
  }

  async function activateActivePartyOwnerLease({
    partyId: requestedPartyId,
    releaseToken,
    gamemode = null
  }) {
    const partyId = normalizePartyId(requestedPartyId);
    const currentTime = getNow();
    const filter = {
      partyId,
      ...(releaseToken?.leaseId ? { _id: releaseToken.leaseId } : {}),
      ...(releaseToken?.leaseToken
        ? { leaseToken: releaseToken.leaseToken }
        : {})
    };
    const lease = await resolveQuery(
      ActivePartyOwnerLease.findOneAndUpdate(
        filter,
        {
          $set: {
            status: 'active',
            activatedAt: currentTime,
            updatedAt: currentTime,
            ...(gamemode ? { gamemode } : {})
          },
          $unset: { expiresAt: '' },
          $inc: { revision: 1 }
        },
        { new: true }
      ),
      { includePrivateLeaseFields: true }
    );

    if (!lease) {
      const error = new Error(
        'The party owner lease was lost during creation.'
      );
      error.status = 503;
      error.code = 'party_owner_lease_lost';
      throw error;
    }

    return lease;
  }

  async function getActivePartyOwnerLeaseReleaseToken(partyId) {
    const lease = await findLease({ partyId: normalizePartyId(partyId) });
    if (!lease) return null;
    return {
      leaseId: lease._id,
      leaseToken: lease.leaseToken,
      revision: lease.revision
    };
  }

  async function releaseActivePartyOwnerLeaseIfInactive({
    partyId: requestedPartyId,
    releaseToken
  }) {
    const partyId = normalizePartyId(requestedPartyId);
    if (
      !partyId ||
      !releaseToken?.leaseToken ||
      !Number.isInteger(releaseToken.revision)
    ) {
      return false;
    }
    if (await doesPartyExist(partyId)) return false;

    const result = await ActivePartyOwnerLease.deleteOne({
      partyId,
      ...(releaseToken.leaseId ? { _id: releaseToken.leaseId } : {}),
      leaseToken: releaseToken.leaseToken,
      revision: releaseToken.revision
    });
    return Boolean(result?.deletedCount);
  }

  async function attachAccountToPartyOwnerLease({
    partyOwnerIdHash,
    accountId
  }) {
    const normalizedHash = String(partyOwnerIdHash || '').trim();
    if (!normalizedHash || !accountId) return { attached: false };
    const normalizedAccountId = String(accountId);

    for (let attempt = 0; attempt < MAX_ATTACH_ATTEMPTS; attempt += 1) {
      const foundLease = await findLease({
        partyOwnerIdHash: normalizedHash
      });
      if (!foundLease) return { attached: false };

      const lease = await getLiveLeaseOrDeleteStale(foundLease);
      if (!lease) continue;

      if (String(lease.accountId || '') === normalizedAccountId) {
        return { attached: true, partyId: lease.partyId };
      }

      if (lease.accountId) {
        return createAccountAttachmentConflict(lease);
      }

      try {
        const result = await ActivePartyOwnerLease.updateOne(
          {
            _id: lease._id,
            leaseToken: lease.leaseToken,
            revision: lease.revision,
            $or: [{ accountId: { $exists: false } }, { accountId: null }]
          },
          {
            $set: { accountId, updatedAt: getNow() },
            $inc: { revision: 1 }
          }
        );

        if (result?.modifiedCount) {
          return { attached: true, partyId: lease.partyId };
        }

        const currentLease = await findLease({ _id: lease._id });
        if (!currentLease) continue;
        if (String(currentLease.accountId || '') === normalizedAccountId) {
          return { attached: true, partyId: currentLease.partyId };
        }
        if (!currentLease.accountId) continue;

        const liveConflict = await getLiveLeaseOrDeleteStale(currentLease);
        if (!liveConflict) continue;

        return createAccountAttachmentConflict(liveConflict);
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;

        const accountLease = await findLease({ accountId });
        if (!accountLease) continue;
        if (
          String(accountLease.partyOwnerIdHash || '') === normalizedHash &&
          String(accountLease.accountId || '') === normalizedAccountId
        ) {
          return { attached: true, partyId: accountLease.partyId };
        }

        const liveConflict = await getLiveLeaseOrDeleteStale(accountLease);
        if (!liveConflict) continue;

        return createAccountAttachmentConflict(liveConflict);
      }
    }

    const error = new Error('Failed to attach the account owner lease.');
    error.status = 503;
    error.code = 'party_owner_lease_attach_failed';
    throw error;
  }

  return {
    assertNoActiveParticipantParty,
    acquireActivePartyOwnerLease,
    activateActivePartyOwnerLease,
    getActivePartyOwnerLeaseReleaseToken,
    releaseActivePartyOwnerLeaseIfInactive,
    attachAccountToPartyOwnerLease,
    createParticipantConflictError,
    createOwnerConflictError,
    getSafeLeaseDetails
  };
}

module.exports = {
  ACTIVE_PARTICIPANT_WINDOW_MS,
  DEFAULT_PENDING_LEASE_MS,
  createActivePartyOwnerLeaseService,
  isDuplicateKeyError
};
