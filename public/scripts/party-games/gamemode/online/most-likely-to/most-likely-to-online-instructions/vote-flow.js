async function DisplayPrivateCard() {
  const state = getPartyState(currentPartyData);
  const deck = getPartyDeck(currentPartyData);
  const players = currentPartyData.players || [];
  const currentParticipants =
    typeof getMostLikelyToCurrentParticipants === 'function'
      ? getMostLikelyToCurrentParticipants(currentPartyData)
      : players;

  if (typeof renderMostLikelyToVoteTargetButtons === 'function') {
    renderMostLikelyToVoteTargetButtons(currentPartyData);
  }

  const delay = new Date(state.timer) - Date.now();
  const durationSeconds = getTimeLimit();

  startTimerFromContainer({
    container: gameContainerPrivate,
    timeLeft: delay / 1000,
    duration: durationSeconds
  });
  startTimerWithContainer({
    container: selectUserContainer,
    label: 'selectUserContainer',
    timeLeft: delay / 1000,
    duration: durationSeconds
  });
  startTimerWithContainer({
    container: waitingForPlayersContainer,
    label: 'waitingForPlayersContainer',
    timeLeft: delay / 1000,
    duration: durationSeconds
  });

  SetTimeOut({
    delay,
    instruction: "DISPLAY_VOTE_RESULTS",
    nextDelay: resultTimerDuration
  });

  const myIndex = players.findIndex(p => getPlayerId(p) === deviceId);
  if (myIndex === -1) {
    stopMostLikelyToTimerWarning();
    console.warn("Device not found in players.");
    return;
  }

  const myState = getPlayerState(players[myIndex]);
  const cardIndex = deck.currentCardIndex ?? 0;

  syncMostLikelyToTimerWarning(
    state,
    myState.hasConfirmed !== true,
    'vote'
  );

  selectedQuestionObj = getNextQuestion(cardIndex);
  selectNumberButtonContainer.innerHTML = "";

  selectUserQuestionText.textContent =
    formatMostLikelyToQuestionForSelection(selectedQuestionObj.question);

  DisplayCard(gameContainerPrivate, selectedQuestionObj);

  if (!myState.isReady && !myState.hasConfirmed) {
    setActiveContainers(gameContainerPrivate);
  }
  else if (myState.isReady && !myState.hasConfirmed) {
    setActiveContainers(selectUserContainer);
  }
  else {
    const allConfirmed = currentParticipants.every(
      p => getPlayerState(p).hasConfirmed
    );

    if (allConfirmed) {
      await SendInstruction({
        instruction: "DISPLAY_VOTE_RESULTS",
        timer: Date.now() + resultTimerDuration
      });
    } else if (myState.hasConfirmed) {
      DisplayWaitingForPlayers();
    }
  }
}

async function DisplayVoteResults() {
  const state = getPartyState(currentPartyData);
  stopMostLikelyToTimerWarning();

  const players = currentPartyData.players || [];
  const authoritativeHostId = state.hostComputerId ?? hostDeviceId;

  const delay = new Date(state.timer) - Date.now();
  const firstDisplay = !isContainerVisible(resultsChartContainer);

  stopTimerForContainer(waitingForPlayersContainer, 'waitingForPlayersContainer');
  startTimerWithContainer({
    container: resultsChartContainer,
    label: 'resultsChartContainer',
    timeLeft: delay / 1000,
    duration: resultTimerDuration / 1000
  });

  const myIndex = players.findIndex(p => getPlayerId(p) === deviceId);
  if (myIndex === -1) {
    stopMostLikelyToTimerWarning();
    console.warn("Device not found in players.");
    return;
  }

  if (firstDisplay) {
    GetVoteResults(currentPartyData);
    setActiveContainers(resultsChartContainer);
  }

  const highestValue = getHighestVoteValue(currentPartyData);
  debugLog("highestValue:", highestValue);

  if (firstDisplay) {
    if (deviceId === authoritativeHostId) {
      const updatedParty = await performOnlinePartyAction({
        action: 'most-likely-to-resolve-vote-results'
      });

      if (updatedParty) {
        currentPartyData = updatedParty;
      }
    }
  }

  ClearIcons();

  if (firstDisplay) {
    scheduleMostLikelyToPhaseAction({
      delay,
      action: 'most-likely-to-advance-from-results',
      payload: {
        phaseTimer: Date.now() + getTimeLimit() * 1000,
        roundTimer: Date.now() + getTimeLimit() * 1000
      }
    });
  }
}

