const mongoose = require('mongoose');
const UserSchema = new mongoose.Schema({
  name: String,
  phone: { type: String, unique: true },
  passwordHash: String,
  avatar: String,
  lastSeen: Date
});
module.exports = mongoose.model('User', UserSchema);