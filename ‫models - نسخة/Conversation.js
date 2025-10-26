const mongoose = require('mongoose');
const ConversationSchema = new mongoose.Schema({
  title: String,
  isGroup: { type: Boolean, default: false },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
module.exports = mongoose.model('Conversation', ConversationSchema);