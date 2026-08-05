window.OE_PANEL_SECTIONS = window.OE_PANEL_SECTIONS || {};
window.OE_PANEL_SECTIONS['Party Games'] = [
  {
    id: 'party-games-grid-1',
    type: 'table',
    title: 'Series',
    backgroundColour: '#202020',
    primaryColour: 'var(--primarypagecolour)',
    secondaryColour: 'var(--secondarypagecolour)',
    defaultSeries: 'rooms',
    tableSeries: [
      {
        value: 'rooms',
        label: 'Rooms',
        columns: [
          { key: 'roomCode', label: 'Room Code' },
          { key: 'gameId', label: 'Game ID' },
          { key: 'gamemode', label: 'Gamemode' },
          { key: 'playerCount', label: 'Player Count' },
          { key: 'timeLapsed', label: 'Time Lapsed' },
          { key: 'serverRegion', label: 'Server Region' },
          { key: 'roomStatus', label: 'Room Status' }
        ],
        expandedFields: [
          { key: 'gameId', label: 'Game ID', section: 'Room' },
          { key: 'gamemode', label: 'Gamemode' },
          { key: 'date', label: 'Date' },
          { key: 'hostUser', label: 'Host User' },
          { key: 'createdAt', label: 'Created At' },
          { key: 'lastUpdated', label: 'Last Updated' },
          { key: 'roomStatus', label: 'Room Status' },
          { key: 'serverRegion', label: 'Server Region' },
          { key: 'visibility', label: 'Visibility' },
          { key: 'phase', label: 'Phase' },
          { key: 'currentRound', label: 'Current Round' },
          { key: 'playerTurn', label: 'Player Turn' },
          { key: 'outcome', label: 'Outcome' },
          {
            key: 'players',
            label: 'Player Identities',
            section: 'Players',
            expandable: true
          },
          { key: 'accountPlayers', label: 'Signed-In Players' },
          { key: 'guestPlayers', label: 'Guest Players' },
          { key: 'connectedPlayers', label: 'Connected Players' },
          { key: 'disconnectedPlayers', label: 'Disconnected Players' },
          { key: 'readyPlayers', label: 'Ready Players' },
          {
            key: 'selectedPacks',
            label: 'Selected Packs',
            section: 'Configuration',
            expandable: true
          },
          {
            key: 'roleCounts',
            label: 'Role Counts',
            expandable: true,
            palette: {
              type: 'role',
              map: true,
              fallbackType: 'gamemode'
            }
          },
          {
            key: 'gameRules',
            label: 'Game Rules',
            expandable: true,
            palette: {
              type: 'rule',
              map: true,
              fallbackType: 'gamemode'
            }
          },
          { key: 'instruction', label: 'Instructions', expandable: true },
          {
            key: 'configSummary',
            label: 'Full Configuration',
            expandable: true
          },
          {
            key: 'stateSummary',
            label: 'Current State',
            section: 'Diagnostics',
            expandable: true
          },
          { key: 'reportCount', label: 'Reports' },
          { key: 'errorCount', label: 'Error Count' },
          { key: 'errorSummary', label: 'Errors', expandable: true },
          { key: 'spectators', label: 'Spectators' },
          { key: 'sourceCollection', label: 'Source Collection' }
        ],
        rows: [],
        dataSource: 'partyRooms',
        deleteEndpoint:
          '/api/oe-panel/party-rooms/{roomCode}?sourceCollection={sourceCollection}'
      },
      {
        value: 'packs',
        label: 'Packs',
        columns: [
          { key: 'title', label: 'Pack' },
          { key: 'gamemode', label: 'Gamemode' },
          { key: 'availabilityState', label: 'Availability' },
          { key: 'status', label: 'Status' },
          { key: 'active', label: 'Active' },
          { key: 'questionCount', label: 'Questions' }
        ],
        expandedFields: [
          { key: 'title', label: 'Pack', editable: true },
          { key: 'slug', label: 'Slug' },
          { key: 'packKey', label: 'Pack Key' },
          { key: 'gamemode', label: 'Gamemode' },
          { key: 'status', label: 'Status', editable: true },
          { key: 'active', label: 'Active', editable: true },
          {
            key: 'availabilityMode',
            label: 'Availability Mode',
            section: 'Availability',
            editable: true,
            inputType: 'select',
            options: ['always', 'fixed', 'annual']
          },
          { key: 'availabilityState', label: 'Current State' },
          {
            key: 'availabilityTimeZone',
            label: 'Timezone',
            editable: true,
            inputType: 'availability-timezone'
          },
          {
            key: 'availableFrom',
            label: 'Available From',
            editable: true,
            inputType: 'availability-boundary'
          },
          {
            key: 'availableUntil',
            label: 'Available Until',
            editable: true,
            inputType: 'availability-boundary'
          },
          { key: 'description', label: 'Description', editable: true },
          { key: 'difficulty', label: 'Difficulty', editable: true },
          { key: 'restriction', label: 'Restriction', editable: true },
          { key: 'questionCount', label: 'Question Count' },
          { key: 'colour', label: 'Colour', editable: true },
          {
            key: 'secondaryColour',
            label: 'Secondary Colour',
            editable: true
          },
          { key: 'updatedAt', label: 'Updated At' }
        ],
        rows: [],
        dataSource: 'partyPacks',
        deleteEndpoint: '/api/oe-panel/game-packs/{key}',
        rowActions: [
          { label: 'Edit', action: 'edit-game-pack' },
          { label: 'Delete', action: 'delete' }
        ]
      },
      {
        value: 'rules',
        label: 'Rules',
        columns: [
          { key: 'rule', label: 'Rule' },
          { key: 'gamemode', label: 'Gamemode' },
          { key: 'buttonType', label: 'Button Type' },
          { key: 'availabilityState', label: 'Availability' },
          { key: 'status', label: 'Status' },
          { key: 'active', label: 'Active' }
        ],
        expandedFields: [
          { key: 'rule', label: 'Rule', editable: true },
          { key: 'ruleKey', label: 'Rule Key' },
          { key: 'gamemode', label: 'Gamemode' },
          { key: 'status', label: 'Status', editable: true },
          { key: 'active', label: 'Active', editable: true },
          {
            key: 'availabilityMode',
            label: 'Availability Mode',
            section: 'Availability',
            editable: true,
            inputType: 'select',
            options: ['always', 'fixed', 'annual']
          },
          { key: 'availabilityState', label: 'Current State' },
          {
            key: 'availabilityTimeZone',
            label: 'Timezone',
            editable: true,
            inputType: 'availability-timezone'
          },
          {
            key: 'availableFrom',
            label: 'Available From',
            editable: true,
            inputType: 'availability-boundary'
          },
          {
            key: 'availableUntil',
            label: 'Available Until',
            editable: true,
            inputType: 'availability-boundary'
          },
          { key: 'description', label: 'Description', editable: true },
          { key: 'buttonType', label: 'Button Type', editable: true },
          { key: 'restriction', label: 'Restriction', editable: true },
          {
            key: 'requiredSetting',
            label: 'Required Setting',
            editable: true
          },
          { key: 'designation', label: 'Designation', editable: true },
          { key: 'initialValue', label: 'Initial Value', editable: true },
          {
            key: 'incrementValue',
            label: 'Increment Value',
            editable: true
          },
          { key: 'minimumValue', label: 'Minimum Value', editable: true },
          { key: 'maximumValue', label: 'Maximum Value', editable: true },
          { key: 'colour', label: 'Colour', editable: true },
          {
            key: 'secondaryColour',
            label: 'Secondary Colour',
            editable: true
          },
          { key: 'updatedAt', label: 'Updated At' }
        ],
        rows: [],
        dataSource: 'partyRules',
        editable: true,
        saveEndpoint: '/api/oe-panel/game-rules/{key}',
        deleteEndpoint: '/api/oe-panel/game-rules/{key}',
        rowActions: [{ label: 'Delete', action: 'delete' }]
      },
      {
        value: 'roles',
        label: 'Roles',
        columns: [
          { key: 'role', label: 'Role' },
          { key: 'gamemode', label: 'Gamemode' },
          { key: 'faction', label: 'Faction' },
          { key: 'availabilityState', label: 'Availability' },
          { key: 'status', label: 'Status' },
          { key: 'active', label: 'Active' }
        ],
        expandedFields: [
          { key: 'role', label: 'Role', editable: true },
          { key: 'roleKey', label: 'Role Key' },
          { key: 'gamemode', label: 'Gamemode' },
          { key: 'faction', label: 'Faction', editable: true },
          { key: 'status', label: 'Status', editable: true },
          { key: 'active', label: 'Active', editable: true },
          {
            key: 'availabilityMode',
            label: 'Availability Mode',
            section: 'Availability',
            editable: true,
            inputType: 'select',
            options: ['always', 'fixed', 'annual']
          },
          { key: 'availabilityState', label: 'Current State' },
          {
            key: 'availabilityTimeZone',
            label: 'Timezone',
            editable: true,
            inputType: 'availability-timezone'
          },
          {
            key: 'availableFrom',
            label: 'Available From',
            editable: true,
            inputType: 'availability-boundary'
          },
          {
            key: 'availableUntil',
            label: 'Available Until',
            editable: true,
            inputType: 'availability-boundary'
          },
          { key: 'description', label: 'Description', editable: true },
          { key: 'defaultCount', label: 'Default Count', editable: true },
          { key: 'increment', label: 'Increment', editable: true },
          { key: 'minimum', label: 'Minimum', editable: true },
          { key: 'maximum', label: 'Maximum', editable: true },
          {
            key: 'fillRemaining',
            label: 'Fill Remaining',
            editable: true
          },
          { key: 'sortOrder', label: 'Sort Order', editable: true },
          { key: 'colour', label: 'Colour', editable: true },
          {
            key: 'secondaryColour',
            label: 'Secondary Colour',
            editable: true
          },
          { key: 'updatedAt', label: 'Updated At' }
        ],
        rows: [],
        dataSource: 'partyRoles',
        editable: true,
        saveEndpoint: '/api/oe-panel/game-roles/{key}',
        deleteEndpoint: '/api/oe-panel/game-roles/{key}',
        rowActions: [{ label: 'Delete', action: 'delete' }]
      },
      {
        value: 'gamemodes',
        label: 'Gamemodes',
        columns: [
          { key: 'gamemode', label: 'Gamemode' },
          { key: 'rooms', label: 'Rooms (30d)' },
          { key: 'share', label: 'Share' },
          { key: 'activeRooms', label: 'Active' },
          { key: 'errorRate', label: 'Error Rate' }
        ],
        expandedFields: [
          { key: 'gamemodeKey', label: 'Gamemode Key' },
          { key: 'rooms', label: 'Archived Rooms (30d)' },
          { key: 'share', label: 'Room Share' },
          { key: 'activeRooms', label: 'Active Rooms' },
          { key: 'averagePlayers', label: 'Average Players' },
          { key: 'errorRate', label: 'Room Error Rate' },
          { key: 'outcomeCoverage', label: 'Outcome Data Coverage' },
          { key: 'latestArchived', label: 'Latest Archived Room' }
        ],
        rows: [],
        dataSource: 'partyGamemodes'
      }
    ]
  },
  {
    id: 'party-games-grid-2',
    type: 'stats',
    title: 'Game Stats',
    backgroundColour: '#202020',
    primaryColour: 'var(--primarypagecolour)',
    secondaryColour: 'var(--secondarypagecolour)',
    stats: [
      {
        label: 'Active Rooms',
        value: '-',
        detail: 'live database',
        expandedType: 'graph'
      },
      {
        label: 'Players Online',
        value: '-',
        detail: 'active rooms',
        expandedType: 'table'
      },
      {
        label: 'Most Popular',
        value: '-',
        detail: 'stored summaries',
        expandedType: 'graph'
      },
      {
        label: 'Room Error Rate',
        value: '-',
        detail: 'active + archived',
        expandedType: 'table'
      }
    ]
  },
  {
    id: 'party-games-grid-3',
    type: 'pieChart',
    title: 'Gamemodes Played',
    backgroundColour: '#202020',
    primaryColour: 'var(--primarypagecolour)',
    secondaryColour: 'var(--secondarypagecolour)',
    endpoint: '/api/oe-panel/party-games/gamemode-distribution',
    elements: [],
    defaultFilters: {
      datePreset: '30d',
      metric: 'games',
      excludedGamemodes: [],
      includeUnknown: false,
      minimumCount: 0,
      topN: 0
    },
    elementFields: {
      key: 'key',
      label: 'label',
      value: 'value',
      percentage: 'percentage',
      colour: 'colour'
    },
    targetGridId: 'party-games-grid-1',
    targetSeries: 'rooms',
    targetFilterField: 'gamemode'
  },
  {
    id: 'party-games-grid-4',
    type: 'actions',
    title: 'Quick Actions',
    backgroundColour: '#202020',
    primaryColour: 'var(--primarypagecolour)',
    secondaryColour: 'var(--secondarypagecolour)',
    alerts: [],
    visibleAlerts: 8,
    visibleActions: 8,
    actions: [
      {
        label: 'Room Activity',
        value: 'room-activity',
        view: 'embedded-widget',
        widget: {
          type: 'calendar',
          title: 'Rooms by day',
          dataSource: 'partyRoomActivity',
          counts: {},
          countLabel: 'rooms',
          targetGridId: 'party-games-grid-1',
          targetFilterField: 'date'
        }
      },
      {
        label: 'Room Issue Alerts',
        value: 'room-issue-alerts',
        view: 'room-issue-alerts',
        countKey: 'roomIssues'
      },
      {
        label: 'Gamemode Settings Alerts',
        value: 'gamemode-settings-alerts',
        view: 'gamemode-settings-alerts',
        countKey: 'gamemodeSettingsAlerts'
      },
      {
        label: 'Gamemode Export Alerts',
        value: 'gamemode-export-alerts',
        view: 'gamemode-export-alerts',
        countKey: 'gamemodeExportAlerts'
      },
      {
        label: 'Export Packs',
        value: 'export-packs',
        endpoint: '/api/oe-panel/game-packs/export',
        successMessage: 'Game packs exported to JSON.'
      },
      {
        label: 'Export Rules',
        value: 'export-rules',
        endpoint: '/api/oe-panel/game-rules/export',
        successMessage: 'Game rules exported to JSON.'
      },
      {
        label: 'Export Roles',
        value: 'export-roles',
        endpoint: '/api/oe-panel/game-roles/export',
        successMessage: 'Game roles exported to JSON.'
      },
      {
        label: 'Manage Packs',
        value: 'manage-packs',
        actions: [
          {
            label: 'Create New Pack',
            value: 'create-new-pack',
            view: 'game-pack-create'
          },
          {
            label: 'View Packs',
            value: 'view-packs',
            targetGridId: 'party-games-grid-1',
            series: 'packs'
          }
        ]
      }
    ]
  }
];
