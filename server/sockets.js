const Project = require('./models/Project');

const handleSocket = (io) => {
  // Rate limiting helper
  const rateLimit = (socket, action, limit = 100, windowMs = 60000) => {
    if (!socket.rateLimits) socket.rateLimits = {};
    const key = `${action}:${socket.id}`;
    const now = Date.now();
    if (!socket.rateLimits[key] || now - socket.rateLimits[key].last > windowMs) {
      socket.rateLimits[key] = { count: 1, last: now };
      return true;
    }
    if (socket.rateLimits[key].count >= limit) {
      socket.emit('error', { message: 'Rate limit exceeded' });
      return false;
    }
    socket.rateLimits[key].count++;
    return true;
  };

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join room
    socket.on('join-room', async (data) => {
      const { roomId, username, avatarColor } = data;
      try {
        const project = await Project.findOne({ roomId });
        if (!project) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        socket.join(roomId);
        socket.roomId = roomId;
        socket.username = username;
        socket.avatarColor = avatarColor;

        // Add user to participants if not already
        const existingParticipant = project.participants.find(p => p.socketId === socket.id);
        if (!existingParticipant) {
          project.participants.push({ socketId: socket.id, username, avatarColor });
          await project.save();
        }

        // Emit room data to all in room
        const participants = project.participants.map(p => ({
          socketId: p.socketId,
          username: p.username,
          avatarColor: p.avatarColor
        }));
        // Prepare all codes as plain object
        const allCodes = {};
        for (const [lang, code] of project.codes.entries()) {
          allCodes[lang] = code;
        }
        io.to(roomId).emit('room-joined', { roomId, participants, codes: allCodes, language: project.language });

        // Emit user joined to others
        socket.to(roomId).emit('user-joined', { socketId: socket.id, username, avatarColor });
      } catch (error) {
        console.error(error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Leave room
    socket.on('leave-room', async () => {
      if (socket.roomId) {
        const roomId = socket.roomId;

        // Remove from participants
        const project = await Project.findOne({ roomId });
        if (project) {
          project.participants = project.participants.filter(p => p.socketId !== socket.id);
          await project.save();
        }

        socket.leave(roomId);
        socket.roomId = null;
      }
    });

    // Code change
    socket.on('code-change', async (data) => {
      if (!rateLimit(socket, 'code-change')) return;
      const { roomId, code, language } = data;
      if (socket.roomId === roomId) {
        try {
          const project = await Project.findOne({ roomId });
          if (project) {
            project.codes.set(language, code);
            await project.save();
          }
        } catch (error) {
          console.error('Error saving code change:', error);
        }
        socket.to(roomId).emit('code-updated', { code, language });
      }
    });

    // Language change
    socket.on('language-change', async (data) => {
      const { roomId, language } = data;
      if (socket.roomId === roomId) {
        try {
          const project = await Project.findOne({ roomId });
          if (project) {
            project.language = language;
            await project.save();
            // Emit updated language and code for that language only to the sender
            const code = project.codes.get(language) || '';
            socket.emit('language-updated', { language, code });
          }
        } catch (error) {
          console.error('Error handling language change:', error);
        }
      }
    });

    // Cursor update
    socket.on('cursor-update', (data) => {
      if (!rateLimit(socket, 'cursor-update', 50, 10000)) return;
      const { roomId, position, selection } = data;
      if (socket.roomId === roomId) {
        socket.to(roomId).emit('cursor-moved', {
          socketId: socket.id,
          position,
          selection
        });
      }
    });

    // Typing indicator
    socket.on('typing-start', (data) => {
      const { roomId } = data;
      if (socket.roomId === roomId) {
        socket.to(roomId).emit('user-typing', { socketId: socket.id });
      }
    });

    socket.on('typing-stop', (data) => {
      const { roomId } = data;
      if (socket.roomId === roomId) {
        socket.to(roomId).emit('user-stopped-typing', { socketId: socket.id });
      }
    });

    // Chat message
    socket.on('chat-message', (data) => {
      if (!rateLimit(socket, 'chat-message')) return;
      const { roomId, message } = data;
      if (socket.roomId === roomId) {
        const chatData = {
          socketId: socket.id,
          username: socket.username,
          message,
          timestamp: new Date()
        };
        io.to(roomId).emit('chat-message', chatData);
      }
    });

    // Auto-save snapshot
    socket.on('save-snapshot', async (data) => {
      const { roomId, code } = data;
      if (socket.roomId === roomId) {
        try {
          const project = await Project.findOne({ roomId });
          if (project) {
            project.snapshots.push({ code, timestamp: new Date() });
            // Keep only last 10 snapshots for MVP
            if (project.snapshots.length > 10) {
              project.snapshots = project.snapshots.slice(-10);
            }
            project.code = code; // Update current code
            await project.save();
          }
        } catch (error) {
          console.error('Save error:', error);
        }
      }
    });

    // Output update
    socket.on('output-update', (data) => {
      const { roomId, output } = data;
      if (socket.roomId === roomId) {
        io.to(roomId).emit('output-updated', { output });
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      if (socket.roomId) {
        socket.to(socket.roomId).emit('user-left', { socketId: socket.id });
        // Remove from participants on disconnect
        Project.findOne({ roomId: socket.roomId }).then(project => {
          if (project) {
            project.participants = project.participants.filter(p => p.socketId !== socket.id);
            project.save();
          }
        });
      }
      console.log('User disconnected:', socket.id);
    });
  });
};

module.exports = { handleSocket };
