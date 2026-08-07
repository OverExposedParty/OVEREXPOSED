function normaliseAccountAchievementKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function normalizeAccountAchievementData(achievement) {
  const key = normaliseAccountAchievementKey(achievement?.key);
  if (!accountExposedAchievementKeys.has(key)) return achievement;

  return {
    ...achievement,
    rarity: 'secret',
    hidden: true,
    tags: [...new Set([...(achievement.tags || []), 'hidden'])]
  };
}

function getAccountAchievementUnlocks(account) {
  const achievements = account?.gameData?.achievements;
  return Array.isArray(achievements) ? achievements : [];
}

async function loadAccountAchievements() {
  if (!accountAchievementsPromise) {
    accountAchievementsPromise = fetch(accountAchievementsConfigPath, {
      cache: 'no-store'
    })
      .then((response) => (response.ok ? response.json() : {}))
      .then((data) => {
        const catalog = Array.isArray(data?.data?.rewardCatalog)
          ? data.data.rewardCatalog
          : [];
        accountAchievementRewardCatalog = new Map(
          catalog.map((item) => [
            `${normaliseAccountAchievementKey(
              item?.type
            )}:${normaliseAccountAchievementKey(item?.key)}`,
            item
          ])
        );

        return Array.isArray(data?.data?.achievements)
          ? data.data.achievements.map(normalizeAccountAchievementData)
          : Array.isArray(data?.achievements)
            ? data.achievements.map(normalizeAccountAchievementData)
            : [];
      })
      .catch((error) => {
        console.warn(error);
        return [];
      });
  }

  return accountAchievementsPromise;
}

async function loadAccountAchievementRarities() {
  if (!accountAchievementRaritiesPromise) {
    accountAchievementRaritiesPromise = fetch(accountAchievementRaritiesPath, {
      cache: 'no-store'
    })
      .then((response) => (response.ok ? response.json() : {}))
      .catch((error) => {
        console.warn(error);
        return {};
      });
  }

  return accountAchievementRaritiesPromise;
}

function getAccountAchievementBorderPath(rarityKey) {
  const normalizedRarity = normaliseAccountAchievementKey(rarityKey)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const borderKey =
    normalizedRarity === 'secret' ? 'exposed' : normalizedRarity;
  return `/images/achievements/borders/${borderKey || 'common'}.svg`;
}

function createAccountAchievementSummary(unlocks, totalAchievements) {
  const section = createAccountProfileSection('Overview');
  section.append(
    createAccountProfileRow('Unlocked', formatAccountNumber(unlocks.length)),
    createAccountProfileRow(
      'Completion',
      totalAchievements
        ? formatAccountRatioPercent(unlocks.length, totalAchievements)
        : '0%'
    )
  );
  return section;
}

function getAccountAchievementLockedDescription(achievement) {
  const rarity = normaliseAccountAchievementKey(achievement.rarity);
  if (achievement.hidden || rarity === 'secret' || rarity === 'exposed') {
    return '???';
  }

  const requirements = String(achievement.metadata?.requirements || '').trim();
  if (requirements && requirements !== '-') return requirements;

  return achievement.description || 'Keep playing to unlock this achievement';
}

function isAccountAchievementHiddenWhileLocked(achievement, unlock) {
  if (unlock) return false;

  const rarity = normaliseAccountAchievementKey(achievement?.rarity);
  return achievement?.hidden || rarity === 'secret' || rarity === 'exposed';
}

function getAccountNestedValue(source, path) {
  if (!source || !path) return null;

  return String(path)
    .split('.')
    .reduce((target, segment) => {
      if (target === null || target === undefined) return null;
      return target[segment];
    }, source);
}

function getAccountPerGameStatValue(account, statPath) {
  const match = String(statPath || '').match(
    /^gameData\.perGameStats\.([^.]+)\.(.+)$/
  );
  if (!match) return null;

  const [, gameMode, innerPath] = match;
  const perGameStats = Array.isArray(account?.gameData?.perGameStats)
    ? account.gameData.perGameStats
    : [];
  const gameStats = perGameStats.find((stats) => stats.gameMode === gameMode);
  return getAccountNestedValue(gameStats, innerPath);
}

