function wireEventListeners() {
  buttonChoosePlayer.addEventListener('click', handleChoosePlayerClick);
  buttonNextQuestion.addEventListener('click', handleNextQuestionClick);

  selectUserConfirmPlayerButton.addEventListener('click', handleConfirmPlayerClick);
  selectPunishmentConfirmPunishmentButton.addEventListener('click', handleConfirmPunishmentClick);

  completePunishmentButtonPass.addEventListener('click', handleCompletePunishmentPassClick);
  completePunishmentButtonConfirm.addEventListener('click', handleCompletePunishmentConfirmClick);

  document
    .querySelector('#heads-or-tails-pick-container .select-button-container #heads')
    ?.addEventListener('click', handlePickHeadsClick);

  document
    .querySelector('#heads-or-tails-pick-container .select-button-container #tails')
    ?.addEventListener('click', handlePickTailsClick);

  ConfirmPunishmentButtonYes.addEventListener('click', handlePunishmentYesClick);
  confirmPunishmentButtonNo.addEventListener('click', handlePunishmentNoClick);
}

async function handleChoosePlayerClick() {
  await SendInstruction({
    instruction: "DISPLAY_PRIVATE_CARD:CHOOSE_PLAYER",
    byPassHost: true
  });
}

async function handleNextQuestionClick() {
  hideContainer(gameContainerDualStack);
  await SetUserConfirmation({
    selectedDeviceId: deviceId,
    option: true,
    reason: "QUESTION",
  });
}

async function handleConfirmPlayerClick() {
  const selectedId = selectUserButtonContainer.getAttribute('selected-id');
  if (!selectedId) return;

  await SetVote({
    option: selectedId,
    sendInstruction: "CHOOSING_PUNISHMENT"
  });

  const selectUserButtons = document
    .getElementById('select-user-container')
    .querySelectorAll('.selected-user-container .button-container button');

  selectUserButtons.forEach(button => {
    button.classList.remove('active');
  });

  selectUserButtonContainer.setAttribute('selected-id', "");
}

async function handleConfirmPunishmentClick() {
  const selectedId = selectPunishmentContainer.getAttribute('select-id');
  if (!selectedId) return;

  hideContainer(selectPunishmentContainer);

  if (selectedId === 'lucky-coin-flip') {
    console.log("paranoia-coin-flip");
    await SendInstruction({
      instruction: "CHOSE_PUNISHMENT:COIN_FLIP",
      byPassHost: true
    });
  }
  else if (selectedId === 'drink-wheel') {
    await SendInstruction({
      instruction: "CHOSE_PUNISHMENT:DRINK_WHEEL",
      byPassHost: true
    });
  }
  else if (selectedId === 'take-a-shot') {
    completePunishmentContainer.setAttribute("punishment-type", "take-a-shot");
    await SendInstruction({
      instruction: "CHOSE_PUNISHMENT:TAKE_A_SHOT",
      byPassHost: true
    });
  }

  const selectPunishmentButtons = document
    .getElementById('select-punishment-container')
    .querySelectorAll('.selected-user-container .button-container button');

  selectPunishmentButtons.forEach(button => {
    button.classList.remove('active');
  });

  selectPunishmentContainer.setAttribute('select-id', "");
}

async function handleCompletePunishmentPassClick() {
  hideContainer(completePunishmentContainer);

  const players = currentPartyData.players || [];
  const state = getPartyState(currentPartyData);
  const playerTurn = state.playerTurn ?? currentPartyData.playerTurn ?? 0;
  const turnPlayer = players[playerTurn];

  if (getPlayerId(turnPlayer) === deviceId) {
    await SendInstruction({
      instruction: "RESET_PARANOIA_QUESTION:PLAYER_TURN_PASSED:2",
      byPassHost: true
    });
  }
  else {
    await SetUserConfirmation({
      selectedDeviceId: deviceId,
      option: false,
      reason: "PASS",
      userInstruction: "PUNISHMENT_OFFER"
    });
  }
}

async function handleCompletePunishmentConfirmClick() {
  const instructions = getUserInstructions(currentPartyData);
  const parsedInstructions = parseInstruction(instructions);

  hideContainer(completePunishmentContainer);

  const players = currentPartyData.players || [];
  const state = getPartyState(currentPartyData);
  const playerTurn = state.playerTurn ?? currentPartyData.playerTurn ?? 0;
  const turnPlayer = players[playerTurn];

  if (getPlayerId(turnPlayer) === deviceId) {
    await SendInstruction({
      instruction: "RESET_PARANOIA_QUESTION:PLAYER_TURN_PASSED:1",
      byPassHost: true
    });
  }
  else {
    await SetUserConfirmation({
      selectedDeviceId: deviceId,
      option: true,
      reason: "CONFIRM:" + parsedInstructions.reason,
      userInstruction: "PUNISHMENT_OFFER"
    });
  }
}

function handlePickHeadsClick() {
  hideContainer(pickHeadsOrTailsContainer);
  showContainer(luckyCoinFlipContainer);
  pickedHeads = true;
}

function handlePickTailsClick() {
  hideContainer(pickHeadsOrTailsContainer);
  showContainer(luckyCoinFlipContainer);
  pickedHeads = false;
}

async function handlePunishmentYesClick() {
  await SetUserConfirmation({
    selectedDeviceId: deviceId,
    option: true
  });
}

async function handlePunishmentNoClick() {
  await SetUserConfirmation({
    selectedDeviceId: deviceId,
    option: false
  });
}
