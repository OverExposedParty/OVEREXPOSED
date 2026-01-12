const mongoose = require('mongoose');

const ConfessionSchema = new mongoose.Schema({
  title: String,
  text: String,
  id: String,
  date: String,
  userIcon: {
    type: String,
    default: "0000:0100:0200:0300"
  },
  x: String,
  y: String,
  tag: {
    type: String,
    enum: ['confessions', 'stories', 'thoughts', 'feelings'],
    default: 'confessions'
  },
  deleteCodeHash: { type: String, required: true }
});

module.exports = mongoose.model('Confession', ConfessionSchema, 'confessions');
