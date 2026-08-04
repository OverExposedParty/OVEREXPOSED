(function () {
  const achievementsConfigPath = '/api/achievements';
  const eggsConfigPath = '/api/olings/eggs';
  let achievementLibraryPromise = null;
  let eggLibraryPromise = null;

  function normaliseAchievementKey(value) {
    return String(value || '')
      .trim()
      .toLowerCase();
  }

  async function loadAchievementLibrary() {
    if (!achievementLibraryPromise) {
      achievementLibraryPromise = fetch(achievementsConfigPath)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Unable to load achievements (${response.status})`);
          }
          return response.json();
        })
        .then((data) =>
          Array.isArray(data?.data?.achievements)
            ? data.data.achievements
            : Array.isArray(data?.achievements)
              ? data.achievements
              : []
        );
    }

    return achievementLibraryPromise;
  }

  function findAchievementByKey(achievements, key) {
    const normalisedKey = normaliseAchievementKey(key);
    return achievements.find(
      (achievement) =>
        normaliseAchievementKey(achievement.key) === normalisedKey
    );
  }

  async function loadEggLibrary() {
    if (!eggLibraryPromise) {
      eggLibraryPromise = fetch(eggsConfigPath)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Unable to load Oling eggs (${response.status})`);
          }
          return response.json();
        })
        .then((data) =>
          Array.isArray(data?.data?.eggs)
            ? data.data.eggs
            : Array.isArray(data?.eggs)
              ? data.eggs
              : []
        );
    }
    return eggLibraryPromise;
  }

  function getEggImage(egg) {
    if (egg?.assets?.image) return egg.assets.image;
    const setName = egg?.collection || egg?.key;
    return setName ? `/images/olings/eggs/${setName}/egg.svg` : '';
  }

  function getAchievementPreviewRewards(achievement) {
    if (Array.isArray(achievement?.rewardResults)) {
      return achievement.rewardResults;
    }

    if (!Array.isArray(achievement?.rewards)) return [];
    return achievement.rewards.map((reward) => ({
      ...reward,
      granted: reward?.granted !== false
    }));
  }

  async function showTestAchievement(achievement) {
    const achievementPreview = {
      ...achievement,
      rewardResults: getAchievementPreviewRewards(achievement)
    };

    if (typeof window.showAchievementPopup === 'function') {
      return window.showAchievementPopup(achievementPreview);
    }

    window.dispatchEvent(
      new CustomEvent('oe-achievement-unlocked', {
        detail: { achievement: achievementPreview }
      })
    );
    return null;
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function runAchievementCommand({ command, writeConsole }) {
    const action = normaliseAchievementKey(command.args[0]);
    const achievements = await loadAchievementLibrary();

    if (achievements.length === 0) {
      writeConsole('No achievements are available to test.', 'error');
      return;
    }

    if (action === 'list') {
      writeConsole(
        achievements
          .map((achievement) => achievement.key)
          .filter(Boolean)
          .join(', ')
      );
      return;
    }

    writeConsole(
      'Invalid achievement command. Usage: /achievement list',
      'error'
    );
  }

  function getStoredAccount() {
    try {
      return JSON.parse(localStorage.getItem('oe-account')) || null;
    } catch {
      return null;
    }
  }

  async function runAchievementNotificationTest(
    target,
    delayInput,
    writeConsole
  ) {
    const achievements = await loadAchievementLibrary();
    const delayMs = Math.max(250, Number(delayInput) || 900);

    if (achievements.length === 0) {
      writeConsole('No achievements are available to test.', 'error');
      return;
    }

    if (normaliseAchievementKey(target) === 'all') {
      writeConsole(`Testing ${achievements.length} achievements.`);
      for (const achievement of achievements) {
        const row = await showTestAchievement(achievement);
        if (!row) {
          writeConsole(
            'Achievement popup did not show. Make sure you are signed in.',
            'error'
          );
          return;
        }
        await wait(delayMs);
      }
      writeConsole('Achievement popup test complete.');
      return;
    }

    const achievement = findAchievementByKey(achievements, target);
    if (!achievement) {
      writeConsole(
        `Achievement not found: ${target || '(missing key)'}`,
        'error'
      );
      return;
    }

    const row = await showTestAchievement(achievement);
    if (!row) {
      writeConsole(
        'Achievement popup did not show. Make sure you are signed in.',
        'error'
      );
      return;
    }
    writeConsole(`Testing achievement: ${achievement.name || achievement.key}`);
  }

  async function getFriendRequestTestPlayer(username) {
    const requestedUsername = String(username || '').trim();
    if (!requestedUsername) {
      const account = getStoredAccount();
      return {
        accountId: account?.id || account?._id || 'notification-test-player',
        username: account?.username || 'Test Player',
        oeIcon: account?.oeIcon || ''
      };
    }

    const response = await fetch(
      `/api/accounts/friends/search?username=${encodeURIComponent(requestedUsername)}`,
      { credentials: 'same-origin' }
    );
    const payload = await response.json().catch(() => ({}));
    const player = payload?.data?.player || payload?.player;
    if (!response.ok || !player) {
      throw new Error(
        payload?.error?.message || `Player not found: ${requestedUsername}`
      );
    }
    return player;
  }

  async function runNotificationTestCommand({ command, writeConsole }) {
    const action = normaliseAchievementKey(command.args[0]);
    const notificationType = normaliseAchievementKey(command.args[1]);

    if (action !== 'test') {
      writeConsole(
        'Invalid notification command. Usage: /notification test <achievement|opals|friend-request|friend-accepted|incubator-ready|account-prompt|party-disbanded|email-verified>',
        'error'
      );
      return;
    }

    if (notificationType === 'achievement') {
      await runAchievementNotificationTest(
        command.args[2] || '',
        command.args[3],
        writeConsole
      );
      return;
    }

    if (notificationType === 'opals') {
      if (typeof window.showOpalRewardPopup !== 'function') {
        writeConsole('Opal notifications are unavailable.', 'error');
        return;
      }

      const amount = Math.max(
        1,
        Math.min(999999, Math.trunc(Number(command.args[2]) || 25))
      );
      window.showOpalRewardPopup({
        amount,
        balance: amount,
        label: 'Opal notification test',
        reason: 'Preview only. No Opals were granted.'
      });
      writeConsole(`Testing Opal notification for ${amount} Opal.`);
      return;
    }

    if (
      notificationType === 'friend-request' ||
      notificationType === 'friend-accepted'
    ) {
      const showNotification =
        notificationType === 'friend-accepted'
          ? window.showFriendAcceptedPopup
          : window.showFriendRequestPopup;
      if (typeof showNotification !== 'function') {
        writeConsole('Friend notifications are unavailable.', 'error');
        return;
      }

      try {
        const player = await getFriendRequestTestPlayer(command.args[2]);
        showNotification(player);
        writeConsole(
          `Testing ${notificationType} notification from ${player.username}.`
        );
      } catch (error) {
        writeConsole(
          error.message || 'Friend notification test failed.',
          'error'
        );
      }
      return;
    }

    if (notificationType === 'incubator-ready') {
      if (typeof window.showIncubatorReadyPopup !== 'function') {
        writeConsole('Incubator notifications are unavailable.', 'error');
        return;
      }
      const eggKey = normaliseAchievementKey(command.args[2]);
      if (!eggKey) {
        writeConsole(
          'Missing egg type. Usage: /notification test incubator-ready [egg-type]',
          'error'
        );
        return;
      }
      const eggs = await loadEggLibrary();
      const egg = eggs.find(
        (item) => normaliseAchievementKey(item?.key) === eggKey
      );
      if (!egg) {
        writeConsole(`Egg type not found: ${eggKey}`, 'error');
        return;
      }
      window.showIncubatorReadyPopup({
        id: `incubator-ready-test:${egg.key}`,
        eggKey: egg.key,
        eggName: egg.name || egg.key,
        image: getEggImage(egg)
      });
      writeConsole(
        `Testing incubator-ready notification for ${egg.name || egg.key}.`
      );
      return;
    }

    if (notificationType === 'account-prompt') {
      if (typeof window.showAccountPromptPopup !== 'function') {
        writeConsole('Account prompt notification is unavailable.', 'error');
        return;
      }

      window.showAccountPromptPopup({ force: true });
      writeConsole('Testing account prompt notification.');
      return;
    }

    if (notificationType === 'email-verified') {
      if (typeof window.showEmailVerificationSuccessPopup !== 'function') {
        writeConsole(
          'Email verification notification is unavailable.',
          'error'
        );
        return;
      }

      window.showEmailVerificationSuccessPopup();
      writeConsole('Testing email verified notification.');
      return;
    }

    if (notificationType === 'party-disbanded') {
      if (typeof window.showPartyNotificationPopup !== 'function') {
        writeConsole('Party notifications are unavailable.', 'error');
        return;
      }

      const account = getStoredAccount();
      window.showPartyNotificationPopup({
        id: `notification-test:party-disbanded:${Date.now()}`,
        type: 'party_disbanded',
        partyId: 'TEST',
        modeName: 'Party Games',
        actorAccountId: account?.id || account?._id || '',
        actorUsername: account?.username || 'Party host',
        actorOeIcon: account?.oeIcon || ''
      });
      writeConsole('Testing party disbanded notification.');
      return;
    }

    writeConsole(
      'Notification type not found. Use achievement, opals, friend-request, friend-accepted, incubator-ready, account-prompt, party-disbanded, or email-verified.',
      'error'
    );
  }

  window.OverexposedCommands?.registerCommandPack({
    id: 'global',
    commands: {
      achievement: {
        adminOnly: true,
        description: 'List achievement keys. Usage: /achievement list',
        suggestions: ['/achievement list'],
        run: runAchievementCommand
      },
      notification: {
        adminOnly: true,
        description:
          'Test notification popups. Opal usage: /notification test opals [amount]',
        suggestions: [
          '/notification test achievement',
          '/notification test achievement all',
          '/notification test opals',
          '/notification test opals 100',
          '/notification test friend-request',
          '/notification test friend-accepted',
          '/notification test account-prompt',
          '/notification test email-verified',
          '/notification test party-disbanded',
          '/notification test incubator-ready base-egg'
        ],
        getSuggestions: async () => {
          const [achievements, eggs] = await Promise.all([
            loadAchievementLibrary(),
            loadEggLibrary()
          ]);
          return [
            '/notification test account-prompt',
            '/notification test email-verified',
            '/notification test party-disbanded',
            '/notification test opals',
            '/notification test opals 100',
            ...achievements
              .map((achievement) => achievement.key)
              .filter(Boolean)
              .map((key) => `/notification test achievement ${key}`),
            ...eggs
              .map((egg) => egg.key)
              .filter(Boolean)
              .map((key) => `/notification test incubator-ready ${key}`)
          ];
        },
        run: runNotificationTestCommand
      }
    }
  });
})();
