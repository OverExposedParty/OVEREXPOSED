const {
  getPartyOwnerIdHashFromRequest
} = require('../../services/party-owner-identity');
const {
  getPartyRoomActiveSince
} = require('../../services/party-room-activity');

function createInviteSessionSupport(context) {
  const {
    getCookieValue,
    defaultOeIcon,
    waitingRoomSchema,
    getPartyGameRoomSources,
    OlingBattleMatch,
    crypto
  } = context;

  const partyInviteModes = new Map([
    [
      'party-game-truth-or-dare',
      ['truth-or-dare', '#66CCFF', '#427BB9', 'Truth or Dare']
    ],
    ['party-game-paranoia', ['paranoia', '#9D8AFF', '#7F71B2', 'Paranoia']],
    [
      'party-game-never-have-i-ever',
      ['never-have-i-ever', '#FF9266', '#B96542', 'Never Have I Ever']
    ],
    [
      'party-game-most-likely-to',
      ['most-likely-to', '#FFEE66', '#B9AA42', 'Most Likely To']
    ],
    ['party-game-imposter', ['imposter', '#3DA7A1', '#2A6E6A', 'Imposter']],
    [
      'party-game-would-you-rather',
      ['would-you-rather', '#7CFFB2', '#55B97F', 'Would You Rather']
    ],
    ['party-game-mafia', ['mafia', '#9B56D3', '#6D3C95', 'Mafia']]
  ]);

  function decorateInviteSession(session) {
    if (!session) return null;
    if (session.type === 'oling_battle') {
      return {
        ...session,
        modeName: 'Battle Olings',
        primaryColour: '#FFB5C8',
        secondaryColour: '#E87398'
      };
    }
    const mode = [...partyInviteModes.values()].find(
      ([key]) => key === session.key
    );
    if (!mode) return null;
    return {
      ...session,
      modeName: mode[3],
      primaryColour: mode[1],
      secondaryColour: mode[2]
    };
  }

  function getPartyGuestHashFromRequest(req) {
    return getPartyOwnerIdHashFromRequest(req, { crypto, getCookieValue });
  }

  function createPartyGameInviteSession({ name, room, viewer }) {
    const mode = partyInviteModes.get(name);
    const gamePath = mode?.[0];
    const hostComputerId = room.state?.hostComputerId;
    const host = room.players?.find(
      (player) => String(player.identity?.computerId) === String(hostComputerId)
    );
    const apiRoute = gamePath
      ? name
      : [...partyInviteModes.entries()].find(
          ([, value]) => value[0] === String(room.config?.gamemode || '')
        )?.[0] || null;
    const resolvedGamePath = gamePath || String(room.config?.gamemode || '');
    const phase = String(room.state?.phase || '').toLowerCase();
    const isHost = Boolean(
      viewer && String(viewer.identity?.computerId) === String(hostComputerId)
    );
    const shouldReturnToGame = Boolean(
      resolvedGamePath &&
      (room.state?.isPlaying === true || phase === 'game-over')
    );
    const lobbyPath = shouldReturnToGame
      ? `/${resolvedGamePath}/${room.partyId}`
      : `/${room.partyId}`;
    const returnPath =
      isHost && !shouldReturnToGame && resolvedGamePath
        ? `/${resolvedGamePath}/settings?partyCode=${encodeURIComponent(room.partyId)}`
        : lobbyPath;
    const statusText =
      phase === 'game-over'
        ? 'Game over'
        : room.state?.isPlaying === true
          ? 'Game in progress'
          : 'Waiting for players';

    return {
      type: 'party_game',
      key: gamePath || String(room.config?.gamemode || ''),
      code: room.partyId,
      host: {
        accountId: String(host?.identity?.accountId || ''),
        username: host?.identity?.username || 'Host',
        oeIcon: host?.identity?.userIcon || defaultOeIcon
      },
      viewer: {
        accountId: String(viewer?.identity?.accountId || ''),
        username: viewer?.identity?.username || 'Player',
        oeIcon: viewer?.identity?.userIcon || defaultOeIcon
      },
      isHost,
      hostComputerId: host?.identity?.computerId || hostComputerId || null,
      playerComputerId: viewer?.identity?.computerId || null,
      apiRoute,
      statusText,
      lobbyPath,
      returnPath
    };
  }

  async function getPartyGameInviteSessionByIdentity({
    identityFilter,
    findViewer,
    options = {}
  }) {
    if (!identityFilter || typeof findViewer !== 'function') return null;

    const activeSince = getPartyRoomActiveSince();
    const includeInProgress = options.includeInProgress === true;
    const partyCandidates = (
      await Promise.all(
        [['waiting-room', waitingRoomSchema], ...getPartyGameRoomSources()].map(
          async ([name, model]) => {
            const filter = {
              ...identityFilter,
              'state.lastPinged': { $gte: activeSince }
            };
            if (!includeInProgress) {
              filter['state.isPlaying'] = false;
            }

            const room = await model
              .findOne(filter)
              .sort({ 'state.lastPinged': -1 })
              .select('+players.identity.guestIdHash')
              .lean();
            return room?.partyId ? { name, room } : null;
          }
        )
      )
    )
      .filter(Boolean)
      .sort(
        (left, right) =>
          new Date(right.room?.state?.lastPinged || 0).getTime() -
          new Date(left.room?.state?.lastPinged || 0).getTime()
      );

    if (!partyCandidates[0]) return null;

    const { name, room } = partyCandidates[0];
    const viewer = room.players?.find(findViewer);
    return createPartyGameInviteSession({ name, room, viewer });
  }

  async function getAccountInviteSession(accountId, options = {}) {
    if (!accountId) return null;

    if (options.includeBattle !== false) {
      const battle = await OlingBattleMatch.findOne({
        status: { $in: ['waiting', 'ready'] },
        players: { $elemMatch: { accountId, connected: true, isAi: false } }
      })
        .sort({ updatedAt: -1 })
        .select('matchCode players')
        .lean();
      if (battle?.matchCode) {
        const host = battle.players?.find(
          (player) => player.slot === 'player-one'
        );
        const viewer = battle.players?.find(
          (player) => String(player.accountId) === String(accountId)
        );
        return {
          type: 'oling_battle',
          key: 'battle-olings',
          code: battle.matchCode,
          host: {
            accountId: String(host?.accountId || ''),
            username: host?.playerName || 'Host',
            oeIcon: host?.oeIcon || defaultOeIcon
          },
          isHost: Boolean(
            host?.accountId && String(host.accountId) === String(accountId)
          ),
          playerComputerId: null,
          apiRoute: null,
          statusText: viewer ? 'Waiting for opponent' : 'Waiting in lobby',
          lobbyPath: `/olings/battle/${battle.matchCode}`
        };
      }
    }

    return getPartyGameInviteSessionByIdentity({
      identityFilter: { 'players.identity.accountId': accountId },
      findViewer: (player) =>
        String(player.identity?.accountId) === String(accountId),
      options
    });
  }

  async function getGuestInviteSession(req, options = {}) {
    const guestIdHash = getPartyGuestHashFromRequest(req);
    if (!guestIdHash) return null;

    return getPartyGameInviteSessionByIdentity({
      identityFilter: { 'players.identity.guestIdHash': guestIdHash },
      findViewer: (player) =>
        String(player.identity?.guestIdHash || '') === String(guestIdHash),
      options
    });
  }

  async function validateStoredInviteSession(relationship) {
    const type = relationship.notificationSessionType;
    const key = String(relationship.notificationSessionKey || '');
    const code = String(relationship.notificationSessionCode || '');
    if (!/^[A-Za-z0-9]{3}-[A-Za-z0-9]{3}$/.test(code)) return null;

    if (type === 'oling_battle' && key === 'battle-olings') {
      const match = await OlingBattleMatch.findOne({
        matchCode: code,
        status: { $in: ['waiting', 'ready'] }
      })
        .select('matchCode')
        .lean();
      return match
        ? decorateInviteSession({
            type,
            key,
            code,
            lobbyPath: `/olings/battle/${code}`
          })
        : null;
    }

    const source = getPartyGameRoomSources().find(
      ([name]) => partyInviteModes.get(name)?.[0] === key
    );
    const activeSince = getPartyRoomActiveSince();
    const waitingRoom = await waitingRoomSchema
      .findOne({
        partyId: code,
        'state.isPlaying': false,
        'state.lastPinged': { $gte: activeSince }
      })
      .select('partyId config.gamemode')
      .lean();
    const gameRoom =
      !waitingRoom && source
        ? await source[1]
            .findOne({
              partyId: code,
              'state.isPlaying': false,
              'state.lastPinged': { $gte: activeSince }
            })
            .select('partyId')
            .lean()
        : null;
    const room = waitingRoom || gameRoom;
    if (!room) return null;

    const resolvedKey = key || String(room.config?.gamemode || '');
    return decorateInviteSession({
      type: 'party_game',
      key: resolvedKey,
      code,
      lobbyPath: waitingRoom ? `/${code}` : `/${resolvedKey}/${code}`
    });
  }

  return {
    decorateInviteSession,
    getPartyGuestHashFromRequest,
    createPartyGameInviteSession,
    getPartyGameInviteSessionByIdentity,
    getAccountInviteSession,
    getGuestInviteSession,
    validateStoredInviteSession
  };
}

module.exports = { createInviteSessionSupport };
