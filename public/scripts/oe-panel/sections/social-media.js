window.OE_PANEL_SECTIONS = window.OE_PANEL_SECTIONS || {};
window.OE_PANEL_SECTIONS["Social Media"] = [
    {
      id: 'social-media-grid-1',
      type: 'stats',
      title: 'Social Statistics',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      stats: [
        {
          label: 'Ideas',
          value: '-',
          detail: '-',
          expandedType: 'table'
        },
        {
          label: 'Drafts',
          value: '-',
          detail: '-',
          expandedType: 'table'
        },
        {
          label: 'Scheduled',
          value: '-',
          detail: '-',
          expandedType: 'table'
        },
        {
          label: 'Uploaded',
          value: '-',
          detail: '-',
          expandedType: 'table'
        }
      ]
    },
    {
      id: 'social-media-grid-2',
      type: 'table',
      title: 'Content Database',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      columns: [
        { key: 'postDate', label: 'Post Date' },
        { key: 'postTime', label: 'Post Time' },
        { key: 'platformsLabel', label: 'Platforms' },
        { key: 'status', label: 'Status' },
        { key: 'title', label: 'Title' },
        { key: 'type', label: 'Type' }
      ],
      rows: [],
      dataSource: 'socialMediaContent',
      editable: true,
      saveEndpoint: '/api/oe-panel/social-media/{id}',
      deleteEndpoint: '/api/oe-panel/social-media/{id}',
      rowActions: [{ label: 'Delete', action: 'delete' }],
      expandedFields: [
        { key: 'status', label: 'Status', editable: true },
        { key: 'type', label: 'Type', editable: true },
        { key: 'title', label: 'Title', editable: true },
        { key: 'hook', label: 'Hook', expandable: true, editable: true },
        { key: 'angle', label: 'Angle', expandable: true, editable: true },
        { key: 'prompt', label: 'Prompt', expandable: true, editable: true },
        { key: 'caption', label: 'Caption', expandable: true, editable: true },
        { key: 'script', label: 'Script', expandable: true, editable: true },
        { key: 'hashtags', label: 'Hashtags', editable: true },
        { key: 'callToAction', label: 'CTA', expandable: true, editable: true },
        { key: 'notes', label: 'Notes', expandable: true, editable: true },
        { key: 'updatedAtLabel', label: 'Updated' }
      ]
    },
    {
      id: 'social-media-grid-3',
      type: 'calendar',
      title: 'Social Calendar',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      counts: {},
      allowFutureDates: true,
      countLabel: 'social items',
      targetGridId: 'social-media-grid-2',
      targetFilterField: 'postDate'
    },
    {
      id: 'social-media-grid-4',
      type: 'socialCreation',
      title: 'Content Creation Tool',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      quickActions: [
        {
          label: 'Short-Form Studio',
          actions: [
            {
              label: 'Create Meme',
              title: 'Short-form meme',
              platforms: ['tiktok', 'instagram'],
              type: 'general-meme',
              status: 'draft',
              view: 'upload-video'
            }
          ]
        },
        {
          label: 'Ideas',
          actions: [
            {
              label: 'Create',
              view: 'social-idea-create'
            },
            {
              label: 'View',
              targetGridId: 'social-media-grid-2',
              query: '[status:idea]'
            }
          ]
        },
        {
          label: 'Social Alerts',
          view: 'social-alerts',
          expandView: false
        }
      ]
    }
  ];
