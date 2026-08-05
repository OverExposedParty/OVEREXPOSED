const mongoose = require('mongoose');

const partyGameEventSchema = new mongoose.Schema(
  {
    partyId: { type: String, required: true, index: true },
    gameId: { type: String, default: null, index: true },
    eventKey: { type: String, required: true },
    gamemode: { type: String, required: true },
    action: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

partyGameEventSchema.index({ partyId: 1, eventKey: 1 }, { unique: true });

module.exports = mongoose.model(
  'PartyGameEvent',
  partyGameEventSchema,
  'party-game-events'
);
