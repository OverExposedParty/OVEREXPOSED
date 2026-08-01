const DEFAULT_ROUND_LIMITS = Object.freeze({
  'most-likely-to': 20,
  'never-have-i-ever': 20,
  'would-you-rather': 20,
  'truth-or-dare': 5,
  paranoia: 5,
  imposter: 5
});

function getRuleValue(gameRules, key) {
  if (!gameRules) return undefined;
  if (typeof gameRules.get === 'function') return gameRules.get(key);
  return gameRules[key];
}

function getConfiguredRoundLimit({ gamemode, gameRules }) {
  const fallback = DEFAULT_ROUND_LIMITS[gamemode] ?? null;
  if (fallback == null) return null;

  const configured = Number(getRuleValue(gameRules, 'rounds'));
  const limit =
    Number.isFinite(configured) && configured > 0
      ? Math.floor(configured)
      : fallback;

  return limit == null ? null : Math.min(50, Math.max(1, limit));
}

function completeConfiguredRound({
  gamemode,
  config,
  state,
  shouldCount = true
}) {
  if (!shouldCount) return false;

  const limit = getConfiguredRoundLimit({
    gamemode,
    gameRules: config?.gameRules
  });
  if (limit == null) return false;

  state.completedRounds = Math.max(0, Number(state.completedRounds) || 0) + 1;
  if (state.completedRounds < limit) return false;

  config.userInstructions = 'GAME_OVER';
  state.userInstructions = 'GAME_OVER';
  state.isPlaying = false;
  state.phase = 'game-over';
  state.phaseData = null;
  state.timer = null;
  state.lastPinged = new Date();
  return true;
}

module.exports = {
  DEFAULT_ROUND_LIMITS,
  completeConfiguredRound,
  getConfiguredRoundLimit
};
