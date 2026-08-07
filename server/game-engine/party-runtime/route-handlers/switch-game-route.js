const SUPPORTED_GAMEMODES = new Set([
  'truth-or-dare',
  'paranoia',
  'never-have-i-ever',
  'most-likely-to',
  'imposter',
  'would-you-rather',
  'mafia'
]);

function normalizeGamemode(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
}

function getPartyPlayerId(player) {
  return player?.identity?.computerId ?? player?.computerId ?? null;
}

function canAccountAccessGamemodeTile(
  tile,
  account,
  { canAccessFeature, canAccessOwnerPages }
) {
  if (!tile) return false;

  const accessType = tile.access?.type || 'public';
  if (accessType === 'public') return true;
  if (accessType === 'account') return Boolean(account);
  if (accessType === 'feature') {
    return Boolean(canAccessFeature?.(account, tile.access?.feature));
  }
  if (accessType === 'owner') {
    return Boolean(canAccessOwnerPages?.(account));
  }
  return false;
}

function createSwitchedPlayer(player, { gamemode, hostComputerId }) {
  const playerId = getPartyPlayerId(player);
  const isHost = hostComputerId && String(playerId) === String(hostComputerId);
  const state = {
    isReady: Boolean(isHost),
    hasConfirmed: false
  };

  if (gamemode === 'mafia') {
    Object.assign(state, {
      roleKey: null,
      status: 'alive',
      vote: 'N/A',
      phase: {
        scenarioFileName: 'N/A',
        index: 1,
        state: 'pending'
      }
    });
  } else {
    Object.assign(state, {
      score: 0,
      participationStatus: 'active',
      reconnectDeadline: null
    });
  }

  return {
    identity: { ...(player?.identity || {}) },
    connection: { ...(player?.connection || {}) },
    state
  };
}

function createPartySwitchSnapshot({
  party,
  targetGamemode,
  gameId,
  gameModeRelease = null,
  now = new Date(),
  shuffleSeed = 0
}) {
  const gamemode = normalizeGamemode(targetGamemode);
  if (!SUPPORTED_GAMEMODES.has(gamemode)) {
    const error = new Error('The selected party game is not supported.');
    error.status = 400;
    error.code = 'party_switch_gamemode_invalid';
    throw error;
  }

  const hostComputerId = party?.state?.hostComputerId ?? null;
  const players = Array.isArray(party?.players)
    ? party.players.map((player) =>
        createSwitchedPlayer(player, { gamemode, hostComputerId })
      )
    : [];
  const previousSession = party?.session || {};
  const session = {
    ...previousSession,
    gameId,
    gameModeRelease,
    createdAt: now,
    startedAt: null,
    endedAt: null,
    playtimeStartedAt: null,
    playtimeAccumulatedMilliseconds: 0
  };
  const config = {
    gamemode,
    gameRules: {},
    selectedPacks: [],
    roleCounts: {},
    userInstructions: '',
    shuffleSeed
  };
  const state = {
    isPlaying: false,
    phase: 'lobby',
    lastPinged: now,
    completedRounds: 0,
    playerTurn: 0,
    playerTurnOrder: [],
    roundParticipantIds: [],
    roundTimeline: [],
    speakingRound: 0,
    speakingPlayerTurn: 0,
    timer: null,
    phaseData: null,
    hostComputerId,
    hostComputerIdList: players.map(getPartyPlayerId).filter(Boolean)
  };

  return {
    partyId: party.partyId,
    session,
    config,
    state,
    ...(gamemode === 'mafia'
      ? {}
      : {
          deck: {
            currentCardIndex: 0,
            currentCardSecondIndex: 0,
            alternativeQuestionIndex: 0,
            questionType: 'truth'
          }
        }),
    players,
    errors: []
  };
}

