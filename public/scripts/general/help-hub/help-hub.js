const helpHubData = window.createHelpHubData();
const helpHubContent = window.createHelpHubContent(helpHubData);
const helpHubView = window.createHelpHubView({
  ...helpHubData,
  ...helpHubContent,
  getCurrentAccount:
    typeof window.getStoredSettingsAccount === 'function'
      ? window.getStoredSettingsAccount
      : () => null,
  canAccessFeature:
    typeof window.canAccountAccessExtraMenuFeature === 'function'
      ? window.canAccountAccessExtraMenuFeature
      : () => false
});

var renderHelpHub = function () {
  helpHubView.renderHelpHub();
};

helpHubView.initializeHelpHub();
