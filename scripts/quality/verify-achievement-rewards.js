require('dotenv').config();

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  Account,
  Achievement,
  AchievementRewardClaim,
  accountsConnection,
  socialConnection
} = require('../../server/models');
const {
  persistAccountNotificationsDelivered,
  serializePendingAccountNotifications
} = require('../../server/services/account-notifications');
const {
  unlockAchievementByKey
} = require('../../server/services/achievements');

const CONFIRMATION_FLAG = '--confirm-live-test';
const STARTING_OPALS = 10;
const OPAL_REWARD = 37;
const STARTING_XP = 480;
const XP_REWARD = 75;
const ITEM_QUANTITY = 2;

function getDatabaseUri(baseUri, dbName) {
  const parsedUri = new URL(baseUri);
  parsedUri.pathname = `/${dbName}`;
  return parsedUri.toString();
}

function getDatabaseUris() {
  const baseUri = process.env.MONGO_URI_OVEREXPOSURE;
  const socialBaseUri = process.env.MONGO_URI_SOCIAL || baseUri;
  const accountsBaseUri = process.env.MONGO_URI_ACCOUNTS || baseUri;
  if (!socialBaseUri || !accountsBaseUri) {
    throw new Error('MongoDB social and accounts URIs must be configured.');
  }

  return {
    socialUri:
      process.env.MONGO_URI_SOCIAL ||
      getDatabaseUri(socialBaseUri, process.env.MONGO_DB_SOCIAL || 'social'),
    accountsUri:
      process.env.MONGO_URI_ACCOUNTS ||
      getDatabaseUri(
        accountsBaseUri,
        process.env.MONGO_DB_ACCOUNTS || 'accounts'
      )
  };
}

function getRewardState(account, achievementKey, itemKey) {
  const achievements = account.gameData?.achievements || [];
  const achievementTransactions = (
    account.gameData?.opalTransactions || []
  ).filter(
    (transaction) =>
      transaction.sourceType === 'achievement' &&
      transaction.sourceId === achievementKey
  );
  const inventoryItem = (account.olings?.consumables || []).find(
    (item) => item.key === itemKey
  );

  return {
    opalBalance: account.gameData?.opals?.balance,
    lifetimeOpalsEarned: account.gameData?.opals?.lifetimeEarned,
    xp: account.gameData?.xp,
    level: account.gameData?.level,
    achievementUnlocks: achievements.filter(
      (achievement) => achievement.key === achievementKey
    ).length,
    achievementTransactions: achievementTransactions.length,
    itemQuantity: inventoryItem?.quantity || 0
  };
}

async function getPanelProgressRow(accountId, achievementKey) {
  const rows = await Account.aggregate([
    { $match: { _id: accountId } },
    { $unwind: '$gameData.achievements' },
    {
      $match: {
        'gameData.achievements.key': achievementKey
      }
    },
    {
      $project: {
        _id: 0,
        user: '$username',
        achievement: '$gameData.achievements.key',
        source: '$gameData.achievements.source',
        progress: '$gameData.achievements.progressAtUnlock',
        rewardStatus: '$gameData.achievements.rewardStatus',
        rewardResults: '$gameData.achievements.rewardResults'
      }
    }
  ]);

  assert.equal(rows.length, 1, 'OE Panel should receive one progress row.');
  return rows[0];
}

