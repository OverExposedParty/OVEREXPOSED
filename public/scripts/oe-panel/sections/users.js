window.OE_PANEL_SECTIONS = window.OE_PANEL_SECTIONS || {};
window.OE_PANEL_SECTIONS["Users"] = [
    {
      id: 'users-grid-1',
      type: 'stats',
      title: 'User Stats',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      stats: [
        {
          label: 'Total Users',
          value: '-',
          detail: '-',
          expandedType: 'table'
        },
        {
          label: 'Online Now',
          value: '-',
          detail: '-',
          expandedType: 'table'
        },
        {
          label: 'New Today',
          value: '-',
          detail: '-',
          expandedType: 'table'
        },
        {
          label: 'Account Flags',
          value: '-',
          detail: '-',
          expandedType: 'table'
        }
      ]
    },
    {
      id: 'users-grid-2',
      type: 'table',
      title: 'Users',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      columns: [
        { key: 'joined', label: 'Joined' },
        { key: 'user', label: 'User' },
        { key: 'role', label: 'Role' },
        { key: 'status', label: 'Status' },
        { key: 'lastSeen', label: 'Last Seen' }
      ],
      rows: [],
      dataSource: 'users',
      expandedFields: [
        { key: 'displayName', label: 'Display Name', section: 'Identity' },
        { key: 'email', label: 'Email' },
        { key: 'emailVerified', label: 'Email Verified' },
        { key: 'accountId', label: 'Account ID' },
        { key: 'accountAge', label: 'Account Age' },
        { key: 'country', label: 'Country' },
        { key: 'language', label: 'Language' },
        { key: 'oeIcon', label: 'OE Icon' },
        { key: 'status', label: 'Status', section: 'Access & Security' },
        { key: 'suspensionReason', label: 'Suspension Reason' },
        { key: 'suspensionExpires', label: 'Suspension Expires' },
        { key: 'lastLogin', label: 'Last Login' },
        { key: 'lastSeen', label: 'Last Seen' },
        { key: 'provider', label: 'Login Providers' },
        { key: 'twoFactor', label: 'Two-Factor Authentication' },
        { key: 'activeSessions', label: 'Active Sessions' },
        { key: 'latestLogin', label: 'Latest Login Event', expandable: true },
        { key: 'failedLoginAttempts', label: 'Failed Login Attempts' },
        { key: 'lockoutExpires', label: 'Lockout Expires' },
        { key: 'suspiciousActivity', label: 'Suspicious Activity' },
        { key: 'compromisedPassword', label: 'Compromised Password' },
        { key: 'role', label: 'Primary Role', section: 'Administration' },
        { key: 'adminRoles', label: 'Admin Roles' },
        { key: 'permissionCount', label: 'Permission Count' },
        { key: 'permissions', label: 'Permissions', expandable: true },
        { key: 'adminTwoFactor', label: 'Admin Two-Factor' },
        { key: 'adminActionCount', label: 'Admin Actions Against Account' },
        {
          key: 'recentAdminActions',
          label: 'Recent Admin Actions',
          expandable: true
        },
        { key: 'opalsBalance', label: 'Opals Balance', section: 'Economy' },
        { key: 'opalsLifetimeEarned', label: 'Lifetime Opals Earned' },
        { key: 'opalsLifetimeSpent', label: 'Lifetime Opals Spent' },
        { key: 'opalTransactionCount', label: 'Opal Transactions' },
        {
          key: 'recentOpalTransactions',
          label: 'Recent Opal Transactions',
          expandable: true
        },
        { key: 'orderCount', label: 'Orders' },
        { key: 'paidOrderCount', label: 'Paid Orders' },
        { key: 'totalSpend', label: 'Total Spend' },
        { key: 'purchasedProducts', label: 'Purchased Products' },
        { key: 'digitalEntitlements', label: 'Digital Entitlements' },
        { key: 'unlockCount', label: 'Game Unlocks' },
        { key: 'level', label: 'Level', section: 'Game Activity' },
        { key: 'xp', label: 'XP' },
        { key: 'gamesPlayed', label: 'Games Played' },
        { key: 'roundsPlayed', label: 'Rounds Played' },
        { key: 'playtime', label: 'Total Playtime' },
        { key: 'lastGameMode', label: 'Last Game Mode' },
        { key: 'lastPlayed', label: 'Last Played' },
        { key: 'achievements', label: 'Achievements' },
        { key: 'friends', label: 'Friends' },
        { key: 'blockedUsers', label: 'Blocked Users' },
        { key: 'olingCount', label: 'Olings', section: 'Olings' },
        { key: 'olingEggs', label: 'Eggs' },
        { key: 'olingConsumables', label: 'Consumables' },
        { key: 'olingFurniture', label: 'Furniture' },
        { key: 'olingHatches', label: 'Hatches' },
        { key: 'olingLabLevel', label: 'Lab Level' },
        {
          key: 'overexposurePosts',
          label: 'Overexposure Posts',
          section: 'Content & Moderation'
        },
        { key: 'reportsCreated', label: 'Reports Submitted' },
        { key: 'reportsReceived', label: 'Reports Received' },
        { key: 'openReportsReceived', label: 'Open Reports Received' },
        { key: 'reputation', label: 'Reputation' },
        { key: 'moderationStrikes', label: 'Moderation Strikes' },
        {
          key: 'signupSource',
          label: 'Signup Source',
          section: 'Acquisition'
        },
        { key: 'signupReferrer', label: 'Signup Referrer', expandable: true },
        { key: 'signupCapturedAt', label: 'Signup Captured' }
      ],
      rowActions: [
        { label: 'Suspend', action: 'suspend' },
        { label: 'Ban', action: 'ban' },
        { label: 'Delete', action: 'delete' }
      ],
      deleteEndpoint: '/api/oe-panel/users/{accountId}'
    },
    {
      id: 'users-grid-3',
      type: 'calendar',
      title: 'Signup Activity',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      counts: {},
      targetGridId: 'users-grid-2',
      targetFilterField: 'date'
    },
    {
      id: 'users-grid-4',
      type: 'actions',
      title: 'User Actions',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      actions: [
        {
          label: 'Account Flags',
          value: 'account-flags',
          countKey: 'accountFlags',
          alertSource: 'accountFlagAlerts',
          emptyTitle: 'No account flags',
          emptyDetail: 'Suspended and banned accounts will appear here.'
        },
        {
          label: 'Manage Opals',
          value: 'manage-opals',
          actions: [
            {
              label: 'Add Opals',
              value: 'add-opals',
              form: {
                title: 'Add Opals',
                backLabel: 'Back to manage opals',
                submitEndpoint: '/api/oe-panel/users/opals/add',
                submitLabel: 'Add Opals',
                submittingLabel: 'Adding...',
                successMessage: 'Opals added.',
                successButtonLabel: 'Added',
                errorMessage: 'Opals could not be added.',
                successEvent: 'oe-panel-users-data-changed',
                fields: [
                  {
                    type: 'player-lookup',
                    name: 'accountId',
                    label: 'Player',
                    required: true,
                    placeholder: 'Search username or paste account ID',
                    searchEndpoint: '/api/oe-panel/users/search'
                  },
                  {
                    name: 'amount',
                    label: 'Amount',
                    required: true,
                    inputType: 'number',
                    inputMode: 'numeric',
                    placeholder: '100'
                  },
                  {
                    name: 'reason',
                    label: 'Reason',
                    required: true,
                    placeholder: 'Admin adjustment'
                  }
                ]
              }
            },
            {
              label: 'Remove Opals',
              value: 'remove-opals',
              form: {
                title: 'Remove Opals',
                backLabel: 'Back to manage opals',
                submitEndpoint: '/api/oe-panel/users/opals/remove',
                submitLabel: 'Remove Opals',
                submittingLabel: 'Removing...',
                successMessage: 'Opals removed.',
                successButtonLabel: 'Removed',
                errorMessage: 'Opals could not be removed.',
                successEvent: 'oe-panel-users-data-changed',
                fields: [
                  {
                    type: 'player-lookup',
                    name: 'accountId',
                    label: 'Player',
                    required: true,
                    placeholder: 'Search username or paste account ID',
                    searchEndpoint: '/api/oe-panel/users/search'
                  },
                  {
                    name: 'amount',
                    label: 'Amount',
                    required: true,
                    inputType: 'number',
                    inputMode: 'numeric',
                    placeholder: '100'
                  },
                  {
                    name: 'reason',
                    label: 'Reason',
                    required: true,
                    placeholder: 'Admin adjustment'
                  }
                ]
              }
            }
          ]
        }
      ]
    }
  ];
