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
const DEFAULT_PROTECTED_PAGE_SPLASH_SCREEN =
  '/images/splash-screens/overexposed.png';

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
        ? `This page will open on ${unlockAt}.`
        : 'This page is not open yet. Please check back later.'
    };
  }

  if (access.reason === 'window_closed') {
    return {
      title: 'Access Closed',
      message: 'This page is no longer available.'
    };
  }

  if (access.reason === 'password_required') {
    return {
      title: 'Password Required',
      message: 'Enter the page password to continue.'
    };
  }

  if (access.reason === 'account_required') {
    const requiresEligibleAccount =
      access.requiredAccess && access.requiredAccess !== 'account';
    return {
      title: 'Sign In Required',
      message: requiresEligibleAccount
        ? 'Sign in to continue. Access is limited to eligible accounts.'
        : 'Sign in to access this page.',
      showSignIn: true
    };
  }

  if (access.reason === 'feature_required') {
    if (access.requiredAccess !== 'beta') {
      return {
        title: 'Access Restricted',
        message:
          'Your account does not have the required access to view this page.'
      };
    }
    return {
      title: 'Beta Access Required',
      message: 'This page is only available to beta testers.'
    };
  }

  if (access.reason === 'owner_required') {
    return {
      title: 'Owner Access Required',
      message: 'This page is only available to owner accounts.'
    };
  }

  if (access.reason === 'admin_required') {
    return {
      title: 'Admin Access Required',
      message: 'This page is only available to administrator accounts.'
    };
  }

  return {
    title: 'Access Restricted',
    message: 'You do not have access to view this page.'
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

  return `/sign-in?returnTo=${encodeURIComponent(
    returnTo
  )}&authEntryPoint=protected_page`;
}

function renderProtectedPage(access = {}, options = {}) {
  const copy = getProtectedPageCopy(access);
  const replacements = {
    __PROTECTION_REASON__: access.reason || 'protected',
    __PROTECTION_TITLE__: copy.title,
    __PROTECTION_MESSAGE__: copy.message,
    __PROTECTION_LOGIN_URL__: options.loginUrl || '/sign-in',
    __PROTECTION_SIGN_IN_HIDDEN__: copy.showSignIn ? '' : 'hidden',
    __PROTECTION_SPLASH_SCREEN__:
      options.splashScreen || DEFAULT_PROTECTED_PAGE_SPLASH_SCREEN
  };

  return Object.entries(replacements).reduce(
    (html, [placeholder, value]) =>
      html.replaceAll(placeholder, escapeHtmlText(value)),
    PROTECTED_PAGE_TEMPLATE
  );
}

function sendProtectedPage(
  req,
  res,
  access = {},
  statusCode = 403,
  options = {}
) {
  appendDeploymentCacheHeaders(req, res);

  res
    .status(statusCode)
    .type('html')
    .send(
      prepareHtmlResponse(
        renderProtectedPage(access, {
          loginUrl: getProtectedPageLoginUrl(req),
          splashScreen: options.splashScreen
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
