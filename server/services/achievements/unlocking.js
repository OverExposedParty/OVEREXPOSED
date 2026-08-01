const { normalizeString } = require('./normalization');
const {
  isAchievementAvailableToStandardAccounts
} = require('../../../models/content/achievement-taxonomy');
const {
  createAccountNotificationState,
  queueAccountNotification
} = require('../account-notifications');
const {
  acquireAchievementRewardClaim,
  finalizeQueuedAchievementClaims,
  getAchievementRewardClaimKey,
  getAchievementRewardClaimModel,
  markAchievementRewardClaimApplied,
  queueAchievementClaimFinalization,
  reconcileAppliedAchievementClaim,
  releaseAchievementRewardClaim,
  recordPendingAchievementClaimResults
} = require('./claims');
const {
  clearCommittedAccountChanges,
  runAchievementAccountTransaction,
  syncAchievementAccountState
} = require('./account-transactions');
const { grantAchievementRewards } = require('./reward-grants');

function getExistingAchievementUnlock(account, achievementKey) {
  return (account?.gameData?.achievements || []).find(
    (entry) =>
      normalizeString(entry?.key).toLowerCase() ===
      normalizeString(achievementKey).toLowerCase()
  );
}

function applyAchievementUnlock({
  account,
  achievement,
  source,
  gamemode,
  partyId,
  progressAtUnlock,
  metadata
}) {
  const unlockedAt = new Date();
  const { rewardGranted, rewardStatus, rewardResults } =
    grantAchievementRewards({
      account,
      achievement,
      gamemode,
      partyId,
      now: unlockedAt
    });

  const notificationState = createAccountNotificationState();
  account.gameData.achievements.push({
    type: 'achievement',
    key: achievement.key,
    source,
    gamemode,
    partyId,
    progressAtUnlock,
    unlockedAt,
    rewardGranted,
    rewardStatus,
    rewardResults,
    metadata,
    ...notificationState
  });
  queueAccountNotification(account, {
    id: notificationState.notificationId,
    type: 'achievement_unlocked',
    createdAt: unlockedAt,
    metadata: {
      achievementKey: achievement.key,
      rewardStatus,
      rewardResults
    }
  });
  account.markModified?.('gameData.achievements');

  return { rewardGranted, rewardStatus, rewardResults };
}

async function unlockAchievementTransactionally({
  account,
  achievement,
  Claim,
  source,
  gamemode,
  partyId,
  progressAtUnlock,
  metadata,
  save
}) {
  const transaction = await runAchievementAccountTransaction({
    account,
    Claim,
    operation: async ({ account: workingAccount, session }) => {
      workingAccount.gameData ||= {};
      workingAccount.gameData.achievements ||= [];
      const claimKey = getAchievementRewardClaimKey(
        workingAccount,
        achievement.key
      );
      const existingUnlock = getExistingAchievementUnlock(
        workingAccount,
        achievement.key
      );
      if (existingUnlock) {
        await reconcileAppliedAchievementClaim({
          Claim,
          claimKey,
          rewardResults: existingUnlock.rewardResults || [],
          session
        });
        return {
          account: workingAccount,
          accountSaved: false,
          unlocked: false
        };
      }

      const claim = await acquireAchievementRewardClaim({
        AchievementRewardClaim: Claim,
        account: workingAccount,
        achievement,
        source,
        gamemode,
        partyId,
        session,
        throwOnDuplicate: true
      });
      if (!claim.acquired) {
        return {
          account: workingAccount,
          accountSaved: false,
          unlocked: false
        };
      }

      const { rewardResults } = applyAchievementUnlock({
        account: workingAccount,
        achievement,
        source,
        gamemode,
        partyId,
        progressAtUnlock,
        metadata
      });
      await recordPendingAchievementClaimResults({
        Claim,
        claimKey: claim.claimKey,
        grantToken: claim.grantToken,
        rewardResults,
        session
      });
      await workingAccount.save({ session });

      const finalized = await markAchievementRewardClaimApplied({
        Claim,
        claimKey: claim.claimKey,
        grantToken: claim.grantToken,
        rewardResults,
        session
      });
      if (claim.protected && !finalized) {
        throw new Error('Achievement reward claim could not be finalized.');
      }

      return { account: workingAccount, accountSaved: true, unlocked: true };
    }
  });

  if (!transaction.handled) return { handled: false, unlocked: false };

  const workingAccount = transaction.result?.account || null;
  const accountSaved = transaction.result?.accountSaved === true;
  if (workingAccount) {
    syncAchievementAccountState(account, workingAccount);
  }
  if (accountSaved) {
    clearCommittedAccountChanges(account, transaction.pendingChanges || []);
  }
  if (
    save &&
    accountSaved &&
    workingAccount &&
    workingAccount !== account &&
    account.isModified?.()
  ) {
    await account.save();
  }

  return {
    handled: true,
    unlocked: transaction.result?.unlocked === true
  };
}

