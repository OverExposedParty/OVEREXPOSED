function getStoredOnlineMenuAccount() {
  try {
    return JSON.parse(localStorage.getItem('oe-account')) || null;
  } catch {
    return null;
  }
}

function getCurrentOnlineMenuAccountId() {
  const account = getStoredOnlineMenuAccount();
  return account?.id || account?._id || '';
}

function canOpenOnlineUserActionMenu(context = {}) {
  const viewerAccountId = getCurrentOnlineMenuAccountId();
  const targetAccountId = context.accountId || '';

  return Boolean(
    viewerAccountId &&
      targetAccountId &&
      String(viewerAccountId) !== String(targetAccountId)
  );
}

function getOnlineFriendActionState(relationship = {}) {
  const status = relationship.status || 'not_friends';
  const labels = {
    friends: 'FRIENDS',
    pending_sent: 'REQUEST SENT',
    pending_received: 'ACCEPT FRIEND',
    blocked: 'BLOCKED',
    signed_out: 'SIGN IN TO ADD',
    self: 'YOUR PROFILE'
  };
  const isRequestDisabled =
    status === 'not_friends' && relationship.allowFriendRequests === false;
  const action = status === 'pending_received' ? 'accept' : 'send';

  return {
    action,
    label:
      labels[status] ||
      (relationship.allowFriendRequests === false
        ? 'REQUESTS OFF'
        : 'ADD FRIEND'),
    disabled:
      !['not_friends', 'pending_received'].includes(status) ||
      isRequestDisabled
  };
}

async function updateOnlinePublicFriendRelationship(accountId, action = 'send') {
  if (window.updateOeFriendRelationship) {
    return window.updateOeFriendRelationship(accountId, action);
  }

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

  if (payload.account) {
    localStorage.setItem('oe-account', JSON.stringify(payload.account));
    window.setAccountPreview?.(payload.account);
  }
  return payload;
}

function createOnlinePublicProfileFriendButton(profile, account) {
  const state = getOnlineFriendActionState(profile.relationship);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'online-public-profile-friend-button';
  button.textContent = state.label;
  button.disabled = state.disabled;
  button.dataset.accountHint = state.disabled
    ? state.label
    : `Send ${profile.username || 'player'} a friend request`;

  if (profile.relationship?.status === 'signed_out') {
    button.disabled = true;
  }

  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'SENDING...';

    try {
      await updateOnlinePublicFriendRelationship(profile.id, state.action);
      profile.relationship = {
        ...profile.relationship,
        status: state.action === 'accept' ? 'friends' : 'pending_sent',
        canSendFriendRequest: false
      };
      renderOnlinePublicProfileOverview(account, profile);
    } catch (error) {
      button.disabled = false;
      button.textContent = state.label;
      button.dataset.accountHint = error?.message || 'Friend request failed';
      console.warn(error);
    }
  });

  return button;
}

