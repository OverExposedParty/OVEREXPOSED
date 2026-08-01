const mostLikelyToInstructionHandlers = [
  'DisplayPrivateCard',
  'DisplayVoteResults',
  'TieBreakerPunishmentOffer',
  'WaitingForPlayer',
  'DisplayPunishmentToUser',
  'ChoosingPunishment',
  'ChosePunishment',
  'PartySkip'
];

const missingMostLikelyToInstructionHandlers = mostLikelyToInstructionHandlers.filter(
  handler => typeof window[handler] !== 'function'
);

if (missingMostLikelyToInstructionHandlers.length > 0) {
  throw new Error(
    `Most Likely To instruction modules failed to load: ${missingMostLikelyToInstructionHandlers.join(', ')}`
  );
}
