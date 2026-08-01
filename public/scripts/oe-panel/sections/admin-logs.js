window.OE_PANEL_SECTIONS = window.OE_PANEL_SECTIONS || {};
window.OE_PANEL_SECTIONS["Admin Logs"] = [
    {
      id: 'admin-logs-grid-1',
      type: 'table',
      title: 'Recent Logs',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      columns: [
        { key: 'time', label: 'Time' },
        { key: 'admin', label: 'Admin' },
        { key: 'action', label: 'Action' },
        { key: 'area', label: 'Area' },
        { key: 'result', label: 'Result' }
      ],
      rows: [{ time: '-', admin: '-', action: '-', area: '-', result: '-' }],
      dataSource: 'adminLogs',
      expandedFields: [
        { key: 'target', label: 'Target' },
        { key: 'targetType', label: 'Target Type' },
        { key: 'targetId', label: 'Target ID' },
        { key: 'previousValue', label: 'Previous Value' },
        { key: 'newValue', label: 'New Value' },
        { key: 'severity', label: 'Severity' },
        { key: 'note', label: 'Note' },
        { key: 'logId', label: 'Log ID' }
      ],
      rowActions: []
    },
    {
      id: 'admin-logs-grid-2',
      type: 'stats',
      title: 'Audit Stats',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      stats: [
        {
          label: 'Logs Today',
          value: '-',
          detail: '-',
          expandedType: 'table'
        },
        {
          label: 'Admin Actions',
          value: '-',
          detail: '-',
          expandedType: 'table'
        },
        {
          label: 'Critical Events',
          value: '-',
          detail: '-',
          expandedType: 'table'
        },
        {
          label: 'Failed Actions',
          value: '-',
          detail: '-',
          expandedType: 'table'
        }
      ]
    },
    {
      id: 'admin-logs-grid-3',
      type: 'calendar',
      title: 'Log Calendar',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      counts: {},
      countLabel: 'logs',
      targetGridId: 'admin-logs-grid-1',
      targetFilterField: 'date'
    },
    {
      id: 'admin-logs-grid-4',
      type: 'actions',
      title: 'Log Tools',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      actions: [
        {
          label: 'Export Logs',
          value: 'export-logs',
          downloadEndpoint: '/api/oe-panel/admin-logs/export'
        },
        {
          label: 'Filter Audit',
          value: 'filter-audit',
          view: 'admin-log-filter'
        },
        {
          label: 'Review Alerts',
          value: 'review-log-alerts',
          countKey: 'adminLogAlerts',
          view: 'admin-log-alerts'
        },
        {
          label: 'Archive Logs',
          value: 'archive-logs',
          view: 'admin-log-archive'
        }
      ]
    }
  ];
