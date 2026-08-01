let waitingForPlayersRosterSignature = '';
let waitingForPlayersConfirmationStates = new Map();

function getWaitingForPlayersParticipants(partyData = currentPartyData) {
  const players = Array.isArray(partyData?.players) ? partyData.players : [];
  const state = getPartyState(partyData || {}) || {};
  const participantIds = Array.isArray(state.roundParticipantIds)
    ? state.roundParticipantIds.filter(Boolean)
    : [];
  const hasParticipantSnapshot =
    state.isPlaying === true &&
    (participantIds.length > 0 ||
      players.some((player) => {
        const status = getPlayerState(player).participationStatus;
        return status && status !== 'active';
      }));

  if (!hasParticipantSnapshot) return players;

  const participantIdSet = new Set(participantIds.map(String));
  return players.filter((player) => {
    const playerState = getPlayerState(player);
    return (
      playerState.participationStatus !== 'pending_next_round' &&
      participantIdSet.has(String(getPlayerId(player)))
    );
  });
}

function getWaitingForPlayersRosterSignature(players = []) {
  return JSON.stringify(
    players.map((player) => [getPlayerId(player), getPlayerIcon(player)])
  );
}

async function AddUserIcons(partyData = currentPartyData) {
  if (
    !waitingForPlayersIconContainer ||
    !partyData ||
    !Array.isArray(partyData.players)
  ) {
    return;
  }

  const players = getWaitingForPlayersParticipants(partyData);
  waitingForPlayersIconContainer.replaceChildren();

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const id = getPlayerId(p);
    const icon = getPlayerIcon(p);
    await createUserIconPartyGames({
      container: waitingForPlayersIconContainer,
      userId: id,
      userCustomisationString: icon
    });
  }

  waitingForPlayersRosterSignature =
    getWaitingForPlayersRosterSignature(players);
}

async function SyncWaitingForPlayersIcons(partyData = currentPartyData) {
  if (!waitingForPlayersIconContainer || !partyData) return;

  const players = getWaitingForPlayersParticipants(partyData);
  const nextSignature = getWaitingForPlayersRosterSignature(players);
  const renderedIconCount =
    waitingForPlayersIconContainer.querySelectorAll('.icon').length;
  if (
    nextSignature !== waitingForPlayersRosterSignature ||
    renderedIconCount !== players.length
  ) {
    await AddUserIcons(partyData);
  }
}

function SetWaitingForPlayersIconStates(players, confirmation = true) {
  if (!waitingForPlayersIconContainer || !Array.isArray(players)) return;

  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
  const iconsByPlayerId = new Map();
  const nextConfirmationStates = new Map();
  const localPlayerId =
    typeof deviceId === 'undefined' ? null : String(deviceId);
  const waitingContainerWasVisible =
    typeof isContainerVisible === 'function' &&
    isContainerVisible(waitingForPlayersContainer);
  let anotherPlayerNewlyConfirmed = false;

  icons.forEach(icon => {
    icon.classList.remove('yes');
    icon.classList.remove('no');

    const playerId = icon.dataset.userId;
    if (!playerId) return;

    const playerIcons = iconsByPlayerId.get(playerId) ?? [];
    playerIcons.push(icon);
    iconsByPlayerId.set(playerId, playerIcons);
  });

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const playerId = getPlayerId(player);
    const normalisedPlayerId = String(playerId);
    const pState = getPlayerState(player);
    const check = confirmation ? pState.hasConfirmed : pState.isReady;
    const isConfirmed = pState.hasConfirmed === true;
    const wasConfirmed =
      waitingForPlayersConfirmationStates.get(normalisedPlayerId);
    const matchingIcons = iconsByPlayerId.get(normalisedPlayerId) ?? [];

    nextConfirmationStates.set(normalisedPlayerId, isConfirmed);
    if (
      confirmation &&
      isConfirmed &&
      wasConfirmed === false &&
      normalisedPlayerId !== localPlayerId
    ) {
      anotherPlayerNewlyConfirmed = true;
    }

    matchingIcons.forEach(icon => {
      if (!icon) return;
      icon.classList.toggle('yes', check === true);
    });
  }

  waitingForPlayersConfirmationStates = nextConfirmationStates;

  if (
    confirmation &&
    waitingContainerWasVisible &&
    anotherPlayerNewlyConfirmed &&
    typeof window.PartyGameSounds?.play === 'function'
  ) {
    Promise.resolve(window.PartyGameSounds.play('playerConfirmed'))
      .catch(() => {});
  }
}

function DisplayWaitingForPlayers(confirmation = true) {
  const allPlayers = currentPartyData.players || [];
  const players = getWaitingForPlayersParticipants(currentPartyData);
  const index = allPlayers.findIndex(player => getPlayerId(player) === deviceId);
  if (index === -1) return;

  SetWaitingForPlayersIconStates(players, confirmation);

  const me = allPlayers[index];
  const conn = ensureConnection(me);
  conn.lastPing = new Date();

  setActiveContainers(waitingForPlayersContainer);
}

/* ──────────────────────────────────────────────
   NORMALISERS & HELPERS FOR NESTED/LEGACY SHAPES
────────────────────────────────────────────── */
