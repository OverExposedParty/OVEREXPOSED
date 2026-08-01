const fs = require('fs');
const path = require('path');

const { PUBLIC_DIRECTORY } = require('../../constants');
const {
  appendDeploymentCacheHeaders,
  prepareHtmlResponse
} = require('./asset-response');
const { escapeHtmlText } = require('./html-escape');

const PROTECTED_PAGE_TEMPLATE_PATH = path.join(
  PUBLIC_DIRECTORY,
  'pages',
  'protection',
  'protected-page.html'
);
const PROTECTED_PAGE_TEMPLATE = fs.readFileSync(
  PROTECTED_PAGE_TEMPLATE_PATH,
  'utf8'
);

function getProtectedPageCopy(access = {}) {
  if (
    access.reason === 'locked_until' ||
    access.reason === 'window_not_started'
  ) {
    const unlockAt = access.unlockAt
      ? new Date(access.unlockAt).toLocaleString('en-GB', {
          dateStyle: 'medium',
          timeStyle: 'short'
        })
      : null;
    return {
      title: 'Not Open Yet',
      message: unlockAt
        ? `This page unlocks on ${unlockAt}. Come back then.`
        : 'This page is not open yet. Come back later.'
    };
  }

  if (access.reason === 'window_closed') {
    return {
      title: 'Access Closed',
      message: 'This page was only open for a limited time.'
    };
  }

  if (access.reason === 'password_required') {
    return {
      title: 'Password Required',
      message: 'This page needs a password before it can be opened.'
    };
  }

  if (access.reason === 'account_required') {
    return {
      title: 'Sign In Required',
      message: 'Sign in with an account that has access to this page.'
    };
  }

  if (access.reason === 'feature_required') {
    return {
      title: 'Beta Access Required',
      message: 'This page is currently available to beta testers.'
    };
  }

  return {
    title: 'Admin Access Only',
    message: 'This page is currently only available to admin accounts.'
  };
}

function getProtectedPageLoginUrl(req) {
  const returnTo = req?.originalUrl || req?.url || req?.path || '/';
  if (
    typeof returnTo !== 'string' ||
    !returnTo.startsWith('/') ||
    returnTo.startsWith('//') ||
    returnTo.startsWith('/sign-in') ||
    returnTo.startsWith('/login')
  ) {
    return '/sign-in';
  }

  return `/sign-in?returnTo=${encodeURIComponent(returnTo)}`;
}

function renderProtectedPage(access = {}, options = {}) {
  const copy = getProtectedPageCopy(access);
  const replacements = {
    __PROTECTION_REASON__: access.reason || 'protected',
    __PROTECTION_TITLE__: copy.title,
    __PROTECTION_MESSAGE__: copy.message,
    __PROTECTION_LOGIN_URL__: options.loginUrl || '/sign-in'
  };

  return Object.entries(replacements).reduce(
    (html, [placeholder, value]) =>
      html.replaceAll(placeholder, escapeHtmlText(value)),
    PROTECTED_PAGE_TEMPLATE
  );
}

function sendProtectedPage(req, res, access = {}, statusCode = 403) {
  appendDeploymentCacheHeaders(req, res);

  res
    .status(statusCode)
    .type('html')
    .send(
      prepareHtmlResponse(
        renderProtectedPage(access, {
          loginUrl: getProtectedPageLoginUrl(req)
        }),
        {
          cspNonce: res.locals?.cspNonce
        }
      )
    );
}

module.exports = {
  getProtectedPageLoginUrl,
  renderProtectedPage,
  sendProtectedPage
};
