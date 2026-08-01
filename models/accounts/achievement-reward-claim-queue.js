const QUEUED_CLAIMS_KEY = 'pendingAchievementRewardClaims';

function getAchievementRewardClaimModel(account, providedModel = null) {
  return (
    providedModel ||
    account?.constructor?.db?.models?.AchievementRewardClaim ||
    null
  );
}

function queueAchievementClaimFinalization({
  account,
  claimKey,
  grantToken,
  rewardResults
}) {
  if (!account || !claimKey || !grantToken) return;
  account.$locals ||= {};
  account.$locals[QUEUED_CLAIMS_KEY] ||= [];

  const queued = account.$locals[QUEUED_CLAIMS_KEY];
  const existing = queued.find((claim) => claim.claimKey === claimKey);
  if (existing) {
    existing.grantToken = grantToken;
    existing.rewardResults = rewardResults;
    return;
  }
  queued.push({ claimKey, grantToken, rewardResults });
}

async function finalizeQueuedAchievementClaims({
  account,
  AchievementRewardClaim = null,
  appliedAt = new Date()
}) {
  const queued = account?.$locals?.[QUEUED_CLAIMS_KEY];
  if (!Array.isArray(queued) || !queued.length) return 0;

  const Claim = getAchievementRewardClaimModel(account, AchievementRewardClaim);
  if (!Claim?.updateOne) return 0;

  let finalized = 0;
  for (const claim of queued) {
    const result = await Claim.updateOne(
      {
        claimKey: claim.claimKey,
        status: 'pending',
        grantToken: claim.grantToken
      },
      {
        $set: {
          status: 'applied',
          rewardResults: claim.rewardResults,
          appliedAt,
          leaseExpiresAt: appliedAt
        }
      }
    );
    if (Number(result?.modifiedCount || result?.nModified || 0) > 0) {
      finalized += 1;
    }
  }

  account.$locals[QUEUED_CLAIMS_KEY] = [];
  return finalized;
}

module.exports = {
  QUEUED_CLAIMS_KEY,
  finalizeQueuedAchievementClaims,
  getAchievementRewardClaimModel,
  queueAchievementClaimFinalization
};
