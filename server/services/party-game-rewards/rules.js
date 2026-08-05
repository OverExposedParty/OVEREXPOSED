const {
  getConfiguredRoundLimit
} = require('../../game-engine/party-runtime/rounds');

const PARTY_GAME_REWARD_RULES = Object.freeze({
  minimumDurationMs: 5 * 60 * 1000,
  minimumDurationFloorMs: 60 * 1000,
  minimumDurationMsPerRound: 20 * 1000,
  minimumActivityRate: 0.25,
  minimumAvailableActions: 4,
  baseCompletionOpals: 5,
  maxParticipationOpals: 3,
  maxObjectiveOpals: 7,
  maxOpalsPerGame: 15,
  dailySoftCap: 125,
  softCapReductionRate: 0.8
});

const PARTY_GAME_XP_RULES = Object.freeze({
  xpPerCreditedMinute: 4,
  maxCreditedDurationMs: 30 * 60 * 1000,
  maxCreditedDurationMsPerRound: 2 * 60 * 1000,
  maxObjectiveBonusRate: 0.25,
  participationMultipliers: Object.freeze({
    minimum: 0.6,
    moderate: 0.8,
    active: 1
  }),
  matchLengthMultipliers: Object.freeze({
    short: 1,
    medium: 1.05,
    long: 1.1,
    maximum: 1.15
  })
});

function getStartOfUtcDay(date = new Date()) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function getPartyGameRewardProgress(party) {
  const progress =
    party?.state?.phaseData?.rewardProgress ||
    party?.state?.phaseData?.partyGameRewards?.progress ||
    {};
  return progress && typeof progress === 'object' ? progress : {};
}

function getRewardProgressForPlayer(progress, playerId, accountId) {
  if (
    playerId &&
    progress[playerId] &&
    typeof progress[playerId] === 'object'
  ) {
    return progress[playerId];
  }

  if (
    accountId &&
    progress[accountId] &&
    typeof progress[accountId] === 'object'
  ) {
    return progress[accountId];
  }

  return {};
}

function getPlayerScoreForReward(player) {
  return Math.max(0, Number(player?.state?.score ?? player?.score ?? 0) || 0);
}

function getPartyGameRewardDurationMs(party, now = new Date()) {
  const startedAtValue =
    party?.session?.startedAt ||
    party?.session?.createdAt ||
    party?.session?.access?.createdAt ||
    null;
  const startedAt = new Date(startedAtValue || 0);
  if (!startedAtValue || !Number.isFinite(startedAt.getTime())) return 0;
  return Math.max(0, now.getTime() - startedAt.getTime());
}

function getPartyGameActivePlaytimeMs(party, now = new Date()) {
  const accumulatedMilliseconds = Math.max(
    0,
    Number(party?.session?.playtimeAccumulatedMilliseconds) || 0
  );
  if (party?.state?.isPlaying !== true) return accumulatedMilliseconds;

  const playtimeStartedAt = new Date(
    party?.session?.playtimeStartedAt || 0
  ).getTime();
  const nowMilliseconds = new Date(now).getTime();
  const currentSegmentMilliseconds =
    Number.isFinite(playtimeStartedAt) &&
    Number.isFinite(nowMilliseconds) &&
    playtimeStartedAt > 0 &&
    playtimeStartedAt <= nowMilliseconds
      ? nowMilliseconds - playtimeStartedAt
      : 0;

  return accumulatedMilliseconds + currentSegmentMilliseconds;
}

function getPartyGameRewardMinimumDurationMs(party) {
  const configuredRounds = getConfiguredRoundLimit({
    gamemode: party?.config?.gamemode || party?.gamemode || '',
    gameRules: party?.config?.gameRules
  });

  if (!configuredRounds) {
    return PARTY_GAME_REWARD_RULES.minimumDurationMs;
  }

  return Math.min(
    PARTY_GAME_REWARD_RULES.minimumDurationMs,
    Math.max(
      PARTY_GAME_REWARD_RULES.minimumDurationFloorMs,
      configuredRounds * PARTY_GAME_REWARD_RULES.minimumDurationMsPerRound
    )
  );
}

function getParticipationOpals(activityRate) {
  if (activityRate >= 0.75) return 3;
  if (activityRate >= 0.5) return 2;
  if (activityRate >= PARTY_GAME_REWARD_RULES.minimumActivityRate) return 1;
  return 0;
}

function clampRatio(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}

