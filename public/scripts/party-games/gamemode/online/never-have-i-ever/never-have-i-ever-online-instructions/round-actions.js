async function PartySkip({ nextPlayer = true } = {}) {
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
  await ResetQuestion({
    icons,
    timer: Date.now() + getTimeLimit() * 1000,
    nextPlayer
  });
}
