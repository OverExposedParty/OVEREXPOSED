function getAccountFriendRelationships(account) {
  const relationships = Array.isArray(account?.gameData?.friendsAndBlockedUsers)
    ? account.gameData.friendsAndBlockedUsers
    : [];

  return relationships;
}

function getAccountFriendId(friend) {
  return String(
    friend?.accountId?._id ||
      friend?.accountId?.id ||
      friend?.accountId ||
      friend?.id ||
      friend?._id ||
      ''
  );
}

function getAccountFriendName(friend) {
  return (
    friend?.username ||
    friend?.displayName ||
    friend?.name ||
    friend?.account?.username ||
    friend?.accountId?.username ||
    `Player ${getAccountFriendId(friend).slice(-6) || 'unknown'}`
  );
}

const ACCOUNT_FRIEND_ONLINE_WINDOW_MS = 10 * 60 * 1000;

function getAccountFriendLastActiveAt(friend) {
  return friend?.lastActiveAt || friend?.lastSeenAt || null;
}

function isAccountFriendOnline(friend) {
  if (friend?.online) return true;

  const lastActiveAt = getAccountFriendLastActiveAt(friend);
  if (!lastActiveAt) return false;

  const lastActiveTime = new Date(lastActiveAt).getTime();
  return (
    Number.isFinite(lastActiveTime) &&
    Date.now() - lastActiveTime <= ACCOUNT_FRIEND_ONLINE_WINDOW_MS
  );
}