function getPartyGameXpParticipationMultiplier(activityRate) {
  const rate = clampRatio(activityRate);
  if (rate >= 0.75) {
    return PARTY_GAME_XP_RULES.participationMultipliers.active;
  }
  if (rate >= 0.5) {
    return PARTY_GAME_XP_RULES.participationMultipliers.moderate;
  }
  if (rate >= PARTY_GAME_REWARD_RULES.minimumActivityRate) {
    return PARTY_GAME_XP_RULES.participationMultipliers.minimum;
  }
  return 0;
}

function getPartyGameXpMatchLengthMultiplier(creditedDurationMs) {
  const creditedMinutes =
    Math.max(0, Number(creditedDurationMs) || 0) / (60 * 1000);

  if (creditedMinutes >= 30) {
    return PARTY_GAME_XP_RULES.matchLengthMultipliers.maximum;
  }
  if (creditedMinutes >= 20) {
    return PARTY_GAME_XP_RULES.matchLengthMultipliers.long;
  }
  if (creditedMinutes >= 10) {
    return PARTY_GAME_XP_RULES.matchLengthMultipliers.medium;
  }
  return PARTY_GAME_XP_RULES.matchLengthMultipliers.short;
}

function calculatePartyGameXpReward({
  party,
  activeDurationMs,
  activityRate,
  objectiveRatio,
  eligible
}) {
  const safeDurationMs = Math.max(0, Number(activeDurationMs) || 0);
  const configuredRounds = getConfiguredRoundLimit({
    gamemode: party?.config?.gamemode || party?.gamemode || '',
    gameRules: party?.config?.gameRules
  });
  const configuredDurationCapMs = configuredRounds
    ? configuredRounds * PARTY_GAME_XP_RULES.maxCreditedDurationMsPerRound
    : PARTY_GAME_XP_RULES.maxCreditedDurationMs;
  const creditedDurationMs = Math.min(
    safeDurationMs,
    configuredDurationCapMs,
    PARTY_GAME_XP_RULES.maxCreditedDurationMs
  );
  const creditedMinutes = creditedDurationMs / (60 * 1000);
  const baseXp = creditedMinutes * PARTY_GAME_XP_RULES.xpPerCreditedMinute;
  const participationRate = clampRatio(activityRate);
  const participationMultiplier =
    getPartyGameXpParticipationMultiplier(participationRate);
  const safeObjectiveRatio = clampRatio(objectiveRatio);
  const objectiveMultiplier =
    1 + safeObjectiveRatio * PARTY_GAME_XP_RULES.maxObjectiveBonusRate;
  const matchLengthMultiplier =
    getPartyGameXpMatchLengthMultiplier(creditedDurationMs);
  const earnedTotal = eligible
    ? Math.round(
        baseXp *
          participationMultiplier *
          objectiveMultiplier *
          matchLengthMultiplier
      )
    : 0;

  return {
    activeDurationMs: safeDurationMs,
    configuredRounds,
    configuredDurationCapMs,
    maximumDurationCapMs: PARTY_GAME_XP_RULES.maxCreditedDurationMs,
    creditedDurationMs,
    creditedMinutes,
    baseXp,
    participationRate,
    participationMultiplier,
    objectiveRatio: safeObjectiveRatio,
    objectiveMultiplier,
    matchLengthMultiplier,
    earnedTotal,
    grantedTotal: 0,
    grantApplied: false,
    alreadyGranted: false,
    grantSkippedReason: null,
    progression: null
  };
}

const PARTY_GAME_OBJECTIVE_STRATEGIES = Object.freeze({
  'truth-or-dare': Object.freeze({
    pointsPerActionTarget: 2.5
  }),
  'most-likely-to': Object.freeze({
    pointsPerActionTarget: 1.5
  }),
  'never-have-i-ever': Object.freeze({
    pointsPerActionTarget: 1.75
  }),
  'would-you-rather': Object.freeze({
    pointsPerActionTarget: 1.75
  }),
  mafia: Object.freeze({
    pointsPerActionTarget: 2
  }),
  imposter: Object.freeze({
    pointsPerActionTarget: 2
  }),
  paranoia: Object.freeze({
    pointsPerActionTarget: 2
  }),
  default: Object.freeze({
    pointsPerActionTarget: 2
  })
});

