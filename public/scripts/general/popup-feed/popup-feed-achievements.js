(function () {
  function createPopupFeedAchievements({ showPopup }) {
    const rarityConfigPath = '/json-files/achievements/rarities.json';
    const achievementsConfigPath = '/api/achievements';
    const defaultDuration = 4200;
    const opalIconPath = '/images/icons/currency/opal.svg';
    let raritiesPromise = null;
    let achievementsPromise = null;
    let accountNotificationPollTimer = null;
    let accountNotificationRequestRunning = false;
    const displayedAccountNotificationIds = new Set();
    let activeOpalRewardDialog = null;

    function normalizeKey(value) {
      return String(value || '')
        .trim()
        .toLowerCase();
    }

    function getAchievementBorderPath(rarityKey) {
      const normalizedRarity = normalizeKey(rarityKey)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const borderKey =
        normalizedRarity === 'secret' ? 'exposed' : normalizedRarity;
      return `/images/achievements/borders/${borderKey || 'common'}.svg`;
    }

    function getAchievementSoundKey(rarityKey) {
      const specialRarities = new Set([
        'legendary',
        'mythic',
        'exposed',
        'secret'
      ]);
      return specialRarities.has(normalizeKey(rarityKey))
        ? 'notificationAchievementLegendary'
        : 'notificationSuccess';
    }

    function isSignedInAccount(account) {
      return Boolean(account?._id || account?.id || account?.username);
    }

    async function loadRarities() {
      if (!raritiesPromise) {
        raritiesPromise = fetch(rarityConfigPath)
          .then((response) => (response.ok ? response.json() : {}))
          .catch(() => ({}));
      }
      return raritiesPromise;
    }

    async function loadAchievements() {
      if (!achievementsPromise) {
        achievementsPromise = fetch(achievementsConfigPath)
          .then((response) => (response.ok ? response.json() : {}))
          .then((data) => {
            const list = Array.isArray(data?.data?.achievements)
              ? data.data.achievements
              : Array.isArray(data?.achievements)
                ? data.achievements
                : [];
            const achievementsByKey = new Map();
            list.forEach((achievement) => {
              achievementsByKey.set(achievement.key, achievement);
              achievementsByKey.set(normalizeKey(achievement.key), achievement);
            });
            return achievementsByKey;
          })
          .catch(() => new Map());
      }
      return achievementsPromise;
    }

    function setAchievementColours(row, rarity = {}) {
      if (rarity.primaryColour) {
        row.style.setProperty(
          '--achievement-primary-colour',
          rarity.primaryColour
        );
      }
      if (rarity.secondaryColour) {
        row.style.setProperty(
          '--achievement-secondary-colour',
          rarity.secondaryColour
        );
      }
      if (rarity.textColour) {
        row.style.setProperty('--achievement-text-colour', rarity.textColour);
      }
    }

    function createAchievementPopupRow(achievement, rarity = {}) {
      const row = document.createElement('div');
      row.className = 'achievement-popup-row';
      row.dataset.popupType = 'achievement';
      setAchievementColours(row, rarity);

      const iconWrap = document.createElement('div');
      iconWrap.className = 'achievement-popup-icon-wrap';

      const border = document.createElement('img');
      border.className = 'achievement-popup-border';
      border.alt = '';
      border.src =
        achievement.border || getAchievementBorderPath(achievement.rarity);

      const icon = document.createElement('img');
      icon.className = 'achievement-popup-icon';
      icon.alt = '';
      icon.src = achievement.image || '/images/icons/help-icon.svg';
      iconWrap.append(icon, border);

      const content = document.createElement('div');
      content.className = 'achievement-popup-content';

      const label = document.createElement('p');
      label.className = 'achievement-popup-label';
      label.textContent = `${rarity.label || achievement.rarity || 'Achievement'} unlocked`;

      const title = document.createElement('h2');
      title.className = 'achievement-popup-title';
      title.textContent =
        achievement.name || achievement.key || 'Achievement unlocked';

      const description = document.createElement('p');
      description.className = 'achievement-popup-description';
      description.textContent =
        achievement.description || rarity.description || '';

      content.append(label, title);
      if (description.textContent) content.appendChild(description);
      row.append(iconWrap, content);
      return row;
    }

    function createOpalRewardPopupRow(reward) {
      const row = document.createElement('button');
      row.className = 'opal-reward-popup-row';
      row.dataset.popupType = 'opal-reward';
      row.type = 'button';
      row.setAttribute(
        'aria-label',
        `Open Opal reward details for ${reward.amount} Opal`
      );

      const iconWrap = document.createElement('span');
      iconWrap.className = 'opal-reward-popup-icon-wrap';

      const icon = document.createElement('img');
      icon.className = 'opal-reward-popup-icon';
      icon.src = opalIconPath;
      icon.alt = '';
      icon.setAttribute('aria-hidden', 'true');

      iconWrap.appendChild(icon);

      const content = document.createElement('span');
      content.className = 'opal-reward-popup-content';

      const label = document.createElement('span');
      label.className = 'opal-reward-popup-label';
      label.textContent = reward.label || 'Opal received';

      const amount = document.createElement('span');
      amount.className = 'opal-reward-popup-amount';
      amount.textContent = `+${reward.amount} Opal`;

      const reason = document.createElement('span');
      reason.className = 'opal-reward-popup-reason';
      reason.textContent = reward.reason || 'Added to your balance';

      content.append(label, amount, reason);

      const hint = document.createElement('span');
      hint.className = 'opal-reward-popup-hint';
      hint.textContent = 'View';

      row.append(iconWrap, content, hint);
      row.addEventListener('click', () => {
        openOpalRewardDialog(reward);
      });

      return row;
    }

    function closeOpalRewardDialog() {
      if (!activeOpalRewardDialog) return;
      const dialogHost = activeOpalRewardDialog;
      activeOpalRewardDialog = null;
      if (typeof window.closeOeDialog === 'function') {
        window.closeOeDialog(dialogHost);
        return;
      }
      dialogHost.close();
    }

    function openOpalRewardDialog(reward) {
      closeOpalRewardDialog();

      const dialogHost = document.createElement('dialog');
      dialogHost.className = 'opal-reward-dialog-host oe-dialog';
      dialogHost.setAttribute('aria-labelledby', 'opal-reward-dialog-label');

      const dialog = document.createElement('section');
      dialog.className = 'opal-reward-dialog';
      dialog.tabIndex = -1;

      const iconHalo = document.createElement('div');
      iconHalo.className = 'opal-reward-dialog-icon-halo';

      const icon = document.createElement('img');
      icon.className = 'opal-reward-dialog-icon';
      icon.src = opalIconPath;
      icon.alt = '';
      icon.setAttribute('aria-hidden', 'true');
      iconHalo.appendChild(icon);

      const label = document.createElement('p');
      label.className = 'opal-reward-dialog-label';
      label.id = 'opal-reward-dialog-label';
      label.textContent = reward.label || 'Opal received';

      const summary = document.createElement('div');
      summary.className = 'opal-reward-dialog-summary';

      const oldBalance = Math.max(0, reward.balance - reward.amount);
      [
        ['Amount received', reward.amount],
        ['Old balance', oldBalance],
        ['New balance', reward.balance]
      ].forEach(([rowLabel, value]) => {
        const row = document.createElement('div');
        row.className = 'opal-reward-dialog-summary-row';

        const text = document.createElement('span');
        text.className = 'opal-reward-dialog-summary-label';
        text.textContent = rowLabel;

        const valueWrap = document.createElement('span');
        valueWrap.className = 'opal-reward-dialog-summary-value';

        const valueIcon = document.createElement('img');
        valueIcon.className = 'opal-reward-dialog-summary-icon';
        valueIcon.src = opalIconPath;
        valueIcon.alt = '';
        valueIcon.setAttribute('aria-hidden', 'true');

        const valueText = document.createElement('span');
        valueText.textContent = value.toLocaleString();

        valueWrap.append(valueIcon, valueText);
        row.append(text, valueWrap);
        summary.appendChild(row);

        if (rowLabel === 'Old balance') {
          const separator = document.createElement('div');
          separator.className = 'opal-reward-dialog-summary-separator';
          separator.setAttribute('aria-hidden', 'true');
          summary.appendChild(separator);
        }
      });

      dialog.append(label, iconHalo, summary);
      dialogHost.appendChild(dialog);
      document.body.appendChild(dialogHost);
      activeOpalRewardDialog = dialogHost;
      window.OeDialog?.register(dialogHost, {
        onClose: () => dialogHost.remove()
      });
      if (typeof window.openOeDialog === 'function') {
        window.openOeDialog(dialogHost, {
          initialFocus: '.opal-reward-dialog'
        });
      } else {
        dialogHost.showModal();
        dialog.focus({ preventScroll: true });
      }
    }

    function showOpalRewardPopup(rewardInput = {}) {
      const amount = Math.max(1, Math.trunc(Number(rewardInput.amount) || 0));
      const reward = {
        amount,
        balance: Math.max(amount, Math.trunc(Number(rewardInput.balance) || 0)),
        label: rewardInput.label || 'Opal received',
        reason: rewardInput.reason || 'Login reward received'
      };
      const row = createOpalRewardPopupRow(reward);
      return showPopup(row, {
        duration: Number(rewardInput.duration) || 10000,
        slideInSound: 'notificationSuccess'
      });
    }

    async function showAchievementPopup(achievementInput = {}) {
      const account = getStoredAccountSafely();
      if (!isSignedInAccount(account)) return null;

      const [rarities, achievementsByKey] = await Promise.all([
        loadRarities(),
        loadAchievements()
      ]);
      const achievement =
        achievementsByKey.get(achievementInput.key) ||
        achievementsByKey.get(normalizeKey(achievementInput.key)) ||
        achievementInput;
      const rarityKey = normalizeKey(
        achievement.rarity || achievementInput.rarity || 'common'
      );
      const rarity = rarities[rarityKey] || rarities.common || {};
      const row = createAchievementPopupRow(
        {
          ...achievement,
          rarity: rarityKey
        },
        rarity
      );
      return showPopup(row, {
        duration: Number(rarity.popUpDuration) || defaultDuration,
        slideInSound: getAchievementSoundKey(rarityKey)
      });
    }

    function getStoredAccountSafely() {
      try {
        return JSON.parse(localStorage.getItem('oe-account')) || null;
      } catch {
        return null;
      }
    }

    async function acknowledgeAccountNotifications(notificationIds) {
      if (!notificationIds.length) return;

      const response = await fetch('/api/accounts/me/notifications', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds })
      });
      if (!response.ok) {
        throw new Error('Account notification acknowledgement failed');
      }
    }

    async function showAccountNotification(notification) {
      if (notification.type === 'achievement_unlocked') {
        return showAchievementPopup({
          key: notification.achievementKey
        });
      }
      if (notification.type === 'opal_reward') {
        return showOpalRewardPopup(notification);
      }
      return null;
    }

    async function showAccountNotifications(notifications) {
      const shownIds = [];
      const achievementNotificationKeys = new Set(
        notifications
          .filter(
            (notification) => notification?.type === 'achievement_unlocked'
          )
          .map((notification) => normalizeKey(notification?.achievementKey))
          .filter(Boolean)
      );

      for (const notification of notifications) {
        const id = String(notification?.id || '');
        if (!id || displayedAccountNotificationIds.has(id)) continue;

        displayedAccountNotificationIds.add(id);
        if (
          notification?.type === 'opal_reward' &&
          normalizeKey(notification?.sourceType) === 'achievement' &&
          achievementNotificationKeys.has(normalizeKey(notification?.sourceId))
        ) {
          shownIds.push(id);
          continue;
        }

        const row = await showAccountNotification(notification);
        if (row) shownIds.push(id);
      }
      return shownIds;
    }

    async function checkAccountNotifications() {
      const account = getStoredAccountSafely();
      if (!isSignedInAccount(account) || accountNotificationRequestRunning)
        return;

      accountNotificationRequestRunning = true;
      try {
        const response = await fetch('/api/accounts/me/notifications', {
          cache: 'no-store',
          credentials: 'same-origin'
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.success === false) return;

        const notifications = Array.isArray(payload?.data?.notifications)
          ? payload.data.notifications
          : Array.isArray(payload?.notifications)
            ? payload.notifications
            : [];
        const shownIds = await showAccountNotifications(notifications);

        if (shownIds.length) {
          await acknowledgeAccountNotifications(shownIds);
        }
      } catch (error) {
        console.warn(error);
      } finally {
        accountNotificationRequestRunning = false;
      }
    }

    async function handleLiveAccountNotifications(notifications) {
      const shownIds = await showAccountNotifications(
        Array.isArray(notifications) ? notifications : []
      );
      if (shownIds.length) {
        await acknowledgeAccountNotifications(shownIds);
      }
      return shownIds;
    }

    function startAccountNotificationPolling() {
      if (accountNotificationPollTimer) return;
      window.setTimeout(checkAccountNotifications, 1500);
      accountNotificationPollTimer = window.setInterval(
        checkAccountNotifications,
        30000
      );
    }

    return {
      showAchievementPopup,
      showOpalRewardPopup,
      showAccountNotifications,
      handleLiveAccountNotifications,
      checkAccountNotifications,
      startAccountNotificationPolling,
      clearAccountNotifications() {
        displayedAccountNotificationIds.clear();
      },
      getStoredAccountSafely,
      isSignedInAccount
    };
  }

  window.createPopupFeedAchievements = createPopupFeedAchievements;
})();
