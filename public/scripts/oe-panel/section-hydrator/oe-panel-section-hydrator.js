(function () {
  function createOePanelSectionHydrator({ panelData }) {
    const sectionHydrators = [
      window.createOePanelCatalogHydrator({ panelData }),
      window.createOePanelOperationsHydrator({ panelData }),
      window.createOePanelInsightsHydrator({ panelData })
    ];

    function cloneGridConfig(gridConfig) {
      return {
        ...gridConfig,
        columns: Array.isArray(gridConfig.columns)
          ? gridConfig.columns.map((column) => ({ ...column }))
          : undefined,
        rows: Array.isArray(gridConfig.rows)
          ? gridConfig.rows.map((row) => ({ ...row }))
          : undefined,
        stats: Array.isArray(gridConfig.stats)
          ? gridConfig.stats.map((stat) => ({ ...stat }))
          : undefined,
        actions: Array.isArray(gridConfig.actions)
          ? gridConfig.actions.map((action) => ({
              ...action,
              widget:
                action.widget && typeof action.widget === 'object'
                  ? { ...action.widget }
                  : action.widget
            }))
          : undefined,
        tableSeries: Array.isArray(gridConfig.tableSeries)
          ? gridConfig.tableSeries.map((series) => ({
              ...series,
              columns: Array.isArray(series.columns)
                ? series.columns.map((column) => ({ ...column }))
                : undefined,
              rows: Array.isArray(series.rows)
                ? series.rows.map((row) => ({ ...row }))
                : undefined,
              expandedFields: Array.isArray(series.expandedFields)
                ? series.expandedFields.map((field) => ({ ...field }))
                : undefined
            }))
          : undefined
      };
    }

    async function hydrateSectionConfig(sectionName, sectionGridConfig) {
      const nextConfig = sectionGridConfig.map(cloneGridConfig);

      for (const hydrator of sectionHydrators) {
        if (await hydrator.hydrateSection(sectionName, nextConfig)) {
          return nextConfig;
        }
      }

      return nextConfig;
    }

    return { hydrateSectionConfig };
  }

  window.createOePanelSectionHydrator = createOePanelSectionHydrator;
})();
