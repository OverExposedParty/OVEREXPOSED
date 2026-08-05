const { toPositiveInteger } = require('../opals/catalog');
const {
  buildPartyGameRewardSummaries,
  applyPartyGameSoftCap
} = require('./rules');
const {
  createAccountNotificationState,
  queueAccountNotification
} = require('../account-notifications');
const { applyAccountXp } = require('../account-progression');

const PARTY_GAME_REWARD_VERSION = 2;

function getPartyGameXpAmount(summary) {
  return Math.max(0, Math.floor(Number(summary?.xp?.earnedTotal) || 0));
}

function setPartyGameXpGrant(
  summary,
  {
    grantedTotal = 0,
    grantApplied = false,
    alreadyGranted = false,
    grantSkippedReason = null,
    progression = null
  } = {}
) {
  if (!summary?.xp || typeof summary.xp !== 'object') return;

  summary.xp.grantedTotal = Math.max(0, Math.floor(Number(grantedTotal) || 0));
  summary.xp.grantApplied = grantApplied === true;
  summary.xp.alreadyGranted = alreadyGranted === true;
  summary.xp.grantSkippedReason = grantSkippedReason;
  summary.xp.progression = progression;
}

function restoreExistingPartyGameXpGrant(
  summary,
  { storedXp = null, accountXp = null, grantRecorded = false } = {}
) {
  if (!grantRecorded) {
    setPartyGameXpGrant(summary, {
      alreadyGranted: true,
      grantSkippedReason: 'legacy_reward'
    });
    return;
  }

  setPartyGameXpGrant(summary, {
    grantedTotal:
      accountXp?.amount ?? storedXp?.grantedTotal ?? storedXp?.earnedTotal ?? 0,
    grantApplied:
      accountXp?.granted === true || storedXp?.grantApplied === true,
    alreadyGranted: true,
    grantSkippedReason:
      storedXp?.grantSkippedReason ??
      (accountXp?.granted === false ? 'no_xp_earned' : null),
    progression: accountXp?.progression ?? storedXp?.progression ?? null
  });
}

function isModernPartyGameRewardClaim(claim) {
  return Number(claim?.rewardVersion) >= PARTY_GAME_REWARD_VERSION;
}

function getClaimOpalAmount(claim) {
  return Math.max(0, Number(claim?.opalAmount ?? claim?.amount) || 0);
}

function getClaimXpAmount(claim) {
  return Math.max(0, Math.floor(Number(claim?.xpAmount) || 0));
}

async function markPartyGameRewardClaimApplied({
  PartyGameRewardClaim,
  claimKey,
  accountId,
  summary,
  opalAmount,
  xpAmount,
  progression,
  appliedAt
}) {
  if (!PartyGameRewardClaim?.findOneAndUpdate) return;

  await PartyGameRewardClaim.findOneAndUpdate(
    { claimKey, accountId },
    {
      $set: {
        rewardVersion: PARTY_GAME_REWARD_VERSION,
        status: 'applied',
        amount: opalAmount,
        opalAmount,
        xpAmount,
        levelBefore: progression?.levelBefore ?? null,
        levelAfter: progression?.levelAfter ?? null,
        rewardSummary: summary,
        appliedAt
      }
    }
  );
}

function resetAccountProgression(account, progression) {
  if (!account?.gameData || !progression) return;
  account.gameData.xp = progression.xpBefore;
  account.gameData.level = progression.levelBefore;
}

