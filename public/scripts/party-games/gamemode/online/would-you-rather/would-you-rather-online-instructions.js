const wouldYouRatherInstructionHandlers = [
  'DisplayPrivateCard',
  'DisplayVoteResults',
  'WaitingForPlayer',
  'DisplayPunishmentToUser',
  'PunishmentOffer',
  'ChosePunishment',
  'UserSelectedForPunishment',
  'AnswerToUserDonePunishment',
  'GetVoteResults',
  'PartySkip',
  'SplitQuestion'
];

const missingWouldYouRatherInstructionHandlers = wouldYouRatherInstructionHandlers.filter(
  handler => typeof window[handler] !== 'function'
);

if (missingWouldYouRatherInstructionHandlers.length > 0) {
  throw new Error(
    'Would You Rather instruction modules failed to load: ' +
      missingWouldYouRatherInstructionHandlers.join(', ')
  );
}
