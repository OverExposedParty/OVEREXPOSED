function getVersionForAsset(cacheBustKey = null) {
  if (cacheBustKey !== null) {
    return SCRIPT_VERSIONS[cacheBustKey] ?? WEBSITE_CACHE_VERSION ?? null;
  }

  return WEBSITE_CACHE_VERSION ?? getInitialAssetVersion() ?? null;
}

function shouldVersionAssetUrl(assetUrl) {
  if (typeof assetUrl !== 'string' || assetUrl.length === 0) return false;
  if (
    assetUrl.startsWith('http://') ||
    assetUrl.startsWith('https://') ||
    assetUrl.startsWith('//')
  )
    return false;
  if (!assetUrl.startsWith('/')) return false;
  if (assetUrl.startsWith('/api/')) return false;
  return true;
}

function versionAssetUrl(assetUrl, { cacheBustKey = null } = {}) {
  if (!shouldVersionAssetUrl(assetUrl)) {
    return assetUrl;
  }

  try {
    const url = new URL(assetUrl, window.location.origin);
    for (const [key, value] of [...url.searchParams.entries()]) {
      if (/^\d+$/.test(key) && value === '') {
        url.searchParams.delete(key);
      }
    }

    const version = getVersionForAsset(cacheBustKey) || WEBSITE_CACHE_VERSION;
    if (!version) {
      return `${url.pathname}${url.search}${url.hash}`;
    }

    url.searchParams.set('v', version);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return assetUrl;
  }
}

window.versionAssetUrl = versionAssetUrl;

const OE_SANITIZER_DEFAULT_ALLOWED_TAGS = new Set([
  'a',
  'b',
  'br',
  'div',
  'em',
  'i',
  'img',
  'li',
  'ol',
  'p',
  'small',
  'span',
  'strong',
  'u',
  'ul'
]);
const OE_SANITIZER_DEFAULT_ALLOWED_ATTRIBUTES = {
  '*': new Set(['class']),
  a: new Set(['href', 'target', 'rel', 'title', 'class']),
  img: new Set(['src', 'alt', 'loading', 'decoding', 'title', 'class']),
  div: new Set(['class']),
  p: new Set(['class']),
  span: new Set(['class']),
  ul: new Set(['class']),
  ol: new Set(['class']),
  li: new Set(['class']),
  small: new Set(['class'])
};

function isSafeSanitizedUrl(url, { allowDataImage = false } = {}) {
  const trimmed = String(url || '').trim();
  if (!trimmed) return false;

  const normalised = trimmed
    .replace(/[\u0000-\u001F\u007F\s]+/g, '')
    .toLowerCase();
  if (
    normalised.startsWith('javascript:') ||
    normalised.startsWith('vbscript:') ||
    normalised.startsWith('data:')
  ) {
    return allowDataImage && /^data:image\//i.test(trimmed);
  }

  return true;
}

