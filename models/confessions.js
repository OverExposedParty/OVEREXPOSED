const mongoose = require('mongoose');

const ConfessionSchema = new mongoose.Schema({
  title: String,
  text: String,
  id: String,
  date: String,
  x: String,
  y: String
});

module.exports = mongoose.model('Confession', ConfessionSchema, 'confessions');
