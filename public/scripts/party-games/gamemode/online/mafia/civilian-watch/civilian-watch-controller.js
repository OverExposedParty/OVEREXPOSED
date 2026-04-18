window.CivilianWatchAfterDialogue = async function () {
  const latestPartyData = await GetCurrentPartyData();
  if (!latestPartyData?.players) return;

  currentPartyData = latestPartyData;
  const players = currentPartyData.players;
  const meIndex = players.findIndex(p => p.identity.computerId === deviceId);
  if (meIndex === -1) return;

  const me = players[meIndex];
  me.state ||= {};
  me.state.phase ||= { scenarioFileName: "N/A", index: 1, state: "selecting", option: "N/A", optionList: [] };

  phaseIndex = readPhaseIndex(me, 1);
  setPhaseIndex(me, phaseIndex);

  const selectedOption = String(me.state.phase.state || window.__cw_selectedOption || "");
  const isAdvance = selectedOption === "advance";

  if (isAdvance) {
    if (phaseIndex < maxNumOfPhases) {
      setPhaseIndex(me, phaseIndex + 1);
      Object.assign(me.state.phase, { state: "selecting", option: "N/A", optionList: [] });
    } else {
      me.state.hasConfirmed = true;
      Object.assign(me.state.phase, { state: "completed", option: "N/A", optionList: [] });
    }
    await SendPlayerDataToParty(me);
    CivilianWatchContainerUpdate(me.state.phase.state === "completed");
    setActiveContainers(selectCivilianWatchContainer);
    selectCivilianWatchConfirmButton.classList.remove("disabled");;
    return;
  }

  if (selectedOption === "no-hint" || selectedOption === "small-hint") {
    me.state.hasConfirmed = true;
    me.state.phase.state = "completed";
    await SendPlayerDataToParty(me);
  }
  CivilianWatchContainerUpdate(me.state.phase.state === "completed");
  setActiveContainers(selectCivilianWatchContainer);
  selectCivilianWatchConfirmButton.classList.remove("disabled");;
};

function isCivilianWatchOutcomeState(state) {
  return state === "advance" || state === "no-hint" || state === "small-hint";
}

function renderCivilianWatchOutcome({ player, selectedOption, remainingMs }) {
  const optionNumber = findOptionNumberFromStoredOption(player);
  if (optionNumber == null) return false;

  displayCivilianWatchResponseText.innerHTML = computeResponseText({
    scenarioObject,
    phaseIndex,
    optionNumber,
    selectedOption,
  });

  setActiveContainers(displayCivilianWatchResponseContainer);

  startPhaseContainerTimer({
    remainingMs,
    durationMs: dialogueDelay,
    timerSelector: getOnlineTimerWrapper(
      displayCivilianWatchResponseContainer,
      "displayCivilianWatchResponseContainer"
    ),
  });

  scheduleFromExistingTimer({
    timerValue: Date.now() + remainingMs,
    remainingMs,
    functionToCall: "CivilianWatchAfterDialogue",
  });

  return true;
}

async function InitializeCivilianWatch(completed = false) {
  await mafiaHintsReady;
  scenarioObject = await loadRandomScenario();

  const players = currentPartyData?.players || [];
  const me = players.find(p => p?.identity?.computerId === deviceId);
  if (!me) return;

  me.state ||= {};
  me.state.phase ||= { scenarioFileName: "N/A", index: 1, state: "selecting", option: "N/A", optionList: [] };

  phaseIndex = readPhaseIndex(me, 1);
  setPhaseIndex(me, phaseIndex);

  const selectedOption = String(me.state.phase.state || "");
  const timerValueMs = parseTimerMs(getPlayerPhaseTimer(me));
  const remainingMs = timerValueMs == null ? null : timerValueMs - Date.now();

  if (isCivilianWatchOutcomeState(selectedOption)) {
    if (remainingMs != null && remainingMs > 0) {
      if (renderCivilianWatchOutcome({ player: me, selectedOption, remainingMs })) return;
    } else {
      me.state.phaseTimer = null;
      await SendPlayerDataToParty(me);
      await CivilianWatchAfterDialogue();
      return;
    }
  }

  CivilianWatchContainerUpdate(completed);
  setActiveContainers(selectCivilianWatchContainer);
}

function CivilianWatchContainerUpdate(completed = false) {
  const areaKey = `area-${phaseIndex}`;
  if (!scenarioObject?.data?.[areaKey]?.[0]) return;

  areaObject = scenarioObject.data[areaKey];
  const { dialogue, options } = areaObject[0];

  selectCivilianWatchText.textContent = dialogue;

  selectCivilianWatchOptionButtons.forEach((btn, i) => {
    const optionData = options[i];
    if (optionData) {
      btn.textContent = optionData.text;
      btn.classList.remove("disabled");
      btn.classList.remove("active");
      btn.dataset.optionIndex = i;
    } else {
      btn.textContent = "";
      btn.classList.add("disabled");
    }
  });
  if(completed){
    selectCivilianWatchContainer.querySelectorAll('button').forEach(b => b.classList.add('disabled'));
    selectCivilianWatchConfirmButton.classList.add('disabled');
  }
}

selectCivilianWatchOptionButtons.forEach(button => {
  button.addEventListener("click", () => {
    selectCivilianWatchOptionButtons.forEach(b => b.classList.remove("active"));
    button.classList.add("active");
  });
});

selectCivilianWatchConfirmButton.addEventListener("click", async () => {
  const index = currentPartyData.players.findIndex(p => p.identity.computerId === deviceId);
  if (index === -1) return;

  const me = currentPartyData.players[index];
  me.state ||= {};
  me.state.phase ||= { scenarioFileName: "N/A", index: 1, state: "selecting", option: "N/A", optionList: [] };

  phaseIndex = readPhaseIndex(me, 1);
  setPhaseIndex(me, phaseIndex);
  writeOptionListToPlayerPhase(me);

  const selectedButton = [...selectCivilianWatchOptionButtons].find(b => b.classList.contains("active"));
  if (!selectedButton) return;

  const optionNumber = Number(selectedButton.dataset.optionIndex);
  const outcomeIndex = phaseOutcomes[phaseIndex - 1][optionNumber];
  const selectedOption = phaseOptions[outcomeIndex];

  displayCivilianWatchResponseText.innerHTML = computeResponseText({
    scenarioObject,
    phaseIndex,
    optionNumber,
    selectedOption,
  });

  setActiveContainers(displayCivilianWatchResponseContainer);

  me.state.phase.state = selectedOption;
  setSelectedOptionText(me, optionNumber);

  await SendPlayerDataToParty(me);

  window.__cw_selectedOption = selectedOption;

  setPlayerTimeout({
    delay: dialogueDelay,
    playerTimer: "state.phaseTimer",
    functionToCall: "CivilianWatchAfterDialogue",
  });

  startPhaseContainerTimer({
    remainingMs: dialogueDelay,
    durationMs: dialogueDelay,
    timerSelector: getOnlineTimerWrapper(
      displayCivilianWatchResponseContainer,
      "displayCivilianWatchResponseContainer"
    ),
  });
});