async function unlockResolvedAchievement({
  AchievementRewardClaim = null,
  account,
  achievement,
  source = 'event',
  gamemode = null,
  partyId = null,
  progressAtUnlock = 1,
  metadata = {},
  save = true
} = {}) {
  if (
    !account ||
    !achievement?.key ||
    !isAchievementAvailableToStandardAccounts(achievement)
  ) {
    return null;
  }

  const Claim = getAchievementRewardClaimModel(account, AchievementRewardClaim);
  const transactionalUnlock = await unlockAchievementTransactionally({
    account,
    achievement,
    Claim,
    source,
    gamemode,
    partyId,
    progressAtUnlock,
    metadata,
    save
  });
  if (transactionalUnlock.handled) {
    return transactionalUnlock.unlocked ? achievement : null;
  }

  account.gameData ||= {};
  account.gameData.achievements ||= [];
  const claimKey = getAchievementRewardClaimKey(account, achievement.key);
  const existingUnlock = getExistingAchievementUnlock(account, achievement.key);
  if (existingUnlock) {
    await reconcileAppliedAchievementClaim({
      Claim,
      claimKey,
      rewardResults: existingUnlock.rewardResults || []
    });
    return null;
  }

  const claim = await acquireAchievementRewardClaim({
    AchievementRewardClaim: Claim,
    account,
    achievement,
    source,
    gamemode,
    partyId
  });
  if (!claim.acquired) return null;

  try {
    const { rewardResults } = applyAchievementUnlock({
      account,
      achievement,
      source,
      gamemode,
      partyId,
      progressAtUnlock,
      metadata
    });

    await recordPendingAchievementClaimResults({
      Claim: claim.Claim,
      claimKey: claim.claimKey,
      grantToken: claim.grantToken,
      rewardResults
    });
    queueAchievementClaimFinalization({
      account,
      claimKey: claim.claimKey,
      grantToken: claim.grantToken,
      rewardResults
    });

    if (save) {
      await account.save();
      await finalizeQueuedAchievementClaims({
        account,
        AchievementRewardClaim: claim.Claim
      });
    }

    return achievement;
  } catch (error) {
    await releaseAchievementRewardClaim({
      Claim: claim.Claim,
      claimKey: claim.claimKey,
      grantToken: claim.grantToken
    }).catch(() => {});
    throw error;
  }
}

async function unlockAchievementByKey({
  Achievement,
  AchievementRewardClaim = null,
  account,
  key,
  source = 'event',
  gamemode = null,
  partyId = null,
  progressAtUnlock = 1,
  metadata = {},
  save = true
} = {}) {
  if (!Achievement || !account || !key) return null;

  const achievement = await Achievement.findOne({
    key: normalizeString(key).toLowerCase(),
    enabled: true,
    status: 'published'
  }).lean();

  if (!achievement) return null;

  return unlockResolvedAchievement({
    AchievementRewardClaim,
    account,
    achievement,
    source,
    gamemode,
    partyId,
    progressAtUnlock,
    metadata,
    save
  });
}

async function unlockEligibleStatAchievements({
  Achievement,
  account,
  statKey,
  value,
  source
}) {
  const eligibleAchievements = await Achievement.find({
    enabled: true,
    status: 'published',
    requirementType: {
      $in: ['stat', 'stat_threshold', 'collection', 'streak']
    },
    statKey,
    requirementValue: { $lte: value }
  })
    .sort({ requirementValue: 1, sortOrder: 1, key: 1 })
    .lean();

  const unlocked = [];
  for (const achievement of eligibleAchievements) {
    const result = await unlockAchievementByKey({
      Achievement,
      account,
      key: achievement.key,
      source,
      progressAtUnlock: value,
      save: false
    });
    if (result) unlocked.push(result);
  }
  return unlocked;
}

module.exports = {
  grantAchievementRewards,
  unlockAchievementByKey,
  unlockEligibleStatAchievements,
  unlockResolvedAchievement
};
