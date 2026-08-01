const {
  PARTY_OWNER_COOKIE,
  LEGACY_PARTY_GUEST_COOKIE,
  ensurePartyOwnerIdentity,
  getPartyOwnerIdHashFromRequest,
  hashPartyOwnerToken
} = require('../../../services/party-owner-identity');

function createPartyPlayerTools(context) {
  const {
    Account,
    cloneSerializable,
    getPartyPlayerId,
    crypto,
    getCurrentAccount
  } = context;

  const PARTY_GUEST_COOKIE = LEGACY_PARTY_GUEST_COOKIE;
  const PROTECTED_PLAYER_IDENTITY_FIELDS = new Set([
    'computerId',
    'accountId',
    'guestIdHash',
    'partyOwnerIdHash',
    'accountLinkedAt',
    'accountLinkSource'
  ]);
  const BLOCKED_PLAYER_STATE_FIELDS = new Set(['role', 'roleKey']);

  function hashPartyGuestToken(token) {
    return hashPartyOwnerToken(token, crypto);
  }

  async function getPartyRequestPrincipal(req, res) {
    const partyOwnerIdentity = ensurePartyOwnerIdentity(req, res, { crypto });
    const account = await getCurrentAccount(req, Account);
    if (account) {
      return {
        type: 'account',
        accountId: String(account._id),
        partyOwnerIdHash: partyOwnerIdentity.tokenHash
      };
    }

    return {
      type: 'guest',
      guestIdHash: partyOwnerIdentity.tokenHash,
      partyOwnerIdHash: partyOwnerIdentity.tokenHash
    };
  }

  function playerMatchesPrincipal(player, principal) {
    if (!player || !principal) return false;

    const storedPartyOwnerIdHash = String(
      player.identity?.partyOwnerIdHash || ''
    );
    const requestPartyOwnerIdHash = String(
      principal.partyOwnerIdHash || principal.guestIdHash || ''
    );
    if (
      storedPartyOwnerIdHash &&
      requestPartyOwnerIdHash &&
      storedPartyOwnerIdHash === requestPartyOwnerIdHash
    ) {
      return true;
    }

    if (principal.type === 'account') {
      return String(player.identity?.accountId || '') === principal.accountId;
    }

    return (
      !player.identity?.accountId &&
      player.identity?.guestIdHash === principal.guestIdHash
    );
  }

  function playerMatchesGuestPrincipal(player, principal) {
    return (
      player &&
      principal?.type === 'guest' &&
      !player.identity?.accountId &&
      player.identity?.guestIdHash === principal.guestIdHash
    );
  }

  function bindPlayerToPrincipal(player, principal) {
    player.identity ||= {};
    player.identity.accountId =
      principal.type === 'account' ? principal.accountId : null;
    player.identity.guestIdHash =
      principal.type === 'guest' ? principal.guestIdHash : undefined;
    player.identity.partyOwnerIdHash =
      principal.partyOwnerIdHash ?? principal.guestIdHash;
    return player;
  }

  function getPartyGuestPrincipalFromRequest(req) {
    const partyOwnerIdHash = getPartyOwnerIdHashFromRequest(req, { crypto });
    if (!partyOwnerIdHash) return null;

    return {
      type: 'guest',
      guestIdHash: partyOwnerIdHash,
      partyOwnerIdHash
    };
  }

  function assertPrincipalOwnsPlayer(party, computerId, principal) {
    const player = party?.players?.find(
      (entry) => String(getPartyPlayerId(entry)) === String(computerId)
    );

    if (!player || !playerMatchesPrincipal(player, principal)) {
      const error = new Error('You are not authorised to control this player.');
      error.status = 403;
      error.code = 'party_player_forbidden';
      throw error;
    }

    return player;
  }

  function preservePlayerBindings(existingPlayers = [], requestedPlayers = []) {
    const requestedByComputerId = new Map(
      requestedPlayers.map((player) => [
        String(getPartyPlayerId(player)),
        player
      ])
    );

    return existingPlayers.map((existingPlayer) => {
      const computerId = String(getPartyPlayerId(existingPlayer));
      const requestedPlayer = requestedByComputerId.get(computerId);
      if (!requestedPlayer) return existingPlayer;

      const merged = mergePartyPlayer(existingPlayer, requestedPlayer);
      merged.identity.accountId = existingPlayer.identity?.accountId ?? null;
      merged.identity.guestIdHash =
        existingPlayer.identity?.guestIdHash ?? null;
      merged.identity.partyOwnerIdHash =
        existingPlayer.identity?.partyOwnerIdHash ?? null;
      return merged;
    });
  }

  function withoutGuestHashes(party) {
    const result = party?.toObject
      ? party.toObject()
      : cloneSerializable(party);
    result?.players?.forEach((player) => {
      if (!player?.identity) return;
      delete player.identity.guestIdHash;
      delete player.identity.partyOwnerIdHash;
    });
    return result;
  }

  function mergePartyPlayer(existing = {}, incoming = {}) {
    const existingState = existing.state || {};
    const merged = {
      ...existing,
      ...incoming,
      identity: {
        ...(existing.identity || {}),
        ...(incoming.identity || {})
      },
      connection: {
        ...(existing.connection || {}),
        ...(incoming.connection || {})
      },
      state: {
        ...existingState,
        ...(incoming.state || {})
      }
    };

    if (Object.prototype.hasOwnProperty.call(existingState, 'roleKey')) {
      merged.state.roleKey = existingState.roleKey;
    } else {
      delete merged.state.roleKey;
    }
    delete merged.state.role;

    return merged;
  }

  function upsertPartyPlayer(players, incomingPlayer) {
    const incomingPlayerId = getPartyPlayerId(incomingPlayer);
    const nextPlayers = [];
    let mergedPlayer = null;
    let mergedPlayerIndex = -1;

    for (const player of players || []) {
      if (getPartyPlayerId(player) !== incomingPlayerId) {
        nextPlayers.push(player);
        continue;
      }

      mergedPlayer = mergePartyPlayer(mergedPlayer || player, player);

      if (mergedPlayerIndex === -1) {
        mergedPlayerIndex = nextPlayers.length;
        nextPlayers.push(null);
      }
    }

    if (mergedPlayerIndex === -1) {
      nextPlayers.push(incomingPlayer);
    } else {
      const mergedIncomingPlayer = mergePartyPlayer(
        mergedPlayer,
        incomingPlayer
      );
      mergedIncomingPlayer.identity.accountId =
        mergedPlayer.identity?.accountId ??
        incomingPlayer.identity?.accountId ??
        null;
      mergedIncomingPlayer.identity.guestIdHash =
        mergedPlayer.identity?.guestIdHash ??
        incomingPlayer.identity?.guestIdHash ??
        null;
      mergedIncomingPlayer.identity.partyOwnerIdHash =
        mergedPlayer.identity?.partyOwnerIdHash ??
        incomingPlayer.identity?.partyOwnerIdHash ??
        null;

      const continuesAsGuest = Boolean(
        !incomingPlayer.identity?.accountId &&
        incomingPlayer.identity?.guestIdHash &&
        mergedPlayer.identity?.partyOwnerIdHash &&
        incomingPlayer.identity.partyOwnerIdHash ===
          mergedPlayer.identity.partyOwnerIdHash
      );
      if (continuesAsGuest) {
        mergedIncomingPlayer.identity.accountId = null;
        mergedIncomingPlayer.identity.guestIdHash =
          incomingPlayer.identity.guestIdHash;
      }
      nextPlayers[mergedPlayerIndex] = mergedIncomingPlayer;
    }

    return nextPlayers;
  }

  function buildJoinPlayerFromBody(body = {}, principal) {
    const identity = body.identity || {};
    const connection = body.connection || {};
    const state = body.state || {};
    const computerId =
      body.computerId ?? body.newComputerId ?? identity.computerId;
    const username = body.username ?? body.newUsername ?? identity.username;
    const userIcon = body.userIcon ?? body.newUserIcon ?? identity.userIcon;
    const socketId =
      body.socketId ?? body.newUserSocketId ?? connection.socketId;
    const isReady = body.isReady ?? body.newUserReady ?? state.isReady;
    const hasConfirmed =
      body.hasConfirmed ?? body.newUserConfirmation ?? state.hasConfirmed;
    const score = body.score ?? body.newScore ?? state.score;
    const nextState = {
      ...state
    };
    BLOCKED_PLAYER_STATE_FIELDS.forEach((field) => {
      delete nextState[field];
    });

    if (isReady !== undefined) {
      nextState.isReady = isReady;
    }

    if (hasConfirmed !== undefined) {
      nextState.hasConfirmed = hasConfirmed;
    }

    if (score !== undefined) {
      nextState.score = score;
    }

    return bindPlayerToPrincipal(
      {
        identity: {
          computerId,
          ...(username !== undefined ? { username } : {}),
          ...(userIcon !== undefined ? { userIcon } : {})
        },
        connection: {
          ...(socketId !== undefined ? { socketId } : {}),
          lastPing: new Date()
        },
        state: nextState
      },
      principal
    );
  }

  function isPlainPatchObject(value) {
    return (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    );
  }

  function addNestedPlayerPatch(set, path, value) {
    if (value === undefined) {
      return;
    }

    if (isPlainPatchObject(value)) {
      Object.entries(value).forEach(([key, nestedValue]) => {
        addNestedPlayerPatch(set, `${path}.${key}`, nestedValue);
      });
      return;
    }

    set[`players.$.${path}`] = value;
  }

  function buildPlayerPatchFromBody(body = {}) {
    const identityPatch = body.identityPatch || body.identity || {};
    const connectionPatch = body.connectionPatch || body.connection || {};
    const statePatch = body.statePatch || body.state || {};
    const fullPlayerPatch = body.playerPatch || body.player || {};
    const set = {};

    if (isPlainPatchObject(fullPlayerPatch.identity)) {
      Object.entries(fullPlayerPatch.identity).forEach(([key, value]) => {
        if (PROTECTED_PLAYER_IDENTITY_FIELDS.has(key)) return;
        addNestedPlayerPatch(set, `identity.${key}`, value);
      });
    }

    if (isPlainPatchObject(fullPlayerPatch.connection)) {
      Object.entries(fullPlayerPatch.connection).forEach(([key, value]) => {
        addNestedPlayerPatch(set, `connection.${key}`, value);
      });
    }

    if (isPlainPatchObject(fullPlayerPatch.state)) {
      Object.entries(fullPlayerPatch.state).forEach(([key, value]) => {
        if (BLOCKED_PLAYER_STATE_FIELDS.has(key)) return;
        addNestedPlayerPatch(set, `state.${key}`, value);
      });
    }

    const username =
      body.username ?? body.newUsername ?? identityPatch.username;
    const userIcon =
      body.userIcon ?? body.newUserIcon ?? identityPatch.userIcon;
    const socketId =
      body.socketId ?? body.newUserSocketId ?? connectionPatch.socketId;
    const isReady = body.isReady ?? body.newUserReady ?? statePatch.isReady;
    const hasConfirmed =
      body.hasConfirmed ?? body.newUserConfirmation ?? statePatch.hasConfirmed;
    const score = body.score ?? body.newScore ?? statePatch.score;
    const vote = body.vote ?? body.newVote ?? statePatch.vote;
    const status = body.status ?? body.newStatus ?? statePatch.status;

    if (username !== undefined) {
      set['players.$.identity.username'] = username;
    }

    if (userIcon !== undefined) {
      set['players.$.identity.userIcon'] = userIcon;
    }

    if (socketId !== undefined) {
      set['players.$.connection.socketId'] = socketId;
    }

    if (isReady !== undefined) {
      set['players.$.state.isReady'] = isReady;
    }

    if (hasConfirmed !== undefined) {
      set['players.$.state.hasConfirmed'] = hasConfirmed;
    }

    if (score !== undefined) {
      set['players.$.state.score'] = score;
    }

    if (vote !== undefined) {
      set['players.$.state.vote'] = vote;
    }

    if (status !== undefined) {
      set['players.$.state.status'] = status;
    }

    if (body.touchLastPing !== false) {
      set['players.$.connection.lastPing'] = new Date();
    }

    set['state.lastPinged'] = new Date();

    return set;
  }

  async function upsertPlayerInPartyDocument(model, partyId, incomingPlayer) {
    const session = await model
      .findOne({ partyId })
      .select(
        '+players.identity.guestIdHash +players.identity.partyOwnerIdHash'
      );

    if (!session) {
      return null;
    }

    const currentPlayers = Array.isArray(session.players)
      ? session.players.map((player) =>
          player.toObject ? player.toObject() : cloneSerializable(player)
        )
      : [];

    session.players = upsertPartyPlayer(currentPlayers, incomingPlayer);

    if (session.state && typeof session.state === 'object') {
      session.state.lastPinged = new Date();
    }

    await session.save();
    return withoutGuestHashes(session);
  }

  async function patchPlayerInPartyDocument(model, partyId, computerId, set) {
    if (!model) {
      return null;
    }

    return model
      .findOneAndUpdate(
        {
          partyId,
          'players.identity.computerId': computerId
        },
        { $set: set },
        { new: true }
      )
      .lean();
  }

  return {
    PARTY_OWNER_COOKIE,
    PARTY_GUEST_COOKIE,
    hashPartyGuestToken,
    getPartyRequestPrincipal,
    playerMatchesPrincipal,
    playerMatchesGuestPrincipal,
    bindPlayerToPrincipal,
    getPartyGuestPrincipalFromRequest,
    assertPrincipalOwnsPlayer,
    preservePlayerBindings,
    withoutGuestHashes,
    mergePartyPlayer,
    upsertPartyPlayer,
    buildJoinPlayerFromBody,
    isPlainPatchObject,
    addNestedPlayerPatch,
    buildPlayerPatchFromBody,
    upsertPlayerInPartyDocument,
    patchPlayerInPartyDocument
  };
}

module.exports = {
  createPartyPlayerTools
};
