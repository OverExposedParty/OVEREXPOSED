async function DisplayPunishmentToUser(instruction) {
  return;
}

async function PunishmentOffer(instruction) {
  return;
}

async function ChosePunishment(instruction) {
  const players = currentPartyData.players || [];
  const { phase, phaseData } = getWouldYouRatherPhaseState();
  const targetIds = getWouldYouRatherTargetIds();
  const delay = getWouldYouRatherPhaseDelay();

  const myIndex = players.findIndex(
    p => getPlayerId(p) === deviceId
  );
  if (myIndex === -1) return;

  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');

  const myState = getPlayerState(players[myIndex]);

  SetWaitingForPlayersIconStates(players, true);

  if (phase === 'would-you-rather-spin-odd-man-out') {
    const oddManOutId = targetIds[0] ?? null;
    const oddManOutPlayer = players.find(player => getPlayerId(player) === oddManOutId);
    if (!oddManOutPlayer) return;

    if (oddManOutId === deviceId) {
      if (typeof resetDrinkWheelState === 'function') {
        resetDrinkWheelState();
      }
      startWouldYouRatherPhaseTimer(drinkWheelContainer, 'drinkWheelContainer', delay);
      setActiveContainers(drinkWheelContainer);
    } else {
      SetWaitingForPlayer({
        waitingForRoomTitle: "Waiting for " + getPlayerUsername(oddManOutPlayer),
        waitingForRoomText: "Spinning drink wheel...",
        player: oddManOutPlayer
      });
      startWouldYouRatherPhaseTimer(waitingForPlayerContainer, 'waitingForPlayerContainer', delay);
      setActiveContainers(waitingForPlayerContainer);
    }
    return;
  }

  if (phase === 'would-you-rather-show-punishment') {
    scheduleWouldYouRatherPhaseAction({
      delay,
      action: 'would-you-rather-handle-phase-timeout',
      payload: {
        nextRoundTimerDurationMs: getTimeLimit() * 1000
      }
    });
  }

  if (targetIds.includes(deviceId)) {
    const punishmentType = String(phaseData?.punishmentType ?? 'TAKE_A_SIP');
    completePunishmentText.textContent =
      punishmentType === 'TAKE_A_SIP'
        ? 'Take a sip.'
        : 'Take ' + punishmentType.replace(/_/g, ' ').toLowerCase() + '.';
    completePunishmentContainer.setAttribute('punishment-type', punishmentType);

    if (!myState.hasConfirmed) {
      startWouldYouRatherPhaseTimer(completePunishmentContainer, 'completePunishmentContainer', delay);
      setActiveContainers(completePunishmentContainer);
    } else {
      startWouldYouRatherPhaseTimer(waitingForPlayersContainer, 'waitingForPlayersContainer', delay);
      DisplayWaitingForPlayers();
    }
  } else {
    startWouldYouRatherPhaseTimer(waitingForPlayersContainer, 'waitingForPlayersContainer', delay);
    DisplayWaitingForPlayers();
  }
}

async function UserSelectedForPunishment(instruction) {
  return;
}

async function AnswerToUserDonePunishment() {
  return;
}
