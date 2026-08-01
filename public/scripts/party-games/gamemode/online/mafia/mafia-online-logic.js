function GetMafiaVote() {
  if (!currentPartyData || !currentPartyData.players) return '';

  const votes = currentPartyData.players
    .filter((player) =>
      getMafiaRoleActionKeys(player.state.roleKey, 'night').includes(
        MAFIA_ACTION_KEYS.MAFIA_KILL_VOTE
      )
    )
    .map((player) => player.state.vote)
    .filter((vote) => !!vote);

  return getMostFrequentVote(votes);
}

async function GetTownVote() {
  const response = await fetch(
    `/api/${sessionPartyType}?partyCode=${partyCode}`
  );
  const data = await response.json();

  if (!data.length) return '';

  const party = data[0];

  const votes = party.players
    .map((player) => player.state.vote)
    .filter((vote) => !!vote);

  return getMostFrequentVote(votes);
}

function getMostFrequentVote(votes) {
  if (!Array.isArray(votes) || votes.length === 0) return '';

  const counts = {};
  for (const vote of votes) {
    if (vote) {
      counts[vote] = (counts[vote] || 0) + 1;
    }
  }

  let maxCount = 0;
  let maxVote = '';
  let isTie = false;

  for (const vote in counts) {
    if (counts[vote] > maxCount) {
      maxCount = counts[vote];
      maxVote = vote;
      isTie = false;
    } else if (counts[vote] === maxCount) {
      isTie = true;
    }
  }

  return isTie ? '' : maxVote;
}

async function CheckGameOver() {
  const currentPartyData = await GetCurrentPartyData({
    requireInstructions: true,
    retries: 8,
    delayMs: 150
  });
  if (!currentPartyData || !currentPartyData.players) return null;

  const alive = currentPartyData.players.filter(
    (p) => p.state.status === 'alive'
  );

  const civilians = alive.filter(
    (p) => getMafiaRoleTeamKey(p.state.roleKey) === 'town'
  );
  const mafia = alive.filter(
    (p) => getMafiaRoleTeamKey(p.state.roleKey) === 'mafia'
  );
  const neutrals = alive.filter(
    (p) => getMafiaRoleTeamKey(p.state.roleKey) === 'neutral'
  );
  const serialKillers = alive.filter(
    (p) => p.state.roleKey === 'serial-killer'
  );
  //return null //temp
  // Mafia win: mafia >= civilians + neutrals (or however you define it)
  if (mafia.length > 0 && mafia.length >= civilians.length + neutrals.length) {
    return 'DISPLAY_GAMEOVER:MAFIOSO';
  }

  // Town win: no mafia + at least 1 town
  if (mafia.length === 0 && civilians.length > 0) {
    return 'DISPLAY_GAMEOVER:CIVILIAN';
  }

  // Serial killer solo win (if you want it):
  if (serialKillers.length === 1 && alive.length === 1) {
    return 'DISPLAY_GAMEOVER:SERIAL_KILLER';
  }

  // Optional: everyone dead / pure neutrals = draw or special ending
  if (alive.length === 0) {
    return 'DISPLAY_GAMEOVER:DRAW';
  }

  return null;
}
