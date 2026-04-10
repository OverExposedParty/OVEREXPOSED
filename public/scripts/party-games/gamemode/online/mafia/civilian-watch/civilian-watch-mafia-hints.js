

const mafiaHintsReady = buildMafiaHints()
  .then(result => { mafiaHints = result; })
  .catch(err => {
    console.error("Failed to build mafia hints:", err);
    mafiaHints = {};
  });

const mafiaHintsPackColourReady = buildMafiaHintsPackColour()
  .then(result => { mafiaHintsPackColour = result; })
  .catch(err => {
    console.error("Failed to build mafia hints pack colour:", err);
    mafiaHintsPackColour = {};
  });

function GetRandomMafioso(currentPartyData, mafiosoRolesArray) {
  if (!currentPartyData?.players) return null;

  const matching = currentPartyData.players.filter(
    p => mafiosoRolesArray.includes(p?.state?.role) && p?.state?.status === "alive"
  );

  if (!matching.length) return null;
  return matching[Math.floor(Math.random() * matching.length)];
}

async function buildMafiaHints() {
  const packsMeta = await fetch("/json-files/customisation/customisation-packs.json").then(r => r.json());
  const result = {};

  const packPayloads = await Promise.all(
    packsMeta.map(p => fetch(p["pack-path"]).then(r => r.json()))
  );

  packPayloads.forEach(packData => {
    for (const key of Object.keys(packData)) {
      const items = packData[key];
      if (!Array.isArray(items)) continue;

      items.forEach(item => {
        const id = item.id;
        const name = item.name ?? item.word ?? item["item-name"] ?? null;
        result[id] = { name };
      });
    }
  });

  return result;
}

async function buildMafiaHintsPackColour() {
  const packsMeta = await fetch("/json-files/customisation/customisation-packs.json").then(r => r.json());
  const result = {};

  packsMeta.forEach(p => {
    const packPrefix = p["pack-prefix"] ?? p.packPrefix ?? p.packprefix ?? null;
    if (!packPrefix) return;
    result[packPrefix] = { "pack-colour": p["pack-colour"] ?? p.packColour ?? p["pack-color"] ?? p.packColor ?? null };
  });

  return result;
}
function getMafiaItemName(id) {
  return mafiaHints[id]?.name ?? null;
}

function getHintIdsFromPlayer(player) {
  const parsed = parseCustomisationString(player?.identity?.userIcon);

  const ids = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object"
      ? Object.values(parsed)
      : [];

  return ids.filter(id => id && mafiaHints?.[id]?.name);
}

function injectMafiaHint(text) {
  const targetMafioso = GetRandomMafioso(currentPartyData, mafiosoRoles);
  if (!targetMafioso) return text;
  if (!Object.keys(mafiaHints).length) return text;

  const mafiosoHintIds = getHintIdsFromPlayer(targetMafioso);

  return text.replace(/\[HINT(?::([^\]]*))?\]/gi, (match, inner) => {
    let ids = [];

    if (inner) {
      const matches = inner.match(/[A-Za-z0-9_-]+/g);
      if (matches?.length) {
        ids = matches.filter(id => mafiaHints?.[id]?.name);
      }
    }

    if (!ids.length) ids = mafiosoHintIds;
    if (!ids.length) return match;

    const randomId = ids[Math.floor(Math.random() * ids.length)];
    const itemName = mafiaHints[randomId]?.name;
    if (!itemName) return match;
    // 👇 inline color, CSS handles font weight
    return `<span class="mafia-hint" style="color: ${getMafiaHintPackColour(randomId)};">${itemName}</span>`;
  });
}

function GetMafiaItem(string, type = 0) {
  const parsed = parseCustomisationString(string);
  return getMafiaItemName(parsed[type]);
}

function getMafiaHintPackColour(hintId) {
  const packPrefix = hintId.slice(0, 1);
  return mafiaHintsPackColour[packPrefix]?.["pack-colour"] ?? null;
}
