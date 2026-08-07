async function ResetImposterQuestion({ nextPlayer = true } = {}) {
  if (!isAuthoritativePartyHost()) return null;

  ClearIcons();

  const updatedParty = await performOnlinePartyAction({
    action: 'imposter-reset-round',
    payload: {
      nextPlayer,
      timer: Date.now() + getTimeLimit("imposter-time-limit") * 1000,
      resetInstruction: resetGamemodeInstruction,
      alternativeQuestionIndex: Math.floor(Math.random() * 255)
    }
  });

  if (updatedParty) {
    currentPartyData = updatedParty;
    stopImposterTimerWarning();
  }

  return updatedParty;
}

async function PartySkip({ nextPlayer = true } = {}) {
  await ResetImposterQuestion({ nextPlayer });
}