async function grantPartyGameRewardSummary({
  Account,
  PartyGameRewardClaim = null,
  party,
  accountId,
  summary,
  now = new Date()
}) {
  if (
    !Account ||
    !party?.partyId ||
    !accountId ||
    !summary?.claimKey ||
    !summary.eligible ||
    (summary.earnedBeforeCap <= 0 && getPartyGameXpAmount(summary) <= 0)
  ) {
    return summary;
  }

  const account = await Account.findById(accountId);
  if (!account) return summary;

  if (!account.gameData) account.gameData = {};
  if (!account.gameData.opals) account.gameData.opals = {};
  if (!Array.isArray(account.gameData.opalTransactions)) {
    account.gameData.opalTransactions = [];
  }

  const legacySourceId = `${party.partyId}:${accountId}`;
  const legacyPlayerSourceId = `${party.partyId}:${summary.playerId}`;
  const playSequence = Number(party.session?.playSequence);
  const legacySourceIds =
    !Number.isFinite(playSequence) || playSequence <= 1
      ? [legacySourceId, legacyPlayerSourceId]
      : [];
  const existingTransaction = account.gameData.opalTransactions.find(
    (transaction) =>
      transaction?.sourceType === 'game_reward' &&
      [summary.claimKey, ...legacySourceIds].includes(
        String(transaction?.sourceId || '')
      )
  );
  if (existingTransaction) {
    summary.alreadyGranted = true;
    summary.earnedTotal = Math.max(0, Number(existingTransaction.amount) || 0);
    summary.capReduction =
      existingTransaction.metadata?.rewardSummary?.capReduction ||
      summary.capReduction;
    const accountXp = existingTransaction.metadata?.accountXp;
    const grantRecorded = Boolean(accountXp && typeof accountXp === 'object');
    restoreExistingPartyGameXpGrant(summary, {
      storedXp: existingTransaction.metadata?.rewardSummary?.xp,
      accountXp,
      grantRecorded
    });
    if (grantRecorded) {
      await markPartyGameRewardClaimApplied({
        PartyGameRewardClaim,
        claimKey: summary.claimKey,
        accountId,
        summary,
        opalAmount: summary.earnedTotal,
        xpAmount: Math.max(0, Math.floor(Number(accountXp.amount) || 0)),
        progression: accountXp.progression || null,
        appliedAt: existingTransaction.createdAt || now
      });
    }
    return summary;
  }

  let pendingClaim = null;
  if (PartyGameRewardClaim?.findOne) {
    const existingClaim = await PartyGameRewardClaim.findOne({
      claimKey: summary.claimKey
    }).lean();
    if (existingClaim) {
      summary.claimedByAccountId = String(existingClaim.accountId || '');
      const claimedByThisAccount =
        summary.claimedByAccountId === String(accountId);
      const canResume =
        claimedByThisAccount &&
        isModernPartyGameRewardClaim(existingClaim) &&
        existingClaim.status === 'pending';

      if (canResume) {
        pendingClaim = existingClaim;
      } else {
        summary.alreadyGranted = true;
        summary.earnedTotal = getClaimOpalAmount(existingClaim);
      }

      restoreExistingPartyGameXpGrant(summary, {
        storedXp: existingClaim.rewardSummary?.xp,
        grantRecorded: isModernPartyGameRewardClaim(existingClaim)
      });
      if (!canResume) return summary;
    }
  }

  const { finalAmount, capReduction } = pendingClaim
    ? {
        finalAmount: getClaimOpalAmount(pendingClaim),
        capReduction:
          pendingClaim.rewardSummary?.capReduction || summary.capReduction
      }
    : applyPartyGameSoftCap(summary, account, now);
  summary.earnedTotal = finalAmount;
  summary.capReduction = capReduction;

  const xpAmount = pendingClaim
    ? getClaimXpAmount(pendingClaim)
    : getPartyGameXpAmount(summary);
  const progression = applyAccountXp(account, xpAmount);
  setPartyGameXpGrant(summary, {
    grantedTotal: progression.xpAdded,
    grantApplied: progression.xpAdded > 0,
    progression
  });

  if (finalAmount <= 0 && progression.xpAdded <= 0) return summary;

  if (!pendingClaim && PartyGameRewardClaim?.create) {
    try {
      await PartyGameRewardClaim.create({
        claimKey: summary.claimKey,
        partyId: party.partyId,
        gameId: summary.gameId || party.session?.gameId || null,
        playerId: summary.playerId,
        accountId,
        gamemode: party.config?.gamemode || party.gamemode || null,
        rewardVersion: PARTY_GAME_REWARD_VERSION,
        status: 'pending',
        amount: finalAmount,
        opalAmount: finalAmount,
        xpAmount: progression.xpAdded,
        levelBefore: progression.levelBefore,
        levelAfter: progression.levelAfter,
        rewardSummary: summary,
        createdAt: now,
        appliedAt: null
      });
    } catch (error) {
      if (error?.code === 11000) {
        resetAccountProgression(account, progression);
        summary.alreadyGranted = true;
        return summary;
      }
      throw error;
    }
  }

  const currentBalance = toPositiveInteger(account.gameData.opals.balance);
  const nextBalance = currentBalance + finalAmount;
  account.gameData.opals.balance = nextBalance;
  account.gameData.opals.lifetimeEarned =
    toPositiveInteger(account.gameData.opals.lifetimeEarned) + finalAmount;
  const notificationState = createAccountNotificationState();
  const transaction = {
    type: 'earn',
    amount: finalAmount,
    reason: 'Party game reward',
    sourceType: 'game_reward',
    sourceId: summary.claimKey,
    balanceAfter: nextBalance,
    metadata: {
      partyId: party.partyId,
      playerId: summary.playerId,
      gamemode: party.config?.gamemode || party.gamemode || null,
      accountXp: {
        granted: summary.xp?.grantApplied === true,
        amount: summary.xp?.grantedTotal || 0,
        progression: summary.xp?.progression || null
      },
      rewardSummary: summary
    },
    ...notificationState,
    createdAt: now
  };
  account.gameData.opalTransactions.push(transaction);
  queueAccountNotification(account, {
    id: notificationState.notificationId,
    type: 'opal_reward',
    createdAt: now,
    metadata: {
      amount: finalAmount,
      balance: nextBalance,
      label: 'Game reward',
      reason: transaction.reason,
      sourceType: transaction.sourceType,
      sourceId: transaction.sourceId
    }
  });

  account.markModified('gameData.opals');
  account.markModified('gameData.opalTransactions');
  account.markModified('gameData.xp');
  account.markModified('gameData.level');
  await account.save();
  await markPartyGameRewardClaimApplied({
    PartyGameRewardClaim,
    claimKey: summary.claimKey,
    accountId,
    summary,
    opalAmount: finalAmount,
    xpAmount: progression.xpAdded,
    progression,
    appliedAt: now
  });
  return summary;
}

