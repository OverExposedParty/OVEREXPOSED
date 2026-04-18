function readPhaseIndex(player, fallback = 1) {
  const n = Number(player?.state?.phase?.index);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(maxNumOfPhases, n));
}

function setPhaseIndex(player, next) {
  const clamped = Math.max(1, Math.min(maxNumOfPhases, Number(next)));
  phaseIndex = clamped;
  player.state ||= {};
  player.state.phase ||= { scenarioFileName: "N/A", index: clamped, state: "selecting" };
  player.state.phase.index = clamped;
  return clamped;
}

function getPlayerPhaseTimer(player) {
  const phaseTimer = player?.state?.phaseTimer;
  if (phaseTimer != null) return phaseTimer;

  const legacyTimer = player?.state?.phase?.timer;
  if (legacyTimer != null) {
    player.state.phaseTimer = legacyTimer;
    delete player.state.phase.timer;
    return legacyTimer;
  }

  return null;
}

function migrateLegacyPhaseTimer(player) {
  const legacyTimer = player?.state?.phase?.timer;
  if (player?.state?.phaseTimer != null || legacyTimer == null) return false;

  player.state.phaseTimer = legacyTimer;
  delete player.state.phase.timer;
  return true;
}

function computeResponseText({ scenarioObject, phaseIndex, optionNumber, selectedOption }) {
  const areaKey = `area-${phaseIndex}`;
  const optionObj = scenarioObject?.data?.[areaKey]?.[0]?.options?.[optionNumber];
  const outcomeText = optionObj?.[selectedOption];
  const finalText = outcomeText || `(missing key: ${selectedOption})`;
  return /\[HINT(?::[^\]]*)?\]/i.test(finalText) ? injectMafiaHint(finalText) : finalText;
}

function writeOptionListToPlayerPhase(player) {
  const areaKey = `area-${phaseIndex}`;
  const options = scenarioObject?.data?.[areaKey]?.[0]?.options || [];
  player.state.phase.optionList = options.map(o => o?.text ?? "").filter(Boolean);
}

function setSelectedOptionText(player, optionNumber) {
  const list = player?.state?.phase?.optionList ?? [];
  player.state.phase.option = list[optionNumber] ?? "N/A";
}

function findOptionNumberFromStoredOption(player) {
  const list = player?.state?.phase?.optionList ?? [];
  const opt = String(player?.state?.phase?.option ?? "");
  const idx = list.indexOf(opt);
  return idx >= 0 ? idx : null;
}

async function loadRandomScenario() {
  const [latest] = await getExistingPartyData(partyCode);
  currentPartyData = latest;

  const players = currentPartyData.players || [];
  const meIndex = players.findIndex(p => p.identity?.computerId === deviceId);
  if (meIndex === -1) throw new Error("Player not found");

  const me = players[meIndex];
  me.state ||= {};
  me.state.phase ||= { scenarioFileName: "N/A", index: 1, state: "N/A", option: "N/A", optionList: [] };
  migrateLegacyPhaseTimer(me);

  const phase = me.state.phase;
  let scenarioFileName = phase.scenarioFileName;

  const scenarioList = await fetch("/json-files/party-games/mafia/civilian-watch/civilian-watch.json").then(r => r.json());
  const scenarios = scenarioList.scenario;

  let picked;

  if (!scenarioFileName || scenarioFileName === "N/A") {
    picked = scenarios[Math.floor(Math.random() * scenarios.length)];
    scenarioFileName = picked["file-name"];

    Object.assign(phase, {
      scenarioFileName,
      index: 1,
      state: "selecting",
      option: "N/A",
      optionList: [],
    });

    setPhaseIndex(me, 1);
    const updatedPartyAfterScenarioPick = await performOnlinePartyAction({
      action: 'sync-party-state',
      payload: {
        playerUpdates: [me]
      }
    });

    if (updatedPartyAfterScenarioPick) {
      currentPartyData = updatedPartyAfterScenarioPick;
    }
  } else {
    picked = scenarios.find(s => s["file-name"] === scenarioFileName);
    setPhaseIndex(me, readPhaseIndex(me, 1));
  }

  const scenarioData = await fetch(`/json-files/party-games/mafia/civilian-watch/scenarios/${scenarioFileName}.json`).then(r => r.json());
  writeOptionListToPlayerPhase(me);
  const updatedPartyAfterOptionWrite = await performOnlinePartyAction({
    action: 'sync-party-state',
    payload: {
      playerUpdates: [me]
    }
  });

  if (updatedPartyAfterOptionWrite) {
    currentPartyData = updatedPartyAfterOptionWrite;
  }

  return { meta: picked, data: scenarioData };
}
