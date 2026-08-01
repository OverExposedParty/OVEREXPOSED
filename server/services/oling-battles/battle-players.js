const mongoose = require('mongoose');

const { getOlingDefinitions, serializeOlingTrait } = require('../olings');
const { AI_OLING_PRESETS, DEFAULT_AI_DIFFICULTY } = require('./constants');

function getAccountDisplayName(account) {
  return (
    account?.profile?.displayName ||
    account?.username ||
    account?.email ||
    'Player'
  );
}

function getBodyHealth(serializedOling) {
  const health = Number(serializedOling?.traits?.body?.body?.health);
  return Number.isFinite(health) && health > 0 ? Math.round(health) : 100;
}

function clampDifficulty(value) {
  const difficulty = Number(value);
  if (!Number.isFinite(difficulty)) return DEFAULT_AI_DIFFICULTY;
  return Math.max(0, Math.min(1, difficulty));
}

function pickRandom(values) {
  return values[Math.floor(Math.random() * values.length)] || values[0];
}

async function createAiBattlePlayer(
  models,
  slot,
  difficulty = DEFAULT_AI_DIFFICULTY
) {
  const preset = pickRandom(AI_OLING_PRESETS);
  const definitions = await getOlingDefinitions(models, [
    {
      build: preset.build,
      eggKey: 'base-egg'
    }
  ]);
  const traits = Object.fromEntries(
    ['body', 'eyes', 'mouth', 'flight'].map((layer) => [
      layer,
      serializeOlingTrait(definitions.traitsByKey.get(preset.build[layer]))
    ])
  );
  const maxHealth = getBodyHealth({ traits }) || preset.maxHealth;
  const accountId = new mongoose.Types.ObjectId();
  const olingId = new mongoose.Types.ObjectId();

  return {
    accountId,
    aiDifficulty: clampDifficulty(difficulty),
    connected: true,
    currentHealth: maxHealth,
    isAi: true,
    lastActionAt: null,
    maxHealth,
    oeIcon: preset.oeIcon,
    olingId,
    olingSnapshot: {
      id: String(olingId),
      name: preset.name,
      level: preset.level,
      personalityKey: preset.personalityKey,
      build: preset.build,
      equipment: {},
      traits
    },
    playerName: `AI ${preset.name}`,
    ready: true,
    slot,
    stunUntil: null
  };
}

async function snapshotBattleOling(models, account, olingId) {
  const { PlayerOling } = models;
  const oling = await PlayerOling.findOne({
    _id: olingId,
    ownerId: account._id
  }).lean();

  if (!oling) {
    const error = new Error('That Oling could not be found.');
    error.status = 404;
    error.code = 'player_oling_not_found';
    throw error;
  }

  const definitions = await getOlingDefinitions(models, [oling]);
  const bodyHealth = getBodyHealth({
    traits: Object.fromEntries(
      ['body', 'eyes', 'mouth', 'flight'].map((layer) => [
        layer,
        serializeOlingTrait(definitions.traitsByKey.get(oling.build?.[layer]))
      ])
    )
  });

  return {
    currentHealth: bodyHealth,
    maxHealth: bodyHealth,
    player: {
      accountId: account._id,
      connected: true,
      lastActionAt: null,
      maxHealth: bodyHealth,
      currentHealth: bodyHealth,
      olingId: oling._id,
      olingSnapshot: {
        id: String(oling._id),
        name: oling.name || null,
        level: oling.level || 1,
        personalityKey: oling.personalityKey || '',
        build: oling.build || {},
        equipment: oling.equipment || {},
        traits: Object.fromEntries(
          ['body', 'eyes', 'mouth', 'flight'].map((layer) => [
            layer,
            serializeOlingTrait(
              definitions.traitsByKey.get(oling.build?.[layer])
            )
          ])
        )
      },
      playerName: getAccountDisplayName(account),
      oeIcon: account?.profile?.oeIcon || '0000:0100:0200:0300',
      ready: false,
      stunUntil: null
    }
  };
}

function getHumanMatchPlayer(match, account) {
  return match.players.find(
    (item) => !item.isAi && String(item.accountId) === String(account._id)
  );
}

function getAiOpponent(match, account) {
  return match.players.find(
    (item) => item.isAi && String(item.accountId) !== String(account._id)
  );
}

module.exports = {
  clampDifficulty,
  createAiBattlePlayer,
  getAiOpponent,
  getHumanMatchPlayer,
  snapshotBattleOling
};
