const {
  applyResendWebhookEvent,
  verifyResendWebhookSignature
} = require('../services/email-tracking');

function registerEmailTrackingRoutes(context) {
  const { app, EmailDelivery } = context;

  app.post('/api/webhooks/resend', async (req, res) => {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) {
      return res.apiError({
        status: 503,
        code: 'email_webhook_not_configured',
        message: 'Email webhook is not configured'
      });
    }

    const payload = typeof req.rawBody === 'string' ? req.rawBody : '';
    const isValid = verifyResendWebhookSignature({
      payload,
      headers: req.headers,
      secret
    });
    if (!isValid) {
      return res.apiError({
        status: 400,
        code: 'email_webhook_signature_invalid',
        message: 'Email webhook signature is invalid'
      });
    }

    try {
      const event = JSON.parse(payload);
      const result = await applyResendWebhookEvent({
        EmailDelivery,
        event,
        eventId: req.headers['svix-id']
      });
      res.apiSuccess({ data: result });
    } catch (error) {
      console.error(`[REQ ${req.id}] Failed to process email webhook:`, error);
      res.apiError({
        status: 400,
        code: 'email_webhook_invalid',
        message: 'Email webhook payload could not be processed'
      });
    }
  });
}

module.exports = { registerEmailTrackingRoutes };