async function grantPartyGameRewards({
  Account,
  PartyGameRewardClaim = null,
  party,
  now = new Date()
}) {
  const summaries = buildPartyGameRewardSummaries(party, { now });
  if (!Account || !party?.partyId) return summaries;

  for (const summary of Object.values(summaries.byPlayerId)) {
    if (!summary.accountId) continue;
    await grantPartyGameRewardSummary({
      Account,
      PartyGameRewardClaim,
      party,
      accountId: summary.accountId,
      summary,
      now
    });
  }

  return summaries;
}

async function grantPendingPartyGameReward({
  Account,
  PartyGameRewardClaim = null,
  party,
  playerId,
  accountId,
  now = new Date()
}) {
  const summaries = buildPartyGameRewardSummaries(party, { now });
  const summary = summaries.byPlayerId?.[String(playerId || '')] || null;
  if (!summary) return { summaries, summary: null };

  summary.accountId = accountId ? String(accountId) : summary.accountId;
  if (summary.accountId) {
    summaries.byAccountId[summary.accountId] = summary;
  }

  await grantPartyGameRewardSummary({
    Account,
    PartyGameRewardClaim,
    party,
    accountId: summary.accountId,
    summary,
    now
  });

  return { summaries, summary };
}

module.exports = {
  PARTY_GAME_REWARD_VERSION,
  grantPartyGameRewardSummary,
  grantPartyGameRewards,
  grantPendingPartyGameReward
};
