(function () {
  function createOePanelAnalyticsInsightsHydrator({ panelData }) {
    async function hydrateSection(sectionName, nextConfig) {
      if (sectionName === 'Analytics') {
        const [analyticsData, activity] = await Promise.all([
          panelData.fetchAnalyticsData(),
          panelData.fetchDashboardActivityData()
        ]);
        const stats = analyticsData.stats || {};
        const ga4 = analyticsData.ga4 || {};
        const current = ga4.current || {};
        const previous = ga4.previous || {};
        const gaActivity = ga4.dailyActivity || {};
        const metricColumns = [
          { key: 'label', label: 'Metric' },
          { key: 'value', label: 'Value' }
        ];
        const formatCount = (value) =>
          Number.isFinite(Number(value)) ? Number(value).toLocaleString() : '-';
        const formatPercentage = (value) =>
          Number.isFinite(Number(value))
            ? `${(Number(value) * 100).toFixed(1)}%`
            : '-';
        const formatDuration = (value) => {
          const seconds = Number(value);
          if (!Number.isFinite(seconds)) return '-';
          const minutes = Math.floor(seconds / 60);
          const remainingSeconds = Math.round(seconds % 60);
          return minutes
            ? `${minutes}m ${remainingSeconds}s`
            : `${remainingSeconds}s`;
        };
        const formatChange = (value, previousValue, suffix = '') => {
          const currentNumber = Number(value);
          const previousNumber = Number(previousValue);
          if (!Number.isFinite(currentNumber) || previousNumber <= 0)
            return 'last 7 days';
          const change = Math.round(
            ((currentNumber - previousNumber) / previousNumber) * 100
          );
          return `${change >= 0 ? '+' : ''}${change}% vs prior 7d${suffix}`;
        };

        nextConfig.forEach((gridConfig) => {
          if (
            gridConfig.id === 'analytics-grid-1' &&
            Array.isArray(gridConfig.stats)
          ) {
            gridConfig.stats = gridConfig.stats.map((stat) => {
              if (stat.label === 'Active Users') {
                const value = ga4.available
                  ? formatCount(current.activeUsers)
                  : formatCount(stats.activeAccounts);
                return {
                  ...stat,
                  value,
                  detail: ga4.available
                    ? formatChange(current.activeUsers, previous.activeUsers)
                    : 'account fallback, last 24h',
                  expanded: {
                    type: 'table',
                    title: stat.label,
                    columns: metricColumns,
                    rows: [
                      { label: 'GA4 active users, last 7 days', value },
                      {
                        label: 'Previous 7 days',
                        value: ga4.available
                          ? formatCount(previous.activeUsers)
                          : '-'
                      },
                      {
                        label: 'Signed-in accounts active, last 24h',
                        value: formatCount(stats.activeAccounts)
                      }
                    ]
                  }
                };
              }
              if (stat.label === 'Sessions') {
                const value = ga4.available ? formatCount(current.sessions) : '-';
                return {
                  ...stat,
                  value,
                  detail: ga4.available
                    ? formatChange(current.sessions, previous.sessions)
                    : 'GA4 unavailable',
                  expanded: {
                    type: 'table',
                    title: stat.label,
                    columns: metricColumns,
                    rows: [
                      { label: 'Sessions, last 7 days', value },
                      {
                        label: 'Previous 7 days',
                        value: ga4.available
                          ? formatCount(previous.sessions)
                          : '-'
                      },
                      {
                        label: 'Average session duration',
                        value: ga4.available
                          ? formatDuration(current.averageSessionDuration)
                          : '-'
                      }
                    ]
                  }
                };
              }
              if (stat.label === 'Page Views') {
                const value = ga4.available
                  ? formatCount(current.pageViews)
                  : '-';
                return {
                  ...stat,
                  value,
                  detail: ga4.available
                    ? formatChange(current.pageViews, previous.pageViews)
                    : 'GA4 unavailable',
                  expanded: {
                    type: 'table',
                    title: stat.label,
                    columns: metricColumns,
                    rows: [
                      {
                        label: 'Page views, last 7 days',
                        value
                      },
                      {
                        label: 'Previous 7 days',
                        value: ga4.available
                          ? formatCount(previous.pageViews)
                          : '-'
                      }
                    ]
                  }
                };
              }
              if (stat.label === 'Bounce Rate') {
                const value = ga4.available
                  ? formatPercentage(current.bounceRate)
                  : '-';
                const difference =
                  ga4.available && Number.isFinite(Number(previous.bounceRate))
                    ? (Number(current.bounceRate) - Number(previous.bounceRate)) *
                      100
                    : null;
                return {
                  ...stat,
                  value,
                  detail:
                    difference === null
                      ? 'GA4 unavailable'
                      : `${difference >= 0 ? '+' : ''}${difference.toFixed(1)} points vs prior 7d`,
                  expanded: {
                    type: 'table',
                    title: stat.label,
                    columns: metricColumns,
                    rows: [
                      { label: 'Last 7 days', value },
                      {
                        label: 'Previous 7 days',
                        value: ga4.available
                          ? formatPercentage(previous.bounceRate)
                          : '-'
                      },
                      {
                        label: 'Signup attribution coverage',
                        value: `${stats.attributionCoverage ?? 0}%`
                      }
                    ]
                  }
                };
              }
              return stat;
            });
            return;
          }

          if (gridConfig.id === 'analytics-grid-3') {
            gridConfig.rows = Array.isArray(analyticsData.popularPages)
              ? analyticsData.popularPages
              : [];
            return;
          }

          if (gridConfig.id === 'analytics-grid-4') {
            gridConfig.alerts = Array.isArray(analyticsData.alerts)
              ? analyticsData.alerts
              : [];
            return;
          }

          if (!Array.isArray(gridConfig.calendarSeries)) return;
          gridConfig.calendarSeries = gridConfig.calendarSeries.map((series) => ({
            ...series,
            counts: gaActivity[series.value] || activity[series.value] || {}
          }));
          gridConfig.counts = gridConfig.calendarSeries[0]?.counts || {};
        });

        return true;
      }

      return false;
    }

    return { hydrateSection };
  }

  window.createOePanelAnalyticsInsightsHydrator = createOePanelAnalyticsInsightsHydrator;
})();
