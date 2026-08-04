const {
  normalizeAnalyticsBatch,
  storeAnalyticsEvents
} = require('../services/product-analytics');

function registerProductAnalyticsRoutes(context) {
  const { AnalyticsEvent, app, assertAuthThrottle, getCurrentAccount } =
    context;

  app.post('/api/analytics/events', async (req, res) => {
    if (
      typeof assertAuthThrottle === 'function' &&
      !assertAuthThrottle(req, res, 'analytics')
    ) {
      return;
    }
    if (req.body?.consent !== true) {
      return res.apiSuccess({ accepted: 0 });
    }

    try {
      const account =
        typeof getCurrentAccount === 'function'
          ? await getCurrentAccount(req)
          : null;
      const events = normalizeAnalyticsBatch(req.body?.events, {
        accountId: account?._id || null,
        receivedAt: new Date()
      });
      const accepted = await storeAnalyticsEvents(AnalyticsEvent, events);
      return res.apiSuccess({ accepted });
    } catch (error) {
      console.error(
        `[REQ ${req.id}] Failed to store product analytics events:`,
        error
      );
      return res.apiError({
        status: 500,
        code: 'analytics_events_store_failed',
        message: 'Failed to store analytics events'
      });
    }
  });
}

module.exports = { registerProductAnalyticsRoutes };
