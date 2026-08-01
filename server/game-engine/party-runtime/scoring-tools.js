function createPartyScoringTools(context) {
  const { getPartyPlayerState, getPartyPlayerId, SCORE_RULES } = context;

  function addScoreToPartyPlayer(player, score) {
    if (!player || !Number.isFinite(score) || score === 0) return;

    const playerState = getPartyPlayerState(player);
    playerState.score = (playerState.score ?? player.score ?? 0) + score;
    player.score = playerState.score;
  }

  function addScoreToPartyPlayerById(players, playerId, score) {
    if (!playerId) return;

    const player = players.find(
      (candidate) => String(getPartyPlayerId(candidate)) === String(playerId)
    );
    addScoreToPartyPlayer(player, score);
  }

  function addParanoiaRevealMissScores(players, selectorId, targetId) {
    const rules = SCORE_RULES.paranoia;
    addScoreToPartyPlayerById(players, targetId, rules.revealMissPenalty);

    if (selectorId && targetId && String(selectorId) !== String(targetId)) {
      addScoreToPartyPlayerById(
        players,
        selectorId,
        rules.keepQuestionSecretBonus
      );
    }
  }

  function addNeverHaveIEverVoteResultScores({
    players,
    haveVoteCount,
    haveNotVoteCount,
    oddManOutEnabled
  }) {
    const rules = SCORE_RULES['never-have-i-ever'];
    const totalVotes = haveVoteCount + haveNotVoteCount;
    if (totalVotes === 0) return;

    const perfectSplit =
      haveVoteCount === haveNotVoteCount && haveVoteCount > 0;
    const loneVote =
      haveVoteCount === 1 && haveNotVoteCount > 0
        ? true
        : haveNotVoteCount === 1 && haveVoteCount > 0
          ? false
          : null;
    const majorityVote =
      haveVoteCount > haveNotVoteCount
        ? true
        : haveNotVoteCount > haveVoteCount
          ? false
          : null;

    players.forEach((player) => {
      const playerState = getPartyPlayerState(player);
      const socketId = player.connection?.socketId ?? player.socketId;
      const vote = playerState.vote ?? player.vote;
      if (socketId === 'DISCONNECTED' || typeof vote !== 'boolean') return;

      if (perfectSplit) {
        addScoreToPartyPlayer(player, rules.perfectSplit);
        return;
      }

      if (majorityVote !== null && vote === majorityVote) {
        addScoreToPartyPlayer(player, rules.majoritySide);
      }

      if (loneVote !== null && vote === loneVote) {
        addScoreToPartyPlayer(
          player,
          oddManOutEnabled ? rules.oddManOutPenalty : rules.loneSideBonus
        );
      }
    });
  }

  function addImposterVoteOutcomeScores({
    players,
    imposterId,
    imposterCaught,
    imposterVoteCount
  }) {
    if (!imposterId) return;

    const rules = SCORE_RULES.imposter;

    players.forEach((player) => {
      const playerId = getPartyPlayerId(player);
      const playerState = getPartyPlayerState(player);
      const socketId = player.connection?.socketId ?? player.socketId;
      const vote = playerState.vote ?? player.vote ?? null;

      if (socketId === 'DISCONNECTED' || !playerId) return;

      const isImposter = String(playerId) === String(imposterId);

      if (!isImposter && String(vote) === String(imposterId)) {
        addScoreToPartyPlayer(player, rules.correctVote);
      }

      if (imposterCaught) {
        if (!isImposter) {
          addScoreToPartyPlayer(player, rules.crewWin);
        }
        return;
      }

      if (isImposter) {
        addScoreToPartyPlayer(player, rules.imposterSurvivedVote);
        if (imposterVoteCount === 0) {
          addScoreToPartyPlayer(player, rules.imposterNoVotesBonus);
        }
        addScoreToPartyPlayer(player, rules.imposterWin);
      }
    });
  }

  function addWouldYouRatherVoteResultScores(players) {
    const rules = SCORE_RULES['would-you-rather'];
    const voteCounts = { A: 0, B: 0 };

    players.forEach((player) => {
      const playerState = getPartyPlayerState(player);
      const socketId = player.connection?.socketId ?? player.socketId;
      const vote = playerState.vote ?? player.vote;
      if (socketId === 'DISCONNECTED' || (vote !== 'A' && vote !== 'B')) return;
      voteCounts[vote] += 1;
    });

    const totalVotes = voteCounts.A + voteCounts.B;
    if (totalVotes === 0) return;

    const perfectSplit = voteCounts.A === voteCounts.B && voteCounts.A > 0;
    const majorityVote =
      voteCounts.A > voteCounts.B
        ? 'A'
        : voteCounts.B > voteCounts.A
          ? 'B'
          : null;
    const loneVote =
      voteCounts.A === 1 && voteCounts.B > 0
        ? 'A'
        : voteCounts.B === 1 && voteCounts.A > 0
          ? 'B'
          : null;

    players.forEach((player) => {
      const playerState = getPartyPlayerState(player);
      const socketId = player.connection?.socketId ?? player.socketId;
      const vote = playerState.vote ?? player.vote;
      if (socketId === 'DISCONNECTED' || (vote !== 'A' && vote !== 'B')) return;

      if (perfectSplit) {
        addScoreToPartyPlayer(player, rules.perfectSplit);
        return;
      }

      if (majorityVote !== null && vote === majorityVote) {
        addScoreToPartyPlayer(player, rules.majoritySide);
      }

      if (loneVote !== null && vote === loneVote) {
        addScoreToPartyPlayer(player, rules.loneSideBonus);
      }
    });
  }

  function getMostLikelyToVoteSnapshot(players) {
    return players
      .map((player) => ({
        playerId: getPartyPlayerId(player),
        vote: getPartyPlayerState(player).vote ?? player.vote ?? null,
        socketId: player.connection?.socketId ?? player.socketId
      }))
      .filter(
        ({ playerId, vote, socketId }) =>
          playerId && vote && socketId !== 'DISCONNECTED'
      );
  }

  function addMostLikelyToPickedScores(players, voteSnapshot) {
    const rules = SCORE_RULES['most-likely-to'];
    const voteCounts = new Map();

    voteSnapshot.forEach(({ vote }) => {
      voteCounts.set(vote, (voteCounts.get(vote) ?? 0) + 1);
    });

    voteCounts.forEach((count, targetId) => {
      const pickedScore = Math.max(
        rules.pickedMinimum,
        rules.pickedBase - (count - 1) * rules.pickedConcurrentDrop
      );
      addScoreToPartyPlayerById(players, targetId, pickedScore);
    });
  }

  function addMostLikelyToCorrectVoteScores(players, targetId, voteSnapshot) {
    if (!targetId) return;

    const rules = SCORE_RULES['most-likely-to'];
    voteSnapshot.forEach(({ playerId, vote }) => {
      if (String(vote) === String(targetId)) {
        addScoreToPartyPlayerById(players, playerId, rules.correctVote);
      }
    });
  }

  return {
    addScoreToPartyPlayer,
    addScoreToPartyPlayerById,
    addParanoiaRevealMissScores,
    addNeverHaveIEverVoteResultScores,
    addImposterVoteOutcomeScores,
    addWouldYouRatherVoteResultScores,
    getMostLikelyToVoteSnapshot,
    addMostLikelyToPickedScores,
    addMostLikelyToCorrectVoteScores
  };
}

module.exports = { createPartyScoringTools };
