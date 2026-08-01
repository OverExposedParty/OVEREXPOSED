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
  const sectionDefinitions = {
    logo: {
      label: 'Logo',
      controls: [
        { key: 'src', label: 'Image URL', type: 'url' },
        { key: 'alt', label: 'Alternative Text', type: 'text' },
        { key: 'link', label: 'Destination URL', type: 'url' },
        {
          key: 'width',
          label: 'Width',
          type: 'range',
          min: 80,
          max: 280,
          step: 5,
          suffix: 'px'
        },
        {
          key: 'alignment',
          label: 'Alignment',
          type: 'select',
          options: alignmentOptions
        }
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
        { key: 'colour', label: 'Heading Colour', type: 'color' },
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
        }
      ]
    },
    hero: {
      label: 'Hero Image',
      controls: [
        { key: 'src', label: 'Image URL', type: 'url' },
        { key: 'alt', label: 'Alternative Text', type: 'text' },
        { key: 'link', label: 'Destination URL', type: 'url' },
        { key: 'visible', label: 'Show Hero Image', type: 'checkbox' },
        {
          key: 'borderRadius',
          label: 'Corner Radius',
          type: 'range',
          min: 0,
          max: 32,
          step: 1,
          suffix: 'px'
        }
      ]
    },
    image: {
      label: 'Image',
      controls: [
        { key: 'src', label: 'Image URL', type: 'url' },
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
        },
        {
          key: 'borderRadius',
          label: 'Corner Radius',
          type: 'range',
          min: 0,
          max: 32,
          step: 1,
          suffix: 'px'
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
        { key: 'colour', label: 'Text Colour', type: 'color' },
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
        { key: 'backgroundColour', label: 'Button Colour', type: 'color' },
        { key: 'textColour', label: 'Button Text Colour', type: 'color' },
        {
          key: 'borderRadius',
          label: 'Corner Radius',
          type: 'range',
          min: 0,
          max: 30,
          step: 1,
          suffix: 'px'
        },
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
      controls: [
        { key: 'colour', label: 'Divider Colour', type: 'color' },
        {
          key: 'thickness',
          label: 'Thickness',
          type: 'range',
          min: 1,
          max: 8,
          step: 1,
          suffix: 'px'
        },
        {
          key: 'width',
          label: 'Width',
          type: 'range',
          min: 20,
          max: 100,
          step: 5,
          suffix: '%'
        }
      ]
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
        { key: 'instagramUrl', label: 'Instagram URL', type: 'url' },
        { key: 'tiktokUrl', label: 'TikTok URL', type: 'url' },
        { key: 'youtubeUrl', label: 'YouTube URL', type: 'url' },
        { key: 'colour', label: 'Link Colour', type: 'color' },
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
        { key: 'colour', label: 'Text Colour', type: 'color' }
      ]
    }
  };

  function createDefaultTemplate() {
    return {
      message: {
        templateName: 'Untitled Email Template',
        templateKey: '',
        subject: 'A new message from OVEREXPOSED',
        preheader: 'Open this email to see what is waiting for you.',
        category: 'transactional'
      },
      theme: {
        emailBackground: '#171717',
        contentBackground: '#292929',
        accentColour: '#66ccff',
        contentWidth: 640,
        borderRadius: 0
      },
      sections: {
        logo: {
          src: '/images/logo.svg',
          alt: 'OVEREXPOSED',
          link: '/',
          width: 180,
          alignment: 'center'
        },
        heading: {
          text: 'WELCOME TO OVEREXPOSED',
          fontFamily: 'OverExposed, Arial, sans-serif',
          fontSize: 36,
          colour: '#66ccff',
          alignment: 'center',
          showSubheading: true,
          subheading: 'Create, connect and see things differently.',
          subheadingFontFamily: 'LemonMilk, Arial, sans-serif'
        },
        hero: {
          src: '/images/emails/email-confirmation/email-confirmation.png',
          alt: 'OVEREXPOSED email artwork',
          link: '/',
          visible: true,
          borderRadius: 0
        },
        content: {
          text: 'You are now part of OVEREXPOSED. This space can introduce a campaign, share an update or guide your audience towards what comes next.',
          fontFamily: 'Arial, sans-serif',
          fontSize: 16,
          colour: '#f4f4f4',
          alignment: 'center'
        },
        primaryAction: {
          label: 'Explore OVEREXPOSED',
          href: '{{ACTION_URL}}',
          backgroundColour: '#66ccff',
          textColour: '#171717',
          borderRadius: 0,
          alignment: 'center'
        },
        footer: {
          text: 'You are receiving this email because of your OVEREXPOSED account.',
          privacyLabel: 'Privacy Policy',
          privacyHref: '/privacy-policy',
          unsubscribeLabel: 'Unsubscribe',
          unsubscribeHref: '{{UNSUBSCRIBE_URL}}',
          fontSize: 12,
          colour: '#a8a8a8'
        }
      }
    };
  }

  window.OE_PANEL_EMAIL_TEMPLATE_EDITOR_CONFIG = {
    createDefaultTemplate,
    sectionDefinitions,
    messageControls: [
      { key: 'templateName', label: 'Template Name', type: 'text' },
      { key: 'templateKey', label: 'Template Key', type: 'text' },
      { key: 'subject', label: 'Email Subject', type: 'text' },
      { key: 'preheader', label: 'Preheader Text', type: 'textarea' },
      {
        key: 'category',
        label: 'Email Category',
        type: 'select',
        options: [
          { value: 'transactional', label: 'Transactional' },
          { value: 'marketing', label: 'Marketing' }
        ]
      }
    ],
    themeControls: [
      { key: 'emailBackground', label: 'Email Background', type: 'color' },
      { key: 'contentBackground', label: 'Content Background', type: 'color' },
      { key: 'accentColour', label: 'Accent Colour', type: 'color' },
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
