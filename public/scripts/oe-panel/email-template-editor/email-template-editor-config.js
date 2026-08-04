(function () {
  const fontOptions = [
    { value: 'Arial, sans-serif', label: 'Arial' },
    { value: 'OverExposed, Arial, sans-serif', label: 'OverExposed' },
    { value: 'LemonMilk, Arial, sans-serif', label: 'LemonMilk' }
  ];
  const alignmentOptions = [
    { value: 'left', label: 'Left' },
    { value: 'center', label: 'Centre' },
    { value: 'right', label: 'Right' }
  ];
  const sectionSpacingOptions = [
    { value: 'none', label: 'None' },
    { value: 'compact', label: 'Compact' },
    { value: 'standard', label: 'Standard' }
  ];
  const themeColour = (key, label, options = {}) => ({
    key,
    label,
    type: 'themeColour',
    sourceKey: `${key}Source`,
    ...options
  });
  const emailCategoryOptions = [
    { value: 'transactional', label: 'Transactional' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'account-security', label: 'Account & Security' },
    { value: 'onboarding', label: 'Onboarding' },
    { value: 'party-social', label: 'Party & Social' },
    { value: 'rewards-progress', label: 'Rewards & Progress' },
    { value: 'shop-orders', label: 'Shop & Orders' },
    { value: 'product-updates', label: 'Product Updates' },
    { value: 'events', label: 'Events' },
    { value: 're-engagement', label: 'Re-engagement' }
  ];
  const sectionDefinitions = {
    logo: {
      label: 'Logo',
      controls: [
        {
          key: 'src',
          label: 'Logo Image',
          type: 'imagePicker',
          altKey: 'alt',
          initialType: 'branding',
          allowedTypes: ['branding'],
          showTypeTabs: false
        },
        { key: 'alt', label: 'Alternative Text', type: 'text' },
        { key: 'link', label: 'Destination URL', type: 'url' },
        {
          key: 'alignment',
          label: 'Alignment',
          type: 'select',
          options: alignmentOptions
        },
        themeColour('backgroundColour', 'Section Background')
      ]
    },
    heading: {
      label: 'Heading',
      controls: [
        { key: 'text', label: 'Heading Text', type: 'text' },
        {
          key: 'fontFamily',
          label: 'Heading Font',
          type: 'select',
          options: fontOptions
        },
        {
          key: 'fontSize',
          label: 'Heading Size',
          type: 'range',
          min: 22,
          max: 54,
          step: 1,
          suffix: 'px'
        },
        themeColour('colour', 'Heading Colour'),
        {
          key: 'alignment',
          label: 'Alignment',
          type: 'select',
          options: alignmentOptions
        },
        { key: 'showSubheading', label: 'Show Subheading', type: 'checkbox' },
        { key: 'subheading', label: 'Subheading Text', type: 'textarea' },
        {
          key: 'subheadingFontFamily',
          label: 'Subheading Font',
          type: 'select',
          options: fontOptions
        },
        {
          key: 'subheadingFontSize',
          label: 'Subheading Size',
          type: 'range',
          min: 12,
          max: 32,
          step: 1,
          suffix: 'px'
        },
        themeColour('subheadingColour', 'Subheading Colour')
      ]
    },
    hero: {
      label: 'Hero Image',
      controls: [
        {
          key: 'src',
          label: 'Hero Image',
          type: 'imagePicker',
          altKey: 'alt',
          initialType: 'heroes',
          allowedTypes: ['heroes'],
          showTypeTabs: false
        },
        { key: 'alt', label: 'Alternative Text', type: 'text' },
        { key: 'link', label: 'Destination URL', type: 'url' },
        { key: 'visible', label: 'Show Hero Image', type: 'checkbox' }
      ]
    },
    image: {
      label: 'Image',
      controls: [
        {
          key: 'src',
          label: 'Image',
          type: 'imagePicker',
          altKey: 'alt',
          allowNone: true,
          initialType: 'all'
        },
        { key: 'alt', label: 'Alternative Text', type: 'text' },
        { key: 'link', label: 'Destination URL', type: 'url' },
        {
          key: 'width',
          label: 'Width',
          type: 'range',
          min: 20,
          max: 100,
          step: 5,
          suffix: '%'
        },
        {
          key: 'alignment',
          label: 'Alignment',
          type: 'select',
          options: alignmentOptions
        }
      ]
    },
    content: {
      label: 'Body Content',
      controls: [
        { key: 'text', label: 'Body Text', type: 'textarea' },
        {
          key: 'fontFamily',
          label: 'Body Font',
          type: 'select',
          options: fontOptions
        },
        {
          key: 'fontSize',
          label: 'Text Size',
          type: 'range',
          min: 12,
          max: 24,
          step: 1,
          suffix: 'px'
        },
        themeColour('colour', 'Text Colour'),
        {
          key: 'alignment',
          label: 'Alignment',
          type: 'select',
          options: alignmentOptions
        }
      ]
    },
    primaryAction: {
      label: 'Primary Action',
      controls: [
        { key: 'label', label: 'Button Label', type: 'text' },
        { key: 'href', label: 'Destination URL', type: 'url' },
        themeColour('backgroundColour', 'Button Colour'),
        themeColour('textColour', 'Button Text Colour'),
        {
          key: 'alignment',
          label: 'Alignment',
          type: 'select',
          options: alignmentOptions
        }
      ]
    },
    secondaryAction: {
      label: 'Secondary Action',
      controls: [
        { key: 'label', label: 'Link Label', type: 'text' },
        { key: 'href', label: 'Destination URL', type: 'url' },
        themeColour('colour', 'Link Colour'),
        {
          key: 'alignment',
          label: 'Alignment',
          type: 'select',
          options: alignmentOptions
        }
      ]
    },
    buttonGroup: {
      label: 'Button Group',
      controls: [
        { key: 'primaryLabel', label: 'Primary Label', type: 'text' },
        { key: 'primaryHref', label: 'Primary URL', type: 'url' },
        { key: 'secondaryLabel', label: 'Secondary Label', type: 'text' },
        { key: 'secondaryHref', label: 'Secondary URL', type: 'url' },
        themeColour('backgroundColour', 'Primary Button Colour'),
        themeColour('textColour', 'Primary Text Colour'),
        themeColour('borderColour', 'Secondary Border Colour'),
        {
          key: 'alignment',
          label: 'Alignment',
          type: 'select',
          options: alignmentOptions
        }
      ]
    },
    infoBox: {
      label: 'Info Box',
      controls: [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'text', label: 'Text', type: 'textarea' },
        themeColour('backgroundColour', 'Background Colour'),
        themeColour('borderColour', 'Border Colour'),
        themeColour('textColour', 'Text Colour'),
        {
          key: 'borderRadius',
          label: 'Corner Radius',
          type: 'range',
          min: 0,
          max: 30,
          step: 1,
          suffix: 'px'
        }
      ]
    },
    codeToken: {
      label: 'Code / Token',
      controls: [
        { key: 'label', label: 'Label', type: 'text' },
        { key: 'code', label: 'Code', type: 'text' },
        themeColour('labelColour', 'Label Colour'),
        themeColour('backgroundColour', 'Background Colour'),
        themeColour('textColour', 'Code Colour'),
        {
          key: 'borderWidth',
          label: 'Border Thickness',
          type: 'range',
          min: 0,
          max: 12,
          step: 1,
          suffix: 'px'
        },
        themeColour('borderColour', 'Border Colour', {
          visibleWhen: { key: 'borderWidth', greaterThan: 0 }
        }),
        {
          key: 'fontSize',
          label: 'Code Size',
          type: 'range',
          min: 20,
          max: 48,
          step: 1,
          suffix: 'px'
        }
      ]
    },
    keyValueList: {
      label: 'Key Value List',
      controls: [
        { key: 'heading', label: 'Heading', type: 'text' },
        { key: 'rows', label: 'Rows', type: 'textarea' },
        themeColour('labelColour', 'Label Colour'),
        themeColour('valueColour', 'Value Colour')
      ]
    },
    featureList: {
      label: 'Feature List',
      controls: [
        { key: 'heading', label: 'Heading', type: 'text' },
        { key: 'items', label: 'Items', type: 'textarea' },
        themeColour('markerColour', 'Marker Colour'),
        themeColour('textColour', 'Text Colour')
      ]
    },
    quote: {
      label: 'Quote',
      controls: [
        { key: 'text', label: 'Quote Text', type: 'textarea' },
        { key: 'attribution', label: 'Attribution', type: 'text' },
        themeColour('colour', 'Text Colour'),
        themeColour('accentColour', 'Accent Colour'),
        {
          key: 'alignment',
          label: 'Alignment',
          type: 'select',
          options: alignmentOptions
        }
      ]
    },
    productCard: {
      label: 'Product / Reward Card',
      controls: [
        {
          key: 'imageSrc',
          label: 'Product Image',
          type: 'imagePicker',
          altKey: 'imageAlt',
          allowNone: true,
          initialType: 'all'
        },
        { key: 'imageAlt', label: 'Alternative Text', type: 'text' },
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'text', label: 'Text', type: 'textarea' },
        { key: 'meta', label: 'Meta Text', type: 'text' },
        { key: 'ctaLabel', label: 'Action Label', type: 'text' },
        { key: 'ctaHref', label: 'Action URL', type: 'url' },
        themeColour('accentColour', 'Accent Colour'),
        themeColour('borderColour', 'Card Border Colour'),
        themeColour('titleColour', 'Title Colour'),
        themeColour('textColour', 'Text Colour')
      ]
    },
    eventBlock: {
      label: 'Event / Calendar Block',
      controls: [
        { key: 'title', label: 'Event Title', type: 'text' },
        { key: 'dateText', label: 'Date Text', type: 'text' },
        { key: 'location', label: 'Location', type: 'text' },
        { key: 'text', label: 'Text', type: 'textarea' },
        { key: 'ctaLabel', label: 'Action Label', type: 'text' },
        { key: 'ctaHref', label: 'Action URL', type: 'url' },
        themeColour('accentColour', 'Accent Colour'),
        themeColour('titleColour', 'Title Colour'),
        themeColour('locationColour', 'Location Colour'),
        themeColour('textColour', 'Text Colour')
      ]
    },
    legalNote: {
      label: 'Legal Note',
      controls: [
        { key: 'text', label: 'Legal Text', type: 'textarea' },
        {
          key: 'fontSize',
          label: 'Text Size',
          type: 'range',
          min: 10,
          max: 16,
          step: 1,
          suffix: 'px'
        },
        themeColour('colour', 'Text Colour'),
        {
          key: 'alignment',
          label: 'Alignment',
          type: 'select',
          options: alignmentOptions
        }
      ]
    },
    divider: {
      label: 'Divider',
      controls: [themeColour('colour', 'Divider Colour')]
    },
    spacer: {
      label: 'Spacer',
      controls: [
        {
          key: 'height',
          label: 'Height',
          type: 'range',
          min: 8,
          max: 120,
          step: 4,
          suffix: 'px'
        }
      ]
    },
    socialLinks: {
      label: 'Social Links',
      controls: [
        { key: 'heading', label: 'Section Heading', type: 'text' },
        themeColour('iconColour', 'Heading and Icon Colour'),
        {
          key: 'alignment',
          label: 'Alignment',
          type: 'select',
          options: alignmentOptions
        }
      ]
    },
    footer: {
      label: 'Footer',
      controls: [
        { key: 'text', label: 'Footer Text', type: 'textarea' },
        { key: 'privacyLabel', label: 'Privacy Link Label', type: 'text' },
        { key: 'privacyHref', label: 'Privacy Policy URL', type: 'url' },
        {
          key: 'unsubscribeLabel',
          label: 'Unsubscribe Link Label',
          type: 'text'
        },
        {
          key: 'unsubscribeHref',
          label: 'Unsubscribe URL',
          type: 'url'
        },
        {
          key: 'fontSize',
          label: 'Text Size',
          type: 'range',
          min: 10,
          max: 18,
          step: 1,
          suffix: 'px'
        },
        themeColour('colour', 'Text Colour'),
        themeColour('linkColour', 'Link Colour'),
        themeColour('dividerColour', 'Divider Colour')
      ]
    }
  };

  Object.entries(sectionDefinitions).forEach(([type, definition]) => {
    if (type === 'spacer') return;
    definition.controls.push({
      key: 'sectionSpacing',
      label: 'Section Spacing',
      type: 'select',
      options: sectionSpacingOptions
    });
  });

  function createDefaultTemplate() {
    return {
      message: {
        templateName: 'Untitled Email Template',
        templateKey: '',
        subject: 'A new message from OVEREXPOSED',
        preheader: 'Open this email to see what is waiting for you.',
        category: 'transactional',
        automationTriggers: []
      },
      theme: {
        emailBackground: '#171717',
        contentBackground: '#292929',
        accentColour: '#66ccff',
        secondaryColour: '#427bb9',
        contentWidth: 640,
        borderRadius: 0
      },
      sections: {
        logo: {
          src: '/images/emails/branding/overexposed-logo.svg',
          alt: 'OVEREXPOSED',
          link: '/',
          alignment: 'center',
          sectionSpacing: 'compact',
          backgroundColour: '#66ccff',
          backgroundColourSource: 'theme-primary'
        },
        heading: {
          text: 'WELCOME TO OVEREXPOSED',
          fontFamily: 'OverExposed, Arial, sans-serif',
          fontSize: 26,
          colour: '#66ccff',
          colourSource: 'theme-primary',
          alignment: 'center',
          sectionSpacing: 'standard',
          showSubheading: true,
          subheading: 'Create, connect and see things differently.',
          subheadingFontFamily: 'LemonMilk, Arial, sans-serif',
          subheadingFontSize: 16,
          subheadingColour: '#f4f4f4',
          subheadingColourSource: 'custom'
        },
        hero: {
          src: '/images/emails/heroes/mascot/default.png',
          alt: 'OVEREXPOSED email artwork',
          link: '/',
          visible: true,
          sectionSpacing: 'compact'
        },
        content: {
          text: 'You are now part of OVEREXPOSED. This space can introduce a campaign, share an update or guide your audience towards what comes next.',
          fontFamily: 'Arial, sans-serif',
          fontSize: 16,
          colour: '#f4f4f4',
          colourSource: 'custom',
          alignment: 'center',
          sectionSpacing: 'standard'
        },
        primaryAction: {
          label: 'Explore OVEREXPOSED',
          href: '{{ACTION_URL}}',
          backgroundColour: '#66ccff',
          backgroundColourSource: 'theme-primary',
          textColour: '#171717',
          textColourSource: 'custom',
          alignment: 'center',
          sectionSpacing: 'standard'
        },
        footer: {
          text: 'You are receiving this email because of your OVEREXPOSED account.',
          privacyLabel: 'Privacy Policy',
          privacyHref: '/privacy-policy',
          unsubscribeLabel: 'Unsubscribe',
          unsubscribeHref: '{{UNSUBSCRIBE_URL}}',
          fontSize: 12,
          colour: '#a8a8a8',
          colourSource: 'custom',
          linkColour: '#66ccff',
          linkColourSource: 'theme-primary',
          dividerColour: '#427bb9',
          dividerColourSource: 'theme-secondary',
          sectionSpacing: 'standard'
        }
      }
    };
  }

  window.OE_PANEL_EMAIL_TEMPLATE_EDITOR_CONFIG = {
    createDefaultTemplate,
    sectionDefinitions,
    messageControls: [
      { key: 'subject', label: 'Email Subject', type: 'text' },
      { key: 'preheader', label: 'Preheader Text', type: 'textarea' }
    ],
    templateControls: [
      { key: 'templateName', label: 'Template Name', type: 'text' },
      { key: 'templateKey', label: 'Template Key', type: 'text' },
      {
        key: 'category',
        label: 'Email Category',
        type: 'select',
        options: emailCategoryOptions
      },
      {
        key: 'automationTriggers',
        label: 'Automation Triggers',
        type: 'checkboxGroup',
        options: [
          { label: 'Email verification', value: 'email-verification' },
          {
            label: 'Password reset request',
            value: 'password-reset-request'
          },
          {
            label: 'Email address change request',
            value: 'email-address-change'
          }
        ]
      }
    ],
    themeControls: [
      { key: 'emailBackground', label: 'Email Background', type: 'color' },
      { key: 'contentBackground', label: 'Content Background', type: 'color' },
      { key: 'accentColour', label: 'Primary Colour', type: 'color' },
      { key: 'secondaryColour', label: 'Secondary Colour', type: 'color' },
      {
        key: 'contentWidth',
        label: 'Content Width',
        type: 'range',
        min: 420,
        max: 760,
        step: 10,
        suffix: 'px'
      },
      {
        key: 'borderRadius',
        label: 'Content Corner Radius',
        type: 'range',
        min: 0,
        max: 32,
        step: 1,
        suffix: 'px'
      }
    ]
  };
})();
