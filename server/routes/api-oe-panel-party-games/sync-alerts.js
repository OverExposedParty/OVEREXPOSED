function getContentSyncAlertsForArea(contentSync, area) {
  return Array.isArray(contentSync?.alerts)
    ? contentSync.alerts.filter((alert) => alert.area === area)
    : [];
}

function createPartyGameSyncAlerts(contentSync) {
  return getContentSyncAlertsForArea(contentSync, 'Party Games').map(
    (alert) => ({
      title: alert.title,
      roomCode: alert.target || 'json-backup',
      detail: alert.detail,
      severity: alert.severity || 'warning',
      containerType: 'gamemode-setting',
      'container-type': 'gamemode-setting',
      createdAt: contentSync.checkedAt || new Date().toISOString(),
      syncEndpoint: alert.syncEndpoint,
      syncConfirmMessage: alert.syncConfirmMessage,
      syncSuccessMessage: alert.syncSuccessMessage,
      syncRefreshKeys: alert.syncRefreshKeys
    })
  );
}

module.exports = { createPartyGameSyncAlerts };
