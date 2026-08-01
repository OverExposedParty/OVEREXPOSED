const fs = require('fs');
const path = require('path');

const {
  PUBLIC_DIRECTORY,
  DEPLOYMENT_VERSION,
  ONE_YEAR_IN_SECONDS
} = require('../constants');
const {
  getCookieValue,
  prepareHtmlResponse
} = require('./page-assets');

const LOGIN_TEMPLATE_PATH = path.join(
  PUBLIC_DIRECTORY,
  'pages',
  'auth',
  'login.html'
);
const LOGIN_FRAGMENT_DIRECTORY = path.join(
  PUBLIC_DIRECTORY,
  'pages',
  'auth',
  'login'
);
const LOGIN_FRAGMENTS = Object.freeze({
  __LOGIN_AUTH_FORMS__: 'auth-forms.html',
  __LOGIN_LEGAL_DIALOG__: 'legal-dialog.html',
  __LOGIN_PAGE_SCRIPTS__: 'page-scripts.html'
});

function renderLoginPage() {
  const template = fs.readFileSync(LOGIN_TEMPLATE_PATH, 'utf8');

  return Object.entries(LOGIN_FRAGMENTS).reduce(
    (html, [placeholder, filename]) =>
      html.replaceAll(
        placeholder,
        fs.readFileSync(path.join(LOGIN_FRAGMENT_DIRECTORY, filename), 'utf8')
      ),
    template
  );
}

function sendLoginPage(req, res, statusCode = 200) {
  try {
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

    res
      .status(statusCode)
      .type('html')
      .send(
        prepareHtmlResponse(renderLoginPage(), {
          cspNonce: res.locals?.cspNonce
        })
      );
  } catch (error) {
    console.error('Error rendering login page:', error);
    if (!res.headersSent) {
      res.status(500).send('Internal Server Error');
    }
  }
}

module.exports = {
  renderLoginPage,
  sendLoginPage
};
