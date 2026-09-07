const CLASH_FLOW_DURATIONS = Object.freeze({
  action: 15000,
  actionSubmittedHold: 1100,
  drawResult: 3200,
  locked: 1500,
  result: 1800,
  reveal: 2500,
  tagged: 1400
});

function getRoundPlaybackDuration(result = {}) {
  const responseDelay = Math.max(0, Number(result.responseDelayMs) || 0);
  const resultDuration =
    result.outcome === 'draw'
      ? CLASH_FLOW_DURATIONS.drawResult
      : CLASH_FLOW_DURATIONS.result;
  const tagDuration =
    (Array.isArray(result.tags) ? result.tags.length : 0) *
    CLASH_FLOW_DURATIONS.tagged;
  return (
    responseDelay +
    CLASH_FLOW_DURATIONS.locked +
    CLASH_FLOW_DURATIONS.reveal +
    resultDuration +
    tagDuration
  );
}

function getSelectionDeadline(result = null, now = Date.now()) {
  const playbackDuration = result ? getRoundPlaybackDuration(result) : 0;
  return new Date(Number(now) + playbackDuration + CLASH_FLOW_DURATIONS.action);
}

function parseClashTimestamp(value) {
  return value instanceof Date ? value.getTime() : Date.parse(value);
}

module.exports = {
  CLASH_FLOW_DURATIONS,
  getRoundPlaybackDuration,
  getSelectionDeadline,
  parseClashTimestamp
};
