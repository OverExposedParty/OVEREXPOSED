const path = require('path');
const fs = require('fs');

const {
  ROOT_DIRECTORY,
  PUBLIC_DIRECTORY,
  DEPLOYMENT_VERSION,
  ONE_YEAR_IN_SECONDS
} = require('../constants');
const {
  getCookieValue,
  getWaitingRoomMeta,
  prepareHtmlResponse,
  renderWaitingRoomPage,
  sendProtectedPage,
  sendVersionedHtmlFile
} = require('../services/page-assets');
const {
  sendBattleOlingsPage
} = require('../services/page-assets-battle-olings');
const { sendLoginPage } = require('../services/page-assets-login');
const { canAccessProtectedPage } = require('../services/page-protection');

function registerPageRoutes({
  app,
  accountModel,
  debugLog,
  hostedPartyModels = [],
  waitingRoomModel
}) {
  const sendPage = (route, relativePath, protection = null) => {
    app.get(route, async (req, res) => {
      let access;

      try {
        access = await canAccessProtectedPage(req, protection, {
          Account: accountModel,
          PartyModels: hostedPartyModels.length
            ? hostedPartyModels
            : [waitingRoomModel].filter(Boolean)
        });
      } catch (error) {
        console.error(
          `[REQ ${req.id || 'unknown'}] Page protection check failed:`,
          error
        );
        sendProtectedPage(req, res, { reason: 'protected' }, 403);
        return;
      }

      if (!access.allowed) {
        sendProtectedPage(req, res, access, 403);
        return;
      }

      const filePath = path.join(PUBLIC_DIRECTORY, relativePath);
      debugLog(`Attempting to serve file from: ${filePath}`);

      if (!fs.existsSync(filePath)) {
        console.error(
          `❌ Route "${route}" points to a missing HTML file: ${filePath}`
        );
        sendVersionedHtmlFile(
          req,
          res,
          path.join(ROOT_DIRECTORY, 'public', 'pages', '404.html'),
          404
        );
        return;
      }

      sendVersionedHtmlFile(req, res, filePath);
    });
  };
  const adminProtected = { type: 'admin' };
  const accountProtected = { type: 'account' };
  const featureProtected = (feature) => ({ type: 'feature', feature });
  const hostedFeatureProtected = (feature) => ({
    type: 'feature',
    feature,
    allowHostedParty: true
  });

  sendPage('/', path.join('pages', 'homepages', 'homepage.html'));
  sendPage(
    '/truth-or-dare/settings',
    path.join(
      'pages',
      'party-games',
      'truth-or-dare',
      'truth-or-dare-settings-page.html'
    )
  );
  sendPage(
    '/truth-or-dare',
    path.join(
      'pages',
      'party-games',
      'truth-or-dare',
      'truth-or-dare-page.html'
    )
  );
  sendPage(
    '/truth-or-dare/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})',
    path.join(
      'pages',
      'party-games',
      'truth-or-dare',
      'truth-or-dare-online-page.html'
    )
  );
  sendPage(
    '/paranoia/settings',
    path.join('pages', 'party-games', 'paranoia', 'paranoia-settings-page.html')
  );
  sendPage(
    '/paranoia',
    path.join('pages', 'party-games', 'paranoia', 'paranoia-page.html')
  );
  sendPage(
    '/paranoia/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})',
    path.join('pages', 'party-games', 'paranoia', 'paranoia-online-page.html')
  );
  sendPage(
    '/never-have-i-ever/settings',
    path.join(
      'pages',
      'party-games',
      'never-have-i-ever',
      'never-have-i-ever-settings-page.html'
    )
  );
  sendPage(
    '/never-have-i-ever',
    path.join(
      'pages',
      'party-games',
      'never-have-i-ever',
      'never-have-i-ever-page.html'
    )
  );
  sendPage(
    '/never-have-i-ever/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})',
    path.join(
      'pages',
      'party-games',
      'never-have-i-ever',
      'never-have-i-ever-online-page.html'
    )
  );
  sendPage(
    '/most-likely-to/settings',
    path.join(
      'pages',
      'party-games',
      'most-likely-to',
      'most-likely-to-settings-page.html'
    )
  );
  sendPage(
    '/most-likely-to',
    path.join(
      'pages',
      'party-games',
      'most-likely-to',
      'most-likely-to-page.html'
    )
  );
  sendPage(
    '/most-likely-to/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})',
    path.join(
      'pages',
      'party-games',
      'most-likely-to',
      'most-likely-to-online-page.html'
    )
  );
  sendPage(
    '/imposter/settings',
    path.join(
      'pages',
      'party-games',
      'imposter',
      'imposter-settings-page.html'
    ),
    featureProtected('imposter')
  );
  sendPage(
    '/imposter',
    path.join('pages', 'party-games', 'imposter', 'imposter-page.html'),
    featureProtected('imposter')
  );
  sendPage(
    '/imposter/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})',
    path.join('pages', 'party-games', 'imposter', 'imposter-online-page.html'),
    hostedFeatureProtected('imposter')
  );
  sendPage(
    '/would-you-rather',
    path.join(
      'pages',
      'party-games',
      'would-you-rather',
      'would-you-rather-page.html'
    ),
    featureProtected('would-you-rather')
  );
  sendPage(
    '/would-you-rather/settings',
    path.join(
      'pages',
      'party-games',
      'would-you-rather',
      'would-you-rather-settings-page.html'
    ),
    featureProtected('would-you-rather')
  );
  sendPage(
    '/would-you-rather/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})',
    path.join(
      'pages',
      'party-games',
      'would-you-rather',
      'would-you-rather-online-page.html'
    ),
    hostedFeatureProtected('would-you-rather')
  );
  sendPage(
    '/mafia/settings',
    path.join('pages', 'party-games', 'mafia', 'mafia-settings-page.html'),
    featureProtected('mafia')
  );
  sendPage(
    '/mafia/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})',
    path.join('pages', 'party-games', 'mafia', 'mafia-online-page.html'),
    hostedFeatureProtected('mafia')
  );
  sendPage(
    '/overexposure',
    path.join('pages', 'overexposure', 'overexposure.html'),
    featureProtected('overexposure')
  );
  sendPage(
    '/olings/lab',
    path.join('pages', 'olings', 'lab.html'),
    featureProtected('olings.lab')
  );
  const sendBattleOlingsPageRoute = (route) => {
    app.get(route, async (req, res) => {
      let access;

      try {
        access = await canAccessProtectedPage(req, accountProtected, {
          Account: accountModel,
          PartyModels: hostedPartyModels.length
            ? hostedPartyModels
            : [waitingRoomModel].filter(Boolean)
        });
      } catch (error) {
        console.error(
          `[REQ ${req.id || 'unknown'}] Page protection check failed:`,
          error
        );
        sendProtectedPage(req, res, { reason: 'protected' }, 403);
        return;
      }

      if (!access.allowed) {
        sendProtectedPage(req, res, access, 403);
        return;
      }

      sendBattleOlingsPage(req, res);
    });
  };

  sendBattleOlingsPageRoute('/olings/battle');
  sendBattleOlingsPageRoute(
    '/olings/battle/:matchCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})'
  );
  sendPage(
    '/shop',
    path.join('pages', 'shop', 'landing-page.html'),
    featureProtected('shop')
  );
  sendPage(
    '/shop/:slug',
    path.join('pages', 'shop', 'product-page.html'),
    featureProtected('shop')
  );
  app.get('/sign-in', (req, res) => {
    sendLoginPage(req, res);
  });
  app.get('/login', (req, res) => {
    const query = req.url.includes('?')
      ? req.url.slice(req.url.indexOf('?'))
      : '';
    res.redirect(301, `/sign-in${query}`);
  });
  sendPage(
    '/reset-password',
    path.join('pages', 'auth', 'reset-password.html')
  );
  sendPage('/verify-email', path.join('pages', 'auth', 'verify-email.html'));
  sendPage('/change-email', path.join('pages', 'auth', 'change-email.html'));
  sendPage(
    '/oe-panel',
    path.join('pages', 'oe-panel', 'oe-panel.html'),
    adminProtected
  );

  sendPage(
    '/overexposure/:timestamp',
    path.join('pages', 'overexposure', 'overexposure.html'),
    featureProtected('overexposure')
  );

  sendPage('/waiting-room', path.join('pages', 'waiting-room.html'));

  app.get('/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})', async (req, res) => {
    const { partyCode } = req.params;

    try {
      const waitingRoom = await waitingRoomModel
        .findOne({ partyId: partyCode })
        .lean();
      const meta = await getWaitingRoomMeta(req, partyCode, waitingRoom);
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

      res.type('html').send(
        prepareHtmlResponse(renderWaitingRoomPage(meta), {
          cspNonce: res.locals?.cspNonce
        })
      );
    } catch (error) {
      console.error(`❌ Failed to render waiting room ${partyCode}:`, error);
      sendVersionedHtmlFile(
        req,
        res,
        path.join(ROOT_DIRECTORY, 'public', 'pages', '404.html'),
        404
      );
    }
  });

  sendPage(
    '/terms-and-privacy',
    path.join('pages', 'other', 'terms-and-privacy.html')
  );
  sendPage(
    '/faqs',
    path.join('pages', 'other', 'frequently-asked-questions.html')
  );
  sendPage(
    '/oes-customisation',
    path.join('pages', 'other', 'oes-customisation.html'),
    accountProtected
  );
  sendPage(
    '/oe-library',
    path.join('pages', 'other', 'oes-customisation.html'),
    accountProtected
  );
  sendPage('/terminal', path.join('pages', '404.html'));

  app.use((req, res) => {
    sendVersionedHtmlFile(
      req,
      res,
      path.join(ROOT_DIRECTORY, 'public', 'pages', '404.html'),
      404
    );
  });
}

module.exports = {
  registerPageRoutes
};
