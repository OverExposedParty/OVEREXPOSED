const assert = require('node:assert/strict');
const test = require('node:test');

const {
  EmailTemplateValidationError,
  compileEmailTemplate,
  normalizeEmailTemplateInput,
  serializeEmailTemplate
} = require('../../server/services/email-templates');

function createInput() {
  return {
    key: 'verify-email',
    name: 'Verification Email',
    category: 'account-security',
    automationTriggers: ['email-verification'],
    subject: 'Confirm {{ACCOUNT_NAME}}',
    preheader: 'Confirm your account',
    theme: {
      emailBackground: '#171717',
      contentBackground: '#292929',
      accentColour: '#66ccff',
      secondaryColour: '#427bb9',
      contentWidth: 640,
      borderRadius: 0
    },
    sections: [
      {
        id: 'heading',
        type: 'heading',
        settings: {
          text: '<script>alert(1)</script>',
          fontFamily: 'OverExposed, Arial, sans-serif',
          fontSize: 36,
          colour: '#66ccff',
          alignment: 'center',
          showSubheading: true,
          subheading: 'Welcome',
          subheadingFontFamily: 'LemonMilk, Arial, sans-serif',
          subheadingFontSize: 20
        }
      },
      {
        id: 'primaryAction',
        type: 'primaryAction',
        settings: {
          label: 'Confirm email',
          href: '{{VERIFY_URL}}',
          backgroundColour: '#66ccff',
          textColour: '#171717',
          borderRadius: 0,
          alignment: 'center'
        }
      },
      {
        id: 'footer',
        type: 'footer',
        settings: {
          text: 'OVEREXPOSED',
          privacyLabel: 'Privacy Policy',
          privacyHref: '/terms-and-privacy',
          unsubscribeLabel: 'Unsubscribe',
          unsubscribeHref: '{{UNSUBSCRIBE_URL}}',
          fontSize: 12,
          colour: '#a8a8a8'
        }
      }
    ]
  };
}

