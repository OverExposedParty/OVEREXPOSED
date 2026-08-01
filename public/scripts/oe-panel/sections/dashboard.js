window.OE_PANEL_SECTIONS = window.OE_PANEL_SECTIONS || {};
window.OE_PANEL_SECTIONS["Dashboard"] = [
    {
      id: 'dashboard-grid-1',
      type: 'stats',
      title: 'Overview Stats',
      columnSpan: 2,
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
          label: 'Live Rooms',
          value: '-',
          detail: '-',
          expandedType: 'table'
        },
        {
          label: 'Pending Reports',
          value: '-',
          detail: '-',
          expandedType: 'table'
        },
        {
          label: 'Shop Revenue',
          value: '-',
          detail: '-',
          expandedType: 'table'
        }
      ]
    },
    {
      id: 'dashboard-grid-2',
      type: 'calendar',
      title: 'Platform Activity',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      counts: {},
      calendarSeries: [
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
      id: 'dashboard-grid-3',
      type: 'actions',
      title: 'Dashboard Actions',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      actions: [
        {
          label: 'Recent Events',
          value: 'recent-events',
          countKey: 'dashboardRecentEvents',
          view: 'dashboard-recent-events'
        },
        {
          label: 'Review Reports',
          value: 'review-reports',
          targetSection: 'OverExposure',
          targetGridId: 'overexposure-grid-3'
        },
        {
          label: 'View Party Rooms',
          value: 'view-party-rooms',
          targetSection: 'Party Games',
          targetGridId: 'party-games-grid-1'
        },
        {
          label: 'View Admin Logs',
          value: 'view-admin-logs',
          targetSection: 'Admin Logs',
          targetGridId: 'admin-logs-grid-1'
        },
        {
          label: 'System Health',
          value: 'system-health',
          targetSection: 'System',
          targetGridId: 'system-grid-1'
        }
      ]
    }
  ];
