window.OE_PANEL_SECTIONS = window.OE_PANEL_SECTIONS || {};
window.OE_PANEL_SECTIONS["System"] = [
    {
      id: 'system-grid-1',
      type: 'stats',
      title: 'System Status',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      stats: [
        {
          label: 'Runtime',
          value: '-',
          detail: '-',
          expandedType: 'table'
        },
        {
          label: 'Databases',
          value: '-',
          detail: '-',
          expandedType: 'table'
        },
        {
          label: 'Integrations',
          value: '-',
          detail: '-',
          expandedType: 'table'
        },
        {
          label: 'Deployment',
          value: '-',
          detail: '-',
          expandedType: 'table'
        }
      ]
    },
    {
      id: 'system-grid-2',
      type: 'table',
      title: 'Feature Flags',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      columns: [
        { key: 'setting', label: 'Setting' },
        { key: 'value', label: 'Value' },
        { key: 'area', label: 'Area' },
        { key: 'dateChanged', label: 'Date Changed' }
      ],
      rows: [
        {
          key: 'maintenance-mode',
          setting: 'Maintenance Mode',
          value: '-',
          area: 'Global',
          dateChanged: '-'
        },
        {
          key: 'signup-enabled',
          setting: 'Signup Enabled',
          value: '-',
          area: 'Accounts',
          dateChanged: '-'
        },
        {
          key: 'party-rooms-enabled',
          setting: 'Party Rooms Enabled',
          value: '-',
          area: 'Party Games',
          dateChanged: '-'
        },
        {
          key: 'reports-enabled',
          setting: 'Reports Enabled',
          value: '-',
          area: 'Moderation',
          dateChanged: '-'
        }
      ],
      editable: true,
      editKey: 'key',
      fillRows: false,
      saveEndpoint: '/api/oe-panel/system/config/{key}',
      expandedFields: [
        { key: 'value', label: 'Value', editable: true },
        { key: 'dateChanged', label: 'Date Changed' }
      ],
      rowActions: [{ label: 'Edit', action: 'edit' }]
    },
    {
      id: 'system-grid-3',
      type: 'alerts',
      title: 'System Alerts',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      alerts: []
    },
    {
      id: 'system-grid-4',
      type: 'actions',
      title: 'System Tools',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      actions: [
        {
          label: 'Health Check',
          value: 'health-check',
          targetSection: 'System',
          targetGridId: 'system-grid-1'
        },
        {
          label: 'Feature Flags',
          value: 'feature-flags',
          targetSection: 'System',
          targetGridId: 'system-grid-2'
        },
        {
          label: 'System Alerts',
          value: 'system-alerts',
          targetSection: 'System',
          targetGridId: 'system-grid-3'
        },
        {
          label: 'Admin Logs',
          value: 'admin-logs',
          targetSection: 'Admin Logs',
          targetGridId: 'admin-logs-grid-1'
        }
      ]
    }
  ];
