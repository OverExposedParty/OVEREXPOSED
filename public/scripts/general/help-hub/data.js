(function () {
  function createHelpHubData() {
    return {
      ...window.createHelpHubPageConfigs(),
      ...window.createHelpHubModeConfigs(),
      ...window.createHelpHubTopicCopy()
    };
  }

  window.createHelpHubData = createHelpHubData;
})();
