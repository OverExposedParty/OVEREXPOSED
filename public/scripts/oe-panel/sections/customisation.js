window.OE_PANEL_SECTIONS = window.OE_PANEL_SECTIONS || {};
window.OE_PANEL_SECTIONS["OE Customisation"] = [
    {
      id: 'oe-customisation-grid-1',
      type: 'stats',
      title: 'OE Customisation Stats',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      stats: [
        {
          label: 'Total OE Packs',
          value: '-',
          detail: '-',
          expandedType: 'table'
        },
        {
          label: 'Total OE Images',
          value: '-',
          detail: '-',
          expandedType: 'table'
        },
        {
          label: 'OE Related Errors',
          value: '-',
          detail: '-',
          expandedType: 'table'
        },
        {
          label: 'Blacklisted OEs',
          value: '-',
          detail: '-',
          expandedType: 'table'
        }
      ]
    },
    {
      id: 'oe-customisation-grid-2',
      type: 'table',
      title: 'OE Data',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      defaultSeries: 'packs',
      tableSeries: [
        {
          value: 'packs',
          label: 'OE Packs',
          columns: [
            { key: 'pack', label: 'Pack' },
            { key: 'prefix', label: 'Prefix' },
            { key: 'status', label: 'Status' },
            { key: 'active', label: 'Active' },
            { key: 'images', label: 'Images' },
            { key: 'updated', label: 'Updated' }
          ],
          expandedFields: [
            { key: 'pack', label: 'Pack', editable: true },
            { key: 'slug', label: 'Slug', editable: true },
            { key: 'prefix', label: 'Prefix', editable: true },
            {
              key: 'description',
              label: 'Description',
              expandable: true,
              editable: true
            },
            { key: 'status', label: 'Status', editable: true },
            { key: 'active', label: 'Active', editable: true },
            { key: 'images', label: 'Images' },
            { key: 'colour', label: 'Colour', editable: true },
            {
              key: 'secondaryColour',
              label: 'Secondary Colour',
              editable: true
            },
            { key: 'updated', label: 'Updated' }
          ],
          rows: [],
          dataSource: 'oeCustomisationPacks',
          editable: true,
          saveEndpoint: '/api/oe-panel/oe-customisation/packs/{slug}',
          deleteEndpoint: '/api/oe-panel/oe-customisation/packs/{slug}',
          rowActions: [{ label: 'Delete', action: 'delete' }]
        },
        {
          value: 'images',
          label: 'OE Images',
          columns: [
            { key: 'oeId', label: 'OE ID' },
            { key: 'name', label: 'Name' },
            { key: 'pack', label: 'Pack' },
            { key: 'slot', label: 'Slot' },
            { key: 'status', label: 'Status' },
            { key: 'blacklisted', label: 'Blacklisted' }
          ],
          expandedFields: [
            { key: 'oeId', label: 'OE ID', editable: true },
            { key: 'name', label: 'Name', editable: true },
            { key: 'pack', label: 'Pack', editable: true },
            { key: 'slot', label: 'Slot', editable: true },
            { key: 'status', label: 'Status', editable: true },
            { key: 'active', label: 'Active', editable: true },
            { key: 'blacklisted', label: 'Blacklisted', editable: true },
            {
              key: 'filePath',
              label: 'File Path',
              expandable: true,
              editable: true
            },
            { key: 'fileExists', label: 'File Exists' },
            {
              key: 'findTheOeCategory',
              label: 'Find The OE Category',
              editable: true
            },
            { key: 'findTheOeTone', label: 'Find The OE Tone', editable: true },
            { key: 'findTheOeRgb', label: 'Find The OE RGB', editable: true },
            { key: 'updated', label: 'Updated' }
          ],
          rows: [],
          dataSource: 'oeCustomisationImages',
          editable: true,
          saveEndpoint: '/api/oe-panel/oe-customisation/images/{oeId}',
          deleteEndpoint: '/api/oe-panel/oe-customisation/images/{oeId}',
          rowActions: [{ label: 'Delete', action: 'delete' }]
        }
      ]
    },
    {
      id: 'oe-customisation-grid-3',
      type: 'gallery',
      title: 'OE Gallery',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      searchPlaceholder:
        'Search OEs, [pack:base], [OE-ID:A100], [slot:head-slot]',
      emptyText: 'No OEs found.',
      fieldMap: {
        title: 'name',
        meta: ['oeId', 'pack', 'slot'],
        status: 'galleryStatus',
        preview: 'preview',
        alt: 'name',
        search: ['oeId', 'name', 'pack', 'slot', 'status'],
        filters: {
          id: 'oeId',
          oeid: 'oeId',
          image: 'oeId',
          oe: 'oeId',
          name: 'name',
          pack: 'pack',
          packslug: 'pack',
          slot: 'slot',
          status: 'status',
          blacklisted: 'blacklisted'
        }
      },
      targetGridId: 'oe-customisation-grid-2',
      targetSeries: 'images',
      targetQueryField: 'OE-ID',
      targetQueryValue: 'oeId',
      dataSource: 'oeCustomisationImages',
      paletteField: 'pack',
      paletteType: 'oe-pack',
      items: []
    },
    {
      id: 'oe-customisation-grid-4',
      type: 'actions',
      title: 'OE Actions',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      actions: [
        {
          label: 'Manage OE Packs',
          value: 'manage-oe-packs',
          actions: [
            {
              label: 'Create New OE Pack',
              value: 'create-new-oe-pack',
              view: 'oe-pack-create'
            },
            {
              label: 'Manage OE Packs',
              value: 'manage-oe-packs-table',
              targetGridId: 'oe-customisation-grid-2',
              series: 'packs'
            }
          ]
        },
        {
          label: 'Manage OE Images',
          value: 'manage-oe-images',
          actions: [
            {
              label: 'Create New OE Image',
              value: 'create-new-oe-image',
              form: {
                title: 'Create New OE Image',
                backLabel: 'Back to manage OE images',
                submitEndpoint: '/api/oe-panel/oe-customisation/images',
                method: 'POST',
                encoding: 'multipart',
                submitLabel: 'Save OE Image',
                errorMessage: 'OE image could not be created.',
                successEvent: 'oe-panel-oe-customisation-data-changed',
                fields: [
                  {
                    type: 'row',
                    columns: 'is-three-column',
                    fields: [
                      {
                        label: 'OE ID',
                        name: 'oeId',
                        required: true,
                        placeholder: 'A100'
                      },
                      {
                        label: 'Pack Slug',
                        name: 'packSlug',
                        required: true,
                        placeholder: 'base'
                      },
                      {
                        label: 'Slot',
                        name: 'slot',
                        required: true,
                        options: [
                          { label: 'Colour', value: 'colour' },
                          { label: 'Head Slot', value: 'head-slot' },
                          { label: 'Eyes Slot', value: 'eyes-slot' },
                          { label: 'Mouth Slot', value: 'mouth-slot' }
                        ]
                      }
                    ]
                  },
                  { label: 'Name', name: 'name', required: true },
                  {
                    label: 'Folder Path',
                    name: 'filePath',
                    required: true,
                    placeholder: '/images/user-customisation/head-slot/base'
                  },
                  {
                    label: 'SVG Upload',
                    name: 'svg',
                    type: 'file',
                    preview: 'svg',
                    required: true,
                    svgDimensions: { width: 512, height: 512 }
                  },
                  {
                    type: 'row',
                    columns: 'is-three-column',
                    fields: [
                      {
                        label: 'Status',
                        name: 'status',
                        options: [
                          { label: 'Published', value: 'published' },
                          { label: 'Draft', value: 'draft' },
                          { label: 'Archived', value: 'archived' }
                        ]
                      },
                      {
                        label: 'Active',
                        name: 'active',
                        value: 'no',
                        options: [
                          { label: 'No', value: 'no' },
                          { label: 'Yes', value: 'yes' }
                        ]
                      },
                      {
                        label: 'Blacklisted',
                        name: 'blacklisted',
                        options: [
                          { label: 'No', value: 'no' },
                          { label: 'Yes', value: 'yes' }
                        ]
                      }
                    ]
                  },
                  {
                    type: 'row',
                    columns: 'is-three-column',
                    fields: [
                      {
                        label: 'Find The OE Category',
                        name: 'findTheOeCategory',
                        placeholder: 'hair'
                      },
                      {
                        label: 'Find The OE Tone',
                        name: 'findTheOeTone',
                        placeholder: 'mid'
                      },
                      {
                        label: 'Find The OE RGB',
                        name: 'rgb',
                        placeholder: '108, 85, 33',
                        title: 'Comma-separated RGB values.'
                      }
                    ]
                  }
                ]
              }
            },
            {
              label: 'Manage OE Images',
              value: 'manage-oe-images-table',
              targetGridId: 'oe-customisation-grid-2',
              series: 'images'
            }
          ]
        },
        {
          label: 'View OE Issues',
          value: 'view-oe-issues',
          countKey: 'oeIssues',
          view: 'oe-customisation-issues'
        }
      ]
    }
  ];
