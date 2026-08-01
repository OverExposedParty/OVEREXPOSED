function formatAccountSessionActivity(value) {
  const timestamp = new Date(value || 0).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 'Activity unknown';

  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 1000)
  );
  if (elapsedSeconds < 90) return 'Active now';

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `Active ${elapsedMinutes} minutes ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `Active ${elapsedHours} ${elapsedHours === 1 ? 'hour' : 'hours'} ago`;
  }

  return `Last active ${formatAccountDate(value)}`;
}

function createAccountSecurityStatus(message, isError = false) {
  const status = document.createElement('p');
  status.className = 'account-security-status';
  status.classList.toggle('is-error', isError);
  status.textContent = message;
  return status;
}

function getAccountSessionDeviceLabel(session) {
  const browser = session?.device?.browser || 'Unknown browser';
  const os = session?.device?.os || 'Unknown OS';
  return `${browser} on ${os}`;
}

async function requestAccountSessionAction(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...options
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Session action failed');
  }

  return payload;
}

function createAccountSessionCard(session) {
  const card = document.createElement('article');
  card.className = 'account-security-session';
  card.classList.toggle('is-current', Boolean(session.current));

  const summary = document.createElement('div');
  summary.className = 'account-security-session-summary';

  const title = document.createElement('h3');
  title.className = 'account-security-session-title';
  title.textContent = getAccountSessionDeviceLabel(session);

  const type = document.createElement('span');
  type.className = 'account-security-session-type';
  type.textContent = session?.device?.deviceType || 'Unknown device';

  const activity = document.createElement('p');
  activity.className = 'account-security-session-activity';
  activity.textContent = formatAccountSessionActivity(
    session.lastUsedAt || session.createdAt
  );

  const created = document.createElement('p');
  created.className = 'account-security-session-created';
  created.textContent = session.createdAt
    ? `Signed in ${formatAccountDate(session.createdAt)}`
    : 'Sign-in date unavailable';

  summary.append(title, type, activity, created);
  card.appendChild(summary);

  if (session.current) {
    const current = document.createElement('span');
    current.className = 'account-security-current-label';
    current.textContent = 'This device';
    card.appendChild(current);
  } else if (session.manageable && session.id) {
    const revoke = document.createElement('button');
    revoke.className = 'account-security-session-action';
    revoke.type = 'button';
    revoke.textContent = 'Sign out';
    revoke.dataset.accountHint = `Sign out ${getAccountSessionDeviceLabel(session)}`;
    revoke.addEventListener('click', async () => {
      const confirmed = window.confirm(
        `Sign out ${getAccountSessionDeviceLabel(session)}?`
      );
      if (!confirmed) return;

      revoke.disabled = true;
      try {
        const payload = await requestAccountSessionAction(
          `/api/accounts/sessions/${encodeURIComponent(session.id)}`,
          { method: 'DELETE' }
        );
        setAccountFooterHint(payload.message || 'Device signed out');
        await renderAccountSecurityPanel();
      } catch (error) {
        revoke.disabled = false;
        setAccountFooterHint(error.message || 'Failed to sign out device');
      }
    });
    card.appendChild(revoke);
  } else {
    const legacy = document.createElement('span');
    legacy.className = 'account-security-legacy-label';
    legacy.textContent = 'Older session';
    legacy.title = 'This session can be removed by signing out other devices';
    card.appendChild(legacy);
  }

  return card;
}

async function renderAccountSecurityPanel() {
  if (!accountExpandedContent) return;

  accountExpandedContent.replaceChildren(
    createAccountSecurityStatus('Loading devices and sessions...')
  );

  try {
    const payload = await requestAccountSessionAction('/api/accounts/sessions');
    if (accountExpandedAction !== 'security') return;

    const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
    const intro = document.createElement('p');
    intro.className = 'account-security-intro';
    intro.textContent =
      'These browsers currently have access to your OverExposed account.';

    const list = document.createElement('div');
    list.className = 'account-security-session-list';
    sessions.forEach((session) => {
      list.appendChild(createAccountSessionCard(session));
    });

    if (!sessions.length) {
      list.appendChild(
        createAccountSecurityStatus('No active sessions found.')
      );
    }

    const otherSessions = sessions.filter((session) => !session.current);
    const logoutOthers = document.createElement('button');
    logoutOthers.className = 'account-security-logout-others';
    logoutOthers.type = 'button';
    logoutOthers.textContent = 'Sign out all other devices';
    logoutOthers.disabled = otherSessions.length === 0;
    logoutOthers.dataset.accountHint = otherSessions.length
      ? 'Keep this device signed in and remove all other account sessions'
      : 'There are no other devices to sign out';
    logoutOthers.addEventListener('click', async () => {
      if (!window.confirm('Sign out every other device?')) return;

      logoutOthers.disabled = true;
      try {
        const result = await requestAccountSessionAction(
          '/api/accounts/sessions/logout-others',
          { method: 'POST' }
        );
        setAccountFooterHint(result.message || 'Other devices signed out');
        await renderAccountSecurityPanel();
      } catch (error) {
        logoutOthers.disabled = false;
        setAccountFooterHint(
          error.message || 'Failed to sign out other devices'
        );
      }
    });

    accountExpandedContent.replaceChildren(intro, list, logoutOthers);
  } catch (error) {
    if (accountExpandedAction !== 'security') return;
    accountExpandedContent.replaceChildren(
      createAccountSecurityStatus(
        error.message || 'Failed to load devices and sessions',
        true
      )
    );
  }
}
