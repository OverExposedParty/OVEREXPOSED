const HEX_COLOUR_PATTERN = /^#[0-9a-f]{6}$/i;
const SECTION_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9-]{0,79}$/;
const TEMPLATE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VARIABLE_PATTERN = /^\{\{[A-Z][A-Z0-9_]*\}\}$/;
const FONT_FAMILIES = new Set([
  'Arial, sans-serif',
  'OverExposed, Arial, sans-serif',
  'LemonMilk, Arial, sans-serif'
]);
const ALIGNMENTS = new Set(['left', 'center', 'right']);
const SECTION_TYPES = new Set([
  'logo',
  'heading',
  'hero',
  'image',
  'content',
  'primaryAction',
  'divider',
  'spacer',
  'socialLinks',
  'footer'
]);

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

function normalizeSectionSettings(type, input = {}) {
  const settings = input && typeof input === 'object' ? input : {};
  switch (type) {
    case 'logo':
      return {
        src: normalizeUrl(settings.src, 'Logo image URL'),
        alt: limitString(settings.alt, 240, 'Logo alternative text'),
        link: normalizeUrl(settings.link, 'Logo destination URL'),
        width: clampNumber(settings.width, 80, 280, 180),
        alignment: normalizeAlignment(settings.alignment)
      };
    case 'heading':
      return {
        text: limitString(settings.text, 500, 'Heading text'),
        fontFamily: normalizeFont(
          settings.fontFamily,
          'OverExposed, Arial, sans-serif'
        ),
        fontSize: clampNumber(settings.fontSize, 22, 54, 36),
        colour: normalizeColour(settings.colour, '#66ccff'),
        alignment: normalizeAlignment(settings.alignment),
        showSubheading: Boolean(settings.showSubheading),
        subheading: limitString(settings.subheading, 1000, 'Subheading text'),
        subheadingFontFamily: normalizeFont(
          settings.subheadingFontFamily,
          'LemonMilk, Arial, sans-serif'
        )
      };
    case 'hero':
      return {
        src: normalizeUrl(settings.src, 'Hero image URL'),
        alt: limitString(settings.alt, 240, 'Hero alternative text'),
        link: normalizeUrl(settings.link, 'Hero destination URL'),
        visible: settings.visible !== false,
        borderRadius: clampNumber(settings.borderRadius, 0, 32, 0)
      };
    case 'image':
      return {
        src: normalizeUrl(settings.src, 'Image URL'),
        alt: limitString(settings.alt, 240, 'Image alternative text'),
        link: normalizeUrl(settings.link, 'Image destination URL'),
        width: clampNumber(settings.width, 20, 100, 100),
        alignment: normalizeAlignment(settings.alignment),
        borderRadius: clampNumber(settings.borderRadius, 0, 32, 0)
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
        borderRadius: clampNumber(settings.borderRadius, 0, 30, 0),
        alignment: normalizeAlignment(settings.alignment)
      };
    case 'divider':
      return {
        colour: normalizeColour(settings.colour, '#66ccff'),
        thickness: clampNumber(settings.thickness, 1, 8, 1),
        width: clampNumber(settings.width, 20, 100, 86)
      };
    case 'spacer':
      return { height: clampNumber(settings.height, 8, 120, 40) };
    case 'socialLinks':
      return {
        heading: limitString(settings.heading, 240, 'Social links heading'),
        instagramUrl: normalizeUrl(settings.instagramUrl, 'Instagram URL'),
        tiktokUrl: normalizeUrl(settings.tiktokUrl, 'TikTok URL'),
        youtubeUrl: normalizeUrl(settings.youtubeUrl, 'YouTube URL'),
        colour: normalizeColour(settings.colour, '#66ccff'),
        alignment: normalizeAlignment(settings.alignment)
      };
    case 'footer':
      return {
        text: limitString(settings.text, 3000, 'Footer text', { trim: false }),
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
        colour: normalizeColour(settings.colour, '#a8a8a8')
      };
    default:
      throw new EmailTemplateValidationError(
        `Unsupported email section type: ${type}`
      );
  }
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
  if (!['transactional', 'marketing'].includes(category)) {
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
  const theme =
    input.theme && typeof input.theme === 'object' ? input.theme : {};
  return {
    key: rawKey || undefined,
    name,
    category,
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

function renderSection(section, context) {
  const { siteUrl, variables } = context;
  const settings = section.settings;
  const cell = (content, style = '') =>
    `<tr><td style="padding:24px 28px;${style}">${content}</td></tr>`;
  switch (section.type) {
    case 'logo':
      return cell(
        renderLinkedImage(
          settings,
          'email-logo',
          `width:${settings.width}px;margin:0 ${settings.alignment === 'center' ? 'auto' : settings.alignment === 'right' ? '0 0 0 auto' : 'auto 0'};`,
          siteUrl,
          variables
        ),
        `text-align:${settings.alignment};`
      );
    case 'heading': {
      const heading = `<h1 style="margin:0;color:${settings.colour};font-family:${settings.fontFamily};font-size:${settings.fontSize}px;line-height:1.1;text-align:${settings.alignment};">${escapeHtml(replaceVariables(settings.text, variables))}</h1>`;
      const subheading = settings.showSubheading
        ? `<p style="margin:12px 0 0;color:#f4f4f4;font-family:${settings.subheadingFontFamily};font-size:16px;line-height:1.5;text-align:${settings.alignment};">${escapeHtml(replaceVariables(settings.subheading, variables))}</p>`
        : '';
      return cell(`${heading}${subheading}`);
    }
    case 'hero':
      if (!settings.visible) return '';
      return cell(
        renderLinkedImage(
          settings,
          'email-hero',
          `width:100%;border-radius:${settings.borderRadius}px;margin:0 auto;`,
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
          `width:${settings.width}%;border-radius:${settings.borderRadius}px;margin:0 ${settings.alignment === 'center' ? 'auto' : settings.alignment === 'right' ? '0 0 0 auto' : 'auto 0'};`,
          siteUrl,
          variables
        ),
        `text-align:${settings.alignment};`
      );
    case 'content':
      return cell(
        escapeHtml(replaceVariables(settings.text, variables)).replaceAll(
          '\n',
          '<br />'
        ),
        `color:${settings.colour};font-family:${settings.fontFamily};font-size:${settings.fontSize}px;line-height:1.6;text-align:${settings.alignment};`
      );
    case 'primaryAction': {
      const href = escapeHtml(resolveUrl(settings.href, siteUrl, variables));
      return cell(
        `<a href="${href || '#'}" style="display:inline-block;padding:14px 22px;border-radius:${settings.borderRadius}px;background:${settings.backgroundColour};color:${settings.textColour};font-family:Arial,sans-serif;font-size:16px;font-weight:bold;text-decoration:none;">${escapeHtml(replaceVariables(settings.label, variables))}</a>`,
        `text-align:${settings.alignment};`
      );
    }
    case 'divider':
      return cell(
        `<div style="width:${settings.width}%;margin:0 auto;border-top:${settings.thickness}px solid ${settings.colour};font-size:0;line-height:0;">&nbsp;</div>`,
        'padding-top:12px;padding-bottom:12px;'
      );
    case 'spacer':
      return `<tr><td height="${settings.height}" style="height:${settings.height}px;font-size:0;line-height:0;">&nbsp;</td></tr>`;
    case 'socialLinks': {
      const links = [
        ['Instagram', settings.instagramUrl],
        ['TikTok', settings.tiktokUrl],
        ['YouTube', settings.youtubeUrl]
      ]
        .filter(([, url]) => url)
        .map(
          ([label, url]) =>
            `<a href="${escapeHtml(resolveUrl(url, siteUrl, variables))}" style="color:${settings.colour};text-decoration:underline;margin:0 8px;">${label}</a>`
        )
        .join('');
      return cell(
        `<p style="margin:0 0 10px;font-weight:bold;">${escapeHtml(replaceVariables(settings.heading, variables))}</p>${links}`,
        `color:${settings.colour};font-family:Arial,sans-serif;text-align:${settings.alignment};`
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
        `<p style="margin:0 0 10px;">${escapeHtml(replaceVariables(settings.text, variables))}</p><a href="${privacyUrl || '#'}" style="color:${context.accentColour};">${escapeHtml(settings.privacyLabel)}</a>${settings.unsubscribeLabel ? `&nbsp;&nbsp;<a href="${unsubscribeUrl || '#'}" style="color:${context.accentColour};">${escapeHtml(settings.unsubscribeLabel)}</a>` : ''}`,
        `border-top:1px solid rgba(255,255,255,.14);color:${settings.colour};font-family:Arial,sans-serif;font-size:${settings.fontSize}px;line-height:1.5;text-align:center;`
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
        accentColour: normalized.theme.accentColour
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
  const serialized = {
    id: source._id ? String(source._id) : '',
    key: source.key || '',
    name: source.name || '',
    category: source.category || 'transactional',
    status: source.status || 'draft',
    subject: source.subject || '',
    preheader: source.preheader || '',
    version: Number(source.version || 1),
    publishedVersion: source.publishedVersion || null,
    createdAt: source.system?.createdAt || null,
    updatedAt: source.system?.updatedAt || null,
    publishedAt: source.system?.publishedAt || null
  };
  if (includeContent) {
    serialized.theme = source.theme || {};
    serialized.sections = Array.isArray(source.sections) ? source.sections : [];
  }
  return serialized;
}

module.exports = {
  EmailTemplateValidationError,
  compileEmailTemplate,
  normalizeEmailTemplateInput,
  serializeEmailTemplate
};
