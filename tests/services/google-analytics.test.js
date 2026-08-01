const test = require('node:test');
const assert = require('node:assert/strict');

const {
  formatGaDate,
  serializeDailyActivity,
  serializeOverview,
  serializeTopPages
} = require('../../server/services/google-analytics');

function metricValues(...values) {
  return values.map((value) => ({ value: String(value) }));
}

test('formatGaDate converts GA compact dates to calendar keys', () => {
  assert.equal(formatGaDate('20260622'), '2026-06-22');
  assert.equal(formatGaDate('invalid'), null);
});

test('serializeOverview maps the GA traffic metrics in request order', () => {
  assert.deepEqual(
    serializeOverview({
      rows: [
        {
          metricValues: metricValues(150, 193, 1110, 0.42, 84.5)
        }
      ]
    }),
    {
      activeUsers: 150,
      sessions: 193,
      pageViews: 1110,
      bounceRate: 0.42,
      averageSessionDuration: 84.5
    }
  );
});

test('serializeDailyActivity creates calendar count maps', () => {
  assert.deepEqual(
    serializeDailyActivity({
      rows: [
        {
          dimensionValues: [{ value: '20260622' }],
          metricValues: metricValues(12, 18, 74)
        }
      ]
    }),
    {
      activeUsers: { '2026-06-22': 12 },
      sessions: { '2026-06-22': 18 },
      pageViews: { '2026-06-22': 74 }
    }
  );
});

test('serializeTopPages creates OE Panel table rows', () => {
  assert.deepEqual(
    serializeTopPages({
      rows: [
        {
          dimensionValues: [{ value: '/shop' }],
          metricValues: metricValues(300, 80, 110)
        }
      ]
    }),
    [{ page: '/shop', pageViews: '300', users: '80', sessions: '110' }]
  );
});
