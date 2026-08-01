function createPartyRewardProgressTools(context) {
  const { getPartyPlayerState, getPartyPlayerId, getPartyPlayerAccountId } =
    context;

  function addAccountStatIncrement(increments, accountId, path, amount = 1) {
    if (!accountId || !path || !amount) return;

    const accountIncrements = increments.get(accountId) || {};
    accountIncrements[path] = (accountIncrements[path] || 0) + amount;
    increments.set(accountId, accountIncrements);
  }

  function appendPartyAccountStatEvent(workingParty, event) {
    if (!event) return;

    if (!Array.isArray(workingParty.__accountStatEvents)) {
      workingParty.__accountStatEvents = [];
    }

    workingParty.__accountStatEvents.push(event);
    recordPartyRewardProgressFromStatEvent(workingParty, event);
  }

  const PARTY_REWARD_AVAILABLE_PATHS = new Set([
    'stats.totalEligibleVotes',
    'stats.crewVoteAccuracy.eligibleVotes'
  ]);

  const PARTY_REWARD_TAKEN_PATHS = new Set([
    'stats.votesCast',
    'stats.votesSubmitted',
    'stats.haveVotes',
    'stats.haveNotVotes',
    'stats.optionAVotes',
    'stats.optionBVotes',
    'stats.truthsCompleted',
    'stats.daresCompleted',
    'stats.promptsSkipped',
    'stats.punishmentsCompleted',
    'stats.drinkPunishmentsCompleted',
    'stats.promptHeists',
    'stats.drinkWheelSpins',
    'stats.dayVotesCast',
    'stats.nightKillsParticipatedIn',
    'stats.questionsAsked',
    'stats.playersSelected',
    'stats.revealsTriggered',
    'stats.revealsSurvived'
  ]);

  function getPartyRewardActionCounts(paths = {}) {
    let actionsAvailable = 0;
    let actionsTaken = 0;

    Object.entries(paths).forEach(([path, amount]) => {
      const numericAmount = Math.max(0, Number(amount) || 0);
      if (!numericAmount) return;

      if (PARTY_REWARD_AVAILABLE_PATHS.has(path)) {
        actionsAvailable += numericAmount;
      }
      if (PARTY_REWARD_TAKEN_PATHS.has(path)) {
        actionsTaken += numericAmount;
      }
    });

    // Some modes only emit a positive action stat once the player acted. Count
    // that as both available and taken until those modes expose missed actions.
    if (actionsAvailable === 0 && actionsTaken > 0) {
      actionsAvailable = actionsTaken;
    }

    return { actionsAvailable, actionsTaken };
  }

  const PARTY_REWARD_OBJECTIVE_POINTS_BY_MODE = Object.freeze({
    'truth-or-dare': Object.freeze({
      'stats.truthsCompleted': 2,
      'stats.daresCompleted': 3,
      'stats.punishmentsCompleted': 1,
      'stats.drinkPunishmentsCompleted': 1,
      'stats.promptHeists': 2,
      'stats.drinkWheelSpins': 1
    }),
    'most-likely-to': Object.freeze({
      'stats.votesCast': 1,
      'stats.votesReceived': 0.5,
      'stats.roundsNominated': 1,
      'stats.unanimousPicks': 2
    }),
    'never-have-i-ever': Object.freeze({
      'stats.haveVotes': 1,
      'stats.haveNotVotes': 1,
      'stats.majorityVotes': 1,
      'stats.oddManOuts': 2,
      'stats.drinkPunishmentsReceived': 1
    }),
    'would-you-rather': Object.freeze({
      'stats.optionAVotes': 1,
      'stats.optionBVotes': 1,
      'stats.perfectSplitParticipations': 2,
      'stats.majorityPicks': 1,
      'stats.minorityPicks': 1,
      'stats.isolationPicks': 1,
      'stats.lowSharePicks': 1
    }),
    imposter: Object.freeze({
      'stats.votesSubmitted': 1,
      'stats.correctImposterVotes': 3,
      'stats.imposterWins': 4,
      'stats.crewWins': 4,
      'stats.survivedAsImposter': 2
    }),
    mafia: Object.freeze({
      'stats.dayVotesCast': 1,
      'stats.nightKillsParticipatedIn': 2,
      'stats.correctEliminations': 3,
      'stats.mafiaWins': 4,
      'stats.townWins': 4
    }),
    paranoia: Object.freeze({
      'stats.questionsAsked': 1,
      'stats.playersSelected': 1,
      'stats.revealsTriggered': 2,
      'stats.revealsSurvived': 2,
      'stats.timesSelectedByOthers': 0.5
    })
  });

  function getPartyRewardObjectivePoints(gameMode, paths = {}) {
    const weights =
      PARTY_REWARD_OBJECTIVE_POINTS_BY_MODE[String(gameMode || '')] || {};
    return Object.entries(paths).reduce((total, [path, amount]) => {
      const weight = Number(weights[path]) || 0;
      const numericAmount = Math.max(0, Number(amount) || 0);
      return total + weight * numericAmount;
    }, 0);
  }

  function recordPartyRewardProgressFromStatEvent(workingParty, event) {
    if (!workingParty?.state || !Array.isArray(event?.increments)) return;

    const updateByPlayerId = new Map();
    const addUpdate = ({
      playerId,
      accountId,
      actionsAvailable = 0,
      actionsTaken = 0,
      objectivePoints = 0
    }) => {
      const playerIdString = playerId ? String(playerId) : '';
      if (!playerIdString) return;

      const existing = updateByPlayerId.get(playerIdString) || {
        playerId: playerIdString,
        accountId: accountId ? String(accountId) : null,
        actionsAvailable: 0,
        actionsTaken: 0,
        objectivePoints: 0
      };
      if (!existing.accountId && accountId) {
        existing.accountId = String(accountId);
      }
      existing.actionsAvailable += Math.max(0, Number(actionsAvailable) || 0);
      existing.actionsTaken += Math.max(0, Number(actionsTaken) || 0);
      existing.objectivePoints += Math.max(0, Number(objectivePoints) || 0);
      updateByPlayerId.set(playerIdString, existing);
    };

    if (Array.isArray(event.rewardProgress)) {
      event.rewardProgress.forEach(
        ({
          playerId,
          accountId,
          actionsAvailable,
          actionsTaken,
          objectivePoints
        }) => {
          addUpdate({
            playerId,
            accountId,
            actionsAvailable,
            actionsTaken,
            objectivePoints
          });
        }
      );
    }

    event.increments.forEach(({ accountId, paths }) => {
      let playerId = null;
      if (event.accountIdByPlayerId instanceof Map) {
        playerId = Array.from(event.accountIdByPlayerId.entries()).find(
          ([, eventAccountId]) => String(eventAccountId) === String(accountId)
        )?.[0];
      } else if (
        event.accountIdByPlayerId &&
        typeof event.accountIdByPlayerId === 'object'
      ) {
        playerId = Object.entries(event.accountIdByPlayerId).find(
          ([, eventAccountId]) => String(eventAccountId) === String(accountId)
        )?.[0];
      }
      const actionCounts = Array.isArray(event.rewardProgress)
        ? { actionsAvailable: 0, actionsTaken: 0 }
        : getPartyRewardActionCounts(paths);
      addUpdate({
        playerId,
        accountId,
        ...actionCounts,
        objectivePoints: getPartyRewardObjectivePoints(event.gameMode, paths)
      });
    });

    const updates = Array.from(updateByPlayerId.values()).filter(
      ({ actionsAvailable, actionsTaken, objectivePoints }) =>
        actionsAvailable > 0 || actionsTaken > 0 || objectivePoints > 0
    );
    if (!updates.length) return;

    const phaseData =
      workingParty.state.phaseData &&
      typeof workingParty.state.phaseData === 'object'
        ? workingParty.state.phaseData
        : {};
    const rewardProgress =
      phaseData.rewardProgress && typeof phaseData.rewardProgress === 'object'
        ? phaseData.rewardProgress
        : {};

    updates.forEach(
      ({
        playerId,
        accountId,
        actionsAvailable,
        actionsTaken,
        objectivePoints
      }) => {
        const progress =
          rewardProgress[playerId] &&
          typeof rewardProgress[playerId] === 'object'
            ? rewardProgress[playerId]
            : {};
        rewardProgress[playerId] = {
          accountId: accountId || progress.accountId || null,
          actionsAvailable:
            (Number(progress.actionsAvailable) || 0) + actionsAvailable,
          actionsTaken: (Number(progress.actionsTaken) || 0) + actionsTaken,
          objectivePoints:
            (Number(progress.objectivePoints) || 0) +
            Math.max(0, Number(objectivePoints) || 0)
        };
      }
    );

    workingParty.state.phaseData = {
      ...phaseData,
      rewardProgress
    };
  }

  function isRewardAvailablePlayer(player) {
    const playerState = getPartyPlayerState(player);
    const socketId = player?.connection?.socketId ?? player?.socketId;
    return (
      socketId !== 'DISCONNECTED' &&
      playerState.participationStatus !== 'pending_next_round'
    );
  }

  function createRewardProgressEntries(
    players = [],
    { availablePredicate = null, takenPredicate = null } = {}
  ) {
    return players
      .filter((player) => {
        if (!player || !isRewardAvailablePlayer(player)) return false;
        return typeof availablePredicate === 'function'
          ? availablePredicate(player)
          : true;
      })
      .map((player) => ({
        playerId: getPartyPlayerId(player),
        accountId: getPartyPlayerAccountId(player),
        actionsAvailable: 1,
        actionsTaken:
          typeof takenPredicate === 'function' && takenPredicate(player) ? 1 : 0
      }))
      .filter(({ playerId }) => playerId);
  }

  function attachRewardProgress(event, players = [], options = {}) {
    if (!event) return event;
    const rewardProgress = createRewardProgressEntries(players, options);
    if (rewardProgress.length > 0) {
      event.rewardProgress = rewardProgress;
    }
    return event;
  }

  return {
    addAccountStatIncrement,
    appendPartyAccountStatEvent,
    PARTY_REWARD_AVAILABLE_PATHS,
    PARTY_REWARD_TAKEN_PATHS,
    getPartyRewardActionCounts,
    PARTY_REWARD_OBJECTIVE_POINTS_BY_MODE,
    getPartyRewardObjectivePoints,
    recordPartyRewardProgressFromStatEvent,
    isRewardAvailablePlayer,
    createRewardProgressEntries,
    attachRewardProgress
  };
}

module.exports = { createPartyRewardProgressTools };
