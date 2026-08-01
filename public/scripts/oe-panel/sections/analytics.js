window.OE_PANEL_SECTIONS = window.OE_PANEL_SECTIONS || {};
window.OE_PANEL_SECTIONS["Analytics"] = [
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
      type: 'alerts',
      title: 'Analytics Status',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      alerts: []
    }
  ];
