const fs = require('fs');
const path = require('path');

const {
  PUBLIC_DIRECTORY,
  WEBSITE_CACHE_VERSION,
  DEPLOYMENT_VERSION,
  ONE_YEAR_IN_SECONDS
} = require('../../constants');

function getCookieValue(cookieHeader, key) {
  if (
    typeof cookieHeader !== 'string' ||
    typeof key !== 'string' ||
    key.length === 0
  ) {
    return null;
  }

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [rawName, ...rawValue] = cookie.trim().split('=');
    if (rawName === key) {
      return rawValue.join('=');
    }
  }

  return null;
}

function removeLegacyCacheBustParams(url) {
  const keysToDelete = [];

  for (const [key, value] of url.searchParams.entries()) {
    if (/^\d+$/.test(key) && value === '') {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => {
    url.searchParams.delete(key);
  });
}

function getVersionedPublicAssetUrl(assetUrl) {
  if (typeof assetUrl !== 'string' || !assetUrl.startsWith('/')) {
    return assetUrl;
  }

  try {
    const url = new URL(assetUrl, 'http://localhost');
    const assetPath = decodeURIComponent(url.pathname);
    const normalizedAssetPath = path
      .normalize(assetPath)
      .replace(/^([\\/])+/, '');
    const filePath = path.join(PUBLIC_DIRECTORY, normalizedAssetPath);

    if (!filePath.startsWith(PUBLIC_DIRECTORY)) {
      return assetUrl;
    }

    fs.accessSync(filePath, fs.constants.F_OK);

    removeLegacyCacheBustParams(url);
    url.searchParams.set('v', WEBSITE_CACHE_VERSION);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return assetUrl;
  }
}

function versionLocalAssetReferences(html) {
  if (typeof html !== 'string') {
    return html;
  }

  return html.replace(
    /<(script|link|img)\b[^>]*(src|href)=["']([^"']+)["'][^>]*>/gi,
    (tag, tagName, attributeName, assetUrl) => {
      const lowerTagName = tagName.toLowerCase();

      if (
        lowerTagName === 'link' &&
        !/(rel=["'](?:stylesheet|preload|icon|shortcut icon|apple-touch-icon|manifest)["'])/i.test(
          tag
        )
      ) {
        return tag;
      }

      if (lowerTagName === 'link' && /rel=["']canonical["']/i.test(tag)) {
        return tag;
      }

      const versionedUrl = getVersionedPublicAssetUrl(assetUrl);
      if (versionedUrl === assetUrl) {
        return tag;
      }

      return tag.replace(
        new RegExp(
          `(${attributeName}=["'])${assetUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(["'])`,
          'i'
        ),
        `$1${versionedUrl}$2`
      );
    }
  );
}

function stripMetaContentSecurityPolicy(html) {
  if (typeof html !== 'string') {
    return html;
  }

  return html.replace(
    /<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>\s*/gi,
    ''
  );
}

const CRITICAL_SPLASH_STYLE = `<style id="critical-splash-style">
html,
body {
  min-height: 100%;
  background: #202020;
  overflow: hidden;
}

.splash-screen-container,
.splash-screen-container-static {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  background-color: #202020;
  z-index: 9998;
  display: flex;
  justify-content: center;
  align-items: center;
  opacity: 1;
  overflow: hidden;
}

.splash-screen-container {
  z-index: 9999;
}

.splash-screen-container img,
.splash-screen-container-static img {
  display: block;
  width: 100%;
  height: 100%;
  max-height: none;
  object-fit: cover;
  object-position: center;
}
</style>`;

function getSplashScreenImageUrl(html) {
  if (typeof html !== 'string') {
    return null;
  }

  const splashContainerMatch = html.match(
    /<div\b[^>]*class=["'][^"']*splash-screen-container(?:-static)?[^"']*["'][\s\S]*?<\/div>/i
  );
  if (!splashContainerMatch) {
    return null;
  }

  const imageMatch = splashContainerMatch[0].match(
    /<img\b[^>]*\bsrc=["']([^"']+)["']/i
  );
  return imageMatch?.[1] || null;
}

function getSplashPreloadLink(html) {
  const splashImageUrl = getSplashScreenImageUrl(html);
  if (!splashImageUrl || html.includes(`href="${splashImageUrl}"`)) {
    return '';
  }

  return `<link rel="preload" href="${splashImageUrl}" as="image" fetchpriority="high">\n`;
}

function injectCriticalSplashStyles(html) {
  if (
    typeof html !== 'string' ||
    !html.includes('splash-screen-container') ||
    html.includes('id="critical-splash-style"')
  ) {
    return html;
  }

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(
      /<head([^>]*)>/i,
      `<head$1>\n${getSplashPreloadLink(html)}${CRITICAL_SPLASH_STYLE}`
    );
  }

  return html;
}

function applyScriptNonceAttributes(html, cspNonce) {
  if (typeof html !== 'string' || typeof cspNonce !== 'string' || !cspNonce) {
    return html;
  }

  return html.replace(/<script\b([^>]*)>/gi, (tag, attributes = '') => {
    if (/\bnonce\s*=/i.test(attributes)) {
      return tag;
    }

    return `<script${attributes} nonce="${cspNonce}">`;
  });
}

function prepareHtmlResponse(html, { cspNonce = null } = {}) {
  return applyScriptNonceAttributes(
    versionLocalAssetReferences(
      injectCriticalSplashStyles(stripMetaContentSecurityPolicy(html))
    ),
    cspNonce
  );
}

function appendDeploymentCacheHeaders(req, res) {
  const existingDeploymentVersion = getCookieValue(
    req.headers.cookie,
    'oe-deployment-version'
  );
  if (existingDeploymentVersion !== DEPLOYMENT_VERSION) {
    res.setHeader('Clear-Site-Data', '"cache"');
    res.append(
      'Set-Cookie',
      `oe-deployment-version=${DEPLOYMENT_VERSION}; Path=/; Max-Age=${ONE_YEAR_IN_SECONDS}; SameSite=Lax`
    );
  }
}

function sendVersionedHtmlFile(req, res, filePath, statusCode = 200) {
  fs.readFile(filePath, 'utf8', (error, html) => {
    if (error) {
      console.error(`Error reading HTML file "${filePath}":`, error);
      if (!res.headersSent) {
        res.status(500).send('Internal Server Error');
      }
      return;
    }

    appendDeploymentCacheHeaders(req, res);

    res
      .status(statusCode)
      .type('html')
      .send(prepareHtmlResponse(html, { cspNonce: res.locals?.cspNonce }));
  });
}

module.exports = {
  getCookieValue,
  getVersionedPublicAssetUrl,
  versionLocalAssetReferences,
  stripMetaContentSecurityPolicy,
  injectCriticalSplashStyles,
  applyScriptNonceAttributes,
  prepareHtmlResponse,
  appendDeploymentCacheHeaders,
  sendVersionedHtmlFile
};
