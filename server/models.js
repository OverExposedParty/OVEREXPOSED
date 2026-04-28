const Confession = require('../models/confessions');
const partyGameTruthOrDareSchema = require('../models/party-game-truth-or-dare-schema');
const partyGameParanoiaSchema = require('../models/party-game-paranoia-schema');
const partyGameNeverHaveIEverSchema = require('../models/party-game-never-have-i-ever-schema');
const partyGameMostLikelyToSchema = require('../models/party-game-most-likely-to-schema');
const partyGameWouldYouRatherSchema = require('../models/party-game-would-you-rather-schema');
const partyGameMafiaSchema = require('../models/party-game-mafia-schema');
const partyGameChatLogSchema = require('../models/party-game-chat-log-schema');
const waitingRoomSchema = require('../models/waiting-room-schema');
const partyGameImposterSchema = require('../models/party-game-imposter-schema');

const PARTY_GAME_MODELS_BY_GAMEMODE = {
  'truth-or-dare': partyGameTruthOrDareSchema,
  paranoia: partyGameParanoiaSchema,
  'never-have-i-ever': partyGameNeverHaveIEverSchema,
  'most-likely-to': partyGameMostLikelyToSchema,
  imposter: partyGameImposterSchema,
  'would-you-rather': partyGameWouldYouRatherSchema,
  mafia: partyGameMafiaSchema
};

module.exports = {
  Confession,
  partyGameTruthOrDareSchema,
  partyGameParanoiaSchema,
  partyGameNeverHaveIEverSchema,
  partyGameMostLikelyToSchema,
  partyGameWouldYouRatherSchema,
  partyGameMafiaSchema,
  partyGameChatLogSchema,
  waitingRoomSchema,
  partyGameImposterSchema,
  PARTY_GAME_MODELS_BY_GAMEMODE
};
