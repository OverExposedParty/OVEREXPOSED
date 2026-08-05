window.OE_PANEL_SECTIONS = window.OE_PANEL_SECTIONS || {};
window.OE_PANEL_SECTIONS['Achievements'] = [
  {
    id: 'achievements-grid-1',
    type: 'stats',
    title: 'Achievement Stats',
    backgroundColour: '#202020',
    primaryColour: 'var(--primarypagecolour)',
    secondaryColour: 'var(--secondarypagecolour)',
    stats: [
      {
        label: 'Total Achievements',
        value: '-',
        detail: '-',
        expandedType: 'table'
      },
      {
        label: 'Total Unlocks',
        value: '-',
        detail: '-',
        expandedType: 'table'
      },
      {
        label: 'Players With Achievements',
        value: '-',
        detail: '-',
        expandedType: 'table'
      },
      {
        label: 'Review Items',
        value: '-',
        detail: '-',
        expandedType: 'table'
      }
    ]
  },
  {
    id: 'achievements-grid-2',
    type: 'table',
    title: 'Management Tables',
    backgroundColour: '#202020',
    primaryColour: 'var(--primarypagecolour)',
    secondaryColour: 'var(--secondarypagecolour)',
    defaultSeries: 'library',
    tableSeries: [
      {
        value: 'library',
        label: 'Achievement Library',
        dataSource: 'achievementLibrary',
        columns: [
          { key: 'key', label: 'Key' },
          { key: 'name', label: 'Name' },
          { key: 'category', label: 'Category' },
          { key: 'subcategory', label: 'Subcategory' },
          { key: 'gamemode', label: 'Gamemode' },
          { key: 'rarity', label: 'Rarity' },
          { key: 'status', label: 'Status' },
          { key: 'enabled', label: 'Enabled' }
        ],
        expandedFields: [
          { key: 'description', label: 'Description' },
          { key: 'image', label: 'Image' },
          { key: 'trigger', label: 'Trigger' },
          { key: 'requirementType', label: 'Requirement Type' },
          { key: 'requirementValue', label: 'Requirement Value' },
          { key: 'minPlayers', label: 'Min Players' },
          { key: 'points', label: 'Points' },
          { key: 'rewards', label: 'Rewards' },
          { key: 'hidden', label: 'Hidden' },
          { key: 'unlocks', label: 'Unlocks' },
          { key: 'tags', label: 'Tags' },
          { key: 'updatedAt', label: 'Updated' }
        ],
        rowActions: []
      },
      {
        value: 'analytics',
        label: 'Analytics',
        dataSource: 'achievementAnalytics',
        columns: [
          { key: 'achievement', label: 'Achievement' },
          { key: 'category', label: 'Category' },
          { key: 'rarity', label: 'Rarity' },
          { key: 'unlocks', label: 'Unlocks' },
          { key: 'unlockRate', label: 'Unlock Rate' },
          { key: 'status', label: 'Status' }
        ],
        expandedFields: [
          { key: 'key', label: 'Key' },
          { key: 'subcategory', label: 'Subcategory' },
          { key: 'active', label: 'Active' }
        ],
        rowActions: []
      },
      {
        value: 'player-progress',
        label: 'Player Progress',
        dataSource: 'achievementPlayerProgress',
        columns: [
          { key: 'user', label: 'User' },
          { key: 'achievement', label: 'Achievement' },
          { key: 'gamemode', label: 'Gamemode' },
          { key: 'progress', label: 'Progress' },
          { key: 'unlockedAt', label: 'Unlocked' },
          { key: 'rewardStatus', label: 'Reward' }
        ],
        expandedFields: [
          { key: 'accountId', label: 'Account ID' },
          { key: 'source', label: 'Source' },
          { key: 'partyId', label: 'Party ID' }
        ],
        rowActions: []
      },
      {
        value: 'triggers',
        label: 'Triggers',
        dataSource: 'achievementTriggers',
        columns: [
          { key: 'key', label: 'Key' },
          { key: 'achievement', label: 'Achievement' },
          { key: 'requirementType', label: 'Type' },
          { key: 'eventType', label: 'Event' },
          { key: 'statPath', label: 'Stat Path' },
          { key: 'status', label: 'Status' }
        ],
        expandedFields: [
          { key: 'statKey', label: 'Stat Key' },
          { key: 'requirementValue', label: 'Requirement Value' },
          { key: 'minPlayers', label: 'Min Players' }
        ],
        rowActions: []
      }
    ]
  },
  {
    id: 'achievements-grid-3',
    type: 'gallery',
    title: 'Achievement Gallery',
    backgroundColour: '#202020',
    primaryColour: 'var(--primarypagecolour)',
    secondaryColour: 'var(--secondarypagecolour)',
    searchPlaceholder:
      'Search achievements, [category:gameplay], [subcategory:online], [gamemode:imposter]',
    emptyText: 'No achievements found.',
    fieldMap: {
      title: 'name',
      meta: ['key', 'category', 'subcategory', 'gamemode'],
      status: 'galleryStatus',
      preview: 'image',
      border: 'border',
      alt: 'name',
      search: [
        'key',
        'name',
        'category',
        'subcategory',
        'gamemode',
        'rarity',
        'status'
      ],
      filters: {
        id: 'key',
        key: 'key',
        achievement: 'name',
        name: 'name',
        category: 'category',
        subcategory: 'subcategory',
        gamemode: 'gamemode',
        rarity: 'rarity',
        status: 'status',
        enabled: 'enabled'
      }
    },
    targetGridId: 'achievements-grid-2',
    targetSeries: 'library',
    targetQueryField: 'key',
    targetQueryValue: 'key',
    dataSource: 'achievementLibrary',
    paletteField: 'rarity',
    paletteType: 'rarity',
    items: []
  },
  {
    id: 'achievements-grid-4',
    type: 'actions',
    title: 'Achievement Actions',
    backgroundColour: '#202020',
    primaryColour: 'var(--primarypagecolour)',
    secondaryColour: 'var(--secondarypagecolour)',
    actions: [
      {
        label: 'Manage Achievements Library',
        value: 'manage-achievements-library',
        actions: [
          {
            label: 'Manage Achievement Library',
            value: 'manage-achievement-library-gallery',
            targetSection: 'Achievements',
            targetGridId: 'achievements-grid-3'
          },
          {
            label: 'Create New Achievement',
            value: 'create-new-achievement',
            form: {
              title: 'Create New Achievement',
              backLabel: 'Back to manage achievements library',
              submitLabel: 'Save Achievement',
              submittingLabel: 'Saving...',
              successButtonLabel: 'Saved',
              successMessage: 'Achievement created.',
              errorMessage: 'Achievement could not be created.',
              submitEndpoint: '/api/oe-panel/achievements',
              method: 'POST',
              encoding: 'multipart',
              successEvent: 'oe-panel-achievements-data-changed',
              fields: [
                {
                  type: 'row',
                  columns: 'is-two-column',
                  fields: [
                    { label: 'Key', name: 'key', required: true },
                    { label: 'Name', name: 'name', required: true }
                  ]
                },
                {
                  type: 'row',
                  columns: 'is-three-column',
                  fields: [
                    {
                      label: 'Category',
                      name: 'category',
                      value: 'gameplay',
                      required: true,
                      options: [
                        { label: 'Account', value: 'account' },
                        { label: 'Community', value: 'community' },
                        { label: 'Customisation', value: 'customisation' },
                        { label: 'Events', value: 'events' },
                        { label: 'Gameplay', value: 'gameplay' },
                        { label: 'Other', value: 'other' },
                        { label: 'Shop', value: 'shop' },
                        { label: 'Social', value: 'social' }
                      ]
                    },
                    {
                      label: 'Subcategory',
                      name: 'subcategory',
                      value: 'online',
                      required: true,
                      options: [
                        { label: 'Appearance', value: 'appearance' },
                        { label: 'Collections', value: 'collections' },
                        { label: 'Friends', value: 'friends' },
                        { label: 'General', value: 'general' },
                        { label: 'Help', value: 'help' },
                        { label: 'Online', value: 'online' },
                        { label: 'Overexposure', value: 'overexposure' },
                        { label: 'Profile', value: 'profile' },
                        { label: 'Seasonal', value: 'seasonal' },
                        { label: 'Settings', value: 'settings' }
                      ]
                    },
                    {
                      label: 'Gamemode',
                      name: 'gamemode',
                      palette: 'gamemode',
                      options: [
                        { label: 'Global', value: '' },
                        { label: 'Truth Or Dare', value: 'truth-or-dare' },
                        { label: 'Paranoia', value: 'paranoia' },
                        {
                          label: 'Never Have I Ever',
                          value: 'never-have-i-ever'
                        },
                        { label: 'Most Likely To', value: 'most-likely-to' },
                        { label: 'Imposter', value: 'imposter' },
                        {
                          label: 'Would You Rather',
                          value: 'would-you-rather'
                        },
                        { label: 'Mafia', value: 'mafia' }
                      ]
                    }
                  ]
                },
                {
                  label: 'Description',
                  name: 'description',
                  multiline: true
                },
                {
                  label: 'Achievement SVG',
                  name: 'svg',
                  type: 'file',
                  preview: 'svg',
                  required: true,
                  previewText: 'Choose achievement SVG'
                },
                {
                  type: 'row',
                  columns: 'is-three-column',
                  fields: [
                    {
                      label: 'Status',
                      name: 'status',
                      value: 'draft',
                      options: [
                        { label: 'Draft', value: 'draft' },
                        { label: 'Published', value: 'published' },
                        { label: 'Archived', value: 'archived' }
                      ]
                    },
                    {
                      label: 'Active',
                      name: 'active',
                      value: 'no',
                      options: [
                        { label: 'No', value: 'no' },
                        { label: 'Yes', value: 'yes' }
                      ]
                    },
                    {
                      label: 'Hidden',
                      name: 'hidden',
                      value: 'no',
                      options: [
                        { label: 'No', value: 'no' },
                        { label: 'Yes', value: 'yes' }
                      ]
                    }
                  ]
                },
                {
                  type: 'row',
                  columns: 'is-two-column',
                  fields: [
                    {
                      label: 'Requirement Type',
                      name: 'requirementType',
                      value: 'event',
                      options: [
                        { label: 'Event', value: 'event' },
                        { label: 'Stat Threshold', value: 'stat_threshold' },
                        {
                          label: 'Per Game Stat',
                          value: 'per_game_stat_threshold'
                        },
                        { label: 'Streak', value: 'streak' },
                        { label: 'Collection', value: 'collection' },
                        { label: 'Manual', value: 'manual' }
                      ]
                    },
                    {
                      label: 'Rarity',
                      name: 'rarity',
                      palette: 'rarity',
                      value: 'common',
                      options: [
                        { label: 'Common', value: 'common' },
                        { label: 'Uncommon', value: 'uncommon' },
                        { label: 'Rare', value: 'rare' },
                        { label: 'Epic', value: 'epic' },
                        { label: 'Legendary', value: 'legendary' },
                        { label: 'Secret', value: 'secret' }
                      ]
                    }
                  ]
                },
                {
                  type: 'row',
                  columns: 'is-three-column',
                  fields: [
                    { label: 'Event Type', name: 'eventType' },
                    { label: 'Stat Path', name: 'statPath' },
                    { label: 'Stat Key', name: 'statKey' }
                  ]
                },
                {
                  type: 'row',
                  columns: 'is-three-column',
                  fields: [
                    {
                      label: 'Requirement Value',
                      name: 'requirementValue',
                      value: '1',
                      inputType: 'number'
                    },
                    {
                      label: 'Min Players',
                      name: 'minPlayers',
                      value: '0',
                      inputType: 'number'
                    },
                    {
                      label: 'Points',
                      name: 'points',
                      value: '0',
                      inputType: 'number'
                    }
                  ]
                },
                {
                  label: 'Tags',
                  name: 'tags',
                  placeholder: 'global, social'
                },
                {
                  label: 'Rewards JSON',
                  name: 'rewardsJson',
                  multiline: true,
                  value: '[{"type":"opals","amount":10}]',
                  placeholder:
                    '[{"type":"opals","amount":120},{"type":"xp","amount":50},{"type":"oling_consumable","key":"opal-dust","quantity":1}]'
                }
              ]
            }
          }
        ]
      },
      {
        label: 'Analytics',
        value: 'achievement-analytics',
        targetSection: 'Achievements',
        targetGridId: 'achievements-grid-2',
        series: 'analytics'
      },
      {
        label: 'Player Progress',
        value: 'achievement-player-progress',
        targetSection: 'Achievements',
        targetGridId: 'achievements-grid-2',
        series: 'player-progress'
      },
      {
        label: 'Trigger Checks',
        value: 'achievement-triggers',
        targetSection: 'Achievements',
        targetGridId: 'achievements-grid-2',
        series: 'triggers'
      },
      {
        label: 'Review Queue',
        value: 'achievement-review-queue',
        countKey: 'achievementReviewItems',
        alertSource: 'achievementReviewAlerts',
        emptyTitle: 'No review items',
        emptyDetail: 'Achievement configuration looks clear.'
      },
      {
        label: 'Review Drafts',
        value: 'achievement-review-drafts',
        targetSection: 'Achievements',
        targetGridId: 'achievements-grid-2',
        series: 'library',
        query: '[status:draft]'
      },
      {
        label: 'Disabled Published',
        value: 'achievement-disabled-published',
        targetSection: 'Achievements',
        targetGridId: 'achievements-grid-2',
        series: 'library',
        query: '[status:published] [enabled:no]'
      }
    ]
  }
];
