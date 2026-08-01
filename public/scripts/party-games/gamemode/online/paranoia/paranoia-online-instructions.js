const paranoiaInstructionHandlers = [
  'NextQuestion',
  'DisplayPrivateCard',
  'DisplayPunishmentToUser',
  'PunishmentOffer',
  'UserHasPassed',
  'HasUserDonePunishment',
  'ChosePunishment',
  'UserSelectedForPunishment',
  'ChoosingPunishment',
  'DisplayDualStackCard',
  'ResetParanoiaQuestion',
  'PartySkip'
];

const missingParanoiaInstructionHandlers = paranoiaInstructionHandlers.filter(
  handler => typeof window[handler] !== 'function'
);

if (missingParanoiaInstructionHandlers.length > 0) {
  throw new Error(
    `Paranoia instruction modules failed to load: ${missingParanoiaInstructionHandlers.join(', ')}`
  );
}
