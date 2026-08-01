require('dotenv').config();

const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const {
  Account,
  Achievement,
  AchievementRewardClaim,
  accountsConnection,
  socialConnection
} = require('../server/models');
const {
  serializePendingAccountNotifications
} = require('../server/services/account-notifications');
const {
  getAccountXpProgress
} = require('../server/services/account-progression');
const { unlockAchievementByKey } = require('../server/services/achievements');

const CONFIRMATION_FLAG = '--confirm-live-create';
const USERNAME = 'oetester';
const EMAIL = 'oetester@overexposed.test';
const TARGET_XP = 87_400;
const TARGET_OPALS = 4_250;
const TARGET_LIFETIME_OPALS = 12_000;
const CREATED_AT = new Date('2023-06-17T14:32:00.000Z');
const LAST_ACTIVE_AT = new Date('2026-07-05T21:18:00.000Z');

const ACHIEVEMENT_KEYS = Object.freeze([
  'welcome-to-the-party',
  'verified',
  'identity-crisis',
  'fresh-and-fitted',
  'wardrobe-warrior',
  'outfit-rotation',
  'first-steps',
  'party-animal',
  'regular',
  'addict',
  'the-invite',
  'party-starter',
  'room-runner',
  'host-with-the-most',
  'master-of-ceremonies',
  'showing-up',
  'dedicated-player',
  'habit-forming',
  'taste-tester',
  'pack-sampler',
  'pack-explorer',
  'honest-start',
  'truth-teller',
  'truth-seeker',
  'open-book',
  'no-secrets-left',
  'dare-accepted',
  'risk-taker',
  'daredevil',
  'no-backing-out',
  'been-there',
  'relatable',
  'why-me',
  'on-their-mind',
  'living-rent-free',
  'manual-reader',
  'nerd-xd'
]);

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

function getHistoricalUnlockDate(index) {
  const firstUnlock = new Date('2023-07-02T18:20:00.000Z').getTime();
  const lastUnlock = new Date('2025-11-23T20:45:00.000Z').getTime();
  const progress = index / Math.max(1, ACHIEVEMENT_KEYS.length - 1);
  return new Date(firstUnlock + (lastUnlock - firstUnlock) * progress);
}

