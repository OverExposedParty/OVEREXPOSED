const UNSAFE_PACK_STAT_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype'
]);
const {
  getAccountNotificationIds,
  serializeQueuedProgressionNotifications
} = require('../../../services/account-notifications');
const {
  shouldTrackStandardAccountProgress
} = require('../../../../models/content/standard-account-content');

function getCompletedGamePackKeys(selectedPacks = []) {
  if (!Array.isArray(selectedPacks)) return [];

  return Array.from(
    new Set(
      selectedPacks
        .filter((pack) => typeof pack === 'string')
        .map((pack) => pack.trim())
        .filter(
          (pack) =>
            pack.length > 0 &&
            pack.length <= 200 &&
            !UNSAFE_PACK_STAT_KEYS.has(pack)
        )
    )
  );
}

function recordCompletedGamePacks(gameStats, selectedPacks = []) {
  const packKeys = getCompletedGamePackKeys(selectedPacks);
  if (packKeys.length === 0) return;

  const existingCounts =
    gameStats.packPlayCounts &&
    typeof gameStats.packPlayCounts === 'object' &&
    !Array.isArray(gameStats.packPlayCounts)
      ? gameStats.packPlayCounts
      : {};
  const packPlayCounts = {};

  Object.entries(existingCounts).forEach(([pack, count]) => {
    if (!UNSAFE_PACK_STAT_KEYS.has(pack)) {
      packPlayCounts[pack] = Math.max(0, Math.floor(Number(count) || 0));
    }
  });

  packKeys.forEach((pack) => {
    packPlayCounts[pack] = (packPlayCounts[pack] || 0) + 1;
  });

  const highestCount = Math.max(0, ...Object.values(packPlayCounts));
  const leadingPacks = Object.keys(packPlayCounts).filter(
    (pack) => packPlayCounts[pack] === highestCount
  );
  const currentFavourite = String(gameStats.favouritePack || '');

  gameStats.packPlayCounts = packPlayCounts;
  gameStats.favouritePack = leadingPacks.includes(currentFavourite)
    ? currentFavourite
    : packKeys.find((pack) => leadingPacks.includes(pack)) ||
      leadingPacks[0] ||
      null;
}

