const HEX_COLOUR_PATTERN = /^#[0-9a-f]{6}$/i;
const OE_SOCIAL_MEDIA_LINKS = require('../../public/scripts/general/social-media-links');
const {
  EMAIL_TEMPLATE_CATEGORIES
} = require('../../models/emails/email-template-constants');
const {
  EMAIL_AUTOMATION_TRIGGERS
} = require('../../models/emails/email-automation-constants');
const SECTION_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9-]{0,79}$/;
const TEMPLATE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VARIABLE_PATTERN = /^\{\{[A-Z][A-Z0-9_]*\}\}$/;
const AUTOMATION_TRIGGER_SET = new Set(EMAIL_AUTOMATION_TRIGGERS);
const LEGACY_EMAIL_IMAGE_PATHS = {
  '/images/emails/email-confirmation/email-confirmation.png':
    '/images/emails/heroes/mascot/default.png',
  '/images/emails/reset-password/reset-password.jpg':
    '/images/emails/heroes/mascot/shocked.png',
  '/images/emails/heroes/account-email-confirmation.png':
    '/images/emails/heroes/mascot/default.png',
  '/images/emails/heroes/account-reset-password.jpg':
    '/images/emails/heroes/mascot/shocked.png'
};
const FONT_FAMILIES = new Set([
  'Arial, sans-serif',
  'OverExposed, Arial, sans-serif',
  'LemonMilk, Arial, sans-serif'
]);
const ALIGNMENTS = new Set(['left', 'center', 'right']);
const FIXED_LOGO_WIDTH = 280;
const FIXED_BUTTON_RADIUS = 30;
const FIXED_DIVIDER_RADIUS = 20;
const FIXED_DIVIDER_THICKNESS = 6;
const FIXED_DIVIDER_WIDTH = 100;
const SECTION_SPACING_PIXELS = {
  none: 0,
  compact: 12,
  standard: 24
};
const LEGACY_COMPACT_SECTION_TYPES = new Set([
  'logo',
  'secondaryAction',
  'legalNote',
  'divider'
]);
const SECTION_TYPES = new Set([
  'logo',
  'heading',
  'hero',
  'image',
  'content',
  'primaryAction',
  'secondaryAction',
  'buttonGroup',
  'infoBox',
  'codeToken',
  'keyValueList',
  'featureList',
  'quote',
  'productCard',
  'eventBlock',
  'legalNote',
  'divider',
  'spacer',
  'socialLinks',
  'footer'
]);
const SOCIAL_ICON_PATHS = {
  instagram: [
    'M1794.69,419.03c-75.97,0-137.58,61.6-137.58,137.57s61.6,137.6,137.58,137.6,137.59-61.6,137.59-137.6-61.6-137.57-137.59-137.57Z',
    'M1183.04,595.47c-318.68,0-577.96,259.26-577.96,577.94s259.28,577.95,577.96,577.95,577.94-259.28,577.94-577.95-259.27-577.94-577.94-577.94ZM1183.04,1543.62c-204.15,0-370.23-166.07-370.23-370.21s166.08-370.21,370.23-370.21,370.19,166.06,370.19,370.21-166.06,370.21-370.19,370.21Z',
    'M1641.85,2346.82h-936.96C316.21,2346.82,0,2030.6,0,1641.91v-937C0,316.21,316.21,0,704.9,0h936.96c388.69,0,704.94,316.21,704.94,704.91v937c0,388.69-316.25,704.91-704.94,704.91ZM704.9,220.79c-266.96,0-484.12,217.16-484.12,484.12v937c0,266.97,217.16,484.13,484.12,484.13h936.96c266.97,0,484.16-217.16,484.16-484.13v-937c0-266.96-217.19-484.12-484.16-484.12h-936.96Z'
  ],
  tiktok: [
    'M1973.06,933c-18.85,1.83-37.76,2.79-56.69,2.88-207.66.03-401.35-104.65-515.1-278.38v947.96c0,386.95-313.69,700.63-700.63,700.63S0,1992.39,0,1605.45s313.68-700.64,700.63-700.64h0c14.62,0,28.92,1.32,43.3,2.22v345.26c-14.38-1.73-28.51-4.36-43.3-4.36-197.49,0-357.59,160.1-357.59,357.58s160.1,357.59,357.59,357.59,371.96-155.62,371.96-353.15L1076.04,0h330.31c31.15,296.21,269.99,527.56,567.03,549.28v383.71'
  ]
};
const SOCIAL_ICON_VIEW_BOXES = {
  instagram: '0 0 2346.79 2346.82',
  tiktok: '0 0 1973.38 2306.08'
};

class EmailTemplateValidationError extends Error {
  constructor(message, code = 'email_template_invalid') {
    super(message);
    this.name = 'EmailTemplateValidationError';
    this.status = 400;
    this.code = code;
  }
}

