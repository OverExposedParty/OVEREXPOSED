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

  const updatedParty = await performOnlinePartyAction({
    action: 'paranoia-select-target',
    payload: {
      targetId: selectedId,
      phaseTimer: Date.now() + gameRules["time-limit"] * 1000
    }
  });

  if (updatedParty) {
    currentPartyData = updatedParty;
  }

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

  const punishmentType = selectedId === 'lucky-coin-flip'
    ? 'COIN_FLIP'
    : selectedId === 'drink-wheel'
      ? 'DRINK_WHEEL'
      : selectedId === 'take-a-shot'
        ? 'TAKE_A_SHOT'
        : selectedId;

  const updatedParty = await performOnlinePartyAction({
    action: 'paranoia-select-punishment',
    payload: {
      punishmentType
    }
  });

  if (updatedParty) {
    currentPartyData = updatedParty;
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

  const updatedParty = await performOnlinePartyAction({
    action: 'paranoia-pass-punishment',
    payload: {
      roundTimer: Date.now() + gameRules["time-limit"] * 1000
    }
  });

  if (updatedParty) {
    currentPartyData = updatedParty;
  }
}

async function handleCompletePunishmentConfirmClick() {
  setActiveContainers(waitingForPlayersContainer);

  const state = getPartyState(currentPartyData);
  const completionReason = state?.phaseData?.punishmentType ?? "QUESTION";
  const updatedParty = await performOnlinePartyAction({
    action: 'paranoia-begin-punishment-confirmation',
    payload: {
      completionReason
    }
  });

  if (updatedParty) {
    currentPartyData = updatedParty;
  }
}

function handlePickHeadsClick() {
  setActiveContainers(luckyCoinFlipContainer);
  pickedHeads = true;
}

function handlePickTailsClick() {
  setActiveContainers(luckyCoinFlipContainer);
  pickedHeads = false;
}

async function handlePunishmentYesClick() {
  const updatedParty = await performOnlinePartyAction({
    action: 'paranoia-submit-punishment-vote',
    payload: {
      option: true,
      roundTimer: Date.now() + gameRules["time-limit"] * 1000
    }
  });

  if (updatedParty) {
    currentPartyData = updatedParty;
  }
}

async function handlePunishmentNoClick() {
  const updatedParty = await performOnlinePartyAction({
    action: 'paranoia-submit-punishment-vote',
    payload: {
      option: false,
      roundTimer: Date.now() + gameRules["time-limit"] * 1000
    }
  });

  if (updatedParty) {
    currentPartyData = updatedParty;
  }
}
