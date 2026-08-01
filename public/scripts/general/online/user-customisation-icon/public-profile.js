function formatOnlineProfileStat(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : '0';
}

function formatOnlineProfileDate(value) {
  if (!value) return 'Unknown';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function normaliseOnlineAchievementKey(value) {
  return String(value || '').trim().toLowerCase();
}

function loadOnlinePublicAchievements() {
  if (!onlinePublicAchievementsPromise) {
    onlinePublicAchievementsPromise = fetch(onlinePublicAchievementsConfigPath)
      .then((response) => (response.ok ? response.json() : {}))
      .then((data) =>
        Array.isArray(data?.data?.achievements)
          ? data.data.achievements
          : Array.isArray(data?.achievements)
            ? data.achievements
            : []
      )
      .catch((error) => {
        console.warn(error);
        return [];
      });
  }

  return onlinePublicAchievementsPromise;
}

function getOnlineAchievementBorderPath(rarityKey) {
  const normalizedRarity = normaliseOnlineAchievementKey(rarityKey)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const borderKey = normalizedRarity === 'secret' ? 'exposed' : normalizedRarity;
  return `/images/achievements/borders/${borderKey || 'common'}.svg`;
}

function createOnlinePublicAchievementCard(achievement, unlock) {
  const rarity = normaliseOnlineAchievementKey(
    unlock?.rarity || achievement.rarity || 'common'
  );
  const card = document.createElement('article');
  card.className = 'account-achievement-card online-public-achievement-card';

  const iconWrap = document.createElement('div');
  iconWrap.className = 'account-achievement-icon-wrap';

  const icon = document.createElement('img');
  icon.className = 'account-achievement-icon';
  icon.alt = '';
  icon.src = achievement.image || '/images/icons/help-icon.svg';

  const border = document.createElement('img');
  border.className = 'account-achievement-border';
  border.alt = '';
  border.src = achievement.border || getOnlineAchievementBorderPath(rarity);

  iconWrap.append(icon, border);

  const content = document.createElement('div');
  content.className = 'account-achievement-content';

  const heading = document.createElement('div');
  heading.className = 'account-achievement-heading';

  const meta = document.createElement('p');
  meta.className = 'account-achievement-meta';
  meta.textContent = `${rarity || 'Achievement'} / ${formatOnlineProfileDate(unlock?.unlockedAt)}`;

  const title = document.createElement('h3');
  title.className = 'account-achievement-title';
  title.textContent = achievement.name || unlock?.key || 'Achievement';

  const status = document.createElement('span');
  status.className = 'account-achievement-status';
  status.textContent = 'UNLOCKED';

  const description = document.createElement('p');
  description.className = 'account-achievement-description';
  description.textContent = achievement.description || 'Unlocked achievement';

  heading.append(meta, title);
  content.append(heading, status, description);
  card.append(iconWrap, content);
  return card;
}

function createOnlinePublicAchievementsEmptyState() {
  const empty = document.createElement('div');
  empty.className = 'online-public-achievements-empty';
  empty.textContent = 'No achievement unlocked';
  return empty;
}

async function renderOnlinePublicAchievements(content, profile) {
  const list = document.createElement('div');
  list.className = 'account-achievement-list online-public-achievement-list';
  content.appendChild(list);

  const unlocks = Array.isArray(profile.achievements)
    ? profile.achievements
    : [];

  if (!unlocks.length) {
    list.appendChild(createOnlinePublicAchievementsEmptyState());
    return;
  }

  const achievements = await loadOnlinePublicAchievements();
  const achievementsByKey = new Map(
    achievements.map((achievement) => [
      normaliseOnlineAchievementKey(achievement.key),
      achievement
    ])
  );

  const cards = unlocks
    .map((unlock) => ({
      unlock,
      achievement:
        achievementsByKey.get(normaliseOnlineAchievementKey(unlock.key)) || null
    }))
    .filter(({ achievement }) => achievement)
    .map(({ unlock, achievement }) =>
      createOnlinePublicAchievementCard(achievement, unlock)
    );

  if (!cards.length) {
    list.appendChild(createOnlinePublicAchievementsEmptyState());
    return;
  }

  list.append(...cards);
}

function closeOnlinePublicProfilePanel() {
  const dialog = document.querySelector('.online-public-profile-dialog');
  if (!dialog) return;

  const account = dialog.querySelector('.online-public-profile-account');
  account?.classList.remove('has-expanded-action');
  if (typeof window.closeOeDialog === 'function') {
    window.closeOeDialog(dialog);
  } else if (dialog.open) {
    dialog.close();
  }
}

function ensureOnlinePublicProfilePanel() {
  let dialog = document.querySelector('.online-public-profile-dialog');
  if (dialog) return dialog;

  dialog = document.createElement('dialog');
  dialog.className = 'online-public-profile-dialog oe-dialog';
  dialog.setAttribute('aria-labelledby', 'online-public-profile-title');
  document.body.appendChild(dialog);
  window.OeDialog?.register(dialog);

  return dialog;
}

function setOnlinePublicProfileState(content, state, message = '') {
  content.replaceChildren();

  const status = document.createElement('div');
  status.className = `online-public-profile-state ${state}`;
  status.textContent = message;
  content.appendChild(status);
}

function createOnlinePublicProfileRow(label, value) {
  const row = document.createElement('div');
  row.className = 'account-profile-row';

  const labelElement = document.createElement('span');
  labelElement.className = 'account-profile-label';
  labelElement.textContent = label;
  row.appendChild(labelElement);

  const valueElement = document.createElement('span');
  valueElement.className = 'account-profile-value';
  valueElement.textContent = value || 'Hidden';
  row.appendChild(valueElement);

  return row;
}

function createOnlinePublicProfileSection(title, rows = []) {
  const section = document.createElement('section');
  section.className = 'account-profile-section';

  const heading = document.createElement('h3');
  heading.className = 'account-profile-section-title';
  heading.textContent = title;
  section.appendChild(heading);

  rows.forEach(([label, value]) => {
    section.appendChild(createOnlinePublicProfileRow(label, value));
  });

  return section;
}

function setOnlinePublicProfileExpanded(account, title, contentBuilder) {
  const expandedTitle = account.querySelector('.account-expanded-title');
  const expandedContent = account.querySelector('.account-expanded-content');

  if (!expandedTitle || !expandedContent) return;

  expandedTitle.textContent = title;
  expandedContent.replaceChildren();
  contentBuilder(expandedContent);
  account.classList.add('has-expanded-action');
}

function renderOnlinePublicProfileOverview(account, profile, fallback = {}) {
  account.classList.remove('has-expanded-action');
  account.replaceChildren();

  const titleSection = document.createElement('section');
  titleSection.className = 'account-title-section';

  const title = document.createElement('h2');
  title.id = 'online-public-profile-title';
  title.className = 'account-title';
  title.textContent = 'Profile';
  titleSection.appendChild(title);

  const nameRow = document.createElement('div');
  nameRow.className = 'online-public-profile-name-row';

  const subtitle = document.createElement('p');
  subtitle.className = 'account-subtitle';
  subtitle.textContent = profile.username || 'Player';
  nameRow.appendChild(subtitle);

  const relationshipStatus = profile.relationship?.status || 'not_friends';
  if (relationshipStatus !== 'self') {
    nameRow.appendChild(
      createOnlinePublicProfileFriendButton(profile, account)
    );
  }
  titleSection.appendChild(nameRow);
  account.appendChild(titleSection);

  const preview = document.createElement('section');
  preview.className = 'account-preview-section online-public-profile-preview';
  preview.setAttribute('aria-label', 'Public profile preview');

  const avatar = document.createElement('div');
  avatar.className = 'account-preview-icon';
  preview.appendChild(avatar);
  account.appendChild(preview);

  createUserIconPartyGames({
    container: avatar,
    userId: profile.id || fallback.userId || 'online-public-profile',
    userCustomisationString:
      profile.oeIcon || fallback.userIcon || USER_ICON_DEFAULT_STRING
  });

  const expanded = document.createElement('section');
  expanded.className = 'account-expanded-panel';
  expanded.setAttribute('aria-live', 'polite');

  const back = document.createElement('div');
  back.className = 'account-expanded-back-button';
  back.setAttribute('role', 'button');
  back.setAttribute('tabindex', '0');
  back.setAttribute('aria-label', 'Back to profile menu');
  back.addEventListener('click', () => account.classList.remove('has-expanded-action'));
  back.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    account.classList.remove('has-expanded-action');
  });
  expanded.appendChild(back);

  const expandedTitle = document.createElement('h2');
  expandedTitle.className = 'account-expanded-title';
  expanded.appendChild(expandedTitle);

  const expandedContent = document.createElement('div');
  expandedContent.className = 'account-expanded-content';
  expanded.appendChild(expandedContent);
  account.appendChild(expanded);

  const actions = document.createElement('section');
  actions.className = 'account-button-container online-public-profile-actions';
  actions.setAttribute('aria-label', 'Public profile sections');

  const actionItems = [
    {
      label: 'PROFILE',
      hint: 'View public profile details',
      render: (content) => {
        content.appendChild(
          createOnlinePublicProfileSection('Public identity', [
            ['Display name', profile.displayName || profile.username || fallback.username || 'Player'],
            ['Username', profile.username || 'Player'],
            ['Status', profile.onlineStatus || 'Hidden'],
            ['Joined', formatOnlineProfileDate(profile.joinedAt)]
          ])
        );
      }
    },
    {
      label: 'OLINGS',
      hint: 'View public oLing summary',
      render: (content) => {
        content.appendChild(
          createOnlinePublicProfileSection('Public oLings', [
            [
              'oLings',
              profile.olings
                ? formatOnlineProfileStat(profile.olings.total || 0)
                : 'Hidden'
            ]
          ])
        );
      }
    },
    {
      label: 'ACHIEVEMENTS',
      hint: 'View public achievements',
      render: (content) => {
        renderOnlinePublicAchievements(content, profile);
      }
    },
    {
      label: 'STATISTICS',
      hint: 'View public game statistics',
      render: (content) => {
        if (!profile.stats) {
          content.appendChild(
            createOnlinePublicProfileSection('Public statistics', [
              ['Game stats', 'Hidden']
            ])
          );
          return;
        }

        content.appendChild(
          createOnlinePublicProfileSection('Public statistics', [
            ['Level', formatOnlineProfileStat(profile.stats.level || 1)],
            ['XP', formatOnlineProfileStat(profile.stats.xp || 0)],
            ['Games', formatOnlineProfileStat(profile.stats.gamesPlayed || 0)],
            ['Rounds', formatOnlineProfileStat(profile.stats.roundsPlayed || 0)],
            ['Last mode', profile.stats.lastActiveGameMode || 'None']
          ])
        );
      }
    }
  ];

  actionItems.forEach(({ label, hint, render }, index) => {
    const button = document.createElement('div');
    button.className = index === 0 ? 'account-action-container primary' : 'account-action-container';
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.dataset.accountHint = hint;

    const span = document.createElement('span');
    span.className = 'account-action-label';
    span.textContent = label;
    button.appendChild(span);

    const openSection = () => setOnlinePublicProfileExpanded(account, label, render);
    button.addEventListener('click', openSection);
    button.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openSection();
    });

    actions.appendChild(button);
  });
  account.appendChild(actions);

  const footer = document.createElement('footer');
  footer.className = 'account-footer online-public-profile-footer';

  const leftCell = document.createElement('div');
  leftCell.className = 'account-footer-grid online-public-profile-footer-blank';
  leftCell.setAttribute('aria-hidden', 'true');
  footer.appendChild(leftCell);

  const hintCell = document.createElement('div');
  hintCell.className = 'account-footer-grid online-public-profile-hint-grid';
  hintCell.setAttribute('aria-label', 'Profile helper');
  footer.appendChild(hintCell);

  const rightCell = document.createElement('div');
  rightCell.className = 'account-footer-grid online-public-profile-footer-blank';
  rightCell.setAttribute('aria-hidden', 'true');
  footer.appendChild(rightCell);
  account.appendChild(footer);

  window
    .createAccountFooterHintController?.({
      container: account,
      hintGrid: hintCell,
      defaultLabel: 'Profile helper'
    })
    ?.attach();
}

