function createAccountProfileSection(title) {
  const section = document.createElement('section');
  section.className = 'account-profile-section';

  const heading = document.createElement('h3');
  heading.className = 'account-profile-section-title';
  heading.textContent = title;

  section.appendChild(heading);
  return section;
}

function createAccountProfileRow(label, value, options = {}) {
  const row = document.createElement('div');
  row.className = 'account-profile-row';
  if (options.editAction) row.classList.add('has-edit-action');

  if (options.status) {
    row.classList.add(`account-profile-row-${options.status}`);
  }

  const labelElement = document.createElement('span');
  labelElement.className = 'account-profile-label';
  labelElement.textContent = label;

  const valueElement = options.href
    ? document.createElement('button')
    : document.createElement('span');
  valueElement.className = 'account-profile-value';
  valueElement.textContent = value || '-';

  if (options.href) {
    valueElement.type = 'button';
    valueElement.classList.add('account-profile-link');
    valueElement.dataset.profileAction = options.action || '';
    valueElement.dataset.accountHint = options.hint || value || '';
  }

  row.append(labelElement, valueElement);

  if (options.editAction) {
    const editButton = document.createElement('button');
    editButton.className = 'account-profile-edit-button';
    editButton.type = 'button';
    editButton.dataset.profileAction = options.editAction;
    editButton.dataset.accountHint =
      options.editHint || options.editLabel || `Edit ${label}`;
    editButton.setAttribute('aria-label', options.editLabel || `Edit ${label}`);
    editButton.title = options.editLabel || `Edit ${label}`;
    editButton.replaceChildren(createTrustedHtmlFragment(accountEditIconSvg));
    row.appendChild(editButton);
  }

  return row;
}

function createAccountProfileProviderList(providers) {
  const list = document.createElement('div');
  list.className = 'account-profile-provider-list';

  const providerNames = new Set(
    Array.isArray(providers)
      ? providers.filter((provider) => provider !== 'email')
      : []
  );

  accountSocialProviders.forEach((provider) => {
    const action = document.createElement('button');
    action.className = 'account-profile-provider';
    action.type = 'button';
    action.setAttribute(
      'aria-label',
      `${formatAccountProvider(provider)} sign in`
    );
    action.title = formatAccountProvider(provider);
    action.replaceChildren(
      createTrustedHtmlFragment(accountSocialProviderIcons[provider])
    );

    if (providerNames.has(provider)) {
      action.classList.add('is-linked');
      action.dataset.accountHint = `${formatAccountProvider(provider)} sign in is already linked`;
      action.setAttribute('aria-disabled', 'true');
      action.setAttribute(
        'aria-label',
        `${formatAccountProvider(provider)} is linked`
      );
      action.title = `${formatAccountProvider(provider)} linked`;
    } else {
      action.dataset.profileAction = 'linkProvider';
      action.dataset.provider = provider;
      action.dataset.accountHint = `Link ${formatAccountProvider(provider)} sign in`;
      action.setAttribute(
        'aria-label',
        `Link ${formatAccountProvider(provider)} sign in`
      );
      action.title = `Link ${formatAccountProvider(provider)}`;
    }

    list.appendChild(action);
  });

  return list;
}

function createAccountProfileAction(label, action, options = {}) {
  const button = document.createElement('button');
  button.className = 'account-profile-action';
  button.type = 'button';
  button.dataset.profileAction = action;
  button.dataset.accountHint = options.hint || label;
  if (options.hintClass) {
    button.dataset.accountHintClass = options.hintClass;
  }
  button.textContent = label;

  if (options.fullWidth) button.classList.add('full-width');
  if (options.danger) button.classList.add('danger');
  if (options.disabled) {
    button.disabled = true;
    button.title = options.title || 'Coming soon';
  }

  return button;
}

