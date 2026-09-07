(function () {
  function createOlingLabData(dependencies) {
    return {
      ...window.createOlingLabCatalogSelectors(dependencies),
      ...window.createOlingLabInventorySelectors(dependencies),
      ...window.createOlingLabHatchSelectors(dependencies),
      ...window.createOlingLabRarityTheme(dependencies)
    };
  }
  window.createOlingLabData = createOlingLabData;
})();
