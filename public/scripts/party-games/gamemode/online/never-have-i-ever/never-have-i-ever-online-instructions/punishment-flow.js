async function ensureDrinkWheelContainer() {
  let container = document.querySelector('#drink-wheel-container');

  if (container) {
    return container;
  }

  if (typeof AddGamemodeContainers === 'function') {
    AddGamemodeContainers('odd-man-out');

    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      container = document.querySelector('#drink-wheel-container');
      if (container) {
        return container;
      }
    }
  }

  return null;
}

async function ChosePunishment(instruction) {
  const players = currentPartyData.players || [];
  const { phase } = getNeverHaveIEverPhaseState();
  const targetIds = getNeverHaveIEverTargetIds();
  const delay = getNeverHaveIEverPhaseDelay();

  const myIndex = players.findIndex(p => getPlayerId(p) === deviceId);
  if (myIndex === -1) return;

  const myPlayer = players[myIndex];
  const myState = myPlayer.state ?? myPlayer;

  if (phase === 'never-have-i-ever-spin-odd-man-out') {
    const oddManOutId = targetIds[0] ?? null;
    const oddPlayer = players.find(player => getPlayerId(player) === oddManOutId);
    if (!oddPlayer) return;

    if (oddManOutId === deviceId) {
      const drinkWheelContainer = await ensureDrinkWheelContainer();

      if (drinkWheelContainer) {
        if (typeof resetDrinkWheelState === 'function') {
          resetDrinkWheelState();
        }
        startNeverHaveIEverPhaseTimer(drinkWheelContainer, 'drinkWheelContainer', delay);
        setActiveContainers(drinkWheelContainer);
      } else {
        SetWaitingForPlayer({
          waitingForRoomTitle: "Preparing punishment...",
          waitingForRoomText: "Loading drink wheel..."
        });
        startNeverHaveIEverPhaseTimer(waitingForPlayerContainer, 'waitingForPlayerContainer', delay);
        setActiveContainers(waitingForPlayerContainer);
      }
    } else {
      SetWaitingForPlayer({
        waitingForRoomTitle: "Waiting for " + (oddPlayer.identity?.username ?? oddPlayer.username),
        waitingForRoomText: "Spinning drink wheel...",
        player: oddPlayer
      });
      startNeverHaveIEverPhaseTimer(waitingForPlayerContainer, 'waitingForPlayerContainer', delay);
      setActiveContainers(waitingForPlayerContainer);
    }
    return;
  }

  if (targetIds.includes(deviceId)) {
    completePunishmentText.textContent = "Take a sip.";
    completePunishmentContainer.setAttribute("punishment-type", "TAKE_A_SIP");

    const hasConfirmed = myState.hasConfirmed ?? myPlayer.hasConfirmed;
    if (!hasConfirmed) {
      startNeverHaveIEverPhaseTimer(completePunishmentContainer, 'completePunishmentContainer', delay);
      setActiveContainers(completePunishmentContainer);
    } else {
      startNeverHaveIEverPhaseTimer(waitingForPlayersContainer, 'waitingForPlayersContainer', delay);
      DisplayWaitingForPlayers();
    }
  } else {
    startNeverHaveIEverPhaseTimer(waitingForPlayersContainer, 'waitingForPlayersContainer', delay);
    DisplayWaitingForPlayers();
  }
}

async function DisplayPunishmentToUser(instruction) {
  return;
}

async function PunishmentOffer(instruction) {
  return;
}

async function UserSelectedForPunishment(instruction) {
  return;
}

async function AnswerToUserDonePunishment() {
  return;
}