function renderAccountProfilePanel() {
  if (!accountExpandedContent) return;

  const account = getStoredAccount();
  if (!account) {
    accountExpandedContent.replaceChildren(
      createAccountProfileRow('Status', 'Sign in to view your profile')
    );
    return;
  }

  const details = createAccountProfileSection('Details');
  details.append(
    createAccountProfileRow('Username', account.username),
    createAccountProfileRow('Email', account.email, {
      editAction: 'manageEmail',
      editLabel: 'Change email address',
      editHint: 'Send a link to change your email address'
    }),
    createAccountProfileRow(
      'Email status',
      account.emailVerified ? 'Verified' : 'Send verification email',
      account.emailVerified
        ? { status: 'success' }
        : {
            status: 'warning',
            href: true,
            action: 'sendVerificationEmail',
            hint: 'Send a verification email to this address'
          }
    ),
    createAccountProfileRow(
      'Account status',
      account.accountStatusLabel || account.accountStatus || 'Active'
    ),
    createAccountProfileRow('Password', 'Password set', {
      editAction: 'changePassword',
      editLabel: 'Change password',
      editHint: 'Go to password reset'
    }),
    createAccountProfileRow('Joined', formatAccountDate(account.createdAt))
  );

  const linkedMethods = createAccountProfileSection('Linked Sign-In Methods');
  linkedMethods.appendChild(
    createAccountProfileProviderList(account.loginProviders)
  );

  const security = createAccountProfileSection('Security');
  security.appendChild(
    createAccountProfileAction('Devices and sessions', 'securitySessions', {
      fullWidth: true,
      hint: 'Review and sign out devices with account access'
    })
  );

  const stats = createAccountProfileSection('Basic Stats');
  stats.append(
    createAccountProfileRow(
      'Posts shared',
      formatAccountNumber(account.stats?.postsShared)
    ),
    createAccountProfileRow(
      'Games played',
      formatAccountNumber(account.stats?.gamesPlayed)
    )
  );

  const privacySettings = account.privacySettings || {};
  const latestDataExport = account.legal?.latestDataExportRequest;
  const latestDeletionRequest = account.legal?.latestAccountDeletionRequest;
  const privacy = createAccountProfileSection('Privacy');
  privacy.append(
    createAccountProfileRow(
      'Profile visibility',
      formatAccountSettingLabel(privacySettings.profileVisibility || 'public')
    ),
    createAccountProfileRow(
      'Game stats',
      privacySettings.showGameStats === false ? 'Hidden' : 'Visible'
    ),
    createAccountProfileRow(
      'Online status',
      privacySettings.showOnlineStatus === false ? 'Hidden' : 'Visible'
    ),
    createAccountProfileRow(
      'Friend requests',
      privacySettings.allowFriendRequests === false ? 'Blocked' : 'Allowed'
    ),
    createAccountProfileRow(
      'Data export',
      latestDataExport
        ? formatAccountSettingLabel(latestDataExport.status)
        : 'Not requested'
    ),
    createAccountProfileRow(
      'Deletion request',
      latestDeletionRequest
        ? formatAccountSettingLabel(latestDeletionRequest.status)
        : 'Not requested'
    )
  );

  const privacyActions = document.createElement('div');
  privacyActions.className = 'account-profile-action-list';
  privacyActions.append(
    createAccountProfileAction(
      privacySettings.profileVisibility === 'private'
        ? 'Make profile public'
        : 'Make profile private',
      privacySettings.profileVisibility === 'private'
        ? 'makeProfilePublic'
        : 'makeProfilePrivate',
      {
        hint:
          privacySettings.profileVisibility === 'private'
            ? 'Allow everyone to see your profile'
            : 'Only you can see your profile'
      }
    ),
    createAccountProfileAction(
      privacySettings.showGameStats === false
        ? 'Show game stats'
        : 'Hide game stats',
      privacySettings.showGameStats === false
        ? 'showGameStats'
        : 'hideGameStats',
      {
        hint:
          privacySettings.showGameStats === false
            ? 'Show your game stats on your profile'
            : 'Hide your game stats from your profile'
      }
    ),
    createAccountProfileAction(
      privacySettings.showOnlineStatus === false
        ? 'Show online status'
        : 'Hide online status',
      privacySettings.showOnlineStatus === false
        ? 'showOnlineStatus'
        : 'hideOnlineStatus',
      {
        hint:
          privacySettings.showOnlineStatus === false
            ? 'Show when you are online'
            : 'Hide when you are online'
      }
    ),
    createAccountProfileAction(
      privacySettings.allowFriendRequests === false
        ? 'Allow friend requests'
        : 'Block friend requests',
      privacySettings.allowFriendRequests === false
        ? 'allowFriendRequests'
        : 'blockFriendRequests',
      {
        hint:
          privacySettings.allowFriendRequests === false
            ? 'Allow people to send friend requests'
            : 'Stop people sending friend requests'
      }
    )
  );
  privacy.appendChild(privacyActions);

  const purchaseHistoryButton = createAccountProfileAction(
    'Purchase history',
    'purchaseHistory',
    {
      fullWidth: true,
      hint: accountCommerceEnabled
        ? 'View your purchase history'
        : 'Purchase history will open with the shop',
      disabled: !accountCommerceEnabled,
      title: 'Available when the shop opens'
    }
  );

  const dataExportButton = createAccountProfileAction(
    'Request data export',
    'requestDataExport',
    {
      fullWidth: true,
      hint: 'Request a copy of your account data'
    }
  );

  const deleteAccountButton = createAccountProfileAction(
    'Request account deletion',
    'deleteAccount',
    {
      danger: true,
      hint: 'Request deletion of your account',
      hintClass: 'warning'
    }
  );

  accountExpandedContent.replaceChildren(
    details,
    linkedMethods,
    security,
    stats,
    privacy,
    purchaseHistoryButton,
    dataExportButton,
    deleteAccountButton
  );
}