async function openOnlinePublicProfile(context = {}) {
  if (!context.accountId) return;

  const dialog = ensureOnlinePublicProfilePanel();
  dialog.replaceChildren();

  const account = document.createElement('section');
  account.className = 'account-container online-public-profile-account';
  account.setAttribute('aria-labelledby', 'online-public-profile-title');
  dialog.appendChild(account);

  if (typeof window.openOeDialog === 'function') {
    window.openOeDialog(dialog);
  } else if (!dialog.open) {
    dialog.showModal();
  }

  const loadingContent = document.createElement('div');
  loadingContent.className = 'online-public-profile-content';
  account.appendChild(loadingContent);
  setOnlinePublicProfileState(loadingContent, 'loading', 'Loading profile...');

  try {
    const response = await fetch(
      `/api/accounts/public/${encodeURIComponent(context.accountId)}`,
      { credentials: 'same-origin' }
    );
    const payload = await response.json().catch(() => ({}));

    const profile = payload?.profile || payload?.data?.profile;

    if (!response.ok || !profile) {
      throw new Error(
        payload?.message || payload?.error?.message || 'Profile unavailable'
      );
    }

    renderOnlinePublicProfileOverview(account, profile, context);
  } catch (error) {
    setOnlinePublicProfileState(
      loadingContent,
      'error',
      error?.message || 'Profile unavailable'
    );
  }
}

window.openOnlinePublicProfile = openOnlinePublicProfile;

