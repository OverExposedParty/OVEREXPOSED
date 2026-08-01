const truthOrDareInstructionHandlers = [
  'DisplaySelectQuestionType',
  'DisplayPublicCard',
  'ChoosingPunishment',
  'DisplayPromptHeist',
  'UserSelectedForPunishment',
  'DisplayPunishmentToUser',
  'UserHasPassed',
  'DisplayCompleteQuestion',
  'ResetTruthOrDareQuestion',
  'PartySkip'
];

const missingTruthOrDareInstructionHandlers = truthOrDareInstructionHandlers.filter(
  handler => typeof window[handler] !== 'function'
);

if (missingTruthOrDareInstructionHandlers.length > 0) {
  throw new Error(
    `Truth or Dare instruction modules failed to load: ${missingTruthOrDareInstructionHandlers.join(', ')}`
  );
}
