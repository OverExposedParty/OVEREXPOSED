(function () {
  function createOePanelDashboardInsightsHydrator({ panelData }) {
    async function hydrateSection(sectionName, nextConfig) {
      if (sectionName === 'Dashboard') {
        const [activity, overview, adminLogsData] = await Promise.all([
          panelData.fetchDashboardActivityData(),
          sectionName === 'Dashboard'
            ? panelData.fetchDashboardOverviewData()
            : Promise.resolve({}),
          sectionName === 'Dashboard'
            ? panelData.fetchAdminLogsData()
            : Promise.resolve({ logs: [] })
        ]);
        const dashboardEvents = Array.isArray(adminLogsData.logs)
          ? adminLogsData.logs.slice(0, 12).map((log) => ({
              title: log.action || 'Dashboard event',
              severity: log.result === 'failed' ? 'high' : log.severity || 'low',
              area: log.area || '-',
              detail: [log.admin, log.target].filter(Boolean).join(' - '),
              time: log.time || '-',
              log
            }))
          : [];

        nextConfig.forEach((gridConfig) => {
          if (
            gridConfig.id === 'dashboard-grid-1' &&
            Array.isArray(gridConfig.stats)
          ) {
            const statTableColumns = [
              { key: 'label', label: 'Metric' },
              { key: 'value', label: 'Value' }
            ];
            gridConfig.stats = gridConfig.stats.map((stat) => {
              if (stat.label === 'Active Users') {
                const value =
                  overview.activeUsers === undefined
                    ? '-'
                    : String(overview.activeUsers);
                return {
                  ...stat,
                  value,
                  detail: value === '-' ? '-' : 'last 15m',
                  expanded: {
                    type: 'table',
                    title: 'Active Users',
                    columns: statTableColumns,
                    rows: [{ label: 'Active users last 15m', value }]
                  }
                };
              }
              if (stat.label === 'Live Rooms') {
                const value =
                  overview.liveRooms === undefined
                    ? '-'
                    : String(overview.liveRooms);
                return {
                  ...stat,
                  value,
                  detail: value === '-' ? '-' : 'active rooms',
                  expanded: {
                    type: 'table',
                    title: 'Live Rooms',
                    columns: statTableColumns,
                    rows: [{ label: 'Live rooms', value }]
                  }
                };
              }
              if (stat.label === 'Pending Reports') {
                const value =
                  overview.pendingReports === undefined
                    ? '-'
                    : String(overview.pendingReports);
                const urgent =
                  overview.urgentReports === undefined
                    ? '-'
                    : String(overview.urgentReports);
                return {
                  ...stat,
                  value,
                  detail: urgent === '-' ? '-' : `${urgent} urgent`,
                  expanded: {
                    type: 'table',
                    title: 'Pending Reports',
                    columns: statTableColumns,
                    rows: [
                      { label: 'Open or reviewing', value },
                      { label: 'Urgent', value: urgent }
                    ]
                  }
                };
              }
              if (stat.label === 'Shop Revenue') {
                const value = overview.shopRevenueLast24h?.value || '-';
                return {
                  ...stat,
                  value,
                  detail: value === '-' ? '-' : 'last 24h',
                  expanded: {
                    type: 'table',
                    title: 'Shop Revenue',
                    columns: statTableColumns,
                    rows: [
                      { label: 'Revenue last 24h', value },
                      {
                        label: 'Currency',
                        value: overview.shopRevenueLast24h?.currency || '-'
                      }
                    ]
                  }
                };
              }
              return stat;
            });
            return;
          }

          if (gridConfig.id === 'dashboard-grid-3') {
            gridConfig.dashboardEvents = dashboardEvents;
            gridConfig.alertCounts = {
              ...(gridConfig.alertCounts || {}),
              dashboardRecentEvents: dashboardEvents.length
            };
            return;
          }

          if (!Array.isArray(gridConfig.calendarSeries)) return;

          gridConfig.calendarSeries = gridConfig.calendarSeries.map((series) => ({
            ...series,
            counts: activity[series.value] || {}
          }));
          gridConfig.counts = gridConfig.calendarSeries[0]?.counts || {};
        });

        return true;
      }

      return false;
    }

    return { hydrateSection };
  }

  window.createOePanelDashboardInsightsHydrator = createOePanelDashboardInsightsHydrator;
})();
