window.OE_PANEL_SECTIONS = window.OE_PANEL_SECTIONS || {};

const OE_PANEL_EMAIL_AUTOMATION_EDITABLE_TRIGGERS = [
  {
    label: 'Password reset request',
    value: 'password-reset-request'
  },
  {
    label: 'Email address change request',
    value: 'email-address-change'
  }
];

function createOePanelEmailAutomationFormConfig({
  mode = 'create',
  row = {}
} = {}) {
  const isEditing = mode === 'edit';
  const isSystemManaged =
    row.systemManagedValue === true || row.systemManaged === 'Yes';
  const triggerOptions = isSystemManaged
    ? [{ label: 'Email verification', value: 'email-verification' }]
    : [
        { label: 'Choose a trigger', value: '', disabled: true },
        ...OE_PANEL_EMAIL_AUTOMATION_EDITABLE_TRIGGERS
      ];

  return {
    title: isEditing ? 'Edit Automation' : 'Create Automation',
    submitLabel: isEditing ? 'Save Changes' : 'Create Automation',
    submittingLabel: isEditing ? 'Saving...' : 'Creating...',
    submitEndpoint: isEditing
      ? `/api/oe-panel/emails/automations/${encodeURIComponent(row.automationId || '')}`
      : '/api/oe-panel/emails/automations',
    method: isEditing ? 'PATCH' : 'POST',
    errorMessage: isEditing
      ? 'Automation could not be updated.'
      : 'Automation could not be created.',
    successMessage: isEditing ? 'Automation updated.' : 'Automation created.',
    successEvent: 'oe-panel-email-automations-changed',
    fields: [
      {
        name: 'name',
        label: 'Automation Name',
        required: true,
        maxlength: 160,
        value: isEditing ? row.automation || '' : ''
      },
      {
        name: 'trigger',
        label: 'Trigger',
        required: true,
        options: triggerOptions,
        value: isEditing ? row.triggerKey || '' : ''
      },
      {
        name: 'templateKey',
        label: 'Email Template',
        required: true,
        options: [{ label: 'Choose a trigger first', value: '' }],
        optionsEndpoint: '/api/oe-panel/emails/automation-template-options',
        dependsOn: 'trigger',
        dependencyQueryParam: 'trigger',
        dependencyPlaceholder: 'Choose a trigger first',
        loadingLabel: 'Loading templates...',
        placeholder: 'Choose a template',
        emptyLabel: 'No compatible published templates',
        errorLabel: 'Templates unavailable',
        value: isEditing && row.templateKey !== '-' ? row.templateKey : ''
      },
      {
        name: 'status',
        label: 'Initial Status',
        required: true,
        options: [
          { label: 'Active', value: 'active' },
          { label: 'Inactive', value: 'inactive' }
        ],
        value: isEditing ? row.statusKey || 'inactive' : 'active'
      }
    ]
  };
}

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
        key: 'sent',
        label: 'Emails Sent',
        value: '-',
        detail: 'Loading performance',
        expandedType: 'table'
      },
      {
        key: 'deliveryRate',
        label: 'Delivery Rate',
        value: '-',
        detail: 'Loading performance',
        expandedType: 'table'
      },
      {
        key: 'uniqueClickRate',
        label: 'Unique Click Rate',
        value: '-',
        detail: 'Loading performance',
        expandedType: 'table'
      },
      {
        key: 'conversionRate',
        label: 'Conversion Rate',
        value: '-',
        detail: 'Loading performance',
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
        dataSource: 'emailAutomations',
        rowKey: 'automationId',
        columns: [
          { key: 'automation', label: 'Automation' },
          { key: 'trigger', label: 'Trigger' },
          { key: 'template', label: 'Template' },
          { key: 'status', label: 'Status' }
        ],
        expandedFields: [
          { key: 'triggerKey', label: 'Trigger Key' },
          { key: 'templateKey', label: 'Template Key' },
          { key: 'templateStatus', label: 'Template Status' },
          { key: 'systemManaged', label: 'System Managed' },
          { key: 'updatedAt', label: 'Last Updated' }
        ],
        rowActions: [
          {
            label: 'Edit',
            action: 'edit-email-automation'
          },
          {
            label: 'Delete',
            action: 'delete',
            disabledWhen: { key: 'systemManagedValue', equals: true },
            disabledTitle: 'System-managed automations cannot be deleted.'
          }
        ],
        deleteEndpoint: '/api/oe-panel/emails/automations/{automationId}',
        deleteConfirmMessage:
          'Are you sure you want to delete this automation?',
        rows: [],
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
          { key: 'status', label: 'Status' }
        ],
        expandedFields: [
          { key: 'key', label: 'Template Key' },
          { key: 'automationTriggers', label: 'Automation Triggers' },
          { key: 'activeUsage', label: 'Active Usage' },
          { key: 'subject', label: 'Subject' },
          { key: 'updatedAt', label: 'Last Updated' },
          { key: 'publishedAt', label: 'Published At' }
        ],
        rowActions: [
          {
            label: 'Open in Editor',
            action: 'open-email-template'
          },
          {
            label: 'Delete',
            action: 'delete',
            disabledWhen: { key: 'inUse', equals: true },
            disabledTitleKey: 'usageTooltip'
          }
        ],
        deleteEndpoint: '/api/oe-panel/emails/templates/{templateId}',
        deleteConfirmMessage:
          'Are you sure you want to delete this email template?',
        rows: [],
        fillRows: false
      },
      {
        value: 'audiences',
        label: 'Audiences',
        dataSource: 'emailAudiences',
        rowKey: 'audienceId',
        columns: [
          { key: 'audience', label: 'Audience' },
          { key: 'type', label: 'Type' },
          { key: 'recipients', label: 'Recipients' },
          { key: 'status', label: 'Status' }
        ],
        expandedFields: [
          { key: 'description', label: 'Description' },
          { key: 'matchMode', label: 'Matching' },
          { key: 'marketingConsent', label: 'Marketing Consent' },
          { key: 'conditionCount', label: 'Filters' },
          { key: 'updatedAt', label: 'Last Updated' }
        ],
        rowActions: [
          {
            label: 'Preview',
            action: 'preview-email-audience'
          },
          {
            label: 'Edit',
            action: 'edit-email-audience'
          },
          {
            label: 'Duplicate',
            action: 'duplicate-email-audience'
          },
          {
            label: 'Delete',
            action: 'delete'
          }
        ],
        deleteEndpoint: '/api/oe-panel/emails/audiences/{audienceId}',
        deleteConfirmMessage:
          'Are you sure you want to archive this email audience?',
        rows: [],
        fillRows: false
      },
      {
        value: 'suppressions',
        label: 'Suppression List',
        dataSource: 'emailSuppressions',
        rowKey: 'suppressionId',
        columns: [
          { key: 'email', label: 'Email' },
          { key: 'reason', label: 'Reason' },
          { key: 'date', label: 'Added' }
        ],
        expandedFields: [
          { key: 'source', label: 'Source' },
          { key: 'note', label: 'Note' }
        ],
        rowActions: [{ label: 'Remove', action: 'delete' }],
        deleteEndpoint: '/api/oe-panel/emails/suppressions/{suppressionId}',
        deleteConfirmMessage:
          'Remove this address from the email suppression list?',
        rows: [],
        fillRows: false
      }
    ]
  },
  {
    id: 'emails-grid-3',
    type: 'timeSeries',
    title: 'Performance Trends',
    periodLabel: 'Last 30 days',
    emptyMessage: 'No tracked email activity is available for this period.',
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
        actions: [
          {
            label: 'Manage Automations',
            value: 'automation-manage',
            targetSection: 'Emails',
            targetGridId: 'emails-grid-2',
            series: 'automations'
          },
          {
            label: 'Create Automation',
            value: 'automation-create',
            form: createOePanelEmailAutomationFormConfig()
          }
        ]
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
        actions: [
          {
            label: 'Manage Audiences',
            value: 'audience-manage',
            targetSection: 'Emails',
            targetGridId: 'emails-grid-2',
            series: 'audiences'
          },
          {
            label: 'Create Audience',
            value: 'audience-create',
            event: 'oe-panel-email-audience-editor-request'
          },
          {
            label: 'Suppression List',
            value: 'suppression-manage',
            targetSection: 'Emails',
            targetGridId: 'emails-grid-2',
            series: 'suppressions'
          },
          {
            label: 'Add Suppression',
            value: 'suppression-create',
            form: {
              title: 'Add Suppression',
              submitLabel: 'Add to Suppression List',
              submittingLabel: 'Adding...',
              submitEndpoint: '/api/oe-panel/emails/suppressions',
              method: 'POST',
              errorMessage: 'Suppression could not be added.',
              successMessage: 'Suppression added.',
              successEvent: 'oe-panel-email-suppressions-changed',
              fields: [
                {
                  name: 'email',
                  label: 'Email Address',
                  inputType: 'email',
                  maxlength: 254,
                  required: true
                },
                {
                  name: 'reason',
                  label: 'Reason',
                  required: true,
                  options: [
                    { label: 'Unsubscribed', value: 'unsubscribed' },
                    { label: 'Bounced', value: 'bounced' },
                    { label: 'Complaint', value: 'complaint' },
                    { label: 'Blocked', value: 'blocked' },
                    { label: 'Manual', value: 'manual' }
                  ],
                  value: 'manual'
                },
                {
                  name: 'note',
                  label: 'Note',
                  multiline: true,
                  maxlength: 500
                }
              ]
            }
          }
        ]
      }
    ]
  }
];

