const ANALYTICS_CACHE_TTL_MS = 5 * 60 * 1000;

let analyticsClient = null;
let analyticsCache = null;

function getAnalyticsConfiguration() {
  const propertyId = String(process.env.GA4_PROPERTY_ID || '').trim();

  return {
    propertyId,
    configured: Boolean(propertyId)
  };
}

function getAnalyticsClient() {
  if (analyticsClient) return analyticsClient;

  const { BetaAnalyticsDataClient } = require('@google-analytics/data');
  analyticsClient = new BetaAnalyticsDataClient();
  return analyticsClient;
}

function getMetricValue(row, index) {
  const value = Number(row?.metricValues?.[index]?.value);
  return Number.isFinite(value) ? value : 0;
}

function getDimensionValue(row, index) {
  return String(row?.dimensionValues?.[index]?.value || '').trim();
}

function formatGaDate(value) {
  const compactDate = String(value || '').trim();
  if (!/^\d{8}$/.test(compactDate)) return null;

  return `${compactDate.slice(0, 4)}-${compactDate.slice(4, 6)}-${compactDate.slice(6, 8)}`;
}

function serializeOverview(report) {
  const row = report?.rows?.[0];

  return {
    activeUsers: getMetricValue(row, 0),
    sessions: getMetricValue(row, 1),
    pageViews: getMetricValue(row, 2),
    bounceRate: getMetricValue(row, 3),
    averageSessionDuration: getMetricValue(row, 4)
  };
}

function serializeDailyActivity(report) {
  return (report?.rows || []).reduce(
    (activity, row) => {
      const date = formatGaDate(getDimensionValue(row, 0));
      if (!date) return activity;

      activity.activeUsers[date] = getMetricValue(row, 0);
      activity.sessions[date] = getMetricValue(row, 1);
      activity.pageViews[date] = getMetricValue(row, 2);
      return activity;
    },
    { activeUsers: {}, sessions: {}, pageViews: {} }
  );
}

function serializeTopPages(report) {
  return (report?.rows || []).map((row) => ({
    page: getDimensionValue(row, 0) || '-',
    pageViews: String(getMetricValue(row, 0)),
    users: String(getMetricValue(row, 1)),
    sessions: String(getMetricValue(row, 2))
  }));
}

async function fetchGoogleAnalyticsData({ force = false } = {}) {
  const { propertyId, configured } = getAnalyticsConfiguration();
  if (!configured) {
    const error = new Error('GA4_PROPERTY_ID is not configured.');
    error.code = 'ga4_not_configured';
    throw error;
  }

  if (!force && analyticsCache?.expiresAt > Date.now()) {
    return analyticsCache.data;
  }

  const client = getAnalyticsClient();
  const property = `properties/${propertyId}`;
  const overviewMetrics = [
    { name: 'activeUsers' },
    { name: 'sessions' },
    { name: 'screenPageViews' },
    { name: 'bounceRate' },
    { name: 'averageSessionDuration' }
  ];
  const [currentResult, previousResult, dailyResult, pagesResult] =
    await Promise.all([
      client.runReport({
        property,
        dateRanges: [{ startDate: '6daysAgo', endDate: 'today' }],
        metrics: overviewMetrics
      }),
      client.runReport({
        property,
        dateRanges: [{ startDate: '13daysAgo', endDate: '7daysAgo' }],
        metrics: overviewMetrics
      }),
      client.runReport({
        property,
        dateRanges: [{ startDate: '27daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' }
        ],
        orderBys: [{ dimension: { dimensionName: 'date' } }]
      }),
      client.runReport({
        property,
        dateRanges: [{ startDate: '27daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'activeUsers' },
          { name: 'sessions' }
        ],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 20
      })
    ]);

  const data = {
    current: serializeOverview(currentResult[0]),
    previous: serializeOverview(previousResult[0]),
    dailyActivity: serializeDailyActivity(dailyResult[0]),
    topPages: serializeTopPages(pagesResult[0]),
    fetchedAt: new Date().toISOString()
  };

  analyticsCache = {
    data,
    expiresAt: Date.now() + ANALYTICS_CACHE_TTL_MS
  };

  return data;
}

module.exports = {
  fetchGoogleAnalyticsData,
  formatGaDate,
  getAnalyticsConfiguration,
  serializeDailyActivity,
  serializeOverview,
  serializeTopPages
};
