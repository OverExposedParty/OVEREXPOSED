async function DisplayGameOver(instruction) {
  stopMafiaTimerWarning();

  const parsedInstructions = parseInstruction(instruction);
  const gameOverTitles = {
    MAFIOSO: 'Mafia Win',
    CIVILIAN: 'Civilian Win',
    SERIAL_KILLER: 'Serial Killer Win',
    DRAW: 'Draw'
  };

  SetPartyGameStatisticsGameOver({
    title: gameOverTitles[parsedInstructions.reason] || 'Game Over'
  });
}

function DisplayPlayerDeadPLayerBoard() {
  stopMafiaTimerWarning();

  if (!isContainerVisible(playerBoard)) {
    setActiveContainers();
    showContainer(playerBoard);
    addElementIfNotExists(permanantElementClassArray, playerBoard);
    toggleOverlay(true);
  }
}
