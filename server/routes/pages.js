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
  sendVersionedHtmlFile
} = require('../services/page-assets');

function registerPageRoutes({ app, debugLog, waitingRoomModel }) {
  const sendPage = (route, relativePath) => {
    app.get(route, (req, res) => {
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
    path.join('pages', 'party-games', 'imposter', 'imposter-settings-page.html')
  );
  sendPage(
    '/imposter',
    path.join('pages', 'party-games', 'imposter', 'imposter-page.html')
  );
  sendPage(
    '/imposter/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})',
    path.join('pages', 'party-games', 'imposter', 'imposter-online-page.html')
  );
  sendPage(
    '/would-you-rather',
    path.join(
      'pages',
      'party-games',
      'would-you-rather',
      'would-you-rather-page.html'
    )
  );
  sendPage(
    '/would-you-rather/settings',
    path.join(
      'pages',
      'party-games',
      'would-you-rather',
      'would-you-rather-settings-page.html'
    )
  );
  sendPage(
    '/would-you-rather/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})',
    path.join(
      'pages',
      'party-games',
      'would-you-rather',
      'would-you-rather-online-page.html'
    )
  );
  sendPage(
    '/exposay/settings',
    path.join('pages', 'party-games', 'exposay', 'exposay-settings-page.html')
  );
  sendPage(
    '/mafia/settings',
    path.join('pages', 'party-games', 'mafia', 'mafia-settings-page.html')
  );
  sendPage(
    '/mafia/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})',
    path.join('pages', 'party-games', 'mafia', 'mafia-online-page.html')
  );
  sendPage(
    '/overexposure',
    path.join('pages', 'overexposure', 'overexposure.html')
  );

  app.get('/overexposure/:timestamp', (req, res) => {
    const filePath = path.join(
      PUBLIC_DIRECTORY,
      'pages',
      'overexposure',
      'overexposure.html'
    );
    sendVersionedHtmlFile(req, res, filePath);
  });

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
    path.join('pages', 'other', 'oes-customisation.html')
  );

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
