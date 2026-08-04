const {
  applyMarketingConsent,
  parseMarketingUnsubscribeToken
} = require('../services/marketing-consent');

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderUnsubscribePage({
  token = '',
  complete = false,
  invalid = false
}) {
  const title = complete
    ? 'YOU’RE UNSUBSCRIBED'
    : invalid
      ? 'LINK NOT VALID'
      : 'UNSUBSCRIBE';
  const message = complete
    ? 'You will no longer receive marketing emails from OVEREXPOSED.'
    : invalid
      ? 'This unsubscribe link is invalid or no longer matches this email address.'
      : 'Confirm that you no longer want marketing emails about new features, game packs, events, promotional offers, and rewards.';
  const form =
    !complete && !invalid
      ? `<form method="post" action="/unsubscribe"><input type="hidden" name="token" value="${escapeHtml(token)}"><button type="submit">UNSUBSCRIBE</button></form>`
      : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title} | OVEREXPOSED</title>
    <style>
      body{margin:0;min-height:100vh;display:grid;place-items:center;background:#171717;color:#fff;font-family:Arial,sans-serif}
      main{box-sizing:border-box;width:min(92vw,34rem);padding:2rem;border-radius:1rem;background:#292929;text-align:center}
      h1{margin:0 0 1rem;color:#66ccff}p{line-height:1.55}button,a{display:inline-block;margin-top:1rem;border:0;border-radius:1rem;padding:.85rem 1.2rem;background:#66ccff;color:#101010;font-weight:700;text-decoration:none;cursor:pointer}
    </style>
  </head>
  <body><main><h1>${title}</h1><p>${message}</p>${form}<a href="/">BACK TO OVEREXPOSED</a></main></body>
</html>`;
}

async function findActiveSuppression(EmailSuppression, email) {
  if (!EmailSuppression?.findOne) return null;
  const query = EmailSuppression.findOne({ email, removedAt: null });
  return query?.lean ? query.lean() : query;
}

async function ensureUnsubscribeSuppression(EmailSuppression, email) {
  if (!EmailSuppression) return;
  const existing = await findActiveSuppression(EmailSuppression, email);
  if (existing || !EmailSuppression.create) return;

  try {
    await EmailSuppression.create({
      email,
      reason: 'unsubscribed',
      source: 'user',
      note: 'Marketing consent withdrawn through email unsubscribe link'
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
}

function registerMarketingUnsubscribeRoutes(context) {
  const { app, Account, EmailSuppression } = context;

  app.get('/unsubscribe', (req, res) => {
    const token = typeof req.query?.token === 'string' ? req.query.token : '';
    const parsed = parseMarketingUnsubscribeToken(token);
    res
      .status(parsed ? 200 : 400)
      .type('html')
      .send(renderUnsubscribePage({ token, invalid: !parsed }));
  });

  app.post('/unsubscribe', async (req, res) => {
    const token =
      typeof req.body?.token === 'string'
        ? req.body.token
        : typeof req.query?.token === 'string'
          ? req.query.token
          : '';
    const parsed = parseMarketingUnsubscribeToken(token);
    if (!parsed) {
      return res
        .status(400)
        .type('html')
        .send(renderUnsubscribePage({ invalid: true }));
    }

    try {
      const query = Account.findOne({
        _id: parsed.accountId,
        email: parsed.email
      }).select('+legalConsent.consentHistory');
      const account = await query;

      if (account) {
        const isAlreadyUnsubscribed =
          account.legalConsent?.marketingConsentStatus !== 'accepted' &&
          account.profile?.notificationPreferences?.marketingEmail !== true;
        if (!isAlreadyUnsubscribed) {
          applyMarketingConsent(account, {
            accepted: false,
            req,
            source: 'unsubscribe_link'
          });
          await account.save();
        }
        await ensureUnsubscribeSuppression(EmailSuppression, parsed.email);
      }

      res
        .status(200)
        .type('html')
        .send(renderUnsubscribePage({ complete: true }));
    } catch (error) {
      console.error(`[REQ ${req.id}] Failed to unsubscribe email:`, error);
      res
        .status(500)
        .type('html')
        .send(renderUnsubscribePage({ invalid: true }));
    }
  });
}

module.exports = {
  ensureUnsubscribeSuppression,
  registerMarketingUnsubscribeRoutes,
  renderUnsubscribePage
};
