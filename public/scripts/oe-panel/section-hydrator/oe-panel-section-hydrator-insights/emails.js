(function () {
  function createOePanelEmailInsightsHydrator({ panelData }) {
    async function hydrateSection(sectionName, nextConfig) {
      if (sectionName !== 'Emails') return false;

      const emailData = await panelData.fetchEmailTemplatesData();
      const templates = Array.isArray(emailData.templates)
        ? emailData.templates
        : [];

      nextConfig.forEach((gridConfig) => {
        if (gridConfig.id !== 'emails-grid-2') return;
        const templateSeries = gridConfig.tableSeries?.find(
          (series) => series.value === 'templates'
        );
        if (templateSeries) templateSeries.rows = templates;
      });

      return true;
    }

    return { hydrateSection };
  }

  window.createOePanelEmailInsightsHydrator =
    createOePanelEmailInsightsHydrator;
})();
