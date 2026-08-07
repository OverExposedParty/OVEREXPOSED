const fs = require('fs/promises');
const path = require('path');

const GAMEMODES_ROOT = path.join(
  process.cwd(),
  'public',
  'json-files',
  'party-games',
  'gamemodes'
);
const GAMEMODES_FILE = path.join(GAMEMODES_ROOT, 'gamemodes.json');

function serializeGameModeForJson(gamemode) {
  return {
    gamemodeID: gamemode.gameType,
    gamemodeVersion: gamemode.version || '1.0.0',
    gamemodeName: gamemode.name,
    gamemodeCardImageFront: gamemode.cardImages?.front || '',
    gamemodeCardImageBack: gamemode.cardImages?.back || '',
    gamemodeDescription: gamemode.description || '',
    gamemodePrimaryColour: gamemode.colours?.primary || '',
    gamemodeSecondaryColour: gamemode.colours?.secondary || '',
    gamemodeLink: gamemode.link || '',
    gamemodeTextUpdates: gamemode.textUpdates || '',
    'gamemode-active': Boolean(
      gamemode.enabled && gamemode.status === 'published'
    )
  };
}

function serializeGameModeForApi(gamemode) {
  return {
    ...serializeGameModeForJson(gamemode),
    gameMode: gamemode.gameType,
    label: gamemode.name
  };
}

async function readGamemodesJson() {
  return JSON.parse(await fs.readFile(GAMEMODES_FILE, 'utf8'));
}

async function importGameModesFromJson(GameMode) {
  const gamemodes = await readGamemodesJson();
  const imported = [];

  for (const [index, gamemode] of gamemodes.entries()) {
    const gameType = String(gamemode.gamemodeID || '').trim();
    if (!gameType) continue;

    const savedGamemode = await GameMode.findOneAndUpdate(
      { gameType },
      {
        $set: {
          gameType,
          version: gamemode.gamemodeVersion || '1.0.0',
          name: gamemode.gamemodeName || gameType,
          description: gamemode.gamemodeDescription || '',
          cardImages: {
            front: gamemode.gamemodeCardImageFront || '',
            back: gamemode.gamemodeCardImageBack || ''
          },
          colours: {
            primary: gamemode.gamemodePrimaryColour || '',
            secondary: gamemode.gamemodeSecondaryColour || ''
          },
          link: gamemode.gamemodeLink || '',
          textUpdates: gamemode.gamemodeTextUpdates || '',
          enabled: gamemode['gamemode-active'] !== false,
          status: gamemode['gamemode-active'] === false ? 'draft' : 'published',
          sortOrder: index
        }
      },
      { new: true, upsert: true, runValidators: true }
    );

    imported.push(savedGamemode);
  }

  return imported;
}

async function exportGameModesToJson(GameMode) {
  const gamemodes = await GameMode.find({})
    .sort({ sortOrder: 1, gameType: 1 })
    .lean();

  await fs.mkdir(GAMEMODES_ROOT, { recursive: true });
  await fs.writeFile(
    GAMEMODES_FILE,
    `${JSON.stringify(gamemodes.map(serializeGameModeForJson), null, 2)}\n`
  );

  return gamemodes;
}

async function getPublishedGameModes(GameMode) {
  let gamemodes = [];

  try {
    gamemodes = await GameMode.find({
      enabled: true,
      status: 'published'
    })
      .sort({ sortOrder: 1, gameType: 1 })
      .lean();
  } catch (error) {
    console.warn('Falling back to JSON game modes:', error.message || error);
  }

  if (gamemodes.length) return gamemodes;

  const fallbackGamemodes = await readGamemodesJson();
  return fallbackGamemodes
    .filter((gamemode) => gamemode['gamemode-active'] !== false)
    .map((gamemode, index) => ({
      gameType: gamemode.gamemodeID,
      version: gamemode.gamemodeVersion || '1.0.0',
      name: gamemode.gamemodeName,
      description: gamemode.gamemodeDescription || '',
      cardImages: {
        front: gamemode.gamemodeCardImageFront || '',
        back: gamemode.gamemodeCardImageBack || ''
      },
      colours: {
        primary: gamemode.gamemodePrimaryColour || '',
        secondary: gamemode.gamemodeSecondaryColour || ''
      },
      link: gamemode.gamemodeLink || '',
      textUpdates: gamemode.gamemodeTextUpdates || '',
      enabled: true,
      status: 'published',
      sortOrder: index
    }));
}

module.exports = {
  exportGameModesToJson,
  getPublishedGameModes,
  importGameModesFromJson,
  serializeGameModeForApi,
  serializeGameModeForJson
};
