const { normalizeMatchLengthSeconds } = require('./match-codes');

function getBattleTimeMultiplier(remainingRatio, isOvertime = false) {
  if (isOvertime) return 2;
  if (remainingRatio > 0.75) return 1;
  if (remainingRatio > 0.5) return 1.15;
  if (remainingRatio > 0.25) return 1.35;
  return 1.6;
}

function getMatchTiming(match, now = new Date()) {
  const startedAt = match?.state?.startedAt
    ? new Date(match.state.startedAt)
    : null;
  const matchLengthSeconds = normalizeMatchLengthSeconds(
    match?.config?.matchLengthSeconds
  );

  if (!startedAt || Number.isNaN(startedAt.getTime())) {
    return {
      elapsedSeconds: 0,
      isOvertime: false,
      matchLengthSeconds,
      remainingRatio: 1,
      remainingSeconds: matchLengthSeconds,
      timeMultiplier: 1
    };
  }

  const elapsedSeconds = Math.max(
    0,
    (now.getTime() - startedAt.getTime()) / 1000
  );
  const remainingSeconds = Math.max(0, matchLengthSeconds - elapsedSeconds);
  const remainingRatio =
    matchLengthSeconds > 0 ? remainingSeconds / matchLengthSeconds : 0;
  const isOvertime = elapsedSeconds >= matchLengthSeconds;

  return {
    elapsedSeconds,
    isOvertime,
    matchLengthSeconds,
    remainingRatio,
    remainingSeconds,
    timeMultiplier: getBattleTimeMultiplier(remainingRatio, isOvertime)
  };
}

function serializeBattleMatch(match) {
  if (!match) return null;
  const plain = match.toObject ? match.toObject() : match;
  const timing = getMatchTiming(plain);

  return {
    id: String(plain._id || plain.id || ''),
    matchCode: plain.matchCode,
    status: plain.status,
    config: {
      matchLengthSeconds: normalizeMatchLengthSeconds(
        plain.config?.matchLengthSeconds
      )
    },
    players: (plain.players || []).map((player) => ({
      accountId: String(player.accountId || ''),
      connected: Boolean(player.connected),
      currentHealth: Number(player.currentHealth || 0),
      maxHealth: Number(player.maxHealth || 0),
      olingId: String(player.olingId || ''),
      olingSnapshot: player.olingSnapshot || {},
      playerName: player.playerName || '',
      oeIcon: player.oeIcon || '0000:0100:0200:0300',
      isAi: Boolean(player.isAi),
      aiDifficulty: Number.isFinite(Number(player.aiDifficulty))
        ? Number(player.aiDifficulty)
        : null,
      ready: Boolean(player.ready),
      slot: player.slot,
      stunUntil: player.stunUntil || null
    })),
    state: {
      ...(plain.state || {}),
      remainingSeconds: timing.remainingSeconds,
      timeMultiplier: timing.timeMultiplier
    },
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
}

module.exports = {
  getBattleTimeMultiplier,
  getMatchTiming,
  serializeBattleMatch
};
