const express = require('express');
const Project = require('../models/Project');

const router = express.Router();

// POST /api/rooms/create
router.post('/create', async (req, res) => {
  try {
    const { name, language } = req.body;
    const roomId = Math.random().toString(36).substring(2, 15);
    const project = await Project.create({
      roomId,
      name: name || 'Untitled Project',
      language: language || 'javascript',
      participants: []
    });
    res.status(201).json({ roomId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/rooms/join
router.post('/join', async (req, res) => {
  try {
    const { roomId, username } = req.body;
    if (!username || !roomId) {
      return res.status(400).json({ message: 'Username and roomId required' });
    }
    const project = await Project.findOne({ roomId });
    if (!project) {
      return res.status(404).json({ message: 'Room not found' });
    }
    // Generate avatar color
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];
    res.json({ project, avatarColor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