function createPartySwitchGameRoute(context) {
  const {
    app,
    io,
    assertPartyId,
    getPartyRequestPrincipal,
    assertPrincipalOwnsPlayer,
    withoutGuestHashes,
    archiveRoomSnapshot,
    waitingRoomSchema,
    activePartyOwnerLeaseSchema,
    PARTY_GAME_MODELS_BY_GAMEMODE,
    ONLINE_GAMEMODE_MAX_PLAYERS,
    HomepageTile,
    Account,
    getCurrentAccount,
    canAccessFeature,
    canAccessOwnerPages,
    reservePartyGameSession,
    activatePartyGameSession,
    completePartyGameSession,
    releasePartyGameSession,
    crypto
  } = context;

  async function assertCanAccessTargetGamemode(req, targetGamemode) {
    if (!HomepageTile?.findOne) return;

    const query = HomepageTile.findOne({
      key: targetGamemode,
      kind: 'gamemode',
      status: 'published',
      enabled: true
    });
    const tile = await (typeof query?.lean === 'function'
      ? query.lean()
      : query);
    const account = tile ? await getCurrentAccount(req, Account) : null;
    const canAccess = canAccountAccessGamemodeTile(tile, account, {
      canAccessFeature,
      canAccessOwnerPages
    });

    if (canAccess) return;

    const error = new Error('That party game is not available to this host.');
    error.status = 403;
    error.code = 'party_switch_gamemode_unavailable';
    error.details = { gamemode: targetGamemode };
    throw error;
  }

  function createSwitchGameHandler({
    route = '/api/party-lobbies/switch-game'
  } = {}) {
    app.post(route, async (req, res) => {
      let sourceModel = null;
      let sourceParty = null;
      let previousPhase = null;
      let transitionLocked = false;
      let targetSessionReservation = null;
      let switchCommitted = false;

      const restoreSourcePhase = async () => {
        if (!transitionLocked || !sourceModel || !sourceParty) return;
        await sourceModel.updateOne(
          {
            partyId: sourceParty.partyId,
            'session.gameId': sourceParty.session?.gameId,
            'state.phase': 'switching-game'
          },
          { $set: { 'state.phase': previousPhase } }
        );
      };

      try {
        const partyId = String(req.body?.partyId || req.query?.partyCode || '')
          .trim()
          .toUpperCase();
        const targetGamemode = normalizeGamemode(req.body?.targetGamemode);
        assertPartyId(partyId);

        if (!SUPPORTED_GAMEMODES.has(targetGamemode)) {
          const error = new Error('The selected party game is not supported.');
          error.status = 400;
          error.code = 'party_switch_gamemode_invalid';
          throw error;
        }

        const waitingRoom = await waitingRoomSchema
          .findOne({ partyId })
          .select(
            '+players.identity.guestIdHash +players.identity.partyOwnerIdHash'
          )
          .lean();
        if (!waitingRoom) {
          const error = new Error('Party lobby not found.');
          error.status = 404;
          error.code = 'party_not_found';
          throw error;
        }

        const sourceGamemode = normalizeGamemode(waitingRoom.config?.gamemode);
        if (sourceGamemode === targetGamemode) {
          const error = new Error('That game is already selected.');
          error.status = 409;
          error.code = 'party_switch_same_gamemode';
          throw error;
        }

        sourceModel = PARTY_GAME_MODELS_BY_GAMEMODE[sourceGamemode];
        const targetModel = PARTY_GAME_MODELS_BY_GAMEMODE[targetGamemode];
        if (!sourceModel || !targetModel) {
          const error = new Error('Party game data is unavailable.');
          error.status = 409;
          error.code = 'party_switch_source_unavailable';
          throw error;
        }

        sourceParty = await sourceModel
          .findOne({ partyId })
          .select(
            '+players.identity.guestIdHash +players.identity.partyOwnerIdHash'
          )
          .lean();
        if (!sourceParty) {
          const error = new Error('The current party game could not be found.');
          error.status = 404;
          error.code = 'party_switch_source_not_found';
          throw error;
        }

        const expectedGameId = String(req.body?.expectedGameId || '').trim();
        if (
          expectedGameId &&
          expectedGameId !== String(sourceParty.session?.gameId || '')
        ) {
          const error = new Error(
            'The party has already moved to a different game session.'
          );
          error.status = 409;
          error.code = 'party_switch_stale_session';
          throw error;
        }

        const principal = await getPartyRequestPrincipal(req, res);
        const hostComputerId = sourceParty.state?.hostComputerId;
        assertPrincipalOwnsPlayer(sourceParty, hostComputerId, principal);
        await assertCanAccessTargetGamemode(req, targetGamemode);

        previousPhase = sourceParty.state?.phase;
        if (
          sourceParty.state?.isPlaying === true ||
          !['lobby', 'game-over'].includes(previousPhase)
        ) {
          const error = new Error(
            'The current game must end before the host can switch games.'
          );
          error.status = 409;
          error.code = 'party_switch_game_active';
          throw error;
        }

        const maximumPlayers = ONLINE_GAMEMODE_MAX_PLAYERS[targetGamemode];
        if (
          Number.isFinite(maximumPlayers) &&
          sourceParty.players.length > maximumPlayers
        ) {
          const error = new Error(
            `${targetGamemode} supports a maximum of ${maximumPlayers} players.`
          );
          error.status = 409;
          error.code = 'party_switch_too_many_players';
          error.details = {
            gamemode: targetGamemode,
            playerCount: sourceParty.players.length,
            maximumPlayers
          };
          throw error;
        }

        const lockedParty = await sourceModel.findOneAndUpdate(
          {
            partyId,
            'session.gameId': sourceParty.session?.gameId,
            'state.isPlaying': false,
            'state.phase': previousPhase
          },
          {
            $set: {
              'state.phase': 'switching-game',
              'state.lastPinged': new Date()
            }
          },
          { new: true }
        );
        if (!lockedParty) {
          const error = new Error(
            'The party changed while the game switch was being prepared.'
          );
          error.status = 409;
          error.code = 'party_switch_conflict';
          throw error;
        }
        transitionLocked = true;

        if (
          previousPhase === 'game-over' &&
          typeof archiveRoomSnapshot === 'function'
        ) {
          const archived = await archiveRoomSnapshot({
            roomDocument: sourceParty,
            endedAt: sourceParty.session?.endedAt
          });
          if (!archived) {
            const error = new Error(
              'The completed game could not be archived before switching.'
            );
            error.status = 500;
            error.code = 'party_switch_archive_failed';
            throw error;
          }
        }

        targetSessionReservation = await reservePartyGameSession({
          partyId,
          gamemode: targetGamemode
        });
        const targetGameId = targetSessionReservation.gameId;
        const switchedParty = createPartySwitchSnapshot({
          party: sourceParty,
          targetGamemode,
          gameId: targetGameId,
          gameModeRelease: targetSessionReservation.gameModeRelease,
          now: new Date(),
          shuffleSeed:
            typeof crypto.randomInt === 'function'
              ? crypto.randomInt(0, 256)
              : crypto.randomBytes(1)[0]
        });

        await targetModel.replaceOne({ partyId }, switchedParty, {
          upsert: true,
          runValidators: true
        });

        const updatedWaitingRoom = await waitingRoomSchema.findOneAndUpdate(
          {
            partyId,
            'config.gamemode': sourceGamemode,
            'session.gameId': sourceParty.session?.gameId
          },
          {
            session: switchedParty.session,
            config: switchedParty.config,
            state: switchedParty.state,
            players: switchedParty.players
          },
          { new: true, runValidators: true }
        );
        if (!updatedWaitingRoom) {
          await targetModel.deleteOne({
            partyId,
            'session.gameId': targetGameId
          });
          const error = new Error(
            'The party changed while the game switch was being saved.'
          );
          error.status = 409;
          error.code = 'party_switch_conflict';
          throw error;
        }

        await sourceModel.deleteOne({
          partyId,
          'session.gameId': sourceParty.session?.gameId,
          'state.phase': 'switching-game'
        });
        transitionLocked = false;
        switchCommitted = true;

        try {
          await activatePartyGameSession(targetSessionReservation);
        } catch (error) {
          console.error(
            `[REQ ${req.id}] Failed to activate game session ${targetGameId}:`,
            error
          );
        }

        if (previousPhase === 'game-over') {
          try {
            await completePartyGameSession({
              gameId: sourceParty.session?.gameId,
              partyId
            });
          } catch (error) {
            console.error(
              `[REQ ${req.id}] Failed to complete game session ${sourceParty.session?.gameId}:`,
              error
            );
          }
        }

        await activePartyOwnerLeaseSchema?.updateOne(
          { partyId },
          { $set: { gamemode: targetGamemode }, $inc: { revision: 1 } }
        );

        const event = {
          partyId,
          fromGamemode: sourceGamemode,
          toGamemode: targetGamemode,
          gameId: targetGameId,
          hostComputerId
        };
        io.to(partyId).emit('party-game-switched', event);

        res.apiSuccess({
          message: `Party switched to ${targetGamemode}`,
          updated: withoutGuestHashes(switchedParty),
          transition: event
        });
      } catch (err) {
        try {
          await restoreSourcePhase();
        } catch (restoreError) {
          console.error(
            `[REQ ${req.id}] Failed to release party game switch lock:`,
            restoreError
          );
        }

        if (
          targetSessionReservation &&
          !switchCommitted &&
          typeof releasePartyGameSession === 'function'
        ) {
          try {
            await releasePartyGameSession(targetSessionReservation);
          } catch (releaseError) {
            console.error(
              `[REQ ${req.id}] Failed to release unused game session ${targetSessionReservation.gameId}:`,
              releaseError
            );
          }
        }

        const status = Number.isInteger(err.status) ? err.status : 500;
        console.error(`[REQ ${req.id}] Failed to switch party game:`, err);
        res.apiError({
          status,
          code:
            typeof err.code === 'string'
              ? err.code
              : 'party_switch_game_failed',
          message: err.message || 'Failed to switch party game',
          details: err.details
        });
      }
    });
  }

  return { createSwitchGameHandler };
}

module.exports = {
  SUPPORTED_GAMEMODES,
  canAccountAccessGamemodeTile,
  createPartySwitchGameRoute,
  createPartySwitchSnapshot,
  createSwitchedPlayer,
  normalizeGamemode
};
