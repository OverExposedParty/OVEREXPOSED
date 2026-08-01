async function ResetTruthOrDareQuestion({ force = false, nextPlayer = true, incrementScore = 0, byPassHost = false }) {
  const deck = currentPartyData?.deck ?? currentPartyData ?? {};
  const matchedPack =
    typeof getOnlinePackByCardType === 'function'
      ? getOnlinePackByCardType(selectedQuestionObj?.cardType)
      : null;
  const updatedParty = await performOnlinePartyAction({
    action: 'truth-or-dare-reset-round',
    payload: {
      force,
      nextPlayer,
      incrementScore,
      isNsfwDare:
        incrementScore > 0 &&
        deck.questionType === 'dare' &&
        matchedPack?.packRestriction === 'nsfw',
      timer: Date.now() + gameRules["time-limit"] * 1000,
      byPassHost
    }
  });

  if (updatedParty) {
    stopTruthOrDareTimerWarning();
  }
  if (await syncTruthOrDarePartyAndRender(updatedParty)) {
    return;
  }

  if (!force) {
    DisplayWaitingForPlayers();
  }
}

async function PartySkip({ nextPlayer = true } = {}) {
  await ResetTruthOrDareQuestion({
    force: true,
    nextPlayer
  });
}
