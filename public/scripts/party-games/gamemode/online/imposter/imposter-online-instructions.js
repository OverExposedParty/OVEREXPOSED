const imposterInstructionHandlers = [
  'DisplayStartTimer',
  'renderCurrentImposterInstructionFromState',
  'DisplayAnswerContainer',
  'DisplayPrivateCard',
  'DisplayVoteResults',
  'DisplayVoteResultsPartTwo',
  'DisplayPunishmentToUser',
  'ResetImposterQuestion',
  'PartySkip'
];

const missingImposterInstructionHandlers = imposterInstructionHandlers.filter(
  handler => typeof window[handler] !== 'function'
);

if (missingImposterInstructionHandlers.length > 0) {
  throw new Error(
    `Imposter instruction modules failed to load: ${missingImposterInstructionHandlers.join(', ')}`
  );
}
