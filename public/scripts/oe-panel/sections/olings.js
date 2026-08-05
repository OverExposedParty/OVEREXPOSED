window.OE_PANEL_SECTIONS = window.OE_PANEL_SECTIONS || {};
window.OE_PANEL_SECTIONS["oLings"] = [
    {
      id: 'olings-grid-1',
      type: 'stats',
      title: 'oLing Overview',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      stats: [
        {
          label: 'Eggs Opened',
          value: '-',
          detail: '-',
          expandedType: 'table'
        },
        {
          label: 'oLings Hatched',
          value: '-',
          detail: '-',
          expandedType: 'table'
        },
        {
          label: 'Active Eggs',
          value: '-',
          detail: '-',
          expandedType: 'table'
        },
        { label: 'Build Sets', value: '-', detail: '-', expandedType: 'table' }
      ]
    },
    {
      id: 'olings-grid-5',
      type: 'gallery',
      title: 'Set Gallery',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      searchPlaceholder:
        'Search sets, [eggKey:base-egg], [rarity:common], [body:base-round-body]',
      emptyText: 'No oLing sets found.',
      fieldMap: {
        title: 'name',
        meta: ['egg', 'setKey'],
        status: 'galleryStatus',
        preview: 'preview',
        alt: 'name',
        search: [
          'egg',
          'eggKey',
          'setKey',
          'name',
          'rarity',
          'body',
          'eyes',
          'mouth',
          'flight',
          'traitSummary'
        ],
        filters: {
          egg: 'egg',
          eggKey: 'eggKey',
          set: 'setKey',
          setKey: 'setKey',
          rarity: 'rarity',
          body: 'body',
          eyes: 'eyes',
          mouth: 'mouth',
          flight: 'flight'
        }
      },
      targetGridId: 'olings-grid-3',
      targetSeries: 'sets',
      targetQueryField: 'setKey',
      targetQueryValue: 'setKey',
      dataSource: 'olingBuildSets',
      paletteField: 'rarity',
      paletteType: 'rarity',
      items: []
    },
    {
      id: 'olings-grid-3',
      type: 'table',
      title: 'oLing Workspace',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      defaultSeries: 'sets',
      tableSeries: [
        {
          value: 'eggs',
          label: 'Egg Builder',
          dataSource: 'olingEggs',
          editable: true,
          editKey: 'key',
          saveEndpoint: '/api/oe-panel/olings/eggs/{key}',
          deleteEndpoint: '/api/oe-panel/olings/eggs/{key}',
          rowActions: [{ label: 'Archive', action: 'delete' }],
          columns: [
            { key: 'name', label: 'Egg' },
            { key: 'key', label: 'Key' },
            { key: 'collection', label: 'Collection' },
            { key: 'status', label: 'Status' },
            { key: 'enabled', label: 'Active' },
            { key: 'opened', label: 'Opened' }
          ],
          expandedFields: [
            { key: 'name', label: 'Name', editable: true },
            { key: 'key', label: 'Key' },
            { key: 'collection', label: 'Collection', editable: true },
            { key: 'status', label: 'Status', editable: true },
            { key: 'enabled', label: 'Active', editable: true },
            {
              key: 'rarityOddsJson',
              label: 'Rarity Odds JSON',
              editable: true,
              expandable: true
            },
            {
              key: 'setsJson',
              label: 'Build Sets JSON',
              editable: true,
              expandable: true
            },
            { key: 'assignedSets', label: 'Assigned Sets' },
            { key: 'setRarities', label: 'Set Rarities' },
            {
              key: 'poolsJson',
              label: 'Derived Layer Pools JSON',
              expandable: true
            },
            {
              key: 'personalityPool',
              label: 'Personality Pool',
              editable: true
            },
            {
              key: 'assetsJson',
              label: 'Assets JSON',
              editable: true,
              expandable: true
            },
            {
              key: 'metadataJson',
              label: 'Metadata JSON',
              editable: true,
              expandable: true
            },
            { key: 'createdAt', label: 'Created' },
            { key: 'updatedAt', label: 'Updated' }
          ]
        },
        {
          value: 'sets',
          label: 'Build Sets',
          dataSource: 'olingBuildSets',
          columns: [
            { key: 'egg', label: 'Egg' },
            { key: 'name', label: 'Set' },
            { key: 'rarity', label: 'Rarity' },
            { key: 'body', label: 'Body' },
            { key: 'eyes', label: 'Eyes' },
            { key: 'mouth', label: 'Mouth' },
            { key: 'flight', label: 'Flight' }
          ],
          expandedFields: [
            { key: 'eggKey', label: 'Egg Key' },
            { key: 'setKey', label: 'Set Key' },
            { key: 'theme', label: 'Theme' },
            { key: 'metadataJson', label: 'Metadata JSON', expandable: true }
          ]
        },
        {
          value: 'layers',
          label: 'Layer Stats',
          dataSource: 'olingTraits',
          editable: true,
          editKey: 'key',
          saveEndpoint: '/api/oe-panel/olings/traits/{key}',
          columns: [
            { key: 'name', label: 'Trait' },
            { key: 'layer', label: 'Layer' },
            { key: 'rarity', label: 'Rarity' },
            { key: 'theme', label: 'Theme' },
            { key: 'status', label: 'Status' },
            { key: 'enabled', label: 'Active' }
          ],
          expandedFields: [
            { key: 'key', label: 'Key' },
            { key: 'name', label: 'Name', editable: true },
            { key: 'collection', label: 'Collection', editable: true },
            { key: 'theme', label: 'Theme', editable: true },
            { key: 'layer', label: 'Layer' },
            { key: 'rarity', label: 'Rarity', editable: true },
            { key: 'status', label: 'Status', editable: true },
            { key: 'enabled', label: 'Active', editable: true },
            {
              key: 'bodyStatsJson',
              label: 'Body Stats JSON',
              editable: true,
              expandable: true
            },
            {
              key: 'attackJson',
              label: 'Attack JSON',
              editable: true,
              expandable: true
            },
            {
              key: 'modifiersJson',
              label: 'Modifiers JSON',
              editable: true,
              expandable: true
            },
            {
              key: 'passiveJson',
              label: 'Passive JSON',
              editable: true,
              expandable: true
            },
            {
              key: 'assetsJson',
              label: 'Assets JSON',
              editable: true,
              expandable: true
            },
            { key: 'flavor', label: 'Flavor', editable: true, expandable: true }
          ]
        },
        {
          value: 'receipts',
          label: 'Hatch Logs',
          dataSource: 'olingHatchReceipts',
          columns: [
            { key: 'createdAt', label: 'Hatched' },
            { key: 'owner', label: 'Owner' },
            { key: 'eggKey', label: 'Egg' },
            { key: 'olingId', label: 'oLing ID' },
            { key: 'summary', label: 'Build' }
          ],
          expandedFields: [
            { key: 'ownerId', label: 'Owner ID' },
            { key: 'rollsJson', label: 'Rolls JSON', expandable: true },
            {
              key: 'inventoryChangeJson',
              label: 'Inventory Change',
              expandable: true
            },
            { key: 'userAgent', label: 'User Agent', expandable: true }
          ]
        },
        {
          value: 'olings',
          label: 'oLing Browser',
          dataSource: 'playerOlings',
          columns: [
            { key: 'hatchedAt', label: 'Hatched' },
            { key: 'owner', label: 'Owner' },
            { key: 'eggKey', label: 'Egg' },
            { key: 'personalityKey', label: 'Personality' },
            { key: 'matchingSet', label: 'Set' },
            { key: 'rarities', label: 'Rarities' }
          ],
          expandedFields: [
            { key: 'id', label: 'oLing ID' },
            { key: 'ownerId', label: 'Owner ID' },
            { key: 'buildJson', label: 'Build JSON', expandable: true },
            {
              key: 'battleStatsJson',
              label: 'Battle Stats JSON',
              expandable: true
            }
          ]
        },
        {
          value: 'odds',
          label: 'Rarity Balancer',
          dataSource: 'olingRarityBalancer',
          columns: [
            { key: 'egg', label: 'Egg' },
            { key: 'rarity', label: 'Rarity' },
            { key: 'odds', label: 'Odds' },
            { key: 'body', label: 'Body Pool' },
            { key: 'eyes', label: 'Eyes Pool' },
            { key: 'mouth', label: 'Mouth Pool' },
            { key: 'flight', label: 'Flight Pool' }
          ],
          expandedFields: [
            { key: 'eggKey', label: 'Egg Key' },
            { key: 'weight', label: 'Weight' },
            { key: 'possibleBuilds', label: 'Possible Builds' }
          ]
        },
        {
          value: 'warnings',
          label: 'Validation Warnings',
          dataSource: 'olingWarnings',
          columns: [
            { key: 'severity', label: 'Severity' },
            { key: 'area', label: 'Area' },
            { key: 'item', label: 'Item' },
            { key: 'issue', label: 'Issue' }
          ],
          expandedFields: [
            { key: 'detail', label: 'Detail', expandable: true },
            { key: 'fix', label: 'Suggested Fix', expandable: true }
          ]
        }
      ],
      rows: []
    },
    {
      id: 'olings-grid-4',
      type: 'actions',
      title: 'oLing Tools',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      actions: [
        {
          label: 'Egg Builder',
          value: 'oling-egg-builder',
          targetSection: 'oLings',
          targetGridId: 'olings-grid-3',
          series: 'eggs'
        },
        {
          label: 'Create Egg',
          value: 'create-oling-egg',
          form: {
            title: 'Create Egg',
            backLabel: 'Back to oLing tools',
            submitEndpoint: '/api/oe-panel/olings/eggs',
            submitLabel: 'Save Egg',
            submittingLabel: 'Saving...',
            successMessage: 'Egg created.',
            successButtonLabel: 'Saved',
            errorMessage: 'Egg could not be created.',
            successEvent: 'oe-panel-olings-data-changed',
            fields: [
              {
                type: 'row',
                columns: 'is-three-column',
                fields: [
                  { label: 'Name', name: 'name', required: true },
                  { label: 'Key', name: 'key', required: true },
                  {
                    label: 'Collection',
                    name: 'collection',
                    value: 'base',
                    required: true
                  }
                ]
              },
              {
                type: 'row',
                columns: 'is-three-column',
                fields: [
                  {
                    label: 'Status',
                    name: 'status',
                    value: 'draft',
                    options: [
                      { label: 'Draft', value: 'draft' },
                      { label: 'Published', value: 'published' },
                      { label: 'Archived', value: 'archived' }
                    ]
                  },
                  {
                    label: 'Active',
                    name: 'enabled',
                    value: 'no',
                    options: [
                      { label: 'No', value: 'no' },
                      { label: 'Yes', value: 'yes' }
                    ]
                  },
                  { label: 'Image Path', name: 'image' }
                ]
              },
              {
                label: 'Rarity Odds JSON',
                name: 'rarityOddsJson',
                multiline: true,
                value:
                  '{"common":1,"uncommon":0,"rare":0,"epic":0,"legendary":0,"mythic":0}'
              },
              {
                label: 'Build Sets JSON',
                name: 'setsJson',
                multiline: true,
                placeholder:
                  '[{"key":"origin","name":"Origin","rarity":"common","traits":{"flight":"...","body":"...","eyes":"...","mouth":"..."}}]'
              },
              {
                label: 'Personality Pool',
                name: 'personalityPool',
                placeholder: 'brave, curious, lucky'
              }
            ]
          }
        },
        {
          label: 'Run Simulation',
          value: 'simulate-oling-egg',
          form: {
            title: 'Hatch Simulator',
            backLabel: 'Back to oLing tools',
            submitEndpoint: '/api/oe-panel/olings/simulate',
            submitLabel: 'Run Simulation',
            submittingLabel: 'Rolling...',
            successMessage: 'Simulation complete.',
            successButtonLabel: 'Rolled',
            errorMessage: 'Simulation could not run.',
            successEvent: 'oe-panel-olings-data-changed',
            fields: [
              {
                type: 'row',
                columns: 'is-three-column',
                fields: [
                  {
                    label: 'Egg Key',
                    name: 'eggKey',
                    value: 'base-egg',
                    required: true
                  },
                  {
                    label: 'Rolls',
                    name: 'rolls',
                    value: '100',
                    inputType: 'number',
                    required: true
                  },
                  {
                    label: 'Include Draft Eggs',
                    name: 'includeDrafts',
                    value: 'yes',
                    options: [
                      { label: 'Yes', value: 'yes' },
                      { label: 'No', value: 'no' }
                    ]
                  }
                ]
              }
            ]
          }
        },
        {
          label: 'Review Warnings',
          value: 'review-oling-warnings',
          targetSection: 'oLings',
          targetGridId: 'olings-grid-3',
          series: 'warnings'
        },
        {
          label: 'Recent Hatches',
          value: 'recent-oling-hatches',
          targetSection: 'oLings',
          targetGridId: 'olings-grid-3',
          series: 'receipts'
        },
        {
          label: 'oLing Browser',
          value: 'oling-browser',
          targetSection: 'oLings',
          targetGridId: 'olings-grid-3',
          series: 'olings'
        },
        {
          label: 'Rarity Balancer',
          value: 'oling-rarity-balancer',
          targetSection: 'oLings',
          targetGridId: 'olings-grid-3',
          series: 'odds'
        }
      ]
    }
  ];
