const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  username: { type: String, required: true, default: '[CONSOLE]' },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  eventType: { type: String, enum: ['message', 'connect', 'disconnect', 'error'], default: 'message' },
}, { _id: false });

const ChatLogSchema = new mongoose.Schema({
  partyId: { type: String, required: true },
  chat: { type: [chatSchema], required: true },
  lastPinged: { type: Date, default: Date.now },
}, {
  versionKey: false
});

// Optional: remove _id and __v from response
ChatLogSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('ChatLog', ChatLogSchema, 'party-game-chat-log');