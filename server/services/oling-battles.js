const {
  DEFAULT_MATCH_LENGTH_SECONDS,
  MATCH_CODE_PATTERN
} = require('./oling-battles/constants');
const {
  assertMatchCode,
  generateMatchCode,
  generateUniqueMatchCode
} = require('./oling-battles/match-codes');
const {
  getBattleTimeMultiplier,
  getMatchTiming,
  serializeBattleMatch
} = require('./oling-battles/match-view');
const {
  createBattleMatch,
  getBattleMatch,
  joinBattleMatch,
  readyBattlePlayer,
  startBattleMatch
} = require('./oling-battles/match-lifecycle');
const { addAiBattleOpponent } = require('./oling-battles/ai-opponent');
const {
  resolveAiBattleHit,
  resolveBattleHit
} = require('./oling-battles/battle-hits');
const {
  kickBattleOpponent,
  leaveBattleMatch,
  selectBattlePlayerOling
} = require('./oling-battles/match-participants');
const { emitBattleUpdate, recordBattleEvent } = require('./oling-battles/events');
const { snapshotBattleOling } = require('./oling-battles/battle-players');

module.exports = {
  DEFAULT_MATCH_LENGTH_SECONDS,
  MATCH_CODE_PATTERN,
  addAiBattleOpponent,
  assertMatchCode,
  createBattleMatch,
  emitBattleUpdate,
  generateMatchCode,
  generateUniqueMatchCode,
  getBattleMatch,
  getBattleTimeMultiplier,
  getMatchTiming,
  joinBattleMatch,
  kickBattleOpponent,
  leaveBattleMatch,
  readyBattlePlayer,
  recordBattleEvent,
  resolveAiBattleHit,
  resolveBattleHit,
  selectBattlePlayerOling,
  serializeBattleMatch,
  snapshotBattleOling,
  startBattleMatch
};