function getPartyGameObjectiveStrategy(party) {
  const gamemode = String(party?.config?.gamemode || party?.gamemode || '');
  return (
    PARTY_GAME_OBJECTIVE_STRATEGIES[gamemode] ||
    PARTY_GAME_OBJECTIVE_STRATEGIES.default
  );
}

function getObjectiveOpalsFromRatio(objectiveRatio) {
  if (objectiveRatio >= 1) return 7;
  if (objectiveRatio >= 0.85) return 6;
  if (objectiveRatio >= 0.7) return 5;
  if (objectiveRatio >= 0.5) return 4;
  if (objectiveRatio >= 0.35) return 3;
  if (objectiveRatio >= 0.2) return 2;
  if (objectiveRatio > 0) return 1;
  return 0;
}

function getObjectiveRewardDetails({
  party,
  progress,
  score,
  maxScore,
  actionsAvailable
}) {
  const strategy = getPartyGameObjectiveStrategy(party);
  const objectivePoints = Math.max(0, Number(progress?.objectivePoints) || 0);
  const objectivePointTarget = Math.max(
    1,
    actionsAvailable * strategy.pointsPerActionTarget
  );

  if (objectivePoints > 0) {
    const objectiveRatio = Math.min(1, objectivePoints / objectivePointTarget);
    return {
      source: 'gamemode_objective',
      objectivePoints,
      objectivePointTarget,
      objectiveRatio,
      opals: getObjectiveOpalsFromRatio(objectiveRatio)
    };
  }

  const fallbackRatio = maxScore > 0 ? Math.min(1, score / maxScore) : 0;
  return {
    source: 'score_fallback',
    objectivePoints,
    objectivePointTarget,
    objectiveRatio: fallbackRatio,
    opals: getObjectiveOpalsFromRatio(fallbackRatio)
  };
}

function getPartyPlayerRewardIdentity(player) {
  const playerId = player?.identity?.computerId ?? player?.computerId ?? null;
  const accountId = player?.identity?.accountId ?? player?.accountId ?? null;
  const accountIdString = accountId ? String(accountId) : '';
  return {
    playerId: playerId ? String(playerId) : null,
    accountId: /^[a-f\d]{24}$/i.test(accountIdString) ? accountIdString : null
  };
}

function createPartyGameRewardSummary({
  party,
  player,
  progress,
  durationMs,
  activePlaytimeMs,
  maxScore
}) {
  const { playerId, accountId } = getPartyPlayerRewardIdentity(player);
  const gameId = party?.session?.gameId || null;
  const claimKey =
    (gameId || party?.partyId) && playerId
      ? `${gameId || party.partyId}:${playerId}`
      : null;
  const actionsAvailable = Math.max(
    0,
    Math.floor(Number(progress?.actionsAvailable) || 0)
  );
  const actionsTaken = Math.max(
    0,
    Math.min(actionsAvailable, Math.floor(Number(progress?.actionsTaken) || 0))
  );
  const activityRate =
    actionsAvailable > 0 ? actionsTaken / actionsAvailable : 0;
  const score = getPlayerScoreForReward(player);
  const objectiveReward = getObjectiveRewardDetails({
    party,
    progress,
    score,
    maxScore,
    actionsAvailable
  });
  const objectiveOpals = objectiveReward.opals;
  const minimumDurationMs = getPartyGameRewardMinimumDurationMs(party);

  const failedRequirements = [];
  if (durationMs < minimumDurationMs) {
    failedRequirements.push('minimum_duration');
  }
  if (actionsAvailable < PARTY_GAME_REWARD_RULES.minimumAvailableActions) {
    failedRequirements.push('minimum_available_actions');
  }
  if (activityRate < PARTY_GAME_REWARD_RULES.minimumActivityRate) {
    failedRequirements.push('minimum_activity');
  }

  const eligible = failedRequirements.length === 0;
  const completionOpals = eligible
    ? PARTY_GAME_REWARD_RULES.baseCompletionOpals
    : 0;
  const participationOpals = eligible ? getParticipationOpals(activityRate) : 0;
  const cappedObjectiveOpals = eligible ? objectiveOpals : 0;
  const earnedBeforeCap = eligible
    ? Math.min(
        PARTY_GAME_REWARD_RULES.maxOpalsPerGame,
        completionOpals + participationOpals + cappedObjectiveOpals
      )
    : 0;
  const xp = calculatePartyGameXpReward({
    party,
    activeDurationMs: activePlaytimeMs,
    activityRate,
    objectiveRatio: objectiveReward.objectiveRatio,
    eligible
  });

  return {
    playerId,
    accountId,
    gameId,
    claimKey,
    eligible,
    failedRequirements,
    requirements: {
      minimumDurationMs,
      actualDurationMs: durationMs,
      minimumActivityRate: PARTY_GAME_REWARD_RULES.minimumActivityRate,
      minimumAvailableActions: PARTY_GAME_REWARD_RULES.minimumAvailableActions,
      actionsAvailable,
      actionsTaken,
      activityRate,
      objective: {
        source: objectiveReward.source,
        points: objectiveReward.objectivePoints,
        pointTarget: objectiveReward.objectivePointTarget,
        ratio: objectiveReward.objectiveRatio
      }
    },
    rows: {
      gameCompleted: completionOpals,
      activeParticipation: participationOpals,
      objectiveBonus: cappedObjectiveOpals
    },
    capReduction: {
      applied: false,
      percentage: Math.round(
        PARTY_GAME_REWARD_RULES.softCapReductionRate * 100
      ),
      amount: 0
    },
    earnedBeforeCap,
    earnedTotal: earnedBeforeCap,
    xp,
    alreadyGranted: false
  };
}

