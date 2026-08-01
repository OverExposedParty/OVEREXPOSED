function createGamemodeSettingsContext(context) {
  const {
    formatOePanelDateTime,
    formatPartyGameLabel,
    formatReportLabel,
    parseBooleanLabel,
    GamemodeSettingsAlert
  } = context;

  function serializeGamemodeSettingsAlert(alert) {
    const changeList = Array.isArray(alert.changes) ? alert.changes : [];
    return {
      id: String(alert._id || ''),
      severity: alert.severity || 'info',
      title:
        alert.title ||
        `${formatReportLabel(alert.action)} ${alert.itemType || 'setting'}`,
      detail: [formatPartyGameLabel(alert.gamemode), changeList.join(', ')]
        .filter((value) => value && value !== '-')
        .join(' - '),
      createdAt: formatOePanelDateTime(alert.system?.createdAt),
      action: formatReportLabel(alert.action),
      itemType: formatReportLabel(alert.itemType),
      itemTitle: alert.title || '-',
      gamemode: formatPartyGameLabel(alert.gamemode),
      changes: changeList.length ? changeList.join(', ') : '-',
      admin: alert.admin?.usernameSnapshot || '-',
      exportNeeded: alert.exportNeeded !== false && !alert.resolvedAt,
      resolvedAt: formatOePanelDateTime(alert.resolvedAt)
    };
  }

  async function createGamemodeSettingsAlert(account, alertData) {
    if (!['pack', 'rule', 'role'].includes(alertData.itemType)) return null;

    return GamemodeSettingsAlert.create({
      action: alertData.action || 'updated',
      itemType: alertData.itemType,
      itemKey: alertData.itemKey || '-',
      title: alertData.title || 'Gamemode setting',
      gamemode: alertData.gamemode || '-',
      severity: alertData.severity || 'info',
      changes: Array.isArray(alertData.changes) ? alertData.changes : [],
      exportNeeded: true,
      resolvedAt: null,
      admin: {
        accountId: account?._id || null,
        usernameSnapshot:
          account?.profile?.displayName || account?.username || '-'
      }
    });
  }

  function getGamemodeSettingsAlertAction(changedValues = {}) {
    const status = String(changedValues.status || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
    if (status === 'draft') return 'drafted';
    if (status === 'published') return 'published';
    if (status === 'archived') return 'archived';

    if (Object.prototype.hasOwnProperty.call(changedValues, 'active')) {
      const enabled = parseBooleanLabel(changedValues.active);
      if (enabled === true) return 'enabled';
      if (enabled === false) return 'disabled';
    }

    return 'updated';
  }

  function getGamemodeSettingsAlertQuery(filter) {
    const query = { itemType: { $in: ['pack', 'rule', 'role'] } };
    if (filter === 'export-needed') {
      query.exportNeeded = true;
      query.resolvedAt = null;
    }
    return query;
  }

  return {
    serializeGamemodeSettingsAlert,
    createGamemodeSettingsAlert,
    getGamemodeSettingsAlertAction,
    getGamemodeSettingsAlertQuery
  };
}

module.exports = {
  createGamemodeSettingsContext
};
