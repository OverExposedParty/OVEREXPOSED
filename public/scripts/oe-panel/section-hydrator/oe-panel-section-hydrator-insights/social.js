(function () {
  function createOePanelSocialInsightsHydrator({ panelData }) {
    async function hydrateSection(sectionName, nextConfig) {
      if (sectionName === 'Social Media') {
        const socialMediaData = await panelData.fetchSocialMediaData();
        const rows = socialMediaData.rows || [];
        const stats = socialMediaData.stats || {};
        const alerts = Array.isArray(socialMediaData.alerts)
          ? socialMediaData.alerts
          : [];
        const scheduledCounts = rows.reduce((counts, row) => {
          if (!row.postDate || row.postDate === '-') return counts;
          counts[row.postDate] = Number(counts[row.postDate] || 0) + 1;
          return counts;
        }, {});
        const statTableColumns = [
          { key: 'label', label: 'Metric' },
          { key: 'value', label: 'Value' }
        ];

        nextConfig.forEach((gridConfig) => {
          if (gridConfig.dataSource === 'socialMediaContent') {
            gridConfig.rows = rows;
            return;
          }

          if (
            gridConfig.id === 'social-media-grid-1' &&
            Array.isArray(gridConfig.stats)
          ) {
            gridConfig.stats = gridConfig.stats.map((stat) => {
              if (stat.label === 'Ideas') {
                return {
                  ...stat,
                  value: String(stats.ideaItems ?? 0),
                  detail: `${stats.totalItems ?? 0} total`,
                  expanded: {
                    type: 'table',
                    title: 'Ideas',
                    columns: statTableColumns,
                    rows: [
                      { label: 'Ideas', value: stats.ideaItems ?? 0 },
                      { label: 'Ready', value: stats.readyItems ?? 0 }
                    ]
                  }
                };
              }
              if (stat.label === 'Drafts') {
                return {
                  ...stat,
                  value: String(stats.draftItems ?? 0),
                  detail: `${stats.readyItems ?? 0} ready`,
                  expanded: {
                    type: 'table',
                    title: 'Drafts',
                    columns: statTableColumns,
                    rows: [
                      { label: 'Drafts', value: stats.draftItems ?? 0 },
                      { label: 'Ready', value: stats.readyItems ?? 0 }
                    ]
                  }
                };
              }
              if (stat.label === 'Scheduled') {
                return {
                  ...stat,
                  value: String(stats.scheduledItems ?? 0),
                  detail:
                    stats.nextPostDate && stats.nextPostDate !== '-'
                      ? `next ${stats.nextPostDate}`
                      : '-',
                  expanded: {
                    type: 'table',
                    title: 'Scheduled',
                    columns: statTableColumns,
                    rows: [
                      {
                        label: 'Scheduled content',
                        value: stats.scheduledItems ?? 0
                      },
                      { label: 'Next slot', value: stats.nextPostDate || '-' }
                    ]
                  }
                };
              }
              if (stat.label === 'Uploaded') {
                return {
                  ...stat,
                  value: String(stats.uploadedItems ?? 0),
                  detail: 'content library',
                  expanded: {
                    type: 'table',
                    title: 'Uploaded',
                    columns: statTableColumns,
                    rows: [
                      {
                        label: 'Uploaded content',
                        value: stats.uploadedItems ?? 0
                      }
                    ]
                  }
                };
              }
              return stat;
            });
            return;
          }

          if (gridConfig.id === 'social-media-grid-3') {
            gridConfig.counts = scheduledCounts;
            return;
          }

          if (gridConfig.id === 'social-media-grid-4') {
            gridConfig.alerts = alerts;
          }
        });

        return true;
      }

      return false;
    }

    return { hydrateSection };
  }

  window.createOePanelSocialInsightsHydrator = createOePanelSocialInsightsHydrator;
})();
