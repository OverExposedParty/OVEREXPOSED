window.OE_PANEL_SECTIONS = window.OE_PANEL_SECTIONS || {};
window.OE_PANEL_SECTIONS["Shop"] = [
    {
      id: 'shop-grid-1',
      type: 'table',
      title: 'Products',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      columns: [
        { key: 'product', label: 'Product' },
        { key: 'type', label: 'Type' },
        { key: 'payment', label: 'Payment' },
        { key: 'money', label: 'Money' },
        { key: 'opals', label: 'Opals' },
        { key: 'grants', label: 'Grants' },
        { key: 'status', label: 'Status' }
      ],
      rows: [],
      dataSource: 'shopProducts',
      editable: true,
      editKey: 'productId',
      saveEndpoint: '/api/oe-panel/shop/products/{productId}',
      deleteEndpoint: '/api/oe-panel/shop/products/{productId}',
      rowActions: [{ label: 'Archive', action: 'delete' }],
      expandedFields: [
        { key: 'productId', label: 'Product ID' },
        { key: 'product', label: 'Name', editable: true },
        { key: 'slug', label: 'Slug', editable: true },
        { key: 'type', label: 'Type', editable: true },
        { key: 'status', label: 'Status', editable: true },
        { key: 'visibility', label: 'Visibility', editable: true },
        { key: 'active', label: 'Active', editable: true },
        { key: 'purchaseMethods', label: 'Purchase Methods', editable: true },
        { key: 'moneyAmount', label: 'Money Amount', editable: true },
        { key: 'currency', label: 'Currency', editable: true },
        { key: 'opalAmount', label: 'Opal Amount', editable: true },
        { key: 'grantsJson', label: 'Grants JSON', editable: true },
        { key: 'sku', label: 'Default SKU' },
        { key: 'variantName', label: 'Variant Name', editable: true },
        { key: 'quantity', label: 'Quantity', editable: true },
        { key: 'trackStock', label: 'Track Stock', editable: true },
        { key: 'stripeProductId', label: 'Stripe Product ID', editable: true },
        { key: 'stripePriceId', label: 'Stripe Price ID', editable: true },
        { key: 'publishedAt', label: 'Published' },
        { key: 'updatedAt', label: 'Updated' },
        { key: 'description', label: 'Description', editable: true }
      ]
    },
    {
      id: 'shop-grid-2',
      type: 'stats',
      title: 'Shop Stats',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      stats: [
        {
          label: 'Money Revenue',
          value: '-',
          detail: '-',
          expandedType: 'table'
        },
        {
          label: 'Money Orders',
          value: '-',
          detail: '-',
          expandedType: 'table'
        },
        {
          label: 'Opals Received',
          value: '-',
          detail: '-',
          expandedType: 'table'
        },
        {
          label: 'Opals Spent',
          value: '-',
          detail: '-',
          expandedType: 'table'
        }
      ]
    },
    {
      id: 'shop-grid-3',
      type: 'gallery',
      title: 'Product Gallery',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      searchPlaceholder:
        'Search products, [status:active], [type:digital], [payment:opals]',
      emptyText: 'No products found.',
      fieldMap: {
        title: 'product',
        meta: ['slug', 'type', 'payment'],
        status: 'galleryStatus',
        preview: 'preview',
        alt: 'product',
        search: ['product', 'slug', 'type', 'payment', 'status', 'visibility'],
        filters: {
          id: 'productId',
          product: 'product',
          slug: 'slug',
          type: 'type',
          payment: 'payment',
          status: 'status',
          visibility: 'visibility',
          active: 'active'
        }
      },
      targetGridId: 'shop-grid-1',
      targetQueryField: 'slug',
      targetQueryValue: 'slug',
      items: []
    },
    {
      id: 'shop-grid-4',
      type: 'actions',
      title: 'Shop Tools',
      backgroundColour: '#202020',
      primaryColour: 'var(--primarypagecolour)',
      secondaryColour: 'var(--secondarypagecolour)',
      actions: [
        {
          label: 'Create Product',
          value: 'create-product',
          form: {
            title: 'Create Product',
            backLabel: 'Back to shop tools',
            submitEndpoint: '/api/oe-panel/shop/products',
            submitLabel: 'Save Product',
            submittingLabel: 'Saving...',
            successMessage: 'Product created.',
            successButtonLabel: 'Saved',
            errorMessage: 'Product could not be created.',
            successEvent: 'oe-panel-shop-products-changed',
            fields: [
              {
                type: 'row',
                columns: 'is-three-column',
                fields: [
                  { label: 'Name', name: 'name', required: true },
                  { label: 'Slug', name: 'slug' },
                  {
                    label: 'Type',
                    name: 'type',
                    value: 'digital',
                    options: [
                      { label: 'Digital', value: 'digital' },
                      { label: 'Physical', value: 'physical' }
                    ]
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
                      { label: 'Active', value: 'active' },
                      { label: 'Archived', value: 'archived' }
                    ]
                  },
                  {
                    label: 'Visibility',
                    name: 'visibility',
                    value: 'hidden',
                    options: [
                      { label: 'Hidden', value: 'hidden' },
                      { label: 'Public', value: 'public' },
                      { label: 'Members Only', value: 'members_only' }
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
                  }
                ]
              },
              {
                type: 'row',
                columns: 'is-three-column',
                fields: [
                  {
                    label: 'Purchase Methods',
                    name: 'purchaseMethods',
                    value: 'money',
                    placeholder: 'money, opals'
                  },
                  {
                    label: 'Money Amount',
                    name: 'moneyAmount',
                    value: '0',
                    inputType: 'number'
                  },
                  {
                    label: 'Currency',
                    name: 'currency',
                    value: 'GBP'
                  }
                ]
              },
              {
                type: 'row',
                columns: 'is-three-column',
                fields: [
                  {
                    label: 'Opal Amount',
                    name: 'opalAmount',
                    inputType: 'number'
                  },
                  {
                    label: 'Variant Name',
                    name: 'variantName',
                    value: 'Default',
                    required: true
                  },
                  { label: 'SKU', name: 'sku', required: true }
                ]
              },
              {
                type: 'row',
                columns: 'is-three-column',
                fields: [
                  {
                    label: 'Quantity',
                    name: 'quantity',
                    value: '0',
                    inputType: 'number'
                  },
                  {
                    label: 'Track Stock',
                    name: 'trackStock',
                    value: 'yes',
                    options: [
                      { label: 'Yes', value: 'yes' },
                      { label: 'No', value: 'no' }
                    ]
                  },
                  { label: 'Stripe Price ID', name: 'stripePriceId' }
                ]
              },
              {
                label: 'Description',
                name: 'description',
                multiline: true
              },
              {
                label: 'Grants JSON',
                name: 'grantsJson',
                multiline: true,
                placeholder:
                  '[{"type":"pack","key":"truth-or-dare-spicy","gamemode":"truth-or-dare"}]'
              }
            ]
          }
        },
        {
          label: 'Review Issues',
          value: 'review-shop-issues',
          countKey: 'shopIssueItems',
          alertSource: 'shopIssueAlerts',
          emptyTitle: 'No shop issues',
          emptyDetail: 'Shop product configuration looks clear.'
        }
      ]
    }
  ];
