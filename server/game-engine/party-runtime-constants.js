const PARTY_ERROR_LOG_LIMIT = 100;
const PARTY_ID_PATTERN = /^[A-Za-z0-9]{3}-[A-Za-z0-9]{3}$/;

const SCORE_RULES = {
  'truth-or-dare': {
    completeTruth: 10,
    completeDare: 15,
    completeStolenTruth: 15,
    completeStolenDare: 20,
    passWithPunishment: 0,
    passAndStolen: 0,
    passUnresolved: -5,
    passStolenPrompt: -10,
    passStolenPromptWithPunishment: -5
  },
  paranoia: {
    selectTarget: 10,
    revealQuestionTargetBonus: 5,
    revealQuestionSelectorPenalty: -5,
    keepQuestionSecretBonus: 5,
    revealMissPenalty: -5
  },
  'never-have-i-ever': {
    selectSide: 5,
    majoritySide: 10,
    perfectSplit: 15,
    loneSideBonus: 20,
    oddManOutPenalty: -10
  },
  'would-you-rather': {
    selectSide: 5,
    majoritySide: 10,
    perfectSplit: 15,
    loneSideBonus: 20
  },
  imposter: {
    correctVote: 5,
    imposterSurvivedVote: 5,
    imposterNoVotesBonus: 5,
    imposterWin: 25,
    crewWin: 10
  },
  'most-likely-to': {
    selectPlayer: 5,
    correctVote: 10,
    pickedBase: 10,
    pickedConcurrentDrop: 5,
    pickedMinimum: 0,
    completePunishment: 5
  }
};

module.exports = {
  PARTY_ERROR_LOG_LIMIT,
  PARTY_ID_PATTERN,
  SCORE_RULES
};
