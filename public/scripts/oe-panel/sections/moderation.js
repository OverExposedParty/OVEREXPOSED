window.OE_PANEL_SECTIONS = window.OE_PANEL_SECTIONS || {};
window.OE_PANEL_SECTIONS["Moderation"] = [
    {
      id: 'moderation-grid-1',
      type: 'stats',
      title: 'Moderation Summary',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      stats: [
        {
          label: 'Open Queue',
          value: '-',
          detail: '-',
          expandedType: 'table'
        },
        {
          label: 'Urgent Reports',
          value: '-',
          detail: '-',
          expandedType: 'table'
        },
        {
          label: 'Oldest Waiting',
          value: '-',
          detail: '-',
          expandedType: 'table'
        },
        {
          label: 'Resolved 7d',
          value: '-',
          detail: '-',
          expandedType: 'table'
        }
      ]
    },
    {
      id: 'moderation-grid-2',
      type: 'actions',
      title: 'Review Shortcuts',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      actions: [
        {
          label: 'OE Reports',
          value: 'open-oe-reports',
          targetSection: 'OverExposure',
          targetGridId: 'overexposure-grid-3'
        },
        {
          label: 'Room Issues',
          value: 'open-room-issues',
          targetSection: 'Party Games',
          targetGridId: 'party-games-grid-4'
        },
        {
          label: 'Users',
          value: 'open-users',
          targetSection: 'Users',
          targetGridId: 'users-grid-2'
        },
        {
          label: 'Admin Logs',
          value: 'open-admin-logs',
          targetSection: 'Admin Logs',
          targetGridId: 'admin-logs-grid-1'
        }
      ]
    },
    {
      id: 'moderation-grid-3',
      type: 'alerts',
      title: 'Priority Signals',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      alerts: []
    },
    {
      id: 'moderation-grid-4',
      type: 'actions',
      title: 'Moderation Tools',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      actions: [
        {
          label: 'Repeat Offenders',
          value: 'repeat-offenders',
          countKey: 'repeatOffenders',
          alertSource: 'repeatOffenderAlerts',
          emptyTitle: 'No repeat offenders',
          emptyDetail: 'Accounts with multiple open reports will appear here.'
        },
        {
          label: 'Recent Decisions',
          value: 'recent-decisions',
          countKey: 'recentDecisions',
          alertSource: 'recentDecisionAlerts',
          emptyTitle: 'No recent decisions',
          emptyDetail: 'Resolved moderation decisions will appear here.'
        },
        {
          label: 'Suspended Users',
          value: 'suspended-users',
          targetSection: 'Users',
          targetGridId: 'users-grid-2',
          query: '[status:suspended]'
        },
        {
          label: 'Banned Users',
          value: 'banned-users',
          targetSection: 'Users',
          targetGridId: 'users-grid-2',
          query: '[status:banned]'
        },
        {
          label: 'Open Reports',
          value: 'open-reports',
          targetSection: 'OverExposure',
          targetGridId: 'overexposure-grid-3'
        },
        {
          label: 'Room Alerts',
          value: 'room-alerts',
          targetSection: 'Party Games',
          targetGridId: 'party-games-grid-4'
        }
      ]
    }
  ];