function getAccountPerGameStats(account, gameMode) {
  const perGameStats = Array.isArray(account?.gameData?.perGameStats)
    ? account.gameData.perGameStats
    : [];
  return perGameStats.find((stats) => stats.gameMode === gameMode) || null;
}

function getAccountTotalUnlockedItems(account, types = []) {
  const allowedTypes = new Set(types);
  const unlocks = Array.isArray(account?.gameData?.inGamePurchasesAndUnlocks)
    ? account.gameData.inGamePurchasesAndUnlocks
    : [];
  return unlocks.filter((unlock) => allowedTypes.has(unlock.type)).length;
}

function getAccountFriendCount(account) {
  const relationships = Array.isArray(account?.gameData?.friendsAndBlockedUsers)
    ? account.gameData.friendsAndBlockedUsers
    : [];
  return relationships.filter(
    (relationship) => relationship.status === 'friends'
  ).length;
}

function getAccountDifferentPacksPlayed(account) {
  const perGameStats = Array.isArray(account?.gameData?.perGameStats)
    ? account.gameData.perGameStats
    : [];
  const packs = new Set();

  perGameStats.forEach((gameStats) => {
    const packPlayCounts = gameStats?.packPlayCounts || {};
    Object.entries(packPlayCounts).forEach(([pack, count]) => {
      if ((Number(count) || 0) > 0) packs.add(pack);
    });
  });

  return packs.size;
}

function getAccountAchievementDerivedProgress(account, achievement) {
  const chainKey = String(achievement?.metadata?.chainKey || '').toLowerCase();
  const statKey = String(achievement?.statKey || '').toLowerCase();

  if (chainKey === 'online-games-played') {
    return account?.gameData?.gamesPlayed;
  }

  if (chainKey === 'packs-owned') {
    return getAccountTotalUnlockedItems(account, ['pack', 'cosmetic', 'oe']);
  }

  if (chainKey === 'friends-added') {
    return getAccountFriendCount(account);
  }

  if (chainKey === 'different-packs-played') {
    return getAccountDifferentPacksPlayed(account);
  }

  if (chainKey === 'prompts-skipped') {
    const stats = getAccountPerGameStats(account, 'truth-or-dare')?.stats || {};
    return (
      (Number(stats.truthsSkipped) || 0) + (Number(stats.daresSkipped) || 0)
    );
  }

  if (chainKey === 'crowd-reading') {
    return getAccountPerGameStats(account, 'would-you-rather')?.stats
      ?.majorityPicks;
  }

  if (chainKey === 'imposter-correct-accusations') {
    return getAccountPerGameStats(account, 'imposter')?.stats
      ?.correctAccusations;
  }

  if (chainKey === 'mafia-correct-accusations') {
    return getAccountPerGameStats(account, 'mafia')?.stats?.correctAccusations;
  }

  if (statKey === 'promptskipped') {
    const stats = getAccountPerGameStats(account, 'truth-or-dare')?.stats || {};
    return (
      (Number(stats.truthsSkipped) || 0) + (Number(stats.daresSkipped) || 0)
    );
  }

  return null;
}

function getAccountAchievementProgress(account, achievement, unlock) {
  const target = Number(achievement?.requirementValue) || 0;
  if (target <= 1) return null;

  const requirementType = String(
    achievement?.requirementType || ''
  ).toLowerCase();
  if (
    !['stat_threshold', 'per_game_stat_threshold', 'collection'].includes(
      requirementType
    )
  ) {
    return null;
  }

  const chainKey = String(achievement?.metadata?.chainKey || '').toLowerCase();
  const description = String(achievement?.description || '').toLowerCase();
  if (chainKey.includes('streak') || description.includes('in a row')) {
    return null;
  }

  let current = null;
  if (achievement?.statPath) {
    current =
      getAccountPerGameStatValue(account, achievement.statPath) ??
      getAccountNestedValue(account, achievement.statPath);
  }

  if (current === null) {
    current = getAccountAchievementDerivedProgress(account, achievement);
  }

  if (
    current === null &&
    achievement?.statKey &&
    account?.gameData?.achievementStats
  ) {
    current = account.gameData.achievementStats[achievement.statKey];
  }

  if (unlock) {
    current = Math.max(
      Number(current) || 0,
      Number(unlock.progressAtUnlock) || target
    );
  }

  const currentNumber = Math.max(0, Number(current) || 0);
  const cappedCurrent = Math.min(currentNumber, target);
  return {
    current: cappedCurrent,
    target,
    percent: Math.min(100, Math.max(0, (cappedCurrent / target) * 100))
  };
}

