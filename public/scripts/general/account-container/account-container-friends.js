async function searchAccountFriends(query) {
  if (!accountExpandedContent) return;
  accountFriendSearchQuery = query;
  const loading = createAccountFriendsEmptyState('search');
  loading.textContent = 'Searching...';
  accountExpandedContent.replaceChildren(
    createAccountFriendsSearch(query),
    loading
  );

  try {
    const response = await fetch(
      `/api/accounts/friends/search?username=${encodeURIComponent(query)}`,
      { credentials: 'same-origin' }
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      throw new Error(payload?.error?.message || 'Player search failed');
    }

    const customisationData = await loadAccountCustomisationData().catch(
      () => null
    );
    accountExpandedContent.replaceChildren(
      createAccountFriendsSearch(query),
      createAccountFriendSearchHeader('Search result'),
      createAccountFriendCard(
        payload.player,
        'search',
        customisationData?.lookup || null
      )
    );
  } catch (error) {
    accountExpandedContent.replaceChildren(
      createAccountFriendsSearch(query),
      createAccountFriendSearchHeader(error.message, true)
    );
    setAccountFooterHint(error.message);
  }
}

async function requestAccountFriendUpdate(accountId, action) {
  const response = await fetch(
    `/api/accounts/friends/${encodeURIComponent(accountId)}`,
    {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    }
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(payload?.error?.message || 'Friends update failed');
  }

  if (payload.account) setAccountPreview(payload.account);
  return payload;
}

async function updateAccountFriend(button) {
  const action = button.dataset.friendAction;
  const accountId = button.dataset.friendId;
  button.disabled = true;

  try {
    const payload = await requestAccountFriendUpdate(accountId, action);
    setAccountFooterHint(payload.message || 'Friends updated');
    if (accountFriendSearchQuery) {
      await searchAccountFriends(accountFriendSearchQuery);
    } else if (accountExpandedContent) {
      await renderAccountFriendsPanel();
    }
  } catch (error) {
    button.disabled = false;
    setAccountFooterHint(error.message);
    console.warn(error);
  }
}

async function renderAccountFriendsPanel(activeTab = 'friends') {
  if (!accountExpandedContent) return;
  accountFriendSearchQuery = '';

  let account = getStoredAccount();
  try {
    const response = await fetch('/api/accounts/me', {
      credentials: 'same-origin',
      cache: 'no-store'
    });
    const payload = await response.json();
    if (response.ok && payload?.account) {
      account = payload.account;
      saveAccountToLocalStorage(account);
    }
  } catch (error) {
    console.warn(error);
  }

  accountInviteSessionActive = false;
  try {
    const response = await fetch('/api/accounts/friends/invite-session', {
      credentials: 'same-origin',
      cache: 'no-store'
    });
    const payload = await response.json().catch(() => ({}));
    const data = payload?.data || payload;
    accountInviteSessionActive = response.ok && data?.active === true;
  } catch (error) {
    console.warn(error);
  }

  let iconLookup = null;
  try {
    const customisationData = await loadAccountCustomisationData();
    iconLookup = customisationData.lookup;
  } catch (error) {
    console.warn(error);
  }
  const statuses =
    accountFriendTabStatusMap[activeTab] || accountFriendTabStatusMap.friends;
  const relationships = getAccountFriendRelationships(account).filter(
    (friend) => statuses.includes(friend?.status)
  );

  const list = document.createElement('div');
  list.className = 'account-friends-list';

  if (relationships.length) {
    list.append(
      ...relationships.map((friend) =>
        createAccountFriendCard(friend, activeTab, iconLookup)
      )
    );
  } else {
    list.appendChild(createAccountFriendsEmptyState(activeTab));
  }

  accountExpandedContent.replaceChildren(
    createAccountFriendsSearch(),
    createAccountFriendsTabs(activeTab),
    list
  );
}

async function inviteAccountFriend(button) {
  button.disabled = true;
  try {
    const response = await fetch(
      `/api/accounts/friends/${encodeURIComponent(button.dataset.friendId)}/invite`,
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      }
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      throw new Error(
        payload?.error?.message || payload?.message || 'Invite failed'
      );
    }
    if (typeof window.recordAccountAchievementEvent === 'function') {
      window.recordAccountAchievementEvent('party.invite-sent', {
        oncePerPage: false
      });
    }
    setAccountFooterHint(
      payload?.data?.message || payload?.message || 'Invite sent'
    );
  } catch (error) {
    setAccountFooterHint(error.message);
    console.warn(error);
  } finally {
    button.disabled = !accountInviteSessionActive;
  }
}