function createPartyActionStatEventTools(context) {
  const {
    Account,
    Achievement,
    partyGameEventSchema,
    incrementAchievementStat,
    recordAchievementCollectionItems,
    recordAchievementPlayDate,
    recordMostLikelyToResult,
    recordNeverHaveIEverResult,
    recordParanoiaResult,
    recordTruthOrDarePromptResult,
    unlockAchievementByKey,
    unlockEligiblePartyAchievements
  } = context;

  async function applyPartyAccountStatEvent(event) {
    if (
      !Account ||
      !event?.gameMode ||
      !Array.isArray(event.increments) ||
      !shouldTrackStandardAccountProgress({
        gamemode: event.gameMode,
        feature: event.feature
      })
    ) {
      return [];
    }

    const deliveries = await Promise.all(
      event.increments.map(async ({ accountId, paths }) => {
        if (!accountId || !paths || typeof paths !== 'object') return null;

        const account = await Account.findById(accountId);
        if (!account) return null;
        const existingNotificationIds = getAccountNotificationIds(account);

        if (!account.gameData) {
          account.gameData = {};
        }

        if (!Array.isArray(account.gameData.perGameStats)) {
          account.gameData.perGameStats = [];
        }

        let gameStats = account.gameData.perGameStats.find(
          (stats) => stats.gameMode === event.gameMode
        );

        if (!gameStats) {
          account.gameData.perGameStats.push({ gameMode: event.gameMode });
          gameStats =
            account.gameData.perGameStats[
              account.gameData.perGameStats.length - 1
            ];
        }

        Object.entries(paths).forEach(([path, amount]) => {
          if (!amount || path.startsWith('achievement.')) return;

          const segments = path.split('.');
          let target = gameStats;

          while (segments.length > 1) {
            const segment = segments.shift();
            if (!target[segment] || typeof target[segment] !== 'object') {
              target[segment] = {};
            }
            target = target[segment];
          }

          const key = segments[0];
          target[key] = (Number(target[key]) || 0) + amount;
        });

        if (Array.isArray(event.streaks)) {
          event.streaks
            .filter((streak) => String(streak.accountId) === String(accountId))
            .forEach((streak) => {
              if (!gameStats.stats || typeof gameStats.stats !== 'object') {
                gameStats.stats = {};
              }

              if (streak.type === 'have') {
                gameStats.stats.currentHaveStreak =
                  (Number(gameStats.stats.currentHaveStreak) || 0) + 1;
                gameStats.stats.currentHaveNotStreak = 0;
                gameStats.stats.longestHaveStreak = Math.max(
                  Number(gameStats.stats.longestHaveStreak) || 0,
                  gameStats.stats.currentHaveStreak
                );
              } else if (streak.type === 'haveNot') {
                gameStats.stats.currentHaveNotStreak =
                  (Number(gameStats.stats.currentHaveNotStreak) || 0) + 1;
                gameStats.stats.currentHaveStreak = 0;
                gameStats.stats.longestHaveNotStreak = Math.max(
                  Number(gameStats.stats.longestHaveNotStreak) || 0,
                  gameStats.stats.currentHaveNotStreak
                );
              }
            });
        }

        gameStats.lastPlayedAt = new Date();
        account.gameData.roundsPlayed =
          (Number(account.gameData.roundsPlayed) || 0) +
          (Number(paths.roundsPlayed) || 0);
        account.gameData.gamesPlayed =
          (Number(account.gameData.gamesPlayed) || 0) +
          (Number(paths.gamesPlayed) || 0);
        account.gameData.totalPlaytimeSeconds =
          (Number(account.gameData.totalPlaytimeSeconds) || 0) +
          Math.max(0, Math.floor(Number(paths.totalPlaytimeSeconds) || 0));
        if (Number(paths.gamesPlayed) > 0) {
          await incrementAchievementStat({
            Achievement,
            account,
            statKey: 'onlineGamesPlayed',
            amount: Number(paths.gamesPlayed),
            source: 'online-game-completed',
            save: false
          });
          await unlockAchievementByKey({
            Achievement,
            account,
            key: 'first-steps',
            source: 'online-game-completed',
            progressAtUnlock: account.gameData.gamesPlayed,
            save: false
          });
        }
        if (Number(paths['achievement.hostedParties']) > 0) {
          await incrementAchievementStat({
            Achievement,
            account,
            statKey: 'hostedParties',
            amount: Number(paths['achievement.hostedParties']),
            source: 'online-party-hosted',
            save: false
          });
        }
        if (Number(paths['achievement.completedParty']) > 0) {
          recordCompletedGamePacks(gameStats, event.selectedPacks);
          await recordAchievementCollectionItems({
            Achievement,
            account,
            statKey: 'differentPacksPlayed',
            items: (event.selectedPacks || []).map(
              (pack) => `${event.gameMode}:${pack}`
            ),
            source: 'online-pack-played',
            save: false
          });
          await recordAchievementPlayDate({
            Achievement,
            account,
            playedAt: gameStats.lastPlayedAt,
            source: 'online-game-completed',
            save: false
          });
          await recordAchievementCollectionItems({
            Achievement,
            account,
            statKey: 'socialButterfly',
            items: (event.participantAccountIds || []).filter(
              (accountId) => String(accountId) !== String(account._id)
            ),
            source: 'online-players-met',
            save: false
          });
          if (
            Number(event.playerCount) > 0 &&
            Number(event.playerCount) === Number(event.maxPlayers)
          ) {
            await unlockAchievementByKey({
              Achievement,
              account,
              key: 'full-house',
              source: 'max-capacity-party',
              save: false
            });
          }
          const localHour = Number(event.localHour);
          if (Number.isInteger(localHour) && localHour >= 0 && localHour < 5) {
            await incrementAchievementStat({
              Achievement,
              account,
              statKey: 'nightShift',
              source: 'late-night-game',
              save: false
            });
          }
          if (Number(event.playerCount) === 2 && localHour === 3) {
            await incrementAchievementStat({
              Achievement,
              account,
              statKey: 'isAnyoneHome',
              amount: 2,
              source: 'two-player-3am-game',
              save: false
            });
          }
        }
        if (Number(paths['achievement.marathonSession']) > 0) {
          await incrementAchievementStat({
            Achievement,
            account,
            statKey: 'marathonSession',
            amount: Number(paths['achievement.marathonSession']),
            source: 'marathon-session',
            save: false
          });
        }
        if (Number(paths['achievement.noSkipsGiven']) > 0) {
          await unlockAchievementByKey({
            Achievement,
            account,
            key: 'no-skips-given',
            source: 'no-skips-game-complete',
            save: false
          });
        }
        if (Number(paths['achievement.theComeback']) > 0) {
          await unlockAchievementByKey({
            Achievement,
            account,
            key: 'the-comeback',
            source: 'comeback-win',
            save: false
          });
        }
        if (Number(paths['achievement.theOrganiser']) > 0) {
          await unlockAchievementByKey({
            Achievement,
            account,
            key: 'the-organiser',
            source: 'quick-party-start',
            save: false
          });
        }
        if (Number(paths['achievement.truthOrDarePromptSkipped']) > 0) {
          await recordTruthOrDarePromptResult({
            Achievement,
            account,
            result: 'skip',
            save: false
          });
        }
        if (Number(paths['achievement.truthOrDareTruthCompleted']) > 0) {
          await recordTruthOrDarePromptResult({
            Achievement,
            account,
            result: 'truth',
            save: false
          });
        }
        if (Number(paths['achievement.truthOrDareDareCompleted']) > 0) {
          await recordTruthOrDarePromptResult({
            Achievement,
            account,
            result: 'dare',
            isNsfw: Number(paths['achievement.nsfwDareCompleted']) > 0,
            save: false
          });
        }
        if (event.achievementData?.type?.startsWith('most-likely-to-')) {
          await recordMostLikelyToResult({
            Achievement,
            account,
            result: event.achievementData,
            partyId: event.partyId,
            gameId: event.gameId,
            playSequence: event.playSequence,
            save: false
          });
        }
        if (event.achievementData?.type?.startsWith('never-have-i-ever-')) {
          await recordNeverHaveIEverResult({
            Achievement,
            account,
            result: event.achievementData,
            save: false
          });
        }
        if (event.achievementData?.type?.startsWith('paranoia-')) {
          await recordParanoiaResult({
            Achievement,
            account,
            result: event.achievementData,
            partyId: event.partyId,
            save: false
          });
        }
        account.gameData.lastActiveGameMode = event.gameMode;
        account.gameData.lastPlayedAt = gameStats.lastPlayedAt;
        await unlockEligiblePartyAchievements(account, gameStats, event);
        account.markModified('gameData.perGameStats');

        await account.save();
        const notifications = serializeQueuedProgressionNotifications(account, {
          excludeIds: existingNotificationIds
        });
        return notifications.length
          ? {
              accountId: String(account._id || accountId),
              notifications
            }
          : null;
      })
    );
    return deliveries.filter(Boolean);
  }

  async function applyPartyAccountStatEvents(events = [], eventContext = {}) {
    if (!Array.isArray(events) || events.length === 0) return [];

    const deliveries = [];
    for (const [index, event] of events.entries()) {
      if (
        !shouldTrackStandardAccountProgress({
          gamemode: event?.gameMode,
          feature: event?.feature
        })
      ) {
        continue;
      }
      const actionEventKey = String(
        event.eventKey ??
          eventContext.eventId ??
          `${eventContext.action}:${eventContext.phase ?? 'none'}:${eventContext.playerTurn ?? 'none'}:${index}`
      );
      const eventKey = `${Math.max(
        0,
        Number(eventContext.playSequence) || 0
      )}:${actionEventKey}`;
      try {
        await partyGameEventSchema.create({
          partyId: eventContext.partyId,
          gameId: eventContext.gameId || null,
          eventKey,
          gamemode: event.gameMode,
          action: eventContext.action
        });
      } catch (error) {
        if (error?.code === 11000) continue;
        throw error;
      }
      deliveries.push(
        ...(await applyPartyAccountStatEvent({
          ...event,
          partyId: eventContext.partyId,
          gameId: eventContext.gameId,
          playSequence: eventContext.playSequence
        }))
      );
    }
    return deliveries;
  }

  return {
    applyPartyAccountStatEvent,
    applyPartyAccountStatEvents
  };
}

module.exports = { createPartyActionStatEventTools };
