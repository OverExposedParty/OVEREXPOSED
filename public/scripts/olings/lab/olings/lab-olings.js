(function () {
  function createOlingViews({ state, helpers }) {
    const previewTools = window.createOlingLabPreviewTools({ state, helpers });
    const buildTools = window.createOlingLabBuildTools({
      state,
      helpers,
      previewTools
    });
    const inspectTools = window.createOlingLabInspectTools({
      state,
      helpers,
      previewTools,
      buildTools
    });
    const revealTools = window.createOlingLabRevealTools({
      state,
      helpers,
      previewTools,
      buildTools
    });

    return {
      createEnergyMeter: previewTools.createEnergyMeter,
      createPreview: previewTools.createPreview,
      createRevealMenu: revealTools.createRevealMenu,
      openOlingMenu: inspectTools.openOlingMenu
    };
  }

  window.OlingLabOlings = {
    create: createOlingViews
  };
})();
