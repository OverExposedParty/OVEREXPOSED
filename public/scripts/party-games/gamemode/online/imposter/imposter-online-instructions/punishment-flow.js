async function DisplayPunishmentToUser() {
  const players = currentPartyData.players || [];
  const state = getPartyState(currentPartyData);
  const { phaseData } = getImposterPhaseState();

  const imposterIndex = state.playerTurn ?? 0;
  const imposter = players[imposterIndex];

  if (!imposter) {
    stopImposterTimerWarning();
    return;
  }

  syncImposterPunishmentTimerWarning(state, 'perform-punishment');

  const punishedId = phaseData?.targetId ?? getPlayerId(imposter);
  const punishmentType = String(phaseData?.punishmentType ?? '').toUpperCase();

  const punishedIndex = players.findIndex(p => getPlayerId(p) === punishedId);
  const punishedPlayer = punishedIndex !== -1 ? players[punishedIndex] : null;

  if (punishedId === deviceId) {
    if (punishmentType === "DOWN_IT" || punishmentType === "DOWN-IT") {
      completePunishmentText.textContent =
        "In order to find out the question you have to down your drink.";
      completePunishmentContainer.setAttribute("punishment-type", "down-drink");
    } else {
      completePunishmentText.textContent =
        "In order to find out the question you have to take " +
        punishmentType.replace('_', ' ') +
        ".";
      completePunishmentContainer.setAttribute(
        "punishment-type",
        punishmentType
      );
    }

    setActiveContainers(completePunishmentContainer);
  } else if (punishedPlayer) {
    const username = getPlayerUsername(punishedPlayer);

    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + username,
      waitingForRoomText: "Showing player punishment...",
      player: punishedPlayer
    });

    setActiveContainers(waitingForPlayerContainer);
  }
}