test('email template compiler generates safe email HTML and plain text', () => {
  const compiled = compileEmailTemplate(createInput(), {
    siteUrl: 'https://overexposed.test',
    variables: {
      ACCOUNT_NAME: 'Alex',
      VERIFY_URL: 'https://overexposed.test/verify',
      UNSUBSCRIBE_URL: 'https://overexposed.test/unsubscribe'
    }
  });

  assert.equal(compiled.subject, 'Confirm Alex');
  assert.match(compiled.html, /role="presentation"/);
  assert.match(compiled.html, /https:\/\/overexposed\.test\/verify/);
  assert.match(compiled.html, /https:\/\/overexposed\.test\/terms-and-privacy/);
  assert.match(compiled.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(compiled.html, /<script>alert/);
  assert.match(compiled.html, /font-size:20px[^>]*>Welcome<\/p>/);
  assert.match(compiled.html, /border-radius:30px/);
  assert.match(compiled.text, /Confirm email/);
});

test('email action buttons always render with fixed rounded corners', () => {
  const input = createInput();
  input.sections[1].settings.borderRadius = 0;
  input.sections.splice(-1, 0, {
    id: 'buttonGroup',
    type: 'buttonGroup',
    settings: {
      primaryLabel: 'Accept',
      primaryHref: '/accept',
      secondaryLabel: 'Decline',
      secondaryHref: '/decline',
      backgroundColour: '#66ccff',
      textColour: '#171717',
      borderColour: '#427bb9',
      borderRadius: 2,
      alignment: 'center'
    }
  });

  const normalized = normalizeEmailTemplateInput(input);
  const compiled = compileEmailTemplate(input);
  const action = normalized.sections.find(
    (section) => section.type === 'primaryAction'
  );
  const group = normalized.sections.find(
    (section) => section.type === 'buttonGroup'
  );

  assert.equal(action.settings.borderRadius, undefined);
  assert.equal(group.settings.borderRadius, undefined);
  assert.equal((compiled.html.match(/border-radius:30px/g) || []).length, 3);
});

test('logo sections normalize and render their own background colour', () => {
  const input = createInput();
  input.sections.unshift({
    id: 'logo',
    type: 'logo',
    settings: {
      src: '/images/emails/branding/overexposed-logo.svg',
      alt: 'OVEREXPOSED',
      link: '/',
      alignment: 'center',
      backgroundColour: '#123456'
    }
  });

  const normalized = normalizeEmailTemplateInput(input);
  const compiled = compileEmailTemplate(input, {
    siteUrl: 'https://overexposed.test'
  });
  const logo = normalized.sections.find((section) => section.type === 'logo');

  assert.equal(logo.settings.backgroundColour, '#123456');
  assert.equal(logo.settings.width, undefined);
  assert.equal(logo.settings.sectionSpacing, 'compact');
  assert.match(compiled.html, /width:280px/);
  assert.match(
    compiled.html,
    /padding:12px 28px;text-align:center;background-color:#123456;/
  );
});

test('section spacing presets normalize and control vertical cell padding', () => {
  const input = createInput();
  input.sections[0].settings.sectionSpacing = 'none';
  input.sections[1].settings.sectionSpacing = 'compact';
  input.sections.splice(-1, 0, {
    id: 'spacer',
    type: 'spacer',
    settings: { height: 32, sectionSpacing: 'none' }
  });

  const normalized = normalizeEmailTemplateInput(input);
  const compiled = compileEmailTemplate(input);
  const heading = normalized.sections.find(
    (section) => section.type === 'heading'
  );
  const action = normalized.sections.find(
    (section) => section.type === 'primaryAction'
  );
  const spacer = normalized.sections.find(
    (section) => section.type === 'spacer'
  );

  assert.equal(heading.settings.sectionSpacing, 'none');
  assert.equal(action.settings.sectionSpacing, 'compact');
  assert.equal(normalized.sections.at(-1).settings.sectionSpacing, 'standard');
  assert.equal(spacer.settings.sectionSpacing, undefined);
  assert.match(compiled.html, /padding:0px 28px;[^>]*><h1/);
  assert.match(
    compiled.html,
    /padding:12px 28px;text-align:center;"><a[^>]*>Confirm email<\/a>/
  );
  assert.match(
    compiled.html,
    /<td height="32" style="height:32px;font-size:0;line-height:0;">/
  );
});

test('section spacing uses section-specific defaults for legacy values', () => {
  const input = createInput();
  input.sections[0].settings.sectionSpacing = 'unsupported';
  input.sections.splice(-1, 0, {
    id: 'hero',
    type: 'hero',
    settings: {
      src: '/images/emails/heroes/mascot/default.png',
      alt: 'Hero',
      link: '',
      visible: true
    }
  });
  input.sections.splice(-1, 0, {
    id: 'divider',
    type: 'divider',
    settings: { colour: '#66ccff' }
  });

  const normalized = normalizeEmailTemplateInput(input);

  assert.equal(normalized.sections[0].settings.sectionSpacing, 'standard');
  assert.equal(
    normalized.sections.find((section) => section.type === 'hero').settings
      .sectionSpacing,
    'standard'
  );
  assert.equal(
    normalized.sections.find((section) => section.type === 'divider').settings
      .sectionSpacing,
    'compact'
  );
});

test('theme colour sources resolve while preserving custom swatches', () => {
  const input = createInput();
  input.theme.accentColour = '#123456';
  input.theme.secondaryColour = '#654321';
  input.sections[1].settings.backgroundColour = '#abcdef';
  input.sections[1].settings.backgroundColourSource = 'theme-primary';
  input.sections.splice(-1, 0, {
    id: 'divider',
    type: 'divider',
    settings: {
      colour: '#fedcba',
      colourSource: 'theme-secondary',
      thickness: 2,
      width: 80,
      borderRadius: 0
    }
  });

  const normalized = normalizeEmailTemplateInput(input);
  const compiled = compileEmailTemplate(input);
  const action = normalized.sections.find(
    (section) => section.type === 'primaryAction'
  );
  const divider = normalized.sections.find(
    (section) => section.type === 'divider'
  );
  const heading = normalized.sections.find(
    (section) => section.type === 'heading'
  );

  assert.equal(action.settings.backgroundColour, '#abcdef');
  assert.equal(action.settings.backgroundColourSource, 'theme-primary');
  assert.equal(divider.settings.colour, '#fedcba');
  assert.equal(divider.settings.colourSource, 'theme-secondary');
  assert.equal(heading.settings.colourSource, 'custom');
  assert.match(compiled.html, /background:#123456/);
  assert.match(
    compiled.html,
    /width:100%;height:6px[^";]*;[^\"]*background:#654321/
  );
});

test('email template normalization rejects unsafe links', () => {
  const input = createInput();
  input.sections[1].settings.href = 'javascript:alert(1)';

  assert.throws(
    () => normalizeEmailTemplateInput(input),
    EmailTemplateValidationError
  );
});

test('email template normalization accepts the expanded categories', () => {
  const categories = [
    'transactional',
    'marketing',
    'account-security',
    'onboarding',
    'party-social',
    'rewards-progress',
    'shop-orders',
    'product-updates',
    'events',
    're-engagement'
  ];

  categories.forEach((category) => {
    assert.equal(
      normalizeEmailTemplateInput({ ...createInput(), category }).category,
      category
    );
  });
});

test('email template normalization validates and deduplicates automation triggers', () => {
  const normalized = normalizeEmailTemplateInput({
    ...createInput(),
    automationTriggers: [
      'email-verification',
      'password-reset-request',
      'password-reset-request'
    ]
  });

  assert.deepEqual(normalized.automationTriggers, [
    'email-verification',
    'password-reset-request'
  ]);
  assert.throws(
    () =>
      normalizeEmailTemplateInput({
        ...createInput(),
        key: 'custom-email',
        automationTriggers: ['unknown-trigger']
      }),
    EmailTemplateValidationError
  );
});

test('verify-email remains compatible with the protected verification automation', () => {
  const normalized = normalizeEmailTemplateInput({
    ...createInput(),
    automationTriggers: []
  });
  const serialized = serializeEmailTemplate({
    ...normalized,
    automationTriggers: undefined
  });

  assert.deepEqual(normalized.automationTriggers, ['email-verification']);
  assert.deepEqual(serialized.automationTriggers, ['email-verification']);
});

test('legacy email image paths map to the reorganized asset library', () => {
  const input = createInput();
  input.sections.splice(-1, 0, {
    id: 'hero',
    type: 'hero',
    settings: {
      src: '/images/emails/email-confirmation/email-confirmation.png',
      alt: 'Confirmation',
      link: '',
      visible: true,
      borderRadius: 0
    }
  });

  const normalized = normalizeEmailTemplateInput(input);
  const serialized = serializeEmailTemplate({
    ...input,
    _id: 'template-1'
  });

  assert.equal(
    normalized.sections.find((section) => section.type === 'hero').settings.src,
    '/images/emails/heroes/mascot/default.png'
  );
  assert.equal(
    serialized.sections.find((section) => section.type === 'hero').settings.src,
    '/images/emails/heroes/mascot/default.png'
  );
  assert.equal(
    normalized.sections.find((section) => section.type === 'hero').settings
      .borderRadius,
    undefined
  );
});

test('image sections discard saved corner radii and render square', () => {
  const input = createInput();
  input.sections.splice(-1, 0, {
    id: 'image',
    type: 'image',
    settings: {
      src: '/images/emails/content/example.png',
      alt: 'Example',
      link: '',
      width: 80,
      alignment: 'center',
      borderRadius: 18
    }
  });
  input.sections.splice(-1, 0, {
    id: 'productCard',
    type: 'productCard',
    settings: {
      imageSrc: '/images/emails/products/example.png',
      imageAlt: 'Product',
      title: 'Product',
      text: 'Description',
      meta: 'New',
      ctaLabel: 'View',
      ctaHref: '/product',
      accentColour: '#66ccff',
      borderColour: '#474747',
      titleColour: '#f4f4f4',
      textColour: '#d8d8d8',
      borderRadius: 12
    }
  });

  const normalized = normalizeEmailTemplateInput(input);
  const compiled = compileEmailTemplate(input);

  assert.equal(
    normalized.sections.find((section) => section.type === 'image').settings
      .borderRadius,
    undefined
  );
  assert.equal(
    normalized.sections.find((section) => section.type === 'productCard')
      .settings.borderRadius,
    undefined
  );
  assert.match(compiled.html, /width:80%;border-radius:0/);
  assert.match(compiled.html, /border:1px solid #474747;border-radius:0/);
});

test('heading and legal note fallbacks use the editor defaults', () => {
  const input = createInput();
  delete input.sections[0].settings.fontSize;
  input.sections.splice(-1, 0, {
    id: 'legalNote',
    type: 'legalNote',
    settings: {
      text: 'Terms apply.',
      fontSize: 11,
      colour: '#8a8a8a'
    }
  });

  const normalized = normalizeEmailTemplateInput(input);

  assert.equal(normalized.sections[0].settings.fontSize, 26);
  assert.equal(
    normalized.sections.find((section) => section.type === 'legalNote').settings
      .alignment,
    'center'
  );
});

test('email template normalization requires one final footer', () => {
  const input = createInput();
  input.sections.reverse();

  assert.throws(
    () => normalizeEmailTemplateInput(input),
    /footer as their final section/
  );
});

test('code token sections normalize and render their border thickness', () => {
  const input = createInput();
  input.sections.splice(-1, 0, {
    id: 'codeToken',
    type: 'codeToken',
    settings: {
      label: 'Your code',
      code: '{{CODE}}',
      backgroundColour: '#171717',
      textColour: '#66ccff',
      borderColour: '#ffffff',
      borderWidth: 0,
      fontSize: 30
    }
  });

  const normalized = normalizeEmailTemplateInput(input);
  const codeToken = normalized.sections.find(
    (section) => section.type === 'codeToken'
  );
  const compiled = compileEmailTemplate(input, {
    variables: { CODE: '123456' }
  });

  assert.equal(codeToken.settings.borderWidth, 0);
  assert.match(compiled.html, /border:0px solid #ffffff/);
  assert.match(compiled.html, />123456<\/div>/);
});

test('divider sections always render with fixed rounded edges', () => {
  const input = createInput();
  input.sections.splice(-1, 0, {
    id: 'divider',
    type: 'divider',
    settings: {
      colour: '#66ccff',
      thickness: 6,
      width: 80,
      borderRadius: 12
    }
  });

  const normalized = normalizeEmailTemplateInput(input);
  const divider = normalized.sections.find(
    (section) => section.type === 'divider'
  );
  const compiled = compileEmailTemplate(input);

  assert.equal(divider.settings.borderRadius, undefined);
  assert.equal(divider.settings.thickness, undefined);
  assert.equal(divider.settings.width, undefined);
  assert.match(
    compiled.html,
    /width:100%;height:6px[^";]*;[^"]*border-radius:20px[^"]*background:#66ccff/
  );
});

test('footer dividers always render with fixed rounded edges', () => {
  const input = createInput();
  input.sections.at(-1).settings.dividerRadius = 8;

  const normalized = normalizeEmailTemplateInput(input);
  const compiled = compileEmailTemplate(input);
  const footer = normalized.sections.at(-1);

  assert.equal(footer.settings.dividerRadius, undefined);
  assert.match(
    compiled.html,
    /width:100%;height:6px[^";]*;[^"]*border-radius:20px[^"]*background:#474747/
  );
});