function createAccountAchievementProgress(progress) {
  const wrap = document.createElement('div');
  wrap.className = 'account-achievement-progress';
  wrap.setAttribute(
    'aria-label',
    `${formatAccountNumber(progress.current)} of ${formatAccountNumber(progress.target)}`
  );

  const track = document.createElement('div');
  track.className = 'account-achievement-progress-track';

  const fill = document.createElement('div');
  fill.className = 'account-achievement-progress-fill';
  fill.style.width = `${progress.percent}%`;

  const label = document.createElement('span');
  label.className = 'account-achievement-progress-label';
  label.textContent = `${formatAccountNumber(progress.current)} / ${formatAccountNumber(progress.target)}`;

  track.appendChild(fill);
  wrap.append(track, label);
  return wrap;
}

function formatAccountAchievementRewardName(reward) {
  const explicitName =
    reward?.name ||
    reward?.label ||
    reward?.displayName ||
    reward?.metadata?.name ||
    reward?.metadata?.label;
  const value = explicitName || reward?.key || reward?.type || 'Reward';

  return String(value)
    .replace(/[_:/.-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function resolveAccountAchievementReward(reward) {
  const catalogItem = accountAchievementRewardCatalog.get(
    `${normaliseAccountAchievementKey(
      reward?.type
    )}:${normaliseAccountAchievementKey(reward?.key)}`
  );
  if (!catalogItem) return reward;

  return {
    ...reward,
    name:
      reward?.name ||
      reward?.displayName ||
      reward?.metadata?.name ||
      catalogItem.name,
    image:
      reward?.image ||
      reward?.metadata?.image ||
      reward?.metadata?.icon ||
      catalogItem.image
  };
}

function getAccountAchievementRewardDisplay(reward) {
  const amount = Math.max(0, Math.trunc(Number(reward?.amount) || 0));
  if (reward?.type === 'opals') {
    return {
      kind: 'opals',
      value: `${formatAccountNumber(amount)} Opals`,
      type: 'Currency'
    };
  }
  if (reward?.type === 'xp') {
    return {
      kind: 'xp',
      value: `${formatAccountNumber(amount)} XP`,
      type: 'Experience'
    };
  }

  const quantity = Math.max(1, Math.trunc(Number(reward?.quantity) || 1));
  return {
    kind: 'item',
    value: `${formatAccountAchievementRewardName(reward)}${
      quantity > 1 ? ` x${formatAccountNumber(quantity)}` : ''
    }`,
    type: formatAccountAchievementRewardName({ type: reward?.type })
  };
}

function createAccountAchievementReward(reward) {
  const resolvedReward = resolveAccountAchievementReward(reward);
  const display = getAccountAchievementRewardDisplay(resolvedReward);
  const row = document.createElement('div');
  row.className = 'account-achievement-reward';

  const icon = document.createElement(
    display.kind === 'opals' || resolvedReward?.image ? 'img' : 'span'
  );
  icon.className = `account-achievement-reward-icon is-${display.kind}`;
  if (display.kind === 'opals') {
    icon.src = '/images/icons/currency/opal.svg';
    icon.alt = '';
  } else if (resolvedReward?.image) {
    icon.src = resolvedReward.image;
    icon.alt = '';
  } else {
    icon.textContent = display.kind === 'xp' ? 'XP' : 'ITEM';
    icon.setAttribute('aria-hidden', 'true');
  }

  const text = document.createElement('span');
  text.className = 'account-achievement-reward-text';

  const value = document.createElement('strong');
  value.className = 'account-achievement-reward-value';
  value.textContent = display.value;

  const type = document.createElement('span');
  type.className = 'account-achievement-reward-type';
  type.textContent = resolvedReward?.skipped
    ? 'Already owned'
    : resolvedReward?.granted === false
      ? 'Not granted'
      : display.type;

  text.append(value, type);
  row.append(icon, text);
  return row;
}

function createAccountAchievementDetails(achievement, unlock) {
  const isUnlocked = Boolean(unlock);
  const details = document.createElement('div');
  details.className = 'account-achievement-details';
  details.id = `account-achievement-details-${normaliseAccountAchievementKey(
    achievement.key
  )}`;
  details.hidden = true;

  if (isUnlocked) {
    const unlockInfo = document.createElement('div');
    unlockInfo.className = 'account-achievement-unlock-info';

    const unlockLabel = document.createElement('span');
    unlockLabel.className = 'account-achievement-detail-label';
    unlockLabel.textContent = 'Unlocked';

    const unlockDate = document.createElement('time');
    unlockDate.className = 'account-achievement-unlock-date';
    unlockDate.dateTime = unlock.unlockedAt || '';
    unlockDate.textContent = formatAccountDate(unlock.unlockedAt);
    unlockInfo.append(unlockLabel, unlockDate);
    details.appendChild(unlockInfo);
  }

  const rewards = document.createElement('div');
  rewards.className = 'account-achievement-rewards';

  const rewardsTitle = document.createElement('p');
  rewardsTitle.className = 'account-achievement-detail-label';
  rewardsTitle.textContent = isUnlocked
    ? 'Rewards earned'
    : 'Rewards for unlocking';
  rewards.appendChild(rewardsTitle);

  const rewardList = document.createElement('div');
  rewardList.className = 'account-achievement-reward-list';

  const rewardsToDisplay = isUnlocked
    ? Array.isArray(unlock.rewardResults)
      ? unlock.rewardResults
      : []
    : Array.isArray(achievement.rewards)
      ? achievement.rewards
      : [];
  if (rewardsToDisplay.length) {
    rewardList.append(...rewardsToDisplay.map(createAccountAchievementReward));
  } else {
    const empty = document.createElement('p');
    empty.className = 'account-achievement-rewards-empty';
    empty.textContent = 'No rewards recorded';
    rewardList.appendChild(empty);
  }
  rewards.appendChild(rewardList);

  details.appendChild(rewards);
  return details;
}

function setAccountAchievementExpanded(card, expanded) {
  const toggle = card?.querySelector('.account-achievement-details-toggle');
  const details = card?.querySelector('.account-achievement-details');
  if (!toggle || !details) return;

  toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  toggle.dataset.accountHint = expanded
    ? 'Hide achievement details'
    : 'Show achievement details';
  card.classList.toggle('is-expanded', expanded);
  details.hidden = !expanded;
}

function createAccountAchievementStatusControls(achievement, card, isUnlocked) {
  const controls = document.createElement('div');
  controls.className = 'account-achievement-status-controls';

  const status = document.createElement('span');
  status.className = 'account-achievement-status';
  status.textContent = isUnlocked ? 'UNLOCKED' : 'LOCKED';

  const toggle = document.createElement('button');
  toggle.className = 'account-achievement-details-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute(
    'aria-controls',
    `account-achievement-details-${normaliseAccountAchievementKey(
      achievement.key
    )}`
  );
  toggle.setAttribute(
    'aria-label',
    `Show details for ${achievement.name || 'achievement'}`
  );
  toggle.dataset.accountHint = 'Show achievement details';

  const arrow = document.createElement('span');
  arrow.className = 'account-achievement-dropdown-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  toggle.appendChild(arrow);

  toggle.addEventListener('click', () => {
    const shouldExpand = toggle.getAttribute('aria-expanded') !== 'true';
    if (shouldExpand) {
      card
        .closest('.account-achievement-list')
        ?.querySelectorAll('.account-achievement-card.is-expanded')
        .forEach((expandedCard) => {
          if (expandedCard !== card) {
            setAccountAchievementExpanded(expandedCard, false);
          }
        });
    }
    setAccountAchievementExpanded(card, shouldExpand);
  });

  controls.append(status, toggle);
  return controls;
}

function createAccountAchievementCard(
  achievement,
  unlock,
  rarity = {},
  account = null
) {
  const isUnlocked = Boolean(unlock);
  const card = document.createElement('article');
  card.className = 'account-achievement-card';
  card.dataset.achievementKey = normaliseAccountAchievementKey(achievement.key);
  card.classList.toggle('is-locked', !isUnlocked);
  if (rarity.primaryColour) {
    card.style.setProperty(
      '--achievement-rarity-primary-colour',
      rarity.primaryColour
    );
  }
  if (rarity.secondaryColour) {
    card.style.setProperty(
      '--achievement-rarity-secondary-colour',
      rarity.secondaryColour
    );
  }

  const iconWrap = document.createElement('div');
  iconWrap.className = 'account-achievement-icon-wrap';

  const icon = document.createElement('img');
  icon.className = 'account-achievement-icon';
  icon.alt = '';
  icon.src = achievement.image || '/images/icons/help-icon.svg';

  const border = document.createElement('img');
  border.className = 'account-achievement-border';
  border.alt = '';
  border.src =
    achievement.border || getAccountAchievementBorderPath(achievement.rarity);

  iconWrap.append(icon, border);

  const content = document.createElement('div');
  content.className = 'account-achievement-content';

  const heading = document.createElement('div');
  heading.className = 'account-achievement-heading';

  const meta = document.createElement('p');
  meta.className = 'account-achievement-meta';
  meta.textContent = rarity.label || achievement.rarity || 'Achievement';

  const title = document.createElement('h3');
  title.className = 'account-achievement-title';
  title.textContent = achievement.name || unlock?.key || 'Achievement';

  const status = createAccountAchievementStatusControls(
    achievement,
    card,
    isUnlocked
  );

  heading.append(meta, title);

  const description = document.createElement('p');
  description.className = 'account-achievement-description';
  description.textContent = isUnlocked
    ? achievement.description || 'Unlocked achievement'
    : getAccountAchievementLockedDescription(achievement);

  const progress = isAccountAchievementHiddenWhileLocked(achievement, unlock)
    ? null
    : getAccountAchievementProgress(account, achievement, unlock);
  card.classList.toggle('has-progress', Boolean(progress));

  content.append(heading, status, description);
  if (progress) {
    content.appendChild(createAccountAchievementProgress(progress));
  }
  card.append(iconWrap, content);
  card.appendChild(createAccountAchievementDetails(achievement, unlock));
  return card;
}

function createAccountAchievementsEmptyState(
  message = 'No achievements unlocked yet'
) {
  const emptyState = document.createElement('div');
  emptyState.className = 'account-achievements-empty';
  emptyState.textContent = message;
  return emptyState;
}

function createAccountAchievementFilters(list, cards) {
  const filters = document.createElement('div');
  filters.className = 'account-achievement-filters';
  filters.setAttribute('role', 'group');
  filters.setAttribute('aria-label', 'Filter achievements');

  const filteredEmptyState = createAccountAchievementsEmptyState();
  filteredEmptyState.hidden = true;
  list.appendChild(filteredEmptyState);

  const filterOptions = [
    { key: 'all', label: 'All' },
    { key: 'unlocked', label: 'Unlocked' },
    { key: 'locked', label: 'Locked' }
  ];

  const buttons = filterOptions.map(({ key, label }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'account-achievement-filter';
    button.textContent = label;
    button.setAttribute('aria-controls', list.id);
    button.setAttribute('aria-pressed', String(key === 'all'));
    button.dataset.achievementFilter = key;
    filters.appendChild(button);
    return button;
  });

  const applyFilter = (filter) => {
    let visibleCount = 0;

    cards.forEach((card) => {
      const matches =
        filter === 'all' || card.dataset.achievementState === filter;
      card.hidden = !matches;
      if (matches) {
        visibleCount += 1;
      } else {
        setAccountAchievementExpanded(card, false);
      }
    });

    buttons.forEach((button) => {
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.achievementFilter === filter)
      );
    });

    filteredEmptyState.textContent =
      filter === 'unlocked'
        ? 'No achievements unlocked yet'
        : 'No locked achievements remaining';
    filteredEmptyState.hidden = visibleCount > 0;
    list.scrollTop = 0;
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      applyFilter(button.dataset.achievementFilter);
    });
  });

  return filters;
}

