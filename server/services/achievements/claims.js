const crypto = require('node:crypto');
const {
  QUEUED_CLAIMS_KEY,
  finalizeQueuedAchievementClaims,
  getAchievementRewardClaimModel,
  queueAchievementClaimFinalization
} = require('../../../models/accounts/achievement-reward-claim-queue');

const ACHIEVEMENT_REWARD_VERSION = 1;
const ACHIEVEMENT_REWARD_CLAIM_LEASE_MS = 5 * 60 * 1000;

function getAccountId(account) {
  return account?._id?.toString?.() || String(account?._id || '');
}

function getAchievementRewardClaimKey(account, achievementKey) {
  const accountId = getAccountId(account);
  const normalizedKey = String(achievementKey || '')
    .trim()
    .toLowerCase();
  return accountId && normalizedKey ? `${accountId}:${normalizedKey}` : '';
}

async function leanResult(query) {
  return typeof query?.lean === 'function' ? query.lean() : query;
}

function withSession(query, session) {
  return session && typeof query?.session === 'function'
    ? query.session(session)
    : query;
}

async function findClaim(Claim, query, session = null) {
  if (!Claim?.findOne) return null;
  return leanResult(withSession(Claim.findOne(query), session));
}

async function reconcileAppliedAchievementClaim({
  Claim,
  claimKey,
  rewardResults = [],
  appliedAt = new Date(),
  session = null
}) {
  if (!Claim?.updateOne || !claimKey) return;

  await Claim.updateOne(
    { claimKey, status: 'pending' },
    {
      $set: {
        status: 'applied',
        rewardResults,
        appliedAt,
        leaseExpiresAt: appliedAt
      }
    },
    session ? { session } : undefined
  );
}

async function acquireAchievementRewardClaim({
  AchievementRewardClaim = null,
  account,
  achievement,
  source = 'event',
  gamemode = null,
  partyId = null,
  now = new Date(),
  session = null,
  throwOnDuplicate = false
}) {
  const Claim = getAchievementRewardClaimModel(account, AchievementRewardClaim);
  const claimKey = getAchievementRewardClaimKey(account, achievement?.key);
  if (!Claim || !claimKey) {
    return {
      acquired: true,
      protected: false,
      Claim,
      claimKey: null,
      grantToken: null
    };
  }

  const grantToken = crypto.randomUUID();
  const leaseExpiresAt = new Date(
    now.getTime() + ACHIEVEMENT_REWARD_CLAIM_LEASE_MS
  );
  const claim = {
    claimKey,
    accountId: account._id,
    achievementKey: achievement.key,
    rewardVersion: ACHIEVEMENT_REWARD_VERSION,
    status: 'pending',
    grantToken,
    leaseExpiresAt,
    source,
    gamemode,
    partyId,
    rewardResults: [],
    appliedAt: null
  };

  const resumeExistingClaim = async (existingClaim) => {
    if (existingClaim.status === 'applied') {
      return {
        acquired: false,
        protected: true,
        Claim,
        claimKey,
        grantToken: null,
        reason: 'already_applied'
      };
    }

    const existingLease = new Date(existingClaim.leaseExpiresAt || 0).getTime();
    if (Number.isFinite(existingLease) && existingLease > now.getTime()) {
      return {
        acquired: false,
        protected: true,
        Claim,
        claimKey,
        grantToken: null,
        reason: 'in_progress'
      };
    }

    const recoveredClaim = await leanResult(
      Claim.findOneAndUpdate(
        {
          claimKey,
          status: 'pending',
          leaseExpiresAt: { $lte: now }
        },
        {
          $set: {
            grantToken,
            leaseExpiresAt,
            rewardVersion: ACHIEVEMENT_REWARD_VERSION,
            source,
            gamemode,
            partyId
          }
        },
        { new: true, ...(session ? { session } : {}) }
      )
    );

    return {
      acquired: Boolean(recoveredClaim?.grantToken === grantToken),
      protected: true,
      Claim,
      claimKey,
      grantToken: recoveredClaim?.grantToken === grantToken ? grantToken : null,
      reason:
        recoveredClaim?.grantToken === grantToken ? 'recovered' : 'in_progress'
    };
  };

  if (session) {
    const existingClaim = await findClaim(Claim, { claimKey }, session);
    if (existingClaim) return resumeExistingClaim(existingClaim);
  }

  try {
    if (session) {
      await Claim.create([claim], { session });
    } else {
      await Claim.create(claim);
    }
    return {
      acquired: true,
      protected: true,
      Claim,
      claimKey,
      grantToken
    };
  } catch (error) {
    if (error?.code !== 11000) throw error;
    if (throwOnDuplicate) {
      error.achievementRewardClaimDuplicate = true;
      throw error;
    }
  }

  const existingClaim = await findClaim(Claim, { claimKey }, session);
  if (!existingClaim) {
    return {
      acquired: false,
      protected: true,
      Claim,
      claimKey,
      grantToken: null,
      reason: 'claim_unavailable'
    };
  }
  return resumeExistingClaim(existingClaim);
}

async function recordPendingAchievementClaimResults({
  Claim,
  claimKey,
  grantToken,
  rewardResults,
  session = null
}) {
  if (!Claim?.updateOne || !claimKey || !grantToken) return;

  await Claim.updateOne(
    { claimKey, status: 'pending', grantToken },
    { $set: { rewardResults } },
    session ? { session } : undefined
  );
}

async function markAchievementRewardClaimApplied({
  Claim,
  claimKey,
  grantToken,
  rewardResults,
  appliedAt = new Date(),
  session = null
}) {
  if (!Claim?.updateOne || !claimKey || !grantToken) return false;

  const result = await Claim.updateOne(
    { claimKey, status: 'pending', grantToken },
    {
      $set: {
        status: 'applied',
        rewardResults,
        appliedAt,
        leaseExpiresAt: appliedAt
      }
    },
    session ? { session } : undefined
  );
  return Number(result?.modifiedCount || result?.nModified || 0) > 0;
}

async function releaseAchievementRewardClaim({
  Claim,
  claimKey,
  grantToken,
  releasedAt = new Date(),
  session = null
}) {
  if (!Claim?.updateOne || !claimKey || !grantToken) return;

  await Claim.updateOne(
    { claimKey, status: 'pending', grantToken },
    { $set: { leaseExpiresAt: releasedAt } },
    session ? { session } : undefined
  );
}

module.exports = {
  ACHIEVEMENT_REWARD_CLAIM_LEASE_MS,
  ACHIEVEMENT_REWARD_VERSION,
  QUEUED_CLAIMS_KEY,
  acquireAchievementRewardClaim,
  finalizeQueuedAchievementClaims,
  getAchievementRewardClaimKey,
  getAchievementRewardClaimModel,
  markAchievementRewardClaimApplied,
  queueAchievementClaimFinalization,
  reconcileAppliedAchievementClaim,
  releaseAchievementRewardClaim,
  recordPendingAchievementClaimResults
};
