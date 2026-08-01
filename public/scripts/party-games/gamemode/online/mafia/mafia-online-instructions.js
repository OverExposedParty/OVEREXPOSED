const mafiaInstructionHandlers = [
  'DisplayRole',
  'DisplayNightPhase',
  'DisplayNightPhasePartTwo',
  'DisplayPlayerKilled',
  'DisplayPlayerKilledPartTwo',
  'DisplayDayPhaseDiscussion',
  'DisplayDayPhaseVote',
  'DisplayDayPhaseVotePartTwo',
  'DisplayTownVote',
  'DisplayTownVotePartTwo',
  'DisplayGameOver',
  'DisplayPlayerDeadPLayerBoard'
];

const missingMafiaInstructionHandlers = mafiaInstructionHandlers.filter(
  handler => typeof window[handler] !== 'function'
);

if (missingMafiaInstructionHandlers.length > 0) {
  throw new Error(
    `Mafia instruction modules failed to load: ${missingMafiaInstructionHandlers.join(', ')}`
  );
}
