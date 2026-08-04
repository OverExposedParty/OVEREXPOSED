(function () {
  function createOePanelEmailInsightsHydrator({ panelData }) {
    async function hydrateSection(sectionName, nextConfig) {
      if (sectionName !== 'Emails') return false;

      const [
        emailData,
        automationData,
        audienceData,
        suppressionData,
        performanceData
      ] = await Promise.all([
        panelData.fetchEmailTemplatesData({ force: true }),
        panelData.fetchEmailAutomationsData({ force: true }),
        panelData.fetchEmailAudiencesData({ force: true }),
        panelData.fetchEmailSuppressionsData({ force: true }),
        panelData.fetchEmailPerformanceData({ force: true })
      ]);
      const templates = Array.isArray(emailData.templates)
        ? emailData.templates
        : [];
      const automations = Array.isArray(automationData.automations)
        ? automationData.automations
        : [];
      const audiences = Array.isArray(audienceData.audiences)
        ? audienceData.audiences
        : [];
      const suppressions = Array.isArray(suppressionData.suppressions)
        ? suppressionData.suppressions
        : [];

      nextConfig.forEach((gridConfig) => {
        if (gridConfig.id === 'emails-grid-1') {
          const stats = performanceData.stats || {};
          gridConfig.stats = (gridConfig.stats || []).map((stat) => ({
            ...stat,
            ...(stats[stat.key] || {})
          }));
        }
        if (gridConfig.id === 'emails-grid-3') {
          const trends = performanceData.trends || {};
          gridConfig.labels = Array.isArray(trends.labels)
            ? trends.labels
            : gridConfig.labels;
          gridConfig.series = (gridConfig.series || []).map((series) => ({
            ...series,
            values: Array.isArray(trends.series?.[series.key])
              ? trends.series[series.key]
              : []
          }));
        }
        if (gridConfig.id !== 'emails-grid-2') return;
        const failureSeries = gridConfig.tableSeries?.find(
          (series) => series.value === 'failures'
        );
        if (failureSeries) {
          failureSeries.rows = performanceData.failures?.length
            ? performanceData.failures
            : [
                {
                  email: 'No failed sends',
                  reason: '-',
                  date: '-',
                  status: '-'
                }
              ];
        }
        const templateSeries = gridConfig.tableSeries?.find(
          (series) => series.value === 'templates'
        );
        if (templateSeries) templateSeries.rows = templates;
        const automationSeries = gridConfig.tableSeries?.find(
          (series) => series.value === 'automations'
        );
        if (automationSeries) automationSeries.rows = automations;
        const audienceSeries = gridConfig.tableSeries?.find(
          (series) => series.value === 'audiences'
        );
        if (audienceSeries) audienceSeries.rows = audiences;
        const suppressionSeries = gridConfig.tableSeries?.find(
          (series) => series.value === 'suppressions'
        );
        if (suppressionSeries) suppressionSeries.rows = suppressions;
      });

      return true;
    }

    return { hydrateSection };
  }

  window.createOePanelEmailInsightsHydrator =
    createOePanelEmailInsightsHydrator;
})();
