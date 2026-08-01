(function () {
  function createOePanelInsightsHydrator({ panelData }) {
    const sectionHydrators = [
      window.createOePanelEmailInsightsHydrator({ panelData }),
      window.createOePanelSocialInsightsHydrator({ panelData }),
      window.createOePanelAnalyticsInsightsHydrator({ panelData }),
      window.createOePanelDashboardInsightsHydrator({ panelData }),
      window.createOePanelOverexposureInsightsHydrator({ panelData }),
      window.createOePanelPartyGamesInsightsHydrator({ panelData })
    ];

    async function hydrateSection(sectionName, nextConfig) {
      for (const hydrator of sectionHydrators) {
        if (await hydrator.hydrateSection(sectionName, nextConfig)) {
          return true;
        }
      }

      return false;
    }

    return { hydrateSection };
  }

  window.createOePanelInsightsHydrator = createOePanelInsightsHydrator;
})();
