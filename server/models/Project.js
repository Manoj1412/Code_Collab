const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    default: 'Untitled Project'
  },
  codes: {
    type: Map,
    of: String,
    default: { javascript: '// Start coding here' }
  },
  language: {
    type: String,
    default: 'javascript'
  },
  participants: [{
    username: String,
    avatarColor: String,
    socketId: String
  }],
  snapshots: [{
    codes: {
      type: Map,
      of: String
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Project', projectSchema);
