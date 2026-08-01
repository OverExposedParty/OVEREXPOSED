const neverHaveIEverInstructionHandlers = [
  'DisplayPrivateCard',
  'DisplayVoteResults',
  'ChosePunishment',
  'WaitingForPlayer',
  'DisplayPunishmentToUser',
  'PunishmentOffer',
  'UserSelectedForPunishment',
  'AnswerToUserDonePunishment',
  'GetVoteResults',
  'PartySkip'
];

const missingNeverHaveIEverInstructionHandlers = neverHaveIEverInstructionHandlers.filter(
  handler => typeof window[handler] !== 'function'
);

if (missingNeverHaveIEverInstructionHandlers.length > 0) {
  throw new Error(
    'Never Have I Ever instruction modules failed to load: ' +
      missingNeverHaveIEverInstructionHandlers.join(', ')
  );
}
