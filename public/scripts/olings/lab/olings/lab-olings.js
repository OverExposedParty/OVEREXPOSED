(function () {
  function createOlingViews({ state, elements, helpers }) {
    const previewTools = window.createOlingLabPreviewTools({ state, helpers });
    const buildTools = window.createOlingLabBuildTools({
      state,
      helpers,
      previewTools
    });
    const storageTools = window.createOlingLabStorageTools({
      state,
      elements,
      helpers,
      previewTools
    });
    const inspectTools = window.createOlingLabInspectTools({
      state,
      elements,
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
      createPodArtwork: storageTools.createPodArtwork,
      getStoredOlings: storageTools.getStoredOlings,
      createRevealMenu: revealTools.createRevealMenu,
      openOlingMenu: inspectTools.openOlingMenu,
      closeOlingPanel: inspectTools.closeOlingPanel,
      createStoredOlingsSection: storageTools.createStoredOlingsSection,
      openStoredOlingsMenu: storageTools.openStoredOlingsMenu,
      closeStoragePanel: storageTools.closeStoragePanel,
      updateOlingPodDropTarget: storageTools.updateOlingPodDropTarget,
      getOlingStorageDropTarget: storageTools.getOlingStorageDropTarget,
      captureDraggedOling: storageTools.captureDraggedOling,
      clearOlingPodDropTarget: storageTools.clearOlingPodDropTarget
    };
  }

  window.OlingLabOlings = {
    create: createOlingViews
  };
})();
