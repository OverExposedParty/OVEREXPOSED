window.OE_PANEL_SECTIONS = window.OE_PANEL_SECTIONS || {};
window.OE_PANEL_SECTIONS['Analytics'] = [
  {
    id: 'analytics-grid-1',
    type: 'stats',
    title: 'Traffic Stats',
    backgroundColour: '#202020',
    primaryColour: 'var(--primarypagecolour)',
    secondaryColour: 'var(--secondarypagecolour)',
    stats: [
      {
        label: 'Active Users',
        value: '-',
        detail: '-',
        expandedType: 'table'
      },
      {
        label: 'Sessions',
        value: '-',
        detail: '-',
        expandedType: 'table'
      },
      {
        label: 'Page Views',
        value: '-',
        detail: '-',
        expandedType: 'table'
      },
      {
        label: 'Bounce Rate',
        value: '-',
        detail: '-',
        expandedType: 'table'
      }
    ]
  },
  {
    id: 'analytics-grid-2',
    type: 'calendar',
    title: 'Traffic & Platform Activity',
    backgroundColour: '#202020',
    primaryColour: 'var(--primarypagecolour)',
    secondaryColour: 'var(--secondarypagecolour)',
    counts: {},
    calendarSeries: [
      {
        label: 'GA4 active users',
        value: 'activeUsers',
        counts: {}
      },
      {
        label: 'GA4 sessions',
        value: 'sessions',
        counts: {}
      },
      {
        label: 'GA4 page views',
        value: 'pageViews',
        counts: {}
      },
      {
        label: 'Sign up activity',
        value: 'signups',
        counts: {},
        targetSection: 'Users',
        targetGridId: 'users-grid-2',
        targetFilterField: 'date'
      },
      {
        label: 'Party room activity',
        value: 'partyRooms',
        counts: {},
        targetSection: 'Party Games',
        targetGridId: 'party-games-grid-1',
        targetFilterField: 'date'
      },
      {
        label: 'Overexposure post activity',
        value: 'overexposurePosts',
        counts: {},
        targetSection: 'OverExposure',
        targetGridId: 'overexposure-grid-1',
        targetFilterField: 'dateKey'
      },
      {
        label: 'Report activity',
        value: 'reports',
        counts: {},
        targetSection: 'OverExposure',
        targetGridId: 'overexposure-grid-3'
      }
    ]
  },
  {
    id: 'analytics-grid-3',
    type: 'table',
    title: 'Top Pages',
    backgroundColour: '#202020',
    primaryColour: 'var(--primarypagecolour)',
    secondaryColour: 'var(--secondarypagecolour)',
    columns: [
      { key: 'page', label: 'Page' },
      { key: 'pageViews', label: 'Views' },
      { key: 'users', label: 'Users' },
      { key: 'sessions', label: 'Sessions' }
    ],
    rows: [{ page: '-', pageViews: '-', users: '-', sessions: '-' }],
    fillRows: false
  },
  {
    id: 'analytics-grid-4',
    type: 'actions',
    title: 'Analytics Actions',
    backgroundColour: '#202020',
    primaryColour: 'var(--primarypagecolour)',
    secondaryColour: 'var(--secondarypagecolour)',
    alerts: [],
    actions: [
      {
        label: 'Analytics Status',
        value: 'analytics-status',
        countKey: 'analyticsStatusItems',
        alertSource: 'alerts',
        emptyTitle: 'No analytics status items',
        emptyDetail: 'Analytics status information is unavailable.'
      },
      {
        label: 'Authentication',
        value: 'authentication-performance',
        view: 'embedded-widget',
        widget: {
          type: 'table',
          title: 'Authentication - Last 30 Days',
          columns: [
            { key: 'flow', label: 'Flow' },
            { key: 'entryPoint', label: 'Entry Point' },
            { key: 'provider', label: 'Provider' },
            { key: 'attempts', label: 'Attempts' },
            { key: 'completed', label: 'Completed' },
            { key: 'completionRate', label: 'Completion Rate' }
          ],
          rows: [],
          fillRows: false
        }
      },
      {
        label: 'Notification Performance',
        value: 'notification-performance',
        view: 'embedded-widget',
        widget: {
          type: 'table',
          title: 'Notification Performance - Last 30 Days',
          columns: [
            { key: 'notification', label: 'Notification' },
            { key: 'impressions', label: 'Shown' },
            { key: 'uniqueSessions', label: 'Sessions' },
            { key: 'dismissals', label: 'Dismissed' },
            { key: 'dismissRate', label: 'Dismiss Rate' },
            { key: 'actionClicks', label: 'Action Clicks' },
            { key: 'clickRate', label: 'Click Rate' },
            { key: 'conversions', label: 'Conversions' },
            { key: 'conversionRate', label: 'Conversion Rate' }
          ],
          rows: [],
          fillRows: false
        }
      },
      {
        label: 'Pack Selection',
        value: 'pack-selection',
        view: 'embedded-widget',
        widget: {
          type: 'table',
          title: 'Pack Selection - Last 30 Days',
          columns: [
            { key: 'gameMode', label: 'Gamemode' },
            { key: 'pack', label: 'Pack' },
            { key: 'starts', label: 'Selected Starts' },
            { key: 'gameStarts', label: 'Gamemode Starts' },
            { key: 'selectionRate', label: 'Selection Rate' }
          ],
          rows: [],
          fillRows: false
        }
      },
      {
        label: 'Rule Usage',
        value: 'rule-usage',
        view: 'embedded-widget',
        widget: {
          type: 'table',
          title: 'Rule Usage - Last 30 Days',
          columns: [
            { key: 'gameMode', label: 'Gamemode' },
            { key: 'rule', label: 'Rule' },
            { key: 'value', label: 'Value' },
            { key: 'starts', label: 'Starts' },
            { key: 'usageRate', label: 'Usage Rate' }
          ],
          rows: [],
          fillRows: false
        }
      },
      {
        label: 'Question Engagement',
        value: 'question-engagement',
        view: 'embedded-widget',
        widget: {
          type: 'table',
          title: 'Offline Question Engagement - Last 30 Days',
          columns: [
            { key: 'gameMode', label: 'Gamemode' },
            { key: 'pack', label: 'Pack' },
            { key: 'questionId', label: 'Question ID' },
            { key: 'views', label: 'Views' },
            { key: 'averageDisplayed', label: 'Average Displayed' },
            { key: 'averageActive', label: 'Average Active' },
            { key: 'abandonRate', label: 'Abandon Rate' }
          ],
          rows: [],
          fillRows: false
        }
      }
    ]
  }
];
