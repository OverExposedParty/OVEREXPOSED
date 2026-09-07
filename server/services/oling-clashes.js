const {
  MATCH_CODE_PATTERN,
  assertMatchCode,
  generateMatchCode,
  generateUniqueMatchCode,
  normalizeMatchCode
} = require('./oling-clashes/match-codes');
const {
  assertClashPlayerEligible,
  createClashMatch,
  getClashMatch,
  getClashPlayer,
  isClashReadyToStart,
  joinClashMatch,
  markClashPlayerLoaded,
  readyClashPlayer,
  requestClashRematch,
  startClashMatch,
  updateClashTeam
} = require('./oling-clashes/match-lifecycle');
const {
  chooseClashReplacement,
  commitClashSelection,
  createRandomEffectChoice,
  finalizeExpiredClashSelections,
  getAvailableClashActions,
  isActionBlocked,
  updateClashSelectionDraft
} = require('./oling-clashes/selections');
const {
  forfeitClashMatch,
  leaveClashMatch
} = require('./oling-clashes/participants');
const { emitClashUpdate, recordClashEvent } = require('./oling-clashes/events');
const {
  serializeClashMatch,
  serializeLiveClashMatch
} = require('./oling-clashes/match-view');
const {
  archiveAndResetClash,
  archiveClashGame,
  createClashArchiveSnapshot,
  resetClashMatchForRematch
} = require('./oling-clashes/archives');
const {
  applyRoutedDamage,
  resolveCoreClashRound
} = require('./oling-clashes/round-resolution');
const {
  applyStatus,
  blockEffectCategory,
  captureDecisiveStatusTriggers,
  cleanseStatus,
  damageAfterRepeatedDecisiveAction,
  evaluateRepeatedActionMarks,
  expireRoundStatuses,
  grantOvergrowth,
  grantShields,
  getValidHeartTransferChoices,
  getValidPartWardChoices,
  getMostDamagedLivingAlly,
  getMostDamagedLivingBenchOling,
  getValidCleanseChoices,
  healPermanentHearts,
  markRepeatedActionForSuppression,
  primeStatusOnNextActionWin,
  reclaimDrawDamageAsBlood,
  recordRepeatedDecisiveActionProgress,
  resolvePendingReclaims,
  resolveDecisiveStatusTriggers,
  resolvePrimedActionWinStatuses,
  resolveRepeatedActionSuppressions,
  resolveAbilityEffects,
  suppressPart,
  suppressRandomPartUntilDifferentActionWin
} = require('./oling-clashes/ability-effects');
const {
  DEFAULT_AI_DIFFICULTY,
  addAiClashOpponent,
  chooseAiClashSelection,
  chooseAiEffectChoice,
  createAiClashPlayer,
  createAiClashTeam,
  createRandomAiOeIcon,
  getAiClashOpponent,
  updateAiClashOpponentDifficulty
} = require('./oling-clashes/ai-opponent');
const {
  CLASH_FLOW_DURATIONS,
  getRoundPlaybackDuration,
  getSelectionDeadline
} = require('./oling-clashes/timing');
const {
  advanceTagRecharge,
  consumeTagCharge,
  createInitialTagState,
  getTagRules,
  hasTagCharge,
  normalizeTagState,
  resetTagState
} = require('./oling-clashes/tag-economy');

module.exports = {
  DEFAULT_AI_DIFFICULTY,
  CLASH_FLOW_DURATIONS,
  MATCH_CODE_PATTERN,
  addAiClashOpponent,
  advanceTagRecharge,
  applyStatus,
  applyRoutedDamage,
  archiveAndResetClash,
  archiveClashGame,
  assertClashPlayerEligible,
  assertMatchCode,
  chooseClashReplacement,
  commitClashSelection,
  createRandomEffectChoice,
  finalizeExpiredClashSelections,
  getAvailableClashActions,
  isActionBlocked,
  chooseAiClashSelection,
  chooseAiEffectChoice,
  cleanseStatus,
  blockEffectCategory,
  captureDecisiveStatusTriggers,
  damageAfterRepeatedDecisiveAction,
  createClashArchiveSnapshot,
  createAiClashPlayer,
  createAiClashTeam,
  createRandomAiOeIcon,
  createClashMatch,
  createInitialTagState,
  emitClashUpdate,
  evaluateRepeatedActionMarks,
  expireRoundStatuses,
  forfeitClashMatch,
  generateMatchCode,
  generateUniqueMatchCode,
  grantOvergrowth,
  grantShields,
  getValidHeartTransferChoices,
  getValidPartWardChoices,
  getValidCleanseChoices,
  getMostDamagedLivingAlly,
  getMostDamagedLivingBenchOling,
  getRoundPlaybackDuration,
  getSelectionDeadline,
  getTagRules,
  getClashMatch,
  getClashPlayer,
  isClashReadyToStart,
  getAiClashOpponent,
  joinClashMatch,
  healPermanentHearts,
  hasTagCharge,
  leaveClashMatch,
  markClashPlayerLoaded,
  normalizeMatchCode,
  normalizeTagState,
  markRepeatedActionForSuppression,
  primeStatusOnNextActionWin,
  readyClashPlayer,
  requestClashRematch,
  recordClashEvent,
  reclaimDrawDamageAsBlood,
  recordRepeatedDecisiveActionProgress,
  resetClashMatchForRematch,
  resetTagState,
  resolveAbilityEffects,
  resolvePendingReclaims,
  resolveDecisiveStatusTriggers,
  resolvePrimedActionWinStatuses,
  resolveRepeatedActionSuppressions,
  resolveCoreClashRound,
  serializeClashMatch,
  serializeLiveClashMatch,
  startClashMatch,
  suppressPart,
  suppressRandomPartUntilDifferentActionWin,
  consumeTagCharge,
  updateAiClashOpponentDifficulty,
  updateClashSelectionDraft,
  updateClashTeam
};
