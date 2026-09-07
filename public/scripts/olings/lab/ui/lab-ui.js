(function () {
  function createOlingLabUi(dependencies) {
    return {
      ...window.createOlingLabUiElements(dependencies),
      ...window.createOlingLabFormatters(),
      createTabMenu: window.createOlingLabTabMenuFactory(dependencies)
    };
  }
  window.createOlingLabUi = createOlingLabUi;
})();