function sanitiseHtmlNode(node, config) {
  if (node.nodeType === Node.TEXT_NODE) {
    return document.createTextNode(node.textContent || '');
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const tagName = node.tagName.toLowerCase();
  if (!config.allowedTags.has(tagName)) {
    const fragment = document.createDocumentFragment();
    Array.from(node.childNodes).forEach((childNode) => {
      const sanitisedChild = sanitiseHtmlNode(childNode, config);
      if (sanitisedChild) {
        fragment.appendChild(sanitisedChild);
      }
    });
    return fragment;
  }

  const element = document.createElement(tagName);
  const allowedAttributes = new Set([
    ...(config.allowedAttributes['*'] || []),
    ...(config.allowedAttributes[tagName] || [])
  ]);

  Array.from(node.attributes).forEach((attribute) => {
    const attributeName = attribute.name.toLowerCase();
    if (!allowedAttributes.has(attributeName)) {
      return;
    }

    const value = attribute.value;
    if (attributeName === 'href') {
      if (!isSafeSanitizedUrl(value)) return;
      element.setAttribute('href', value);
      const targetValue = node.getAttribute('target');
      if (targetValue === '_blank') {
        element.setAttribute('target', '_blank');
        element.setAttribute('rel', 'noopener noreferrer');
      }
      return;
    }

    if (attributeName === 'src') {
      if (!isSafeSanitizedUrl(value, { allowDataImage: tagName === 'img' }))
        return;
      element.setAttribute('src', value);
      return;
    }

    if (attributeName === 'target') {
      if (value === '_blank') {
        element.setAttribute('target', '_blank');
        element.setAttribute('rel', 'noopener noreferrer');
      }
      return;
    }

    if (
      attributeName === 'rel' &&
      element.getAttribute('target') === '_blank'
    ) {
      element.setAttribute('rel', 'noopener noreferrer');
      return;
    }

    element.setAttribute(attribute.name, value);
  });

  Array.from(node.childNodes).forEach((childNode) => {
    const sanitisedChild = sanitiseHtmlNode(childNode, config);
    if (sanitisedChild) {
      element.appendChild(sanitisedChild);
    }
  });

  return element;
}

function sanitizeHtmlToFragment(html, options = {}) {
  const template = document.createElement('template');
  template.innerHTML = String(html ?? '');

  const config = {
    allowedTags: new Set(
      options.allowedTags || OE_SANITIZER_DEFAULT_ALLOWED_TAGS
    ),
    allowedAttributes:
      options.allowedAttributes || OE_SANITIZER_DEFAULT_ALLOWED_ATTRIBUTES
  };
  const fragment = document.createDocumentFragment();

  Array.from(template.content.childNodes).forEach((childNode) => {
    const sanitisedNode = sanitiseHtmlNode(childNode, config);
    if (sanitisedNode) {
      fragment.appendChild(sanitisedNode);
    }
  });

  return fragment;
}

function setSanitizedHtml(target, html, options = {}) {
  if (!target) return;
  target.replaceChildren(sanitizeHtmlToFragment(html, options));
}

function createTrustedHtmlFragment(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html ?? '');
  return template.content.cloneNode(true);
}

function appendTrustedHtml(target, html, { replace = false } = {}) {
  if (!target) return document.createDocumentFragment();

  const fragment = createTrustedHtmlFragment(html);
  if (replace) {
    target.replaceChildren(fragment);
  } else {
    target.appendChild(fragment);
  }

  return target;
}

async function fetchTrustedHtml(path) {
  const response = await fetch(path);
  return response.text();
}

window.sanitizeHtmlToFragment = sanitizeHtmlToFragment;
window.setSanitizedHtml = setSanitizedHtml;
window.createTrustedHtmlFragment = createTrustedHtmlFragment;
window.appendTrustedHtml = appendTrustedHtml;
window.fetchTrustedHtml = fetchTrustedHtml;

function updateExistingAssetUrls(root = document) {
  const selectors = [
    'script[src]',
    'link[href]',
    'img[src]',
    'source[src]',
    'source[srcset]'
  ];

  root.querySelectorAll(selectors.join(', ')).forEach((el) => {
    if (el.hasAttribute('src')) {
      const src = el.getAttribute('src');
      const versionedSrc = versionAssetUrl(src);
      if (versionedSrc !== src) {
        el.setAttribute('src', versionedSrc);
      }
    }

    if (el.hasAttribute('href')) {
      const href = el.getAttribute('href');
      const versionedHref = versionAssetUrl(href);
      if (versionedHref !== href) {
        el.setAttribute('href', versionedHref);
      }
    }

    if (el.hasAttribute('srcset')) {
      const srcset = el.getAttribute('srcset');
      if (!srcset) return;

      const versionedSrcset = srcset
        .split(',')
        .map((entry) => {
          const parts = entry.trim().split(/\s+/);
          if (parts.length === 0) return entry;
          parts[0] = versionAssetUrl(parts[0]);
          return parts.join(' ');
        })
        .join(', ');

      if (versionedSrcset !== srcset) {
        el.setAttribute('srcset', versionedSrcset);
      }
    }
  });
}

window.updateExistingAssetUrls = updateExistingAssetUrls;
updateExistingAssetUrls();

