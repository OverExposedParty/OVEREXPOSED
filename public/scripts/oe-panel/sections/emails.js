window.OE_PANEL_SECTIONS = window.OE_PANEL_SECTIONS || {};
window.OE_PANEL_SECTIONS['Emails'] = [
  {
    id: 'emails-grid-1',
    type: 'stats',
    title: 'Email Performance',
    backgroundColour: '#202020',
    primaryColour: 'var(--primarypagecolour)',
    secondaryColour: 'var(--secondarypagecolour)',
    stats: [
      {
        label: 'Emails Sent',
        value: '-',
        detail: 'Tracking not connected',
        expandedType: 'table'
      },
      {
        label: 'Delivery Rate',
        value: '-',
        detail: 'Tracking not connected',
        expandedType: 'table'
      },
      {
        label: 'Unique Click Rate',
        value: '-',
        detail: 'Tracking not connected',
        expandedType: 'table'
      },
      {
        label: 'Conversion Rate',
        value: '-',
        detail: 'Tracking not connected',
        expandedType: 'table'
      }
    ]
  },
  {
    id: 'emails-grid-2',
    type: 'table',
    title: 'Email Activity',
    defaultSeries: 'campaigns',
    backgroundColour: '#202020',
    primaryColour: 'var(--primarypagecolour)',
    secondaryColour: 'var(--secondarypagecolour)',
    tableSeries: [
      {
        value: 'campaigns',
        label: 'Recent Campaigns',
        columns: [
          { key: 'campaign', label: 'Campaign' },
          { key: 'status', label: 'Status' },
          { key: 'date', label: 'Date' },
          { key: 'result', label: 'Result' }
        ],
        rows: [
          {
            campaign: 'No campaigns yet',
            status: 'Waiting for data',
            date: '-',
            result: '-'
          }
        ],
        fillRows: false
      },
      {
        value: 'scheduled',
        label: 'Scheduled Campaigns',
        columns: [
          { key: 'campaign', label: 'Campaign' },
          { key: 'audience', label: 'Audience' },
          { key: 'scheduledFor', label: 'Scheduled For' },
          { key: 'status', label: 'Status' }
        ],
        rows: [
          {
            campaign: 'No scheduled campaigns',
            audience: '-',
            scheduledFor: '-',
            status: '-'
          }
        ],
        fillRows: false
      },
      {
        value: 'automations',
        label: 'Automations',
        columns: [
          { key: 'automation', label: 'Automation' },
          { key: 'trigger', label: 'Trigger' },
          { key: 'template', label: 'Template' },
          { key: 'status', label: 'Status' }
        ],
        rows: [
          {
            automation: 'No automations configured',
            trigger: '-',
            template: '-',
            status: '-'
          }
        ],
        fillRows: false
      },
      {
        value: 'failures',
        label: 'Failed Sends',
        columns: [
          { key: 'email', label: 'Email' },
          { key: 'reason', label: 'Reason' },
          { key: 'date', label: 'Date' },
          { key: 'status', label: 'Status' }
        ],
        rows: [
          {
            email: 'No failed sends',
            reason: '-',
            date: '-',
            status: '-'
          }
        ],
        fillRows: false
      },
      {
        value: 'templates',
        label: 'Templates',
        dataSource: 'emailTemplates',
        rowKey: 'templateId',
        columns: [
          { key: 'template', label: 'Template' },
          { key: 'category', label: 'Category' },
          { key: 'version', label: 'Version' },
          { key: 'status', label: 'Status' }
        ],
        expandedFields: [
          { key: 'key', label: 'Template Key' },
          { key: 'subject', label: 'Subject' },
          { key: 'publishedVersion', label: 'Published Version' },
          { key: 'updatedAt', label: 'Last Updated' },
          { key: 'publishedAt', label: 'Published At' }
        ],
        rowActions: [
          {
            label: 'Open in Editor',
            action: 'open-email-template'
          },
          {
            label: 'Archive',
            action: 'delete'
          }
        ],
        deleteEndpoint: '/api/oe-panel/emails/templates/{templateId}',
        rows: [],
        fillRows: false
      },
      {
        value: 'audiences',
        label: 'Audiences',
        columns: [
          { key: 'audience', label: 'Audience' },
          { key: 'subscribers', label: 'Subscribers' },
          { key: 'growth', label: 'Growth' },
          { key: 'status', label: 'Status' }
        ],
        rows: [
          {
            audience: 'Audience management coming next',
            subscribers: '-',
            growth: '-',
            status: 'UI only'
          }
        ],
        fillRows: false
      }
    ]
  },
  {
    id: 'emails-grid-3',
    type: 'timeSeries',
    title: 'Performance Trends',
    periodLabel: 'Last 30 days',
    emptyMessage:
      'Performance data will appear when email tracking is connected.',
    backgroundColour: '#202020',
    primaryColour: 'var(--primarypagecolour)',
    secondaryColour: 'var(--secondarypagecolour)',
    labels: ['Day 1', 'Day 6', 'Day 12', 'Day 18', 'Day 24', 'Day 30'],
    series: [
      { key: 'sent', label: 'Sent', colour: '#66ccff', values: [] },
      { key: 'delivered', label: 'Delivered', colour: '#4fd1a1', values: [] },
      { key: 'clicked', label: 'Unique Clicks', colour: '#e88bae', values: [] },
      { key: 'converted', label: 'Conversions', colour: '#f5c451', values: [] }
    ]
  },
  {
    id: 'emails-grid-4',
    type: 'actions',
    title: 'Email Actions',
    backgroundColour: '#202020',
    primaryColour: 'var(--primarypagecolour)',
    secondaryColour: 'var(--secondarypagecolour)',
    actions: [
      {
        label: 'Campaigns',
        value: 'campaigns',
        targetSection: 'Emails',
        targetGridId: 'emails-grid-2',
        series: 'campaigns'
      },
      {
        label: 'Scheduled',
        value: 'scheduled',
        targetSection: 'Emails',
        targetGridId: 'emails-grid-2',
        series: 'scheduled'
      },
      {
        label: 'Automations',
        value: 'automations',
        targetSection: 'Emails',
        targetGridId: 'emails-grid-2',
        series: 'automations'
      },
      {
        label: 'Failed Sends',
        value: 'failed-sends',
        targetSection: 'Emails',
        targetGridId: 'emails-grid-2',
        series: 'failures'
      },
      {
        label: 'Templates',
        value: 'templates',
        actions: [
          {
            label: 'Create',
            value: 'template-create',
            event: 'oe-panel-email-template-editor-request'
          },
          {
            label: 'Manage',
            value: 'template-manage',
            targetSection: 'Emails',
            targetGridId: 'emails-grid-2',
            series: 'templates'
          }
        ]
      },
      {
        label: 'Audiences',
        value: 'audiences',
        targetSection: 'Emails',
        targetGridId: 'emails-grid-2',
        series: 'audiences'
      }
    ]
  }
];
