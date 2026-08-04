const { createMafiaStatEventTools } = require('./mafia-stat-events');

function createPartyStatEventTools(context) {
  const {
    getPartyPlayerId,
    getPartyPlayerAccountId,
    addAccountStatIncrement,
    attachRewardProgress,
    getPartyPlayerState
  } = context;

  function createMostLikelyToRoundStatEvent(
    players = [],
    voteSnapshot = [],
    winnerPlayerId = null
  ) {
    const livePlayers = players.filter((player) => {
      const socketId = player?.connection?.socketId ?? player?.socketId;
      return socketId !== 'DISCONNECTED';
    });
    const accountIdByPlayerId = new Map();

    livePlayers.forEach((player) => {
      const playerId = getPartyPlayerId(player);
      const accountId = getPartyPlayerAccountId(player);
      if (playerId && accountId) {
        accountIdByPlayerId.set(String(playerId), accountId);
      }
    });

    if (accountIdByPlayerId.size === 0) return null;

    const eligibleVoteCount = voteSnapshot.length;
    const voteCountsByTargetId = new Map();
    const increments = new Map();

    accountIdByPlayerId.forEach((accountId) => {
      addAccountStatIncrement(increments, accountId, 'roundsPlayed', 1);
      addAccountStatIncrement(
        increments,
        accountId,
        'stats.totalEligibleVotes',
        eligibleVoteCount
      );
    });

    voteSnapshot.forEach(({ playerId, vote }) => {
      const voterId = String(playerId);
      const targetId = String(vote);
      const voterAccountId = accountIdByPlayerId.get(voterId);

      if (voterAccountId) {
        addAccountStatIncrement(
          increments,
          voterAccountId,
          'stats.votesCast',
          1
        );

        if (voterId === targetId) {
          addAccountStatIncrement(
            increments,
            voterAccountId,
            'stats.timesVotedForSelf',
            1
          );
        }
      }

      voteCountsByTargetId.set(
        targetId,
        (voteCountsByTargetId.get(targetId) || 0) + 1
      );
    });

    voteCountsByTargetId.forEach((voteCount, targetId) => {
      const targetAccountId = accountIdByPlayerId.get(String(targetId));
      if (!targetAccountId) return;

      addAccountStatIncrement(
        increments,
        targetAccountId,
        'stats.votesReceived',
        voteCount
      );
      addAccountStatIncrement(
        increments,
        targetAccountId,
        'stats.roundsNominated',
        1
      );

      if (eligibleVoteCount > 0 && voteCount === eligibleVoteCount) {
        addAccountStatIncrement(
          increments,
          targetAccountId,
          'stats.unanimousPicks',
          1
        );
      }
    });

    const highestVoteCount = Math.max(0, ...voteCountsByTargetId.values());
    const highestVotedPlayerIds = Array.from(voteCountsByTargetId.entries())
      .filter(([, voteCount]) => voteCount === highestVoteCount)
      .map(([playerId]) => playerId);

    return attachRewardProgress(
      {
        gameMode: 'most-likely-to',
        achievementData: {
          type: 'most-likely-to-round',
          playerAccounts: Array.from(
            accountIdByPlayerId,
            ([playerId, accountId]) => ({ playerId, accountId })
          ),
          votes: voteSnapshot.map(({ playerId, vote }) => ({
            playerId: String(playerId),
            vote: String(vote)
          })),
          highestVotedPlayerIds,
          winnerPlayerId: winnerPlayerId ? String(winnerPlayerId) : null,
          isTie: highestVoteCount > 0 && highestVotedPlayerIds.length > 1
        },
        increments: Array.from(increments, ([accountId, paths]) => ({
          accountId,
          paths
        }))
      },
      livePlayers,
      {
        takenPredicate: (player) => {
          const playerId = getPartyPlayerId(player);
          return voteSnapshot.some(
            ({ playerId: voterId }) => String(voterId) === String(playerId)
          );
        }
      }
    );
  }

  function createMostLikelyToOutcomeStatEvent(
    players = [],
    voteSnapshot = [],
    winnerPlayerId = null
  ) {
    if (!winnerPlayerId) return null;

    const playerAccounts = players
      .map((player) => ({
        playerId: getPartyPlayerId(player),
        accountId: getPartyPlayerAccountId(player)
      }))
      .filter(({ playerId, accountId }) => playerId && accountId)
      .map(({ playerId, accountId }) => ({
        playerId: String(playerId),
        accountId
      }));

    if (playerAccounts.length === 0) return null;

    return {
      gameMode: 'most-likely-to',
      achievementData: {
        type: 'most-likely-to-outcome',
        playerAccounts,
        votes: voteSnapshot.map(({ playerId, vote }) => ({
          playerId: String(playerId),
          vote: String(vote)
        })),
        winnerPlayerId: String(winnerPlayerId)
      },
      increments: playerAccounts.map(({ accountId }) => ({
        accountId,
        paths: {}
      }))
    };
  }

  function createParanoiaAchievementEvent(players = [], achievementData = {}) {
    const playerAccounts = players
      .map((player) => ({
        playerId: getPartyPlayerId(player),
        accountId: getPartyPlayerAccountId(player),
        score: Number(getPartyPlayerState(player).score ?? player.score) || 0
      }))
      .filter(({ playerId, accountId }) => playerId && accountId)
      .map(({ playerId, accountId, score }) => ({
        playerId: String(playerId),
        accountId,
        score
      }));

    if (!achievementData?.type || playerAccounts.length === 0) return null;

    return {
      gameMode: 'paranoia',
      achievementData: {
        ...achievementData,
        playerAccounts
      },
      increments: playerAccounts.map(({ accountId }) => ({
        accountId,
        paths: {}
      }))
    };
  }

  function createAccountStatEvent(
    gameMode,
    playerPathEntries = [],
    { feature = null } = {}
  ) {
    const increments = new Map();

    playerPathEntries.forEach(({ player, playerId, paths }) => {
      const resolvedPlayer =
        player ||
        (playerId
          ? playerPathEntries
              .map((entry) => entry.player)
              .find((entryPlayer) => getPartyPlayerId(entryPlayer) === playerId)
          : null);
      const accountId = getPartyPlayerAccountId(resolvedPlayer);
      if (!accountId || !paths || typeof paths !== 'object') return;

      Object.entries(paths).forEach(([path, amount]) => {
        addAccountStatIncrement(increments, accountId, path, amount);
      });
    });

    if (increments.size === 0) return null;

    return {
      gameMode,
      ...(feature ? { feature } : {}),
      increments: Array.from(increments, ([accountId, paths]) => ({
        accountId,
        paths
      }))
    };
  }

  function createRoundPlayedEntries(players = []) {
    return players
      .filter((player) => {
        const socketId = player?.connection?.socketId ?? player?.socketId;
        return socketId !== 'DISCONNECTED';
      })
      .map((player) => ({ player, paths: { roundsPlayed: 1 } }));
  }

  function createNeverHaveIEverRoundStatEvent({
    players = [],
    rewardEligiblePlayers = null,
    oddManOutEnabled = false,
    drinkPunishmentEnabled = false
  } = {}) {
    const entries = createRoundPlayedEntries(players);
    const eligibleVotes = players
      .map((player) => ({
        player,
        vote: getPartyPlayerState(player).vote ?? player.vote
      }))
      .filter(({ player, vote }) => {
        const socketId = player?.connection?.socketId ?? player?.socketId;
        return socketId !== 'DISCONNECTED' && typeof vote === 'boolean';
      });
    const haveCount = eligibleVotes.filter(({ vote }) => vote === true).length;
    const haveNotCount = eligibleVotes.filter(
      ({ vote }) => vote === false
    ).length;
    const majorityVote =
      haveCount === haveNotCount ? null : haveCount > haveNotCount;
    const oddVote =
      haveCount === 1 && haveNotCount > 1
        ? true
        : haveNotCount === 1 && haveCount > 1
          ? false
          : null;

    eligibleVotes.forEach(({ player, vote }) => {
      const paths = vote
        ? { 'stats.haveVotes': 1 }
        : { 'stats.haveNotVotes': 1 };
      if (majorityVote !== null && vote === majorityVote) {
        paths['stats.majorityVotes'] = 1;
      }
      if (oddManOutEnabled && oddVote !== null && vote === oddVote) {
        paths['stats.oddManOuts'] = 1;
        if (drinkPunishmentEnabled) {
          paths['stats.drinkPunishmentsReceived'] = 1;
        }
      }
      entries.push({ player, paths });
    });

    const event = createAccountStatEvent('never-have-i-ever', entries);
    if (event) {
      event.streaks = eligibleVotes.map(({ player, vote }) => ({
        accountId: getPartyPlayerAccountId(player),
        type: vote ? 'have' : 'haveNot'
      }));
      event.achievementData = {
        type: 'never-have-i-ever-round',
        playerAccounts: eligibleVotes
          .map(({ player }) => ({
            playerId: getPartyPlayerId(player),
            accountId: getPartyPlayerAccountId(player)
          }))
          .filter(({ playerId, accountId }) => playerId && accountId)
          .map(({ playerId, accountId }) => ({
            playerId: String(playerId),
            accountId
          })),
        votes: eligibleVotes.map(({ player, vote }) => ({
          playerId: String(getPartyPlayerId(player)),
          vote
        })),
        haveCount,
        haveNotCount
      };
    }
    return attachRewardProgress(
      event,
      Array.isArray(rewardEligiblePlayers) ? rewardEligiblePlayers : players,
      {
        takenPredicate: (player) =>
          typeof (getPartyPlayerState(player).vote ?? player.vote) === 'boolean'
      }
    );
  }

  function createWouldYouRatherRoundStatEvent(players = []) {
    const entries = createRoundPlayedEntries(players);
    const eligibleVotes = players
      .map((player) => ({
        player,
        vote: getPartyPlayerState(player).vote ?? player.vote
      }))
      .filter(({ player, vote }) => {
        const socketId = player?.connection?.socketId ?? player?.socketId;
        return socketId !== 'DISCONNECTED' && (vote === 'A' || vote === 'B');
      });
    const aCount = eligibleVotes.filter(({ vote }) => vote === 'A').length;
    const bCount = eligibleVotes.filter(({ vote }) => vote === 'B').length;
    const totalVotes = eligibleVotes.length;
    const winningVote = aCount === bCount ? null : aCount > bCount ? 'A' : 'B';
    const perfectSplit = aCount === bCount && aCount > 0;

    eligibleVotes.forEach(({ player, vote }) => {
      const paths =
        vote === 'A'
          ? { 'stats.optionAVotes': 1 }
          : { 'stats.optionBVotes': 1 };
      if (perfectSplit) {
        paths['stats.perfectSplitParticipations'] = 1;
      } else if (winningVote && vote === winningVote) {
        paths['stats.majorityPicks'] = 1;
      } else if (winningVote) {
        paths['stats.minorityPicks'] = 1;
      }
      const sideVoteCount = vote === 'A' ? aCount : bCount;
      if (sideVoteCount === 1) {
        paths['stats.isolationPicks'] = 1;
      }
      if (totalVotes > 0 && sideVoteCount / totalVotes <= 0.25) {
        paths['stats.lowSharePicks'] = 1;
      }
      entries.push({ player, paths });
    });

    return attachRewardProgress(
      createAccountStatEvent('would-you-rather', entries),
      players,
      {
        takenPredicate: (player) => {
          const vote = getPartyPlayerState(player).vote ?? player.vote;
          return vote === 'A' || vote === 'B';
        }
      }
    );
  }

  function createImposterVoteOutcomeStatEvent({
    players = [],
    imposterId = null,
    imposterCaught = false
  } = {}) {
    const entries = createRoundPlayedEntries(players);
    const imposterPlayer = players.find(
      (player) => String(getPartyPlayerId(player)) === String(imposterId)
    );

    players.forEach((player) => {
      const playerId = getPartyPlayerId(player);
      const vote = getPartyPlayerState(player).vote ?? player.vote ?? null;
      const isImposter = String(playerId) === String(imposterId);
      const paths = isImposter
        ? { 'stats.roundsAsImposter': 1 }
        : { 'stats.roundsAsCrew': 1 };

      if (isImposter && !imposterCaught) {
        paths['stats.imposterWins'] = 1;
      }
      if (!isImposter && imposterCaught) {
        paths['stats.crewWins'] = 1;
      }

      if (vote) {
        paths['stats.votesSubmitted'] = 1;
      }
      if (!isImposter && vote) {
        paths['stats.crewVoteAccuracy.eligibleVotes'] = 1;
        if (String(vote) === String(imposterId)) {
          paths['stats.correctImposterVotes'] = 1;
          paths['stats.crewVoteAccuracy.correctVotes'] = 1;
        }
      }
      if (!isImposter && String(playerId) !== String(imposterId)) {
        const wasAccused = players.some(
          (voter) =>
            String(getPartyPlayerState(voter).vote ?? voter.vote) ===
            String(playerId)
        );
        if (wasAccused) {
          paths['stats.falseAccusations'] = 1;
        }
      }

      entries.push({ player, paths });
    });

    if (imposterPlayer) {
      entries.push({
        player: imposterPlayer,
        paths: imposterCaught
          ? { 'stats.votedOutAsImposter': 1 }
          : { 'stats.survivedAsImposter': 1 }
      });
    }

    return attachRewardProgress(
      createAccountStatEvent('imposter', entries),
      players,
      {
        takenPredicate: (player) =>
          Boolean(getPartyPlayerState(player).vote ?? player.vote)
      }
    );
  }

  const mafiaStatEventTools = createMafiaStatEventTools({
    createAccountStatEvent,
    getPartyPlayerState
  });

  return {
    createMostLikelyToRoundStatEvent,
    createMostLikelyToOutcomeStatEvent,
    createParanoiaAchievementEvent,
    createAccountStatEvent,
    createRoundPlayedEntries,
    createNeverHaveIEverRoundStatEvent,
    createWouldYouRatherRoundStatEvent,
    createImposterVoteOutcomeStatEvent,
    ...mafiaStatEventTools
  };
}

module.exports = { createPartyStatEventTools };