window.OE_PANEL_EMAIL_AUTOMATION_FORM = {
  createConfig: createOePanelEmailAutomationFormConfig
};

if (typeof window.addEventListener === 'function') {
  function refreshEmailTableSeries(series) {
    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('oe-panel-section-link-request', {
          detail: {
            section: 'Emails',
            gridId: 'emails-grid-2',
            series
          }
        })
      );
    }, 0);
  }

  window.addEventListener('oe-panel-email-audiences-changed', () => {
    refreshEmailTableSeries('audiences');
  });
  window.addEventListener('oe-panel-email-suppressions-changed', () => {
    refreshEmailTableSeries('suppressions');
  });

  window.addEventListener('oe-panel-table-row-action', (event) => {
    if (event.detail?.action !== 'edit-email-automation') return;
    const row = event.detail?.row;
    const container = document.querySelector(
      '[data-oe-panel-grid="emails-grid-4"]'
    );
    const renderFormWidget = window.OE_PANEL_WIDGET_HELPERS?.renderFormWidget;
    if (!row?.automationId || !container || !renderFormWidget) return;

    const previousNodes = Array.from(container.childNodes);
    const restore = () => container.replaceChildren(...previousNodes);
    renderFormWidget(container, {
      ...createOePanelEmailAutomationFormConfig({ mode: 'edit', row }),
      onBack: restore,
      onSuccess: restore
    });
  });

  window.addEventListener('oe-panel-table-row-action', (event) => {
    if (
      !['edit-email-audience', 'preview-email-audience'].includes(
        event.detail?.action
      )
    ) {
      return;
    }
    const row = event.detail?.row;
    const container = document.querySelector(
      '[data-oe-panel-grid="emails-grid-4"]'
    );
    if (!row?.audienceId || !container) return;
    const previousNodes = Array.from(container.childNodes);
    window.dispatchEvent(
      new CustomEvent('oe-panel-email-audience-editor-request', {
        detail: {
          container,
          audienceId: row.audienceId,
          previewOnly: event.detail.action === 'preview-email-audience',
          restore: () => container.replaceChildren(...previousNodes)
        }
      })
    );
  });

  window.addEventListener('oe-panel-table-row-action', async (event) => {
    if (event.detail?.action !== 'duplicate-email-audience') return;
    const audienceId = event.detail?.row?.audienceId;
    if (!audienceId) return;
    try {
      const response = await fetch(
        `/api/oe-panel/emails/audiences/${encodeURIComponent(audienceId)}/duplicate`,
        { method: 'POST' }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) {
        throw new Error(
          payload?.error?.message || 'Audience could not be duplicated.'
        );
      }
      window.OE_PANEL_DATA?.clear?.('emailAudiences');
      window.dispatchEvent(new CustomEvent('oe-panel-email-audiences-changed'));
      window.alert('Audience duplicated as inactive.');
    } catch (error) {
      window.alert(error.message || 'Audience could not be duplicated.');
    }
  });
}