async function runVerification() {
  if (!process.argv.includes(CONFIRMATION_FLAG)) {
    throw new Error(
      `Refusing to write temporary live data without ${CONFIRMATION_FLAG}.`
    );
  }

  const token = crypto.randomUUID().replaceAll('-', '').slice(0, 10);
  const achievementKey = `e2e-achievement-reward-${token}`;
  const itemKey = `e2e-consumable-${token}`;
  const username = `e2e_reward_${token}`;
  const email = `${username}@example.test`;
  let accountId = null;
  let achievementCreated = false;
  let verificationError = null;
  let cleanupError = null;
  const report = {
    fixture: { achievementKey, username, itemKey },
    rewards: null,
    claimStatus: null,
    notifications: null,
    duplicateProtected: false,
    panel: null,
    cleanup: null
  };

  try {
    const { socialUri, accountsUri } = getDatabaseUris();
    await Promise.all([
      socialConnection.openUri(socialUri),
      accountsConnection.openUri(accountsUri)
    ]);
    await AchievementRewardClaim.createIndexes();

    await Achievement.create({
      key: achievementKey,
      name: 'Achievement Reward E2E Verification',
      description: 'Temporary achievement used by the reward verifier.',
      category: 'account',
      requirementType: 'manual',
      rarity: 'rare',
      enabled: true,
      status: 'published',
      rewards: [
        { type: 'opals', amount: OPAL_REWARD },
        { type: 'xp', amount: XP_REWARD },
        { type: 'oling_consumable', key: itemKey, quantity: ITEM_QUANTITY }
      ],
      metadata: { temporaryVerificationFixture: true }
    });
    achievementCreated = true;

    const createdAccount = await Account.create({
      username,
      email,
      passwordHash: 'temporary-e2e-verification-only',
      profile: {
        accountStatus: 'active',
        emailVerified: true,
        emailVerifiedAt: new Date()
      },
      gameData: {
        level: 1,
        xp: STARTING_XP,
        opals: {
          balance: STARTING_OPALS,
          lifetimeEarned: STARTING_OPALS,
          lifetimeSpent: 0
        }
      }
    });
    accountId = createdAccount._id;

    const account = await Account.findById(accountId);
    assert.ok(account, 'Temporary account should be reloadable.');

    const unlocked = await unlockAchievementByKey({
      Achievement,
      AchievementRewardClaim,
      account,
      key: achievementKey,
      source: 'e2e-verification',
      progressAtUnlock: 1,
      metadata: { temporaryVerificationFixture: true }
    });
    assert.equal(
      unlocked?.key,
      achievementKey,
      'The production unlock service should unlock the fixture.'
    );

    const rewardedAccount = await Account.findById(accountId);
    assert.ok(rewardedAccount, 'Rewarded account should still exist.');
    const unlock = rewardedAccount.gameData.achievements.find(
      (achievement) => achievement.key === achievementKey
    );
    assert.ok(unlock, 'Achievement unlock should be persisted.');
    assert.equal(unlock.rewardGranted, true);
    assert.equal(unlock.rewardStatus, 'granted');
    assert.equal(unlock.rewardResults.length, 3);
    assert.deepEqual(
      unlock.rewardResults.map((reward) => reward.type),
      ['opals', 'xp', 'oling_consumable']
    );

    const rewardedState = getRewardState(
      rewardedAccount,
      achievementKey,
      itemKey
    );
    assert.deepEqual(rewardedState, {
      opalBalance: STARTING_OPALS + OPAL_REWARD,
      lifetimeOpalsEarned: STARTING_OPALS + OPAL_REWARD,
      xp: STARTING_XP + XP_REWARD,
      level: 2,
      achievementUnlocks: 1,
      achievementTransactions: 1,
      itemQuantity: ITEM_QUANTITY
    });

    const opalTransaction = rewardedAccount.gameData.opalTransactions.find(
      (transaction) =>
        transaction.sourceType === 'achievement' &&
        transaction.sourceId === achievementKey
    );
    assert.ok(opalTransaction, 'Achievement Opal transaction should exist.');
    assert.equal(opalTransaction.amount, OPAL_REWARD);
    assert.equal(opalTransaction.balanceAfter, STARTING_OPALS + OPAL_REWARD);

    const xpResult = unlock.rewardResults.find(
      (reward) => reward.type === 'xp'
    );
    assert.equal(xpResult.progression.levelledUp, true);
    assert.equal(xpResult.progression.levelAfter, 2);

    const claim = await AchievementRewardClaim.findOne({
      accountId,
      achievementKey
    }).lean();
    assert.ok(claim, 'A reward claim should be persisted.');
    assert.equal(claim.status, 'applied');
    assert.equal(claim.rewardResults.length, 3);

    const notifications = serializePendingAccountNotifications(rewardedAccount);
    assert.equal(notifications.length, 1);
    const [achievementNotification] = notifications;
    assert.equal(achievementNotification.type, 'achievement_unlocked');
    assert.equal(achievementNotification.rewardStatus, 'granted');
    assert.equal(achievementNotification.rewardResults.length, 3);

    const duplicateAccount = await Account.findById(accountId);
    const duplicateResult = await unlockAchievementByKey({
      Achievement,
      AchievementRewardClaim,
      account: duplicateAccount,
      key: achievementKey,
      source: 'e2e-verification-duplicate'
    });
    assert.equal(duplicateResult, null);
    const afterDuplicate = await Account.findById(accountId);
    assert.deepEqual(
      getRewardState(afterDuplicate, achievementKey, itemKey),
      rewardedState
    );
    assert.equal(
      await AchievementRewardClaim.countDocuments({
        accountId,
        achievementKey
      }),
      1
    );

    const deliveredAt = new Date();
    const delivered = await persistAccountNotificationsDelivered(
      afterDuplicate,
      notifications.map((notification) => notification.id),
      deliveredAt
    );
    assert.equal(delivered, 2);
    const acknowledgedAccount = await Account.findById(accountId);
    assert.deepEqual(
      serializePendingAccountNotifications(acknowledgedAccount),
      []
    );
    const acknowledgedUnlock = acknowledgedAccount.gameData.achievements.find(
      (achievement) => achievement.key === achievementKey
    );
    const acknowledgedTransaction =
      acknowledgedAccount.gameData.opalTransactions.find(
        (transaction) =>
          transaction.sourceType === 'achievement' &&
          transaction.sourceId === achievementKey
      );
    assert.equal(acknowledgedUnlock.notificationPending, false);
    assert.equal(
      acknowledgedUnlock.notifiedAt.getTime(),
      deliveredAt.getTime()
    );
    assert.equal(acknowledgedTransaction.notificationPending, false);
    assert.equal(
      acknowledgedTransaction.notificationDeliveredAt.getTime(),
      deliveredAt.getTime()
    );

    const panelRow = await getPanelProgressRow(accountId, achievementKey);
    assert.equal(panelRow.user, username);
    assert.equal(panelRow.achievement, achievementKey);
    assert.equal(panelRow.source, 'e2e-verification');
    assert.equal(panelRow.progress, 1);
    assert.equal(panelRow.rewardStatus, 'granted');
    assert.equal(panelRow.rewardResults.length, 3);

    report.rewards = rewardedState;
    report.claimStatus = claim.status;
    report.notifications = {
      queuedTypes: notifications.map((notification) => notification.type),
      acknowledged: delivered
    };
    report.duplicateProtected = true;
    report.panel = {
      achievement: panelRow.achievement,
      rewardStatus: panelRow.rewardStatus,
      rewardResults: panelRow.rewardResults.length
    };
  } catch (error) {
    verificationError = error;
  } finally {
    try {
      const cleanup = {
        claimsDeleted: 0,
        accountsDeleted: 0,
        achievementsDeleted: 0,
        verifiedAbsent: false
      };

      if (accountId && accountsConnection.readyState === 1) {
        const claimResult = await AchievementRewardClaim.deleteMany({
          accountId
        });
        const accountResult = await Account.deleteOne({ _id: accountId });
        cleanup.claimsDeleted = claimResult.deletedCount;
        cleanup.accountsDeleted = accountResult.deletedCount;
      }
      if (achievementCreated && socialConnection.readyState === 1) {
        const achievementResult = await Achievement.deleteOne({
          key: achievementKey
        });
        cleanup.achievementsDeleted = achievementResult.deletedCount;
      }

      const accountRecordsRemaining =
        accountId && accountsConnection.readyState === 1
          ? await Account.countDocuments({ _id: accountId })
          : 0;
      const claimRecordsRemaining =
        accountId && accountsConnection.readyState === 1
          ? await AchievementRewardClaim.countDocuments({ accountId })
          : 0;
      const achievementRecordsRemaining =
        achievementCreated && socialConnection.readyState === 1
          ? await Achievement.countDocuments({ key: achievementKey })
          : 0;

      assert.equal(accountRecordsRemaining, 0);
      assert.equal(claimRecordsRemaining, 0);
      assert.equal(achievementRecordsRemaining, 0);
      cleanup.verifiedAbsent = true;
      report.cleanup = cleanup;
    } catch (error) {
      cleanupError = error;
    }

    await Promise.allSettled(
      [accountsConnection, socialConnection]
        .filter((connection) => connection.readyState !== 0)
        .map((connection) => connection.close())
    );
  }

  if (verificationError && cleanupError) {
    throw new AggregateError(
      [verificationError, cleanupError],
      'Achievement reward verification and cleanup both failed.'
    );
  }
  if (verificationError) throw verificationError;
  if (cleanupError) throw cleanupError;

  console.log(JSON.stringify(report, null, 2));
}

runVerification().catch((error) => {
  console.error('Achievement reward verification failed:', error);
  process.exitCode = 1;
});