function focusAccountAchievement(cards, achievementKey) {
  const normalizedKey = normaliseAccountAchievementKey(achievementKey);
  if (!normalizedKey) return false;

  const targetCard = cards.find(
    (card) => card.dataset.achievementKey === normalizedKey
  );
  if (!targetCard) return false;

  cards.forEach((card) => {
    if (card !== targetCard) {
      setAccountAchievementExpanded(card, false);
      card.classList.remove('is-notification-target');
    }
  });
  targetCard.hidden = false;
  targetCard.tabIndex = -1;
  targetCard.classList.add('is-notification-target');
  setAccountAchievementExpanded(targetCard, true);
  targetCard.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  try {
    targetCard.focus({ preventScroll: true });
  } catch {
    targetCard.focus();
  }
  return true;
}

async function renderAccountAchievementsPanel() {
  if (!accountExpandedContent) return;

  const targetAchievementKey = normaliseAccountAchievementKey(
    pendingAccountAchievementKey
  );
  const account = getStoredAccount();
  const unlocks = getAccountAchievementUnlocks(account);
  accountExpandedContent.replaceChildren(
    createAccountProfileRow('Status', 'Loading achievements')
  );

  const [achievements, rarities] = await Promise.all([
    loadAccountAchievements(),
    loadAccountAchievementRarities()
  ]);
  if (accountExpandedAction !== 'achievements') return;

  const unlocksByKey = new Map(
    unlocks.map((unlock) => [
      normaliseAccountAchievementKey(unlock.key),
      unlock
    ])
  );
  const achievementRows = achievements
    .map((achievement) => ({
      achievement,
      unlock: unlocksByKey.get(normaliseAccountAchievementKey(achievement.key))
    }))
    .sort((a, b) => {
      const unlockOrder = Number(Boolean(b.unlock)) - Number(Boolean(a.unlock));
      if (unlockOrder) return unlockOrder;

      return (
        Number(a.achievement.sortOrder || 0) -
        Number(b.achievement.sortOrder || 0)
      );
    });

  const achievementsSection = createAccountProfileSection('Collection');
  const list = document.createElement('div');
  list.id = 'account-achievement-list';
  list.className = 'account-achievement-list';
  let cards = [];

  if (achievementRows.length) {
    cards = achievementRows.map(({ achievement, unlock }) => {
      const rarityKey = normaliseAccountAchievementKey(
        achievement.rarity || unlock?.metadata?.rarity || 'common'
      );
      const card = createAccountAchievementCard(
        { ...achievement, rarity: rarityKey },
        unlock,
        rarities[rarityKey] || rarities.common || {},
        account
      );
      card.dataset.achievementState = unlock ? 'unlocked' : 'locked';
      return card;
    });
    list.append(...cards);

    const sectionHeader = document.createElement('div');
    sectionHeader.className = 'account-achievement-section-header';
    sectionHeader.append(
      achievementsSection.querySelector('.account-profile-section-title'),
      createAccountAchievementFilters(list, cards)
    );
    achievementsSection.replaceChildren(sectionHeader);
  } else {
    list.appendChild(createAccountAchievementsEmptyState());
  }

  achievementsSection.appendChild(list);
  accountExpandedContent.replaceChildren(
    createAccountAchievementSummary(unlocks, achievements.length),
    achievementsSection
  );

  if (targetAchievementKey) {
    focusAccountAchievement(cards, targetAchievementKey);
    if (
      normaliseAccountAchievementKey(pendingAccountAchievementKey) ===
      targetAchievementKey
    ) {
      pendingAccountAchievementKey = '';
    }
  }
  if (accountExpandedAction === 'achievements') {
    await markAccountNotificationDestinationRead('achievements');
  }
}