function buildPartyGameRewardSummaries(party, { now = new Date() } = {}) {
  const players = Array.isArray(party?.players) ? party.players : [];
  const progressByPlayerId = getPartyGameRewardProgress(party);
  const durationMs = getPartyGameRewardDurationMs(party, now);
  const activePlaytimeMs = getPartyGameActivePlaytimeMs(party, now);
  const maxScore = Math.max(0, ...players.map(getPlayerScoreForReward));
  const byAccountId = {};
  const byPlayerId = {};

  players.forEach((player) => {
    const { playerId, accountId } = getPartyPlayerRewardIdentity(player);
    if (!playerId) return;

    const summary = createPartyGameRewardSummary({
      party,
      player,
      progress: getRewardProgressForPlayer(
        progressByPlayerId,
        playerId,
        accountId
      ),
      durationMs,
      activePlaytimeMs,
      maxScore
    });

    if (accountId) {
      byAccountId[accountId] = summary;
    }
    byPlayerId[playerId] = summary;
  });

  return {
    version: 2,
    rules: PARTY_GAME_REWARD_RULES,
    xpRules: PARTY_GAME_XP_RULES,
    byAccountId,
    byPlayerId
  };
}

function applyPartyGameSoftCap(summary, account, now = new Date()) {
  const earnedBeforeCap = Math.max(0, Number(summary?.earnedBeforeCap) || 0);
  if (earnedBeforeCap <= 0) {
    return { finalAmount: 0, capReduction: summary.capReduction };
  }

  const startOfDay = getStartOfUtcDay(now);
  const dailyEarned = (account?.gameData?.opalTransactions || [])
    .filter((transaction) => {
      if (transaction?.sourceType !== 'game_reward') return false;
      if (transaction?.type !== 'earn') return false;
      if ((Number(transaction?.amount) || 0) <= 0) return false;
      return new Date(transaction.createdAt || 0) >= startOfDay;
    })
    .reduce(
      (total, transaction) => total + (Number(transaction.amount) || 0),
      0
    );

  const cap = PARTY_GAME_REWARD_RULES.dailySoftCap;
  const reductionRate = PARTY_GAME_REWARD_RULES.softCapReductionRate;
  const remainingBeforeReduction = Math.max(0, cap - dailyEarned);
  const fullValueAmount = Math.min(earnedBeforeCap, remainingBeforeReduction);
  const overCapAmount = Math.max(0, earnedBeforeCap - fullValueAmount);
  const reducedOverCapAmount =
    overCapAmount > 0
      ? Math.max(1, Math.ceil(overCapAmount * (1 - reductionRate)))
      : 0;
  const finalAmount = fullValueAmount + reducedOverCapAmount;
  const reductionAmount = Math.max(0, earnedBeforeCap - finalAmount);

  return {
    finalAmount,
    capReduction: {
      applied: reductionAmount > 0,
      percentage: Math.round(reductionRate * 100),
      amount: reductionAmount
    }
  };
}

module.exports = {
  PARTY_GAME_REWARD_RULES,
  PARTY_GAME_XP_RULES,
  calculatePartyGameXpReward,
  buildPartyGameRewardSummaries,
  getPartyGameActivePlaytimeMs,
  applyPartyGameSoftCap
};
