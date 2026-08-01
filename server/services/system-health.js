const DATABASE_PING_TIMEOUT_MS = 1500;

const CONNECTION_STATE_LABELS = {
  0: 'Disconnected',
  1: 'Connected',
  2: 'Connecting',
  3: 'Disconnecting'
};

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return '-';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let amount = bytes;
  let unitIndex = 0;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }

  const precision = amount >= 10 || unitIndex === 0 ? 0 : 1;
  return `${amount.toFixed(precision)} ${units[unitIndex]}`;
}

function formatUptime(value) {
  const totalSeconds = Math.max(0, Math.floor(Number(value) || 0));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  return [days ? `${days}d` : '', hours ? `${hours}h` : '', `${minutes}m`]
    .filter(Boolean)
    .join(' ');
}

async function measureDatabaseConnection({ label, connection }) {
  const readyState = Number(connection?.readyState ?? 0);
  const state = CONNECTION_STATE_LABELS[readyState] || 'Unknown';
  if (readyState !== 1 || !connection?.db) {
    return { label, state, connected: false, latencyMs: null };
  }

  const startedAt = Date.now();
  let timeoutId;
  try {
    await Promise.race([
      connection.db.admin().ping(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('Database ping timed out.')),
          DATABASE_PING_TIMEOUT_MS
        );
      })
    ]);

    return {
      label,
      state: 'Connected',
      connected: true,
      latencyMs: Date.now() - startedAt
    };
  } catch (error) {
    return {
      label,
      state: 'Unresponsive',
      connected: false,
      latencyMs: null,
      error: error.message
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function measureDatabaseConnections(connections) {
  return Promise.all(connections.map(measureDatabaseConnection));
}

function getRuntimeSnapshot() {
  const memory = process.memoryUsage();
  const uptimeSeconds = process.uptime();
  const heapUsagePercent = memory.heapTotal
    ? Math.round((memory.heapUsed / memory.heapTotal) * 100)
    : 0;

  return {
    uptimeSeconds,
    uptime: formatUptime(uptimeSeconds),
    startedAt: new Date(Date.now() - uptimeSeconds * 1000).toISOString(),
    nodeVersion: process.version,
    platform: `${process.platform} ${process.arch}`,
    processId: process.pid,
    memory: {
      rss: memory.rss,
      rssLabel: formatBytes(memory.rss),
      heapUsed: memory.heapUsed,
      heapUsedLabel: formatBytes(memory.heapUsed),
      heapTotal: memory.heapTotal,
      heapTotalLabel: formatBytes(memory.heapTotal),
      heapUsagePercent
    }
  };
}

module.exports = {
  formatBytes,
  formatUptime,
  getRuntimeSnapshot,
  measureDatabaseConnection,
  measureDatabaseConnections
};