async function TieBreakerPunishmentOffer() {
  const state = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];
  const authoritativeHostId = state.hostComputerId ?? hostDeviceId;
  const { phaseData } = getMostLikelyToPhaseState();
  const delay = new Date(state.timer) - Date.now();
  const durationSeconds = getTimeLimit();

  startTimerWithContainer({
    container: selectNumberContainer,
    label: 'selectNumberContainer',
    timeLeft: delay / 1000,
    duration: durationSeconds
  });
  startTimerWithContainer({
    container: waitingForPlayersContainer,
    label: 'waitingForPlayersContainer',
    timeLeft: delay / 1000,
    duration: durationSeconds
  });

  scheduleMostLikelyToPhaseAction({
    delay,
    action: 'most-likely-to-handle-phase-timeout',
    payload: {
      phaseTimer: Date.now() + getTimeLimit() * 1000,
      roundTimer: Date.now() + getTimeLimit() * 1000
    }
  });

  const myIndex = players.findIndex(p => getPlayerId(p) === deviceId);
  if (myIndex === -1) {
    stopMostLikelyToTimerWarning();
    console.warn("Device not found in players.");
    return;
  }
  const myState = getPlayerState(players[myIndex]);

  const tiedIds = Array.isArray(phaseData?.tiedIds)
    ? phaseData.tiedIds.filter(Boolean)
    : [];

  syncMostLikelyToTimerWarning(
    state,
    tiedIds.includes(deviceId) && myState.hasConfirmed !== true,
    'tiebreaker'
  );

  if (tiedIds.includes(deviceId)) {
    const count = tiedIds.length;

    for (let i = 0; i < count; i++) {
      if (selectNumberButtonContainer.querySelectorAll('button').length < count) {
        const selectedNumberButton = createUserButton(String(i), i + 1);

        selectedNumberButton.addEventListener('click', () => {
          selectNumberContainer.querySelectorAll('button')
            .forEach(btn => btn.classList.remove('active'));
          selectedNumberButton.classList.add('active');
          selectNumberContainer.setAttribute(
            'selected-id',
            selectedNumberButton.getAttribute('id')
          );
        });

        selectNumberButtonContainer.appendChild(selectedNumberButton);
      }
    }

    if (!myState.hasConfirmed) {
      setActiveContainers(selectNumberContainer);

      for (let i = 0; i < count; i++) {
        const button = document.getElementById(String(i));
        const someoneChoseThis =
          players.some(player => getPlayerState(player).vote === String(i));

        if (someoneChoseThis) {
          button.classList.add("disabled");
        } else {
          button.classList.remove("disabled");
        }
      }
    } else {
      const allConfirmed = tiedIds.every((tiedId) => {
        const tiedPlayer = players.find(p => getPlayerId(p) === tiedId);
        return tiedPlayer ? getPlayerState(tiedPlayer).hasConfirmed === true : false;
      });
      if (allConfirmed && deviceId === authoritativeHostId) {
        const updatedParty = await performOnlinePartyAction({
          action: 'most-likely-to-resolve-tiebreaker',
          payload: {
            tiedIds,
            timer: Date.now() + getTimeLimit() * 1000
          }
        });

        if (updatedParty) {
          currentPartyData = updatedParty;

          if (getPartyState(currentPartyData)?.phase === "most-likely-to-choose-punishment") {
            await ChoosingPunishment();
            return;
          }
        }
      } else {
        DisplayWaitingForPlayers();
      }
    }
  } else {
    DisplayWaitingForPlayers();
  }
}