function formatAccountFriendLastActive(friend) {
  if (isAccountFriendOnline(friend)) return 'ONLINE';

  const lastActiveAt = getAccountFriendLastActiveAt(friend);
  if (!lastActiveAt) return 'OFFLINE';

  const lastActiveTime = new Date(lastActiveAt).getTime();
  if (!Number.isFinite(lastActiveTime)) return 'OFFLINE';

  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - lastActiveTime) / (60 * 1000))
  );
  if (elapsedMinutes < 60) return `${elapsedMinutes}M AGO`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}H AGO`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return `${elapsedDays}D AGO`;

  const elapsedWeeks = Math.floor(elapsedDays / 7);
  if (elapsedDays < 30) return `${elapsedWeeks}W AGO`;

  const elapsedMonths = Math.floor(elapsedDays / 30);
  if (elapsedDays < 365) return `${elapsedMonths}MO AGO`;

  return `${Math.floor(elapsedDays / 365)}Y AGO`;
}

function getAccountFriendStatusText(friend) {
  if (friend?.status === 'pending_received') return 'Wants to add you';
  if (friend?.status === 'pending_sent') return 'Request sent';
  if (friend?.status === 'blocked') return 'Blocked';
  if (friend?.status === 'not_friends') {
    return friend?.allowFriendRequests === false
      ? 'Friend requests disabled'
      : 'Player found';
  }
  return formatAccountFriendLastActive(friend);
}

function getAccountFriendIconParts(friend, lookup) {
  const customisation = parseAccountCustomisationString(friend?.oeIcon);
  if (!customisation || !lookup) return null;

  return getCustomisationFileStackFromIds(customisation, lookup);
}

function createAccountFriendIcon(friend, lookup) {
  const icon = document.createElement('div');
  icon.className = 'account-friend-oe-icon';
  icon.setAttribute('aria-hidden', 'true');
  const iconParts =
    friend?.oeIconParts || getAccountFriendIconParts(friend, lookup);

  if (iconParts) {
    icon.appendChild(createAccountPreviewImageStack(iconParts));
  } else {
    icon.textContent = 'OE';
  }

  if (friend?.status === 'blocked') {
    icon.classList.add('is-blocked');
  }

  return icon;
}

function createAccountFriendAction(label, action, friend, options = {}) {
  const button = document.createElement('button');
  button.className = 'account-friend-action';
  button.type = 'button';
  button.dataset.friendAction = action;
  button.dataset.friendId = getAccountFriendId(friend);
  button.dataset.accountHint = options.hint || label;
  button.textContent = label;

  if (options.danger) button.classList.add('danger');

  return button;
}

function createAccountFriendActions(friend, activeTab) {
  const actions = document.createElement('div');
  actions.className = 'account-friend-actions';

  if (activeTab === 'friends') {
    const inviteButton = createAccountFriendAction('Invite', 'invite', friend, {
      hint: accountInviteSessionActive
        ? `Invite ${getAccountFriendName(friend)} to your session`
        : 'Join an online party or Oling battle to invite friends'
    });
    inviteButton.disabled = !accountInviteSessionActive;
    inviteButton.setAttribute(
      'aria-disabled',
      accountInviteSessionActive ? 'false' : 'true'
    );
    actions.append(
      inviteButton,
      createAccountFriendAction('Profile', 'profile', friend, {
        hint: `View ${getAccountFriendName(friend)}`
      }),
      createAccountFriendAction('Remove', 'remove', friend, {
        danger: true,
        hint: `Remove ${getAccountFriendName(friend)}`
      }),
      createAccountFriendAction('Block', 'block', friend, {
        danger: true,
        hint: `Block ${getAccountFriendName(friend)}`
      })
    );
    return actions;
  }

  if (activeTab === 'search') {
    const friendButtonLabels = {
      friends: 'Already Friends',
      pending_sent: 'Request Sent',
      pending_received: 'Request Received',
      blocked: 'Player Blocked'
    };
    const friendButton = createAccountFriendAction(
      friendButtonLabels[friend?.status] ||
        (friend?.allowFriendRequests === false
          ? 'Requests Disabled'
          : 'Add Friend'),
      'send',
      friend
    );
    const canSendRequest =
      friend?.status === 'not_friends' && friend?.allowFriendRequests !== false;

    friendButton.disabled = !canSendRequest;
    friendButton.setAttribute(
      'aria-disabled',
      canSendRequest ? 'false' : 'true'
    );
    actions.append(
      friendButton,
      createAccountFriendAction('Profile', 'profile', friend)
    );
    return actions;
  }

  if (friend?.status === 'pending_received') {
    actions.append(
      createAccountFriendAction('Accept', 'accept', friend, {
        hint: `Accept ${getAccountFriendName(friend)}`
      }),
      createAccountFriendAction('Decline', 'decline', friend, {
        danger: true,
        hint: `Decline ${getAccountFriendName(friend)}`
      }),
      createAccountFriendAction('Block', 'block', friend, {
        danger: true,
        hint: `Block ${getAccountFriendName(friend)}`
      })
    );
    return actions;
  }

  if (activeTab === 'requests') {
    actions.append(
      createAccountFriendAction('Cancel', 'cancel', friend, {
        danger: true,
        hint: `Cancel request to ${getAccountFriendName(friend)}`
      })
    );
    return actions;
  }

  actions.append(
    createAccountFriendAction('Unblock', 'unblock', friend, {
      hint: `Unblock ${getAccountFriendName(friend)}`
    })
  );
  return actions;
}

function createAccountFriendCard(friend, activeTab, iconLookup) {
  const name = getAccountFriendName(friend);
  const card = document.createElement('article');
  card.className = 'account-friend-card';
  card.dataset.friendId = getAccountFriendId(friend);

  const summary = document.createElement('button');
  summary.className = 'account-friend-summary';
  summary.type = 'button';
  summary.setAttribute('aria-expanded', 'false');
  summary.dataset.accountHint = `Show ${name} options`;

  const identity = document.createElement('span');
  identity.className = 'account-friend-identity';

  const username = document.createElement('span');
  username.className = 'account-friend-username';
  username.textContent = name;

  const status = document.createElement('span');
  status.className = 'account-friend-status';
  status.textContent = getAccountFriendStatusText(friend);
  status.classList.toggle(
    'is-online',
    friend?.status === 'friends' && isAccountFriendOnline(friend)
  );

  const arrow = document.createElement('span');
  arrow.className = 'account-friend-dropdown-arrow';
  arrow.setAttribute('aria-hidden', 'true');

  identity.append(username, status);
  summary.append(createAccountFriendIcon(friend, iconLookup), identity, arrow);

  const details = document.createElement('div');
  details.className = 'account-friend-details';
  details.hidden = true;

  const meta = document.createElement('div');
  meta.className = 'account-friend-meta';
  meta.append(
    createAccountProfileRow('Added', formatAccountDate(friend?.createdAt)),
    createAccountProfileRow('Status', getAccountFriendStatusText(friend))
  );

  details.append(meta, createAccountFriendActions(friend, activeTab));
  card.append(summary, details);
  return card;
}

function createAccountFriendsEmptyState(activeTab) {
  const emptyState = document.createElement('div');
  emptyState.className = 'account-friends-empty';

  const messages = {
    friends: 'No friends found',
    requests: 'No requests found',
    blocked: 'No blocked players',
    statistics: 'No game stats yet'
  };

  emptyState.textContent = messages[activeTab] || 'No players found';
  return emptyState;
}

function createAccountFriendsTabs(activeTab) {
  const tabs = document.createElement('div');
  tabs.className = 'account-friends-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Friends filter');

  accountFriendTabs.forEach((tab) => {
    const button = document.createElement('button');
    button.className = 'account-friends-tab';
    button.type = 'button';
    button.dataset.friendTab = tab.id;
    button.dataset.accountHint = `Show ${tab.label.toLowerCase()}`;
    button.setAttribute('role', 'tab');
    button.setAttribute(
      'aria-selected',
      tab.id === activeTab ? 'true' : 'false'
    );
    button.textContent = tab.label;

    if (tab.id === activeTab) button.classList.add('is-active');

    tabs.appendChild(button);
  });

  return tabs;
}

function createAccountFriendsSearch(query = '') {
  const form = document.createElement('form');
  form.className = 'account-friends-search';
  form.setAttribute('role', 'search');

  const input = document.createElement('input');
  input.className = 'account-friends-search-input';
  input.type = 'search';
  input.name = 'friend-search';
  input.placeholder = 'Search username';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('aria-label', 'Search username');
  input.dataset.accountHint = 'Search for a player';
  input.value = query;

  const button = document.createElement('button');
  button.className = 'account-friends-search-button';
  button.type = 'submit';
  button.dataset.accountHint = 'Search username';
  button.setAttribute('aria-label', 'Search username');
  button.textContent = 'Search';

  form.append(input, button);
  return form;
}

function createAccountFriendSearchHeader(message, isError = false) {
  const header = document.createElement('div');
  header.className = 'account-friends-search-result-header';
  if (isError) header.classList.add('is-error');

  const label = document.createElement('span');
  label.textContent = message;

  const backButton = document.createElement('button');
  backButton.type = 'button';
  backButton.className = 'account-friends-search-clear';
  backButton.dataset.friendSearchClear = 'true';
  backButton.textContent = 'Back to friends';

  header.append(label, backButton);
  return header;
}
