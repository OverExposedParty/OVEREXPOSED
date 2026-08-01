const OE_PANEL_ROLES = new Set([
  'owner',
  'admin',
  'support',
  'moderator',
  'special'
]);

const SYSTEM_FEATURE_FLAGS = [
  { key: 'maintenance-mode', label: 'Maintenance Mode', area: 'Global' },
  { key: 'signup-enabled', label: 'Signup Enabled', area: 'Accounts' },
  {
    key: 'party-rooms-enabled',
    label: 'Party Rooms Enabled',
    area: 'Party Games'
  },
  { key: 'reports-enabled', label: 'Reports Enabled', area: 'Moderation' }
];

function formatSystemConfigDate(value) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString();
}

function formatAdminLogDateTime(value) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString();
}

function summarizeAdminLogValue(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;

  const text =
    typeof value === 'string'
      ? value
      : JSON.stringify(value, (key, entry) => {
          if (key === '_id' && entry) return String(entry);
          return entry;
        });

  if (!text) return fallback;
  return text.length > 480 ? `${text.slice(0, 477)}...` : text;
}

async function createAdminLog(AdminLog, account, logData) {
  try {
    await AdminLog.create({
      admin: {
        accountId: account?.developmentBypass ? null : account?._id || null,
        usernameSnapshot: account?.username || 'Development'
      },
      action: logData.action,
      area: logData.area,
      target: logData.target || {},
      previousValue: summarizeAdminLogValue(logData.previousValue),
      newValue: summarizeAdminLogValue(logData.newValue),
      result: logData.result || 'success',
      severity: logData.severity || 'low',
      note: logData.note || '-',
      metadata: logData.metadata || {}
    });
  } catch (error) {
    console.error('Failed to create admin log:', error);
  }
}

function serializeAdminLog(log) {
  const createdAt = log.system?.createdAt;

  return {
    time: formatAdminLogDateTime(createdAt),
    date: createdAt ? new Date(createdAt).toISOString().slice(0, 10) : '-',
    admin: log.admin?.usernameSnapshot || '-',
    action: log.action || '-',
    area: log.area || '-',
    target: log.target?.label || log.target?.id || '-',
    result: log.result || '-',
    severity: log.severity || 'low',
    previousValue: log.previousValue || '-',
    newValue: log.newValue || '-',
    targetType: log.target?.type || '-',
    targetId: log.target?.id || '-',
    note: log.note || '-',
    logId: String(log._id)
  };
}

module.exports = {
  OE_PANEL_ROLES,
  SYSTEM_FEATURE_FLAGS,
  createAdminLog,
  formatSystemConfigDate,
  serializeAdminLog
};
