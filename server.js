const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// connect mongodb
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(()=>console.log('MongoDB connected'))
  .catch(e=>console.error(e));

// Models (مبسطة) - ضعهم في مجلد models/
const User = require('./models/User');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');

// API routes (auth, upload, conversations...)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/upload', require('./routes/upload'));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Map userId -> socketId(s) (ندعم اتصال متعدد للأجهزة)
const onlineUsers = new Map();

io.on('connection', socket => {
  console.log('socket connected', socket.id);

  socket.on('user:online', ({ userId }) => {
    const set = onlineUsers.get(userId) || new Set();
    set.add(socket.id);
    onlineUsers.set(userId, set);
    // broadcast presence
    io.emit('presence:update', [...onlineUsers.keys()]);
  });

  socket.on('send:message', async ({ conversationId, senderId, text, type, media }) => {
    // SAVE message to DB
    const msg = await Message.create({ conversation: conversationId, sender: senderId, text, type, media, createdAt: new Date() });
    // emit to participants
    const conv = await Conversation.findById(conversationId);
    conv.participants.forEach(pid => {
      const sockets = onlineUsers.get(pid.toString());
      if (sockets) sockets.forEach(sid => io.to(sid).emit('message:receive', msg));
    });
  });

  // typing indicator
  socket.on('typing', ({ conversationId, userId }) => {
    // broadcast to other participants
    socket.to(conversationId).emit('typing', { conversationId, userId });
  });

  // join rooms for conversations (helps إرسال للمجموعة)
  socket.on('join:conversation', ({ conversationId }) => {
    socket.join(conversationId);
  });

  // WebRTC signaling for calls
  socket.on('call:offer', payload => {
    // payload = { toUserId, fromUserId, sdp }
    const sockets = onlineUsers.get(payload.toUserId);
    if (sockets) sockets.forEach(sid => io.to(sid).emit('call:offer', payload));
  });
  socket.on('call:answer', payload => {
    const sockets = onlineUsers.get(payload.toUserId);
    if (sockets) sockets.forEach(sid => io.to(sid).emit('call:answer', payload));
  });
  socket.on('call:ice', payload => {
    const sockets = onlineUsers.get(payload.toUserId);
    if (sockets) sockets.forEach(sid => io.to(sid).emit('call:ice', payload));
  });

  socket.on('disconnect', () => {
    // remove socket.id from onlineUsers
    for (const [userId, set] of onlineUsers.entries()) {
      if (set.has(socket.id)) {
        set.delete(socket.id);
        if (set.size === 0) onlineUsers.delete(userId);
        else onlineUsers.set(userId, set);
        break;
      }
    }
    io.emit('presence:update', [...onlineUsers.keys()]);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, ()=>console.log('Server running on', PORT));