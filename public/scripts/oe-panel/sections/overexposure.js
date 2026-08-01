window.OE_PANEL_SECTIONS = window.OE_PANEL_SECTIONS || {};
window.OE_PANEL_SECTIONS["OverExposure"] = [
    {
      id: 'overexposure-grid-1',
      type: 'table',
      title: 'Posts',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'post', label: 'Post', linkKey: 'postUrl' },
        { key: 'author', label: 'Author' },
        { key: 'status', label: 'Status' },
        { key: 'tag', label: 'Tag' }
      ],
      rows: [],
      dataSource: 'overexposurePosts',
      deleteEndpoint: '/api/oe-panel/overexposure-posts/{publicId}',
      expandedFields: [
        { key: 'publicId', label: 'Public ID' },
        { key: 'date', label: 'Date' },
        { key: 'updatedAt', label: 'Updated' },
        { key: 'coordinates', label: 'Coordinates' },
        { key: 'visibility', label: 'Visibility' },
        { key: 'excerpt', label: 'Excerpt', expandable: true }
      ]
    },
    {
      id: 'overexposure-grid-2',
      type: 'stats',
      title: 'Content Stats',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      stats: [
        {
          label: 'Total Posts',
          value: '-',
          expandedType: 'table'
        },
        {
          label: 'Pending Review',
          value: '-',
          detail: '-',
          expandedType: 'table'
        },
        {
          label: 'Reports',
          value: '-',
          detail: '-',
          expandedType: 'table'
        },
        {
          label: 'Published Today',
          value: '-',
          expandedType: 'table'
        }
      ]
    },
    {
      id: 'overexposure-grid-3',
      type: 'alerts',
      title: 'Reported Content',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      alerts: []
    },
    {
      id: 'overexposure-grid-4',
      type: 'actions',
      title: 'Publishing Tools',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      actions: [
        { label: 'Review Queue', value: 'review-queue' },
        { label: 'Create Feature', value: 'create-feature' },
        { label: 'Manage Tags', value: 'manage-tags' },
        { label: 'Open Reports', value: 'open-reports' }
      ]
    }
  ];