function limitString(value, maxLength, label, { trim = true } = {}) {
  const stringValue = String(value ?? '');
  const normalized = trim ? stringValue.trim() : stringValue;
  if (normalized.length > maxLength) {
    throw new EmailTemplateValidationError(
      `${label} must be ${maxLength} characters or fewer`
    );
  }
  return normalized;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

function normalizeColour(value, fallback) {
  const colour = String(value || '').trim();
  return HEX_COLOUR_PATTERN.test(colour) ? colour.toLowerCase() : fallback;
}

function normalizeColourSource(value) {
  return ['theme-primary', 'theme-secondary', 'custom'].includes(value)
    ? value
    : 'custom';
}

function isColourSetting(key) {
  return key === 'colour' || key.endsWith('Colour');
}

function preserveColourSources(normalized, input) {
  const output = { ...normalized };
  Object.keys(normalized).forEach((key) => {
    if (!isColourSetting(key)) return;
    output[`${key}Source`] = normalizeColourSource(input[`${key}Source`]);
  });
  return output;
}

function normalizeAlignment(value, fallback = 'center') {
  const alignment = String(value || '')
    .trim()
    .toLowerCase();
  return ALIGNMENTS.has(alignment) ? alignment : fallback;
}

function normalizeFont(value, fallback = 'Arial, sans-serif') {
  const font = String(value || '').trim();
  return FONT_FAMILIES.has(font) ? font : fallback;
}

function normalizeSectionSpacing(value, type) {
  const spacing = String(value || '')
    .trim()
    .toLowerCase();
  if (Object.prototype.hasOwnProperty.call(SECTION_SPACING_PIXELS, spacing)) {
    return spacing;
  }
  return LEGACY_COMPACT_SECTION_TYPES.has(type) ? 'compact' : 'standard';
}

function isAllowedUrl(value) {
  if (!value) return true;
  if (VARIABLE_PATTERN.test(value)) return true;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    const url = new URL(value);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function normalizeUrl(value, label, maxLength = 2000) {
  const url = limitString(value, maxLength, label);
  if (!isAllowedUrl(url)) {
    throw new EmailTemplateValidationError(`${label} is not a permitted URL`);
  }
  return url;
}

function normalizeImageUrl(value, label) {
  const url = normalizeUrl(value, label);
  return LEGACY_EMAIL_IMAGE_PATHS[url] || url;
}

function normalizeTextBlock(value, maxLength, label) {
  return limitString(value, maxLength, label, { trim: false });
}

function normalizeSectionSettingsValue(type, settings) {
  switch (type) {
    case 'logo':
      return {
        src: normalizeImageUrl(settings.src, 'Logo image URL'),
        alt: limitString(settings.alt, 240, 'Logo alternative text'),
        link: normalizeUrl(settings.link, 'Logo destination URL'),
        alignment: normalizeAlignment(settings.alignment),
        backgroundColour: normalizeColour(settings.backgroundColour, '#292929')
      };
    case 'heading':
      return {
        text: limitString(settings.text, 500, 'Heading text'),
        fontFamily: normalizeFont(
          settings.fontFamily,
          'OverExposed, Arial, sans-serif'
        ),
        fontSize: clampNumber(settings.fontSize, 22, 54, 26),
        colour: normalizeColour(settings.colour, '#66ccff'),
        alignment: normalizeAlignment(settings.alignment),
        showSubheading: Boolean(settings.showSubheading),
        subheading: limitString(settings.subheading, 1000, 'Subheading text'),
        subheadingFontFamily: normalizeFont(
          settings.subheadingFontFamily,
          'LemonMilk, Arial, sans-serif'
        ),
        subheadingFontSize: clampNumber(
          settings.subheadingFontSize,
          12,
          32,
          16
        ),
        subheadingColour: normalizeColour(settings.subheadingColour, '#f4f4f4')
      };
    case 'hero':
      return {
        src: normalizeImageUrl(settings.src, 'Hero image URL'),
        alt: limitString(settings.alt, 240, 'Hero alternative text'),
        link: normalizeUrl(settings.link, 'Hero destination URL'),
        visible: settings.visible !== false
      };
    case 'image':
      return {
        src: normalizeImageUrl(settings.src, 'Image URL'),
        alt: limitString(settings.alt, 240, 'Image alternative text'),
        link: normalizeUrl(settings.link, 'Image destination URL'),
        width: clampNumber(settings.width, 20, 100, 100),
        alignment: normalizeAlignment(settings.alignment)
      };
    case 'content':
      return {
        text: limitString(settings.text, 12000, 'Body text', { trim: false }),
        fontFamily: normalizeFont(settings.fontFamily),
        fontSize: clampNumber(settings.fontSize, 12, 24, 16),
        colour: normalizeColour(settings.colour, '#f4f4f4'),
        alignment: normalizeAlignment(settings.alignment)
      };
    case 'primaryAction':
      return {
        label: limitString(settings.label, 160, 'Button label'),
        href: normalizeUrl(settings.href, 'Button destination URL'),
        backgroundColour: normalizeColour(settings.backgroundColour, '#66ccff'),
        textColour: normalizeColour(settings.textColour, '#171717'),
        alignment: normalizeAlignment(settings.alignment)
      };
    case 'secondaryAction':
      return {
        label: limitString(settings.label, 160, 'Secondary action label'),
        href: normalizeUrl(settings.href, 'Secondary action URL'),
        colour: normalizeColour(settings.colour, '#66ccff'),
        alignment: normalizeAlignment(settings.alignment)
      };
    case 'buttonGroup':
      return {
        primaryLabel: limitString(
          settings.primaryLabel,
          160,
          'Primary button label'
        ),
        primaryHref: normalizeUrl(settings.primaryHref, 'Primary button URL'),
        secondaryLabel: limitString(
          settings.secondaryLabel,
          160,
          'Secondary button label'
        ),
        secondaryHref: normalizeUrl(
          settings.secondaryHref,
          'Secondary button URL'
        ),
        backgroundColour: normalizeColour(settings.backgroundColour, '#66ccff'),
        textColour: normalizeColour(settings.textColour, '#171717'),
        borderColour: normalizeColour(settings.borderColour, '#66ccff'),
        alignment: normalizeAlignment(settings.alignment)
      };
    case 'infoBox':
      return {
        title: limitString(settings.title, 240, 'Info box title'),
        text: normalizeTextBlock(settings.text, 3000, 'Info box text'),
        backgroundColour: normalizeColour(settings.backgroundColour, '#202f38'),
        borderColour: normalizeColour(settings.borderColour, '#66ccff'),
        textColour: normalizeColour(settings.textColour, '#f4f4f4'),
        borderRadius: clampNumber(settings.borderRadius, 0, 30, 0)
      };
    case 'codeToken':
      return {
        label: limitString(settings.label, 240, 'Code label'),
        labelColour: normalizeColour(settings.labelColour, '#a8a8a8'),
        code: limitString(settings.code, 500, 'Code value'),
        backgroundColour: normalizeColour(settings.backgroundColour, '#171717'),
        textColour: normalizeColour(settings.textColour, '#66ccff'),
        borderColour: normalizeColour(settings.borderColour, '#66ccff'),
        borderWidth: clampNumber(settings.borderWidth, 0, 12, 1),
        fontSize: clampNumber(settings.fontSize, 20, 48, 30)
      };
    case 'keyValueList':
      return {
        heading: limitString(settings.heading, 240, 'Key value heading'),
        rows: normalizeTextBlock(settings.rows, 4000, 'Key value rows'),
        labelColour: normalizeColour(settings.labelColour, '#a8a8a8'),
        valueColour: normalizeColour(settings.valueColour, '#f4f4f4')
      };
    case 'featureList':
      return {
        heading: limitString(settings.heading, 240, 'Feature list heading'),
        items: normalizeTextBlock(settings.items, 6000, 'Feature list items'),
        markerColour: normalizeColour(settings.markerColour, '#66ccff'),
        textColour: normalizeColour(settings.textColour, '#f4f4f4')
      };
    case 'quote':
      return {
        text: normalizeTextBlock(settings.text, 3000, 'Quote text'),
        attribution: limitString(
          settings.attribution,
          240,
          'Quote attribution'
        ),
        colour: normalizeColour(settings.colour, '#f4f4f4'),
        accentColour: normalizeColour(settings.accentColour, '#66ccff'),
        alignment: normalizeAlignment(settings.alignment, 'left')
      };
    case 'productCard':
      return {
        imageSrc: normalizeImageUrl(settings.imageSrc, 'Product image URL'),
        imageAlt: limitString(
          settings.imageAlt,
          240,
          'Product image alternative text'
        ),
        title: limitString(settings.title, 240, 'Product title'),
        text: normalizeTextBlock(settings.text, 3000, 'Product text'),
        meta: limitString(settings.meta, 240, 'Product meta'),
        ctaLabel: limitString(settings.ctaLabel, 160, 'Product action label'),
        ctaHref: normalizeUrl(settings.ctaHref, 'Product action URL'),
        accentColour: normalizeColour(settings.accentColour, '#66ccff'),
        borderColour: normalizeColour(settings.borderColour, '#474747'),
        titleColour: normalizeColour(settings.titleColour, '#f4f4f4'),
        textColour: normalizeColour(settings.textColour, '#d8d8d8')
      };
    case 'eventBlock':
      return {
        title: limitString(settings.title, 240, 'Event title'),
        dateText: limitString(settings.dateText, 240, 'Event date'),
        location: limitString(settings.location, 240, 'Event location'),
        text: normalizeTextBlock(settings.text, 3000, 'Event text'),
        ctaLabel: limitString(settings.ctaLabel, 160, 'Event action label'),
        ctaHref: normalizeUrl(settings.ctaHref, 'Event action URL'),
        accentColour: normalizeColour(settings.accentColour, '#66ccff'),
        titleColour: normalizeColour(settings.titleColour, '#f4f4f4'),
        locationColour: normalizeColour(settings.locationColour, '#a8a8a8'),
        textColour: normalizeColour(settings.textColour, '#d8d8d8')
      };
    case 'legalNote':
      return {
        text: normalizeTextBlock(settings.text, 4000, 'Legal note text'),
        fontSize: clampNumber(settings.fontSize, 10, 16, 11),
        colour: normalizeColour(settings.colour, '#8a8a8a'),
        alignment: normalizeAlignment(settings.alignment, 'center')
      };
    case 'divider':
      return {
        colour: normalizeColour(settings.colour, '#66ccff')
      };
    case 'spacer':
      return { height: clampNumber(settings.height, 8, 120, 40) };
    case 'socialLinks':
      return {
        heading: limitString(settings.heading, 240, 'Social links heading'),
        iconColour: normalizeColour(
          settings.iconColour || settings.colour,
          '#66ccff'
        ),
        alignment: normalizeAlignment(settings.alignment)
      };
    case 'footer':
      return {
        text: limitString(settings.text, 3000, 'Footer text', {
          trim: false
        }),
        privacyLabel: limitString(
          settings.privacyLabel,
          160,
          'Privacy link label'
        ),
        privacyHref: normalizeUrl(settings.privacyHref, 'Privacy policy URL'),
        unsubscribeLabel: limitString(
          settings.unsubscribeLabel,
          160,
          'Unsubscribe link label'
        ),
        unsubscribeHref: normalizeUrl(
          settings.unsubscribeHref,
          'Unsubscribe URL'
        ),
        fontSize: clampNumber(settings.fontSize, 10, 18, 12),
        colour: normalizeColour(settings.colour, '#a8a8a8'),
        linkColour: normalizeColour(settings.linkColour, '#66ccff'),
        dividerColour: normalizeColour(settings.dividerColour, '#474747')
      };
    default:
      throw new EmailTemplateValidationError(
        `Unsupported email section type: ${type}`
      );
  }
}

function normalizeSectionSettings(type, input = {}) {
  const settings = input && typeof input === 'object' ? input : {};
  const normalized = preserveColourSources(
    normalizeSectionSettingsValue(type, settings),
    settings
  );
  if (type !== 'spacer') {
    normalized.sectionSpacing = normalizeSectionSpacing(
      settings.sectionSpacing,
      type
    );
  }
  return normalized;
}

function normalizeSections(input) {
  if (!Array.isArray(input) || input.length > 60) {
    throw new EmailTemplateValidationError(
      'Email templates must contain between 1 and 60 sections'
    );
  }
  const ids = new Set();
  let footerCount = 0;
  const sections = input.map((section, index) => {
    const type = String(section?.type || '').trim();
    const id = String(section?.id || '').trim();
    if (!SECTION_TYPES.has(type)) {
      throw new EmailTemplateValidationError(
        `Section ${index + 1} has an unsupported type`
      );
    }
    if (!SECTION_ID_PATTERN.test(id) || ids.has(id)) {
      throw new EmailTemplateValidationError(
        `Section ${index + 1} must have a unique valid ID`
      );
    }
    ids.add(id);
    if (type === 'footer') footerCount += 1;
    return {
      id,
      type,
      settings: normalizeSectionSettings(type, section.settings)
    };
  });
  if (!sections.length) {
    throw new EmailTemplateValidationError('Add at least one email section');
  }
  if (footerCount !== 1 || sections.at(-1)?.type !== 'footer') {
    throw new EmailTemplateValidationError(
      'Email templates require one footer as their final section'
    );
  }
  return sections;
}

function normalizeEmailTemplateInput(input = {}) {
  const message =
    input.message && typeof input.message === 'object' ? input.message : {};
  const name = limitString(
    input.name ?? message.templateName,
    160,
    'Template name'
  );
  const subject = limitString(
    input.subject ?? message.subject,
    240,
    'Email subject'
  );
  if (!name || !subject) {
    throw new EmailTemplateValidationError(
      'Template name and email subject are required'
    );
  }
  const category = String(
    input.category ?? message.category ?? 'transactional'
  ).toLowerCase();
  if (!EMAIL_TEMPLATE_CATEGORIES.includes(category)) {
    throw new EmailTemplateValidationError('Email category is invalid');
  }
  const rawKey = String(input.key || '')
    .trim()
    .toLowerCase();
  if (rawKey && !TEMPLATE_KEY_PATTERN.test(rawKey)) {
    throw new EmailTemplateValidationError(
      'Template key must contain lowercase letters, numbers and hyphens only'
    );
  }
  const rawAutomationTriggers =
    input.automationTriggers ?? message.automationTriggers ?? [];
  if (!Array.isArray(rawAutomationTriggers)) {
    throw new EmailTemplateValidationError(
      'Automation triggers must be provided as a list'
    );
  }
  const automationTriggers = Array.from(
    new Set(
      rawAutomationTriggers.map((trigger) =>
        String(trigger || '')
          .trim()
          .toLowerCase()
      )
    )
  );
  if (
    automationTriggers.some((trigger) => !AUTOMATION_TRIGGER_SET.has(trigger))
  ) {
    throw new EmailTemplateValidationError(
      'Email template automation trigger is invalid'
    );
  }
  if (
    rawKey === 'verify-email' &&
    !automationTriggers.includes('email-verification')
  ) {
    automationTriggers.unshift('email-verification');
  }
  const theme =
    input.theme && typeof input.theme === 'object' ? input.theme : {};
  return {
    key: rawKey || undefined,
    name,
    category,
    automationTriggers,
    subject,
    preheader: limitString(
      input.preheader ?? message.preheader,
      500,
      'Preheader text'
    ),
    theme: {
      emailBackground: normalizeColour(theme.emailBackground, '#171717'),
      contentBackground: normalizeColour(theme.contentBackground, '#292929'),
      accentColour: normalizeColour(theme.accentColour, '#66ccff'),
      secondaryColour: normalizeColour(theme.secondaryColour, '#427bb9'),
      contentWidth: clampNumber(theme.contentWidth, 420, 760, 640),
      borderRadius: clampNumber(theme.borderRadius, 0, 32, 0)
    },
    sections: normalizeSections(input.sections)
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function replaceVariables(value, variables) {
  return String(value ?? '').replace(
    /\{\{([A-Z][A-Z0-9_]*)\}\}/g,
    (match, key) =>
      Object.prototype.hasOwnProperty.call(variables, key)
        ? String(variables[key] ?? '')
        : match
  );
}

function resolveUrl(value, siteUrl, variables) {
  const replaced = replaceVariables(value, variables).trim();
  if (!replaced) return '';
  if (replaced.startsWith('/') && !replaced.startsWith('//')) {
    return `${siteUrl.replace(/\/+$/, '')}${replaced}`;
  }
  return isAllowedUrl(replaced) ? replaced : '';
}

function renderLinkedImage(settings, className, style, siteUrl, variables) {
  const src = escapeHtml(resolveUrl(settings.src, siteUrl, variables));
  const alt = escapeHtml(replaceVariables(settings.alt, variables));
  const image = `<img class="${className}" src="${src}" alt="${alt}" style="display:block;max-width:100%;height:auto;border:0;${style}" />`;
  const href = resolveUrl(settings.link, siteUrl, variables);
  return href
    ? `<a href="${escapeHtml(href)}" style="text-decoration:none;">${image}</a>`
    : image;
}

function renderMultilineText(value, variables) {
  return escapeHtml(replaceVariables(value, variables)).replaceAll(
    '\n',
    '<br />'
  );
}

function parseListLines(value, variables) {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => replaceVariables(line, variables).trim())
    .filter(Boolean);
}

function renderEmailButton({
  href,
  label,
  backgroundColour,
  textColour,
  borderColour,
  borderRadius,
  siteUrl,
  variables
}) {
  const resolvedHref = escapeHtml(resolveUrl(href, siteUrl, variables));
  const background = backgroundColour || 'transparent';
  const colour = textColour || borderColour || '#66ccff';
  const border = borderColour
    ? `border:1px solid ${borderColour};`
    : 'border:1px solid transparent;';
  return `<a href="${resolvedHref || '#'}" style="display:inline-block;padding:14px 22px;${border}border-radius:${borderRadius}px;background:${background};color:${colour};font-family:Arial,sans-serif;font-size:16px;font-weight:bold;text-decoration:none;">${escapeHtml(replaceVariables(label, variables))}</a>`;
}

function renderSocialIcon(platform, colour) {
  const paths = SOCIAL_ICON_PATHS[platform] || [];
  const viewBox = SOCIAL_ICON_VIEW_BOXES[platform];
  if (!paths.length || !viewBox) return '';
  const svg = `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">${paths
    .map((path) => `<path fill="${colour}" d="${path}" />`)
    .join('')}</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function resolveThemeColour(settings, key, context) {
  const source = settings[`${key}Source`] || 'custom';
  if (source === 'theme-primary') return context.primaryColour;
  if (source === 'theme-secondary') return context.secondaryColour;
  return settings[key];
}

function resolveSectionColourSettings(settings, context) {
  const resolved = { ...settings };
  Object.keys(settings).forEach((key) => {
    if (isColourSetting(key)) {
      resolved[key] = resolveThemeColour(settings, key, context);
    }
  });
  return resolved;
}

function renderSection(section, context) {
  const { siteUrl, variables } = context;
  const settings = resolveSectionColourSettings(section.settings, context);
  const spacing =
    SECTION_SPACING_PIXELS[
      normalizeSectionSpacing(settings.sectionSpacing, section.type)
    ];
  const cell = (content, style = '') =>
    `<tr><td style="padding:${spacing}px 28px;${style}">${content}</td></tr>`;
  switch (section.type) {
    case 'logo':
      return cell(
        renderLinkedImage(
          settings,
          'email-logo',
          `width:${FIXED_LOGO_WIDTH}px;margin:0 ${settings.alignment === 'center' ? 'auto' : settings.alignment === 'right' ? '0 0 0 auto' : 'auto 0'};`,
          siteUrl,
          variables
        ),
        `text-align:${settings.alignment};background-color:${settings.backgroundColour};`
      );
    case 'heading': {
      const heading = `<h1 style="margin:0;color:${settings.colour};font-family:${settings.fontFamily};font-size:${settings.fontSize}px;line-height:1.1;text-align:${settings.alignment};">${escapeHtml(replaceVariables(settings.text, variables))}</h1>`;
      const subheading = settings.showSubheading
        ? `<p style="margin:12px 0 0;color:${settings.subheadingColour};font-family:${settings.subheadingFontFamily};font-size:${settings.subheadingFontSize}px;line-height:1.5;text-align:${settings.alignment};">${escapeHtml(replaceVariables(settings.subheading, variables))}</p>`
        : '';
      return cell(`${heading}${subheading}`);
    }
    case 'hero':
      if (!settings.visible) return '';
      return cell(
        renderLinkedImage(
          settings,
          'email-hero',
          'width:100%;border-radius:0;margin:0 auto;',
          siteUrl,
          variables
        ),
        'padding-left:0;padding-right:0;'
      );
    case 'image':
      return cell(
        renderLinkedImage(
          settings,
          'email-image',
          `width:${settings.width}%;border-radius:0;margin:0 ${settings.alignment === 'center' ? 'auto' : settings.alignment === 'right' ? '0 0 0 auto' : 'auto 0'};`,
          siteUrl,
          variables
        ),
        `text-align:${settings.alignment};`
      );
    case 'content':
      return cell(
        renderMultilineText(settings.text, variables),
        `color:${settings.colour};font-family:${settings.fontFamily};font-size:${settings.fontSize}px;line-height:1.6;text-align:${settings.alignment};`
      );
    case 'primaryAction': {
      return cell(
        renderEmailButton({
          href: settings.href,
          label: settings.label,
          backgroundColour: settings.backgroundColour,
          textColour: settings.textColour,
          borderRadius: FIXED_BUTTON_RADIUS,
          siteUrl,
          variables
        }),
        `text-align:${settings.alignment};`
      );
    }
    case 'secondaryAction': {
      const href = escapeHtml(resolveUrl(settings.href, siteUrl, variables));
      return cell(
        `<a href="${href || '#'}" style="color:${settings.colour};font-family:Arial,sans-serif;font-size:15px;font-weight:bold;text-decoration:underline;">${escapeHtml(replaceVariables(settings.label, variables))}</a>`,
        `text-align:${settings.alignment};`
      );
    }
    case 'buttonGroup': {
      const primary = renderEmailButton({
        href: settings.primaryHref,
        label: settings.primaryLabel,
        backgroundColour: settings.backgroundColour,
        textColour: settings.textColour,
        borderRadius: FIXED_BUTTON_RADIUS,
        siteUrl,
        variables
      });
      const secondary = renderEmailButton({
        href: settings.secondaryHref,
        label: settings.secondaryLabel,
        backgroundColour: 'transparent',
        textColour: settings.borderColour,
        borderColour: settings.borderColour,
        borderRadius: FIXED_BUTTON_RADIUS,
        siteUrl,
        variables
      });
      return cell(
        `<span style="display:inline-block;margin:0 6px 10px;">${primary}</span><span style="display:inline-block;margin:0 6px 10px;">${secondary}</span>`,
        `text-align:${settings.alignment};`
      );
    }
    case 'infoBox':
      return cell(
        `<div style="padding:18px 20px;border:1px solid ${settings.borderColour};border-radius:${settings.borderRadius}px;background:${settings.backgroundColour};color:${settings.textColour};font-family:Arial,sans-serif;line-height:1.55;"><p style="margin:0 0 8px;font-weight:bold;">${escapeHtml(replaceVariables(settings.title, variables))}</p><div>${renderMultilineText(settings.text, variables)}</div></div>`
      );
    case 'codeToken':
      return cell(
        `<p style="margin:0 0 10px;color:${settings.labelColour};font-family:Arial,sans-serif;font-size:13px;text-align:center;">${escapeHtml(replaceVariables(settings.label, variables))}</p><div style="padding:16px 18px;border:${settings.borderWidth}px solid ${settings.borderColour};background:${settings.backgroundColour};color:${settings.textColour};font-family:Arial,sans-serif;font-size:${settings.fontSize}px;font-weight:bold;letter-spacing:3px;text-align:center;overflow-wrap:anywhere;">${escapeHtml(replaceVariables(settings.code, variables))}</div>`
      );
    case 'keyValueList': {
      const rows = parseListLines(settings.rows, variables)
        .map((line) => {
          const separatorIndex = line.indexOf(':');
          const label =
            separatorIndex === -1 ? line : line.slice(0, separatorIndex);
          const value =
            separatorIndex === -1 ? '' : line.slice(separatorIndex + 1).trim();
          return `<tr><td style="padding:8px 0;color:${settings.labelColour};font-family:Arial,sans-serif;font-size:14px;">${escapeHtml(label.trim())}</td><td align="right" style="padding:8px 0;color:${settings.valueColour};font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">${escapeHtml(value)}</td></tr>`;
        })
        .join('');
      return cell(
        `${settings.heading ? `<p style="margin:0 0 10px;color:${settings.valueColour};font-family:Arial,sans-serif;font-weight:bold;">${escapeHtml(replaceVariables(settings.heading, variables))}</p>` : ''}<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table>`
      );
    }
    case 'featureList': {
      const items = parseListLines(settings.items, variables)
        .map(
          (line) =>
            `<tr><td valign="top" style="width:20px;padding:4px 10px 4px 0;color:${settings.markerColour};font-family:Arial,sans-serif;font-weight:bold;">&bull;</td><td style="padding:4px 0;color:${settings.textColour};font-family:Arial,sans-serif;font-size:15px;line-height:1.5;">${escapeHtml(line)}</td></tr>`
        )
        .join('');
      return cell(
        `${settings.heading ? `<p style="margin:0 0 10px;color:${settings.textColour};font-family:Arial,sans-serif;font-weight:bold;">${escapeHtml(replaceVariables(settings.heading, variables))}</p>` : ''}<table role="presentation" cellspacing="0" cellpadding="0">${items}</table>`
      );
    }
    case 'quote':
      return cell(
        `<blockquote style="margin:0;padding:0 0 0 18px;border-left:4px solid ${settings.accentColour};color:${settings.colour};font-family:Arial,sans-serif;font-size:18px;line-height:1.55;text-align:${settings.alignment};"><div>${renderMultilineText(settings.text, variables)}</div>${settings.attribution ? `<p style="margin:12px 0 0;color:${settings.accentColour};font-size:13px;font-weight:bold;">${escapeHtml(replaceVariables(settings.attribution, variables))}</p>` : ''}</blockquote>`
      );
    case 'productCard': {
      const image = settings.imageSrc
        ? renderLinkedImage(
            {
              src: settings.imageSrc,
              alt: settings.imageAlt,
              link: settings.ctaHref
            },
            'email-product-card-image',
            'width:100%;border-radius:0;margin:0 auto;',
            siteUrl,
            variables
          )
        : '';
      const href = escapeHtml(resolveUrl(settings.ctaHref, siteUrl, variables));
      return cell(
        `<div style="border:1px solid ${settings.borderColour};border-radius:0;overflow:hidden;font-family:Arial,sans-serif;">${image}<div style="padding:18px 20px;"><p style="margin:0 0 8px;color:${settings.accentColour};font-size:13px;font-weight:bold;">${escapeHtml(replaceVariables(settings.meta, variables))}</p><h2 style="margin:0 0 10px;color:${settings.titleColour};font-size:22px;line-height:1.2;">${escapeHtml(replaceVariables(settings.title, variables))}</h2><div style="color:${settings.textColour};font-size:15px;line-height:1.55;">${renderMultilineText(settings.text, variables)}</div>${settings.ctaLabel ? `<p style="margin:16px 0 0;"><a href="${href || '#'}" style="color:${settings.accentColour};font-weight:bold;text-decoration:underline;">${escapeHtml(replaceVariables(settings.ctaLabel, variables))}</a></p>` : ''}</div></div>`
      );
    }
    case 'eventBlock': {
      const href = escapeHtml(resolveUrl(settings.ctaHref, siteUrl, variables));
      return cell(
        `<div style="border-left:4px solid ${settings.accentColour};padding:4px 0 4px 18px;font-family:Arial,sans-serif;"><p style="margin:0 0 6px;color:${settings.accentColour};font-size:13px;font-weight:bold;">${escapeHtml(replaceVariables(settings.dateText, variables))}</p><h2 style="margin:0 0 8px;color:${settings.titleColour};font-size:22px;line-height:1.2;">${escapeHtml(replaceVariables(settings.title, variables))}</h2>${settings.location ? `<p style="margin:0 0 10px;color:${settings.locationColour};font-size:14px;">${escapeHtml(replaceVariables(settings.location, variables))}</p>` : ''}<div style="color:${settings.textColour};font-size:15px;line-height:1.55;">${renderMultilineText(settings.text, variables)}</div>${settings.ctaLabel ? `<p style="margin:14px 0 0;"><a href="${href || '#'}" style="color:${settings.accentColour};font-weight:bold;text-decoration:underline;">${escapeHtml(replaceVariables(settings.ctaLabel, variables))}</a></p>` : ''}</div>`
      );
    }
    case 'legalNote':
      return cell(
        renderMultilineText(settings.text, variables),
        `color:${settings.colour};font-family:Arial,sans-serif;font-size:${settings.fontSize}px;line-height:1.45;text-align:${settings.alignment};`
      );
    case 'divider':
      return cell(
        `<div style="width:${FIXED_DIVIDER_WIDTH}%;height:${FIXED_DIVIDER_THICKNESS}px;margin:0 auto;border-radius:${FIXED_DIVIDER_RADIUS}px;background:${settings.colour};font-size:0;line-height:0;">&nbsp;</div>`,
        ''
      );
    case 'spacer':
      return `<tr><td height="${settings.height}" style="height:${settings.height}px;font-size:0;line-height:0;">&nbsp;</td></tr>`;
    case 'socialLinks': {
      const links = ['instagram', 'tiktok']
        .map((platform) => {
          const link = OE_SOCIAL_MEDIA_LINKS[platform];
          const icon = renderSocialIcon(platform, settings.iconColour);
          if (!link || !icon) return '';
          return `<a href="${escapeHtml(link.url)}" aria-label="${escapeHtml(link.label)}" style="display:inline-block;margin:0 8px;text-decoration:none;"><img src="${icon}" width="28" height="28" alt="${escapeHtml(link.label)}" style="display:block;width:28px;height:28px;border:0;" /></a>`;
        })
        .join('');
      return cell(
        `<p style="margin:0 0 10px;font-weight:bold;">${escapeHtml(replaceVariables(settings.heading, variables))}</p>${links}`,
        `color:${settings.iconColour};font-family:Arial,sans-serif;text-align:${settings.alignment};`
      );
    }
    case 'footer': {
      const privacyUrl = escapeHtml(
        resolveUrl(settings.privacyHref, siteUrl, variables)
      );
      const unsubscribeUrl = escapeHtml(
        resolveUrl(settings.unsubscribeHref, siteUrl, variables)
      );
      return cell(
        `<div style="width:${FIXED_DIVIDER_WIDTH}%;height:${FIXED_DIVIDER_THICKNESS}px;margin:0 0 24px;border-radius:${FIXED_DIVIDER_RADIUS}px;background:${settings.dividerColour};font-size:0;line-height:0;">&nbsp;</div><p style="margin:0 0 10px;">${escapeHtml(replaceVariables(settings.text, variables))}</p><a href="${privacyUrl || '#'}" style="color:${settings.linkColour};">${escapeHtml(settings.privacyLabel)}</a>${settings.unsubscribeLabel ? `&nbsp;&nbsp;<a href="${unsubscribeUrl || '#'}" style="color:${settings.linkColour};">${escapeHtml(settings.unsubscribeLabel)}</a>` : ''}`,
        `color:${settings.colour};font-family:Arial,sans-serif;font-size:${settings.fontSize}px;line-height:1.5;text-align:center;`
      );
    }
    default:
      return '';
  }
}

function compileEmailTemplate(template, options = {}) {
  const normalized = normalizeEmailTemplateInput(template);
  const siteUrl = String(options.siteUrl || 'http://localhost:3000').replace(
    /\/+$/,
    ''
  );
  const variables = options.variables || {};
  const sectionHtml = normalized.sections
    .map((section) =>
      renderSection(section, {
        siteUrl,
        variables,
        primaryColour: normalized.theme.accentColour,
        secondaryColour: normalized.theme.secondaryColour
      })
    )
    .join('');
  const overExposedFontUrl = `${siteUrl}/fonts/overexposed/OverExposed-Regular.otf`;
  const lemonMilkFontUrl = `${siteUrl}/fonts/LemonMilk/LEMONMILK-Regular.otf`;
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(replaceVariables(normalized.subject, variables))}</title>
    <style>
      @font-face { font-family: 'OverExposed'; src: url('${escapeHtml(overExposedFontUrl)}') format('opentype'); }
      @font-face { font-family: 'LemonMilk'; src: url('${escapeHtml(lemonMilkFontUrl)}') format('opentype'); }
    </style>
  </head>
  <body style="margin:0;background:${normalized.theme.emailBackground};color:#f4f4f4;font-family:Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(replaceVariables(normalized.preheader, variables))}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:${normalized.theme.emailBackground};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:${normalized.theme.contentWidth}px;background:${normalized.theme.contentBackground};border-radius:${normalized.theme.borderRadius}px;overflow:hidden;">
            ${sectionHtml}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  const textSections = normalized.sections
    .map((section) => {
      const settings = section.settings;
      if (section.type === 'heading') {
        return [
          settings.text,
          settings.showSubheading ? settings.subheading : ''
        ]
          .filter(Boolean)
          .join('\n');
      }
      if (section.type === 'content' || section.type === 'footer') {
        return settings.text;
      }
      if (section.type === 'primaryAction') {
        return `${settings.label}: ${resolveUrl(settings.href, siteUrl, variables)}`;
      }
      if (section.type === 'secondaryAction') {
        return `${settings.label}: ${resolveUrl(settings.href, siteUrl, variables)}`;
      }
      if (section.type === 'buttonGroup') {
        return [
          `${settings.primaryLabel}: ${resolveUrl(settings.primaryHref, siteUrl, variables)}`,
          `${settings.secondaryLabel}: ${resolveUrl(settings.secondaryHref, siteUrl, variables)}`
        ].join('\n');
      }
      if (section.type === 'infoBox') {
        return [settings.title, settings.text].filter(Boolean).join('\n');
      }
      if (section.type === 'codeToken') {
        return [settings.label, settings.code].filter(Boolean).join('\n');
      }
      if (section.type === 'keyValueList') {
        return [settings.heading, settings.rows].filter(Boolean).join('\n');
      }
      if (section.type === 'featureList') {
        return [settings.heading, settings.items].filter(Boolean).join('\n');
      }
      if (section.type === 'quote') {
        return [settings.text, settings.attribution].filter(Boolean).join('\n');
      }
      if (section.type === 'productCard') {
        return [settings.meta, settings.title, settings.text]
          .filter(Boolean)
          .join('\n');
      }
      if (section.type === 'eventBlock') {
        return [
          settings.dateText,
          settings.title,
          settings.location,
          settings.text
        ]
          .filter(Boolean)
          .join('\n');
      }
      if (section.type === 'legalNote') {
        return settings.text;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n\n');
  return {
    subject: replaceVariables(normalized.subject, variables),
    html,
    text: textSections,
    template: normalized
  };
}

function serializeEmailTemplate(document, { includeContent = true } = {}) {
  const source = document?.toObject ? document.toObject() : document || {};
  const automationTriggers = Array.isArray(source.automationTriggers)
    ? [...new Set(source.automationTriggers.map(String))]
    : [];
  if (
    source.key === 'verify-email' &&
    !automationTriggers.includes('email-verification')
  ) {
    automationTriggers.unshift('email-verification');
  }
  const serialized = {
    id: source._id ? String(source._id) : '',
    key: source.key || '',
    name: source.name || '',
    category: source.category || 'transactional',
    automationTriggers,
    status: source.status || 'draft',
    subject: source.subject || '',
    preheader: source.preheader || '',
    createdAt: source.system?.createdAt || null,
    updatedAt: source.system?.updatedAt || null,
    publishedAt: source.system?.publishedAt || null
  };
  if (includeContent) {
    serialized.theme = source.theme || {};
    serialized.sections = Array.isArray(source.sections)
      ? source.sections.map((section) => {
          const settings = { ...(section.settings || {}) };
          if (['logo', 'hero', 'image'].includes(section.type)) {
            settings.src =
              LEGACY_EMAIL_IMAGE_PATHS[settings.src] || settings.src;
          } else if (section.type === 'productCard') {
            settings.imageSrc =
              LEGACY_EMAIL_IMAGE_PATHS[settings.imageSrc] || settings.imageSrc;
          }
          return { ...section, settings };
        })
      : [];
  }
  return serialized;
}

module.exports = {
  EmailTemplateValidationError,
  compileEmailTemplate,
  normalizeEmailTemplateInput,
  serializeEmailTemplate
};
