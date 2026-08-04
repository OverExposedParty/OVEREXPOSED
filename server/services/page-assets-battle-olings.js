const fs = require('fs');
const path = require('path');

const {
  PUBLIC_DIRECTORY,
  DEPLOYMENT_VERSION,
  ONE_YEAR_IN_SECONDS
} = require('../constants');
const { getCookieValue, prepareHtmlResponse } = require('./page-assets');

const BATTLE_OLINGS_TEMPLATE_PATH = path.join(
  PUBLIC_DIRECTORY,
  'pages',
  'olings',
  'battle-olings.html'
);
const BATTLE_OLINGS_FRAGMENT_DIRECTORY = path.join(
  PUBLIC_DIRECTORY,
  'pages',
  'olings',
  'battle-olings'
);
const BATTLE_OLINGS_FRAGMENTS = Object.freeze({
  __BATTLE_OLINGS_ARENA__: 'arena.html',
  __BATTLE_OLINGS_LOBBY__: 'lobby.html',
  __BATTLE_OLINGS_MOMENTUM_FOOTER__: 'momentum-footer.html',
  __BATTLE_OLINGS_LOBBY_FOOTER__: 'lobby-footer.html',
  __BATTLE_OLINGS_NO_OLING__: 'no-oling.html'
});

function renderBattleOlingsPage() {
  const template = fs.readFileSync(BATTLE_OLINGS_TEMPLATE_PATH, 'utf8');

  return Object.entries(BATTLE_OLINGS_FRAGMENTS).reduce(
    (html, [placeholder, filename]) =>
      html.replaceAll(
        placeholder,
        fs.readFileSync(
          path.join(BATTLE_OLINGS_FRAGMENT_DIRECTORY, filename),
          'utf8'
        )
      ),
    template
  );
}

function sendBattleOlingsPage(req, res, statusCode = 200) {
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
        prepareHtmlResponse(renderBattleOlingsPage(), {
          cspNonce: res.locals?.cspNonce
        })
      );
  } catch (error) {
    console.error('Error rendering Battle Olings page:', error);
    if (!res.headersSent) {
      res.status(500).send('Internal Server Error');
    }
  }
}

module.exports = {
  renderBattleOlingsPage,
  sendBattleOlingsPage
};