function setHistoricalAccountData(account) {
  const xpProgress = getAccountXpProgress(TARGET_XP);
  assert.equal(xpProgress.currentLevel, 38);

  account.profile.displayName = 'OE Tester';
  account.profile.oeIcon = '0000:0100:0200:0300';
  account.profile.country = 'GB';
  account.profile.preferredLanguage = 'en';
  account.profile.emailVerified = true;
  account.profile.emailVerifiedAt = new Date('2023-06-18T09:12:00.000Z');
  account.profile.accountStatus = 'active';
  account.profile.lastLoginAt = LAST_ACTIVE_AT;
  account.profile.lastProfileUpdatedAt = new Date('2025-09-14T16:08:00.000Z');
  account.profile.usernameHistory = [
    {
      value: 'oe_tester_legacy',
      changedAt: new Date('2024-02-11T11:25:00.000Z'),
      changedBy: null
    }
  ];
  account.profile.sitePreferences = {
    soundEnabled: true,
    nsfwEnabled: true,
    consoleEnabled: false
  };
  account.profile.notificationPreferences = {
    marketingEmail: false,
    accountEmail: true,
    shopEmail: true,
    gameEmail: true,
    push: false
  };
  account.profile.privacySettings = {
    profileVisibility: 'public',
    showGameStats: true,
    showOnlineStatus: true,
    allowFriendRequests: true
  };

  account.customisationPreferences = {
    showLockedOes: true,
    disabledOes: [],
    disabledPacks: []
  };
  account.access = {
    roles: ['beta_tester'],
    features: [],
    grantedAt: new Date('2023-06-17T14:35:00.000Z'),
    grantedBy: null,
    disabled: false
  };

  account.gameData.gamesPlayed = 842;
  account.gameData.roundsPlayed = 11_080;
  account.gameData.totalPlaytimeSeconds = 1_066_000;
  account.gameData.level = xpProgress.currentLevel;
  account.gameData.xp = xpProgress.lifetimeXp;
  account.gameData.rank = 'Veteran';
  account.gameData.streaks = {
    currentDailyPlay: 0,
    bestDailyPlay: 31,
    lastDailyPlayDate: '2026-06-28'
  };
  account.gameData.lastActiveGameMode = 'truth-or-dare';
  account.gameData.lastPlayedAt = new Date('2026-06-28T22:40:00.000Z');
  account.gameData.achievementStats = {
    onlineGamesPlayed: 842,
    onlinePartiesHosted: 137,
    bestPlayDayStreak: 31,
    uniquePacksPlayed: 23,
    correctAccusations: 64,
    truthsCompleted: 312,
    daresCompleted: 184,
    imposterWins: 17,
    majorityVotes: 138,
    haveVotes: 241,
    majorityMatches: 198,
    paranoiaSelectionsReceived: 86,
    oeChanges: 31
  };
  account.gameData.perGameStats = [
    {
      gameMode: 'truth-or-dare',
      gamesPlayed: 194,
      roundsPlayed: 2670,
      totalPlaytimeSeconds: 238_400,
      lastPlayedAt: new Date('2026-06-28T22:40:00.000Z'),
      favouritePack: 'ice-breaker',
      packPlayCounts: { 'ice-breaker': 74, 'adult-confessions': 58 },
      stats: { truthsCompleted: 312, daresCompleted: 184, promptsSkipped: 37 }
    },
    {
      gameMode: 'paranoia',
      gamesPlayed: 126,
      roundsPlayed: 1600,
      totalPlaytimeSeconds: 151_200,
      lastPlayedAt: new Date('2026-06-21T23:05:00.000Z'),
      favouritePack: 'hidden-agendas',
      stats: { timesPicked: 86, questionsRevealed: 43 }
    },
    {
      gameMode: 'most-likely-to',
      gamesPlayed: 139,
      roundsPlayed: 1850,
      totalPlaytimeSeconds: 160_000,
      lastPlayedAt: new Date('2026-05-17T20:34:00.000Z'),
      favouritePack: 'friendship-test',
      stats: { votesReceived: 491, winningVotes: 138 }
    },
    {
      gameMode: 'never-have-i-ever',
      gamesPlayed: 101,
      roundsPlayed: 1280,
      totalPlaytimeSeconds: 117_000,
      lastPlayedAt: new Date('2026-04-26T19:48:00.000Z'),
      favouritePack: 'simple-admissions',
      stats: { haveVotes: 241, majorityMatches: 198 }
    },
    {
      gameMode: 'would-you-rather',
      gamesPlayed: 131,
      roundsPlayed: 1760,
      totalPlaytimeSeconds: 155_000,
      lastPlayedAt: new Date('2026-06-14T21:15:00.000Z'),
      favouritePack: 'friendship-test',
      stats: { majorityVotes: 138, minorityVotes: 74 }
    },
    {
      gameMode: 'imposter',
      gamesPlayed: 86,
      roundsPlayed: 1050,
      imposterWins: 17,
      imposterGames: 42,
      totalPlaytimeSeconds: 127_000,
      lastPlayedAt: new Date('2026-03-08T22:27:00.000Z'),
      stats: { correctAccusations: 39 }
    },
    {
      gameMode: 'mafia',
      gamesPlayed: 65,
      roundsPlayed: 870,
      totalPlaytimeSeconds: 117_400,
      lastPlayedAt: new Date('2026-02-15T20:02:00.000Z'),
      stats: { wins: 24, correctAccusations: 25 }
    }
  ];

  const achievementOpals = account.gameData.opals.balance;
  assert.ok(achievementOpals < TARGET_LIFETIME_OPALS);
  const legacyEarnAmount = TARGET_LIFETIME_OPALS - achievementOpals;
  account.gameData.opalTransactions.push({
    type: 'earn',
    amount: legacyEarnAmount,
    reason: 'Historical online game rewards',
    sourceType: 'game_reward',
    sourceId: 'legacy-online-history',
    balanceAfter: TARGET_LIFETIME_OPALS,
    metadata: { seededHistory: true },
    notificationPending: false,
    createdAt: new Date('2025-12-05T19:30:00.000Z')
  });

  let balanceAfter = TARGET_LIFETIME_OPALS;
  [
    ['2025-12-19T18:10:00.000Z', 1450, 'Legacy shop purchases 1'],
    ['2026-02-07T16:45:00.000Z', 2300, 'Legacy shop purchases 2'],
    ['2026-04-12T20:25:00.000Z', 1750, 'Legacy shop purchases 3'],
    ['2026-06-03T21:55:00.000Z', 2250, 'Legacy shop purchases 4']
  ].forEach(([date, amount, sourceId]) => {
    balanceAfter -= amount;
    account.gameData.opalTransactions.push({
      type: 'spend',
      amount: -amount,
      reason: 'Historical shop purchases',
      sourceType: 'shop_purchase',
      sourceId,
      balanceAfter,
      metadata: { seededHistory: true },
      notificationPending: false,
      createdAt: new Date(date)
    });
  });
  assert.equal(balanceAfter, TARGET_OPALS);
  account.gameData.opals.balance = TARGET_OPALS;
  account.gameData.opals.lifetimeEarned = TARGET_LIFETIME_OPALS;
  account.gameData.opals.lifetimeSpent = TARGET_LIFETIME_OPALS - TARGET_OPALS;

  account.analytics.featureUsage = new Map([
    ['online-party', 842],
    ['oe-customisation', 31],
    ['shop', 46],
    ['help-hub', 12]
  ]);
  account.analytics.pagesVisitedInsideApp = [
    '/',
    '/party-games',
    '/shop',
    '/account',
    '/oes-customisation',
    '/overexposure',
    '/help'
  ];
  account.analytics.gameModePreferences = new Map([
    ['truth-or-dare', 194],
    ['most-likely-to', 139],
    ['would-you-rather', 131],
    ['paranoia', 126],
    ['never-have-i-ever', 101],
    ['imposter', 86],
    ['mafia', 65]
  ]);
  account.analytics.conversionEvents = [
    {
      event: 'account_created',
      metadata: { seededHistory: true },
      createdAt: CREATED_AT
    },
    {
      event: 'first_online_game',
      metadata: { seededHistory: true },
      createdAt: new Date('2023-07-02T18:20:00.000Z')
    }
  ];
  account.analytics.referralSource = 'direct';
  account.analytics.firstLandingPage = '/';
  account.analytics.cohortDate = CREATED_AT;
  account.analytics.retentionMarkers = {
    day1: true,
    day7: true,
    day30: true,
    year1: true,
    seededHistory: true
  };
  account.analytics.lastSeenAt = LAST_ACTIVE_AT;

  account.legalConsent.termsAcceptedVersion = '2023-06';
  account.legalConsent.privacyPolicyAcceptedVersion = '2023-06';
  account.legalConsent.marketingConsentStatus = 'declined';
  account.legalConsent.ageConfirmation = true;
  account.legalConsent.ageConfirmedAt = CREATED_AT;
  account.legalConsent.dataProcessingRegion = 'GB';

  account.security.passwordChangedAt = CREATED_AT;
  account.security.loginHistory = [
    '2023-06-17T14:40:00.000Z',
    '2024-03-09T20:15:00.000Z',
    '2025-01-18T22:05:00.000Z',
    '2025-11-23T20:40:00.000Z',
    LAST_ACTIVE_AT.toISOString()
  ].map((date) => ({
    provider: 'email',
    approximateLocation: 'United Kingdom',
    device: {
      browser: 'Chrome',
      os: 'Windows',
      deviceType: 'desktop'
    },
    successful: true,
    createdAt: new Date(date)
  }));
  account.security.failedLoginAttempts = 0;
  account.security.lockoutExpiresAt = null;
  account.security.twoFactorEnabled = false;

  account.markModified('profile');
  account.markModified('customisationPreferences');
  account.markModified('access');
  account.markModified('gameData');
  account.markModified('analytics');
  account.markModified('legalConsent');
  account.markModified('security');
}

