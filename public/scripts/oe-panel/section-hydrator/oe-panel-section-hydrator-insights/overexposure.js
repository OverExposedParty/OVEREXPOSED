(function () {
  function createOePanelOverexposureInsightsHydrator({ panelData }) {
    async function hydrateSection(sectionName, nextConfig) {
      if (sectionName === 'OverExposure') {
        const [posts, dashboardData] = await Promise.all([
          panelData.fetchOverexposurePostsData(),
          panelData.fetchOverexposureDashboardData()
        ]);
        const stats = dashboardData.stats || {};
        const reportedContent = Array.isArray(dashboardData.reportedContent)
          ? dashboardData.reportedContent
          : [];

        nextConfig.forEach((gridConfig) => {
          if (gridConfig.dataSource === 'overexposurePosts') {
            gridConfig.rows = posts;
            return;
          }

          if (
            gridConfig.id === 'overexposure-grid-2' &&
            Array.isArray(gridConfig.stats)
          ) {
            const statTableColumns = [
              { key: 'label', label: 'Metric' },
              { key: 'value', label: 'Value' }
            ];
            gridConfig.stats = gridConfig.stats.map((stat) => {
              if (stat.label === 'Total Posts') {
                return {
                  ...stat,
                  value: String(stats.totalPosts ?? 0),
                  expanded: {
                    type: 'table',
                    title: 'Total Posts',
                    columns: statTableColumns,
                    rows: [
                      { label: 'All posts', value: stats.totalPosts ?? 0 },
                      {
                        label: 'Published today',
                        value: stats.publishedToday ?? 0
                      },
                      { label: 'Open reports', value: stats.pendingReview ?? 0 }
                    ]
                  }
                };
              }
              if (stat.label === 'Pending Review') {
                return {
                  ...stat,
                  value: String(stats.pendingReview ?? 0),
                  detail: `${stats.highPriorityReports ?? 0} high priority`,
                  expanded: {
                    type: 'table',
                    title: 'Pending Review',
                    columns: statTableColumns,
                    rows: [
                      { label: 'Open reports', value: stats.pendingReview ?? 0 },
                      {
                        label: 'High priority',
                        value: stats.highPriorityReports ?? 0
                      }
                    ]
                  }
                };
              }
              if (stat.label === 'Reports') {
                return {
                  ...stat,
                  value: String(stats.reportsLast24Hours ?? 0),
                  detail: 'last 24h',
                  expanded: {
                    type: 'table',
                    title: 'Reports',
                    columns: statTableColumns,
                    rows: [
                      {
                        label: 'Last 24h',
                        value: stats.reportsLast24Hours ?? 0
                      },
                      { label: 'Open reports', value: stats.pendingReview ?? 0 },
                      {
                        label: 'High priority',
                        value: stats.highPriorityReports ?? 0
                      }
                    ]
                  }
                };
              }
              if (stat.label === 'Published Today') {
                return {
                  ...stat,
                  value: String(stats.publishedToday ?? 0),
                  expanded: {
                    type: 'table',
                    title: 'Published Today',
                    columns: statTableColumns,
                    rows: [
                      {
                        label: 'Published today',
                        value: stats.publishedToday ?? 0
                      },
                      { label: 'All posts', value: stats.totalPosts ?? 0 }
                    ]
                  }
                };
              }
              return stat;
            });
            return;
          }

          if (gridConfig.id === 'overexposure-grid-3') {
            gridConfig.alerts = reportedContent;
            gridConfig.visibleAlerts = 8;
          }
        });

        return true;
      }

      return false;
    }

    return { hydrateSection };
  }

  window.createOePanelOverexposureInsightsHydrator = createOePanelOverexposureInsightsHydrator;
})();
