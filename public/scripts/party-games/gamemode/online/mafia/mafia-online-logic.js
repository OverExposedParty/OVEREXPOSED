function GetMafiaVote() {
  if (!currentPartyData || !currentPartyData.players) return "";

  const votes = currentPartyData.players
    .filter(player => mafiosoRoles.includes(player.state.role))
    .map(player => player.state.vote)
    .filter(vote => !!vote);

  return getMostFrequentVote(votes);
}

async function GetTownVote() {
  const response = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await response.json();

  if (!data.length) return "";

  const party = data[0];

  const votes = party.players
    .map(player => player.state.vote)
    .filter(vote => !!vote);

  return getMostFrequentVote(votes);
}

function getMostFrequentVote(votes) {
  if (!Array.isArray(votes) || votes.length === 0) return "";

  const counts = {};
  for (const vote of votes) {
    if (vote) {
      counts[vote] = (counts[vote] || 0) + 1;
    }
  }

  let maxCount = 0;
  let maxVote = "";
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

  return isTie ? "" : maxVote;
}

async function CheckGameOver() {
  const currentPartyData = await GetCurrentPartyData({ requireInstructions: true, retries: 8, delayMs: 150 });
  if (!currentPartyData || !currentPartyData.players) return null;

  const alive = currentPartyData.players.filter(p => p.state.status === "alive");

  const civilians = alive.filter(p => civilianRoles.includes(p.state.role));
  const mafia = alive.filter(p => mafiosoRoles.includes(p.state.role));
  const neutrals = alive.filter(p => neutralRoles.includes(p.state.role));
  const serialKillers = alive.filter(p => p.state.role === "serial killer");
  //return null //temp
  // Mafia win: mafia >= civilians + neutrals (or however you define it)
  if (mafia.length > 0 && mafia.length >= civilians.length + neutrals.length) {
    return "DISPLAY_GAMEOVER:MAFIOSO";
  }

  // Town win: no mafia + at least 1 town
  if (mafia.length === 0 && civilians.length > 0) {
    return "DISPLAY_GAMEOVER:CIVILIAN";
  }

  // Serial killer solo win (if you want it):
  if (serialKillers.length === 1 && alive.length === 1) {
    return "DISPLAY_GAMEOVER:SERIAL_KILLER";
  }

  // Optional: everyone dead / pure neutrals = draw or special ending
  if (alive.length === 0) {
    return "DISPLAY_GAMEOVER:DRAW";
  }

  return null;
}


async function GetRoles(playerCount) {
  try {
    const response = await fetch('/json-files/party-games/packs/mafia.json');
    const data = await response.json();

    const validRoles = (data["mafia-packs"] || [])
      .filter(item => item["pack-type"] === "role" && item["pack-active"] === true)
      .map(item => item["pack-name"]);

    const builtList = [];

    partyRulesSettings.forEach(entry => {
      if (!entry) return;
      const parts = entry.split(':').map(s => s.trim());
      const key = parts[0].replace("mafia-", '');
      const count = parseInt(parts[1], 10);
      console.log("key", key, "count", count);
      console.log("validRoles", validRoles);

      if (validRoles.includes(key)) {
        const times = Number.isFinite(count) && count > 0 ? count : 1;
        for (let i = 0; i < times; i++) builtList.push(key);
      }
    });

    while (builtList.length < playerCount) {
      builtList.push("mafia-civilian");
    }

    const roleCounts = builtList.reduce((acc, role) => {
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});

    const roleString = Object.entries(roleCounts)
      .map(([role, cnt]) => `${role}:${cnt}`)
      .join(', ');

    return roleString;
  } catch (err) {
    console.error('GetRoles error:', err);
    return null;
  }
}

function getShuffledRoles(roleString) {
  const roles = [];
  roleString.split(', ').forEach(entry => {
    if (entry.trim() === '') return;
    const [roleRaw, countStr] = entry.split(':');
    const count = countStr ? parseInt(countStr, 10) : 1;

    const formattedRole = roleRaw.trim()
      .replace(/^mafia-/, '')
      .replace(/-/g, ' ');

    for (let i = 0; i < count; i++) {
      roles.push(formattedRole);
    }
  });

  const shuffled = [...roles];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}