async function main() {
  if (!process.argv.includes(CONFIRMATION_FLAG)) {
    throw new Error(
      `Refusing to create a live account without ${CONFIRMATION_FLAG}.`
    );
  }

  const password = process.env.OE_TESTER_PASSWORD;
  if (!password) {
    throw new Error('OE_TESTER_PASSWORD must be provided.');
  }

  let accountId = null;
  let complete = false;
  try {
    const { socialUri, accountsUri } = getDatabaseUris();
    await Promise.all([
      socialConnection.openUri(socialUri),
      accountsConnection.openUri(accountsUri)
    ]);
    await AchievementRewardClaim.createIndexes();

    const existingAccount = await Account.findOne({
      $or: [{ username: /^oetester$/i }, { email: EMAIL }]
    }).lean();
    if (existingAccount) {
      throw new Error(
        'An oetester account already exists; nothing was changed.'
      );
    }

    const configuredAchievements = await Achievement.find({
      key: { $in: ACHIEVEMENT_KEYS },
      enabled: true,
      status: 'published'
    })
      .select('key')
      .lean();
    assert.equal(
      configuredAchievements.length,
      ACHIEVEMENT_KEYS.length,
      'Every seeded achievement must be enabled and published.'
    );

    const passwordHash = await bcrypt.hash(password, 12);
    const createdAccount = await Account.create({
      username: USERNAME,
      email: EMAIL,
      passwordHash,
      profile: {
        displayName: 'OE Tester',
        oeIcon: '0000:0100:0200:0300',
        emailVerified: true,
        emailVerifiedAt: new Date('2023-06-18T09:12:00.000Z'),
        accountStatus: 'active'
      },
      access: {
        roles: ['beta_tester'],
        grantedAt: CREATED_AT
      }
    });
    accountId = createdAccount._id;

    const account = await Account.findById(accountId);
    for (const key of ACHIEVEMENT_KEYS) {
      const unlocked = await unlockAchievementByKey({
        Achievement,
        AchievementRewardClaim,
        account,
        key,
        source: 'seeded-test-account',
        progressAtUnlock: 1,
        metadata: { seededHistory: true }
      });
      assert.equal(unlocked?.key, key, `Failed to unlock ${key}.`);
    }

    const historicalAccount = await Account.findById(accountId).select(
      '+passwordHash +security +legalConsent.consentHistory'
    );
    ACHIEVEMENT_KEYS.forEach((key, index) => {
      const unlockedAt = getHistoricalUnlockDate(index);
      const unlock = historicalAccount.gameData.achievements.find(
        (achievement) => achievement.key === key
      );
      const transaction = historicalAccount.gameData.opalTransactions.find(
        (entry) => entry.sourceType === 'achievement' && entry.sourceId === key
      );
      assert.ok(unlock, `Missing persisted unlock for ${key}.`);
      assert.ok(transaction, `Missing Opal transaction for ${key}.`);

      unlock.unlockedAt = unlockedAt;
      unlock.notificationPending = false;
      unlock.notifiedAt = new Date(unlockedAt.getTime() + 60_000);
      unlock.seenAt = new Date(unlockedAt.getTime() + 86_400_000);
      transaction.createdAt = unlockedAt;
      transaction.notificationPending = false;
      transaction.notificationDeliveredAt = new Date(
        unlockedAt.getTime() + 60_000
      );
    });

    setHistoricalAccountData(historicalAccount);
    await historicalAccount.save({ timestamps: false });

    for (let index = 0; index < ACHIEVEMENT_KEYS.length; index += 1) {
      const historicalDate = getHistoricalUnlockDate(index);
      await AchievementRewardClaim.collection.updateOne(
        { accountId, achievementKey: ACHIEVEMENT_KEYS[index] },
        {
          $set: {
            createdAt: historicalDate,
            updatedAt: historicalDate,
            appliedAt: historicalDate,
            leaseExpiresAt: historicalDate
          }
        }
      );
    }

    await Account.collection.updateOne(
      { _id: accountId },
      { $set: { createdAt: CREATED_AT, updatedAt: LAST_ACTIVE_AT } }
    );

    const verifiedAccount = await Account.findById(accountId).select(
      '+passwordHash +security'
    );
    assert.ok(verifiedAccount);
    assert.equal(
      await bcrypt.compare(password, verifiedAccount.passwordHash),
      true
    );
    assert.equal(verifiedAccount.gameData.level, 38);
    assert.equal(verifiedAccount.gameData.xp, TARGET_XP);
    assert.equal(verifiedAccount.gameData.opals.balance, TARGET_OPALS);
    assert.equal(
      verifiedAccount.gameData.achievements.length,
      ACHIEVEMENT_KEYS.length
    );
    assert.equal(
      serializePendingAccountNotifications(verifiedAccount).length,
      0
    );
    assert.equal(
      await AchievementRewardClaim.countDocuments({
        accountId,
        status: 'applied'
      }),
      ACHIEVEMENT_KEYS.length
    );

    complete = true;
    console.log(
      JSON.stringify(
        {
          username: verifiedAccount.username,
          accountId: String(verifiedAccount._id),
          createdAt: verifiedAccount.createdAt,
          level: verifiedAccount.gameData.level,
          xp: verifiedAccount.gameData.xp,
          gamesPlayed: verifiedAccount.gameData.gamesPlayed,
          roundsPlayed: verifiedAccount.gameData.roundsPlayed,
          opals: verifiedAccount.gameData.opals,
          achievementsUnlocked: verifiedAccount.gameData.achievements.length,
          pendingNotifications: 0,
          passwordVerified: true
        },
        null,
        2
      )
    );
  } finally {
    if (accountId && !complete && accountsConnection.readyState === 1) {
      await AchievementRewardClaim.deleteMany({ accountId }).catch(() => {});
      await Account.deleteOne({ _id: accountId }).catch(() => {});
    }
    await Promise.allSettled(
      [accountsConnection, socialConnection]
        .filter((connection) => connection.readyState !== 0)
        .map((connection) => connection.close())
    );
  }
}

main().catch((error) => {
  console.error('Failed to seed OE Tester:', error);
  process.exitCode = 1;
});
