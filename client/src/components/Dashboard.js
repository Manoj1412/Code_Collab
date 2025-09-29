import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Dashboard = () => {
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const navigate = useNavigate();

  const handleCreateRoom = async () => {
    const promptUsername = prompt('Enter your username for the new room:');
    if (!promptUsername) {
      setError('Username required to create room');
      return;
    }
    setCreateLoading(true);
    setError('');
    try {
      const response = await axios.post('http://localhost:5000/api/rooms/create', {
        name: 'New Project',
        language: 'javascript'
      });
      const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
      const avatarColor = colors[Math.floor(Math.random() * colors.length)];
      navigate(`/editor/${response.data.roomId}`, { state: { username: promptUsername.trim(), avatarColor } });
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to create room. Please ensure the server is running on port 5000.';
      setError(errorMsg);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomId.trim() || !username.trim()) {
      setError('Please enter room ID and username');
      return;
    }
    setJoinLoading(true);
    setError('');
    try {
      const response = await axios.post('http://localhost:5000/api/rooms/join', { roomId: roomId.trim(), username: username.trim() });
      navigate(`/editor/${roomId.trim()}`, { state: { username: username.trim(), avatarColor: response.data.avatarColor } });
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to join room. Please check the room ID and ensure the server is running.';
      setError(errorMsg);
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">Code Collab</h1>
        
        {error && <div className="text-red-600 mb-4 text-center">{error}</div>}

        <div className="space-y-6">
          <button
            onClick={handleCreateRoom}
            disabled={createLoading}
            className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {createLoading ? 'Creating...' : 'Create New Room'}
          </button>

          <div className="text-center text-gray-500">or</div>

          <div>
            <input
              type="text"
              placeholder="Enter Room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
            />
            <input
              type="text"
              placeholder="Enter Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
            />
            <button
              onClick={handleJoinRoom}
              disabled={joinLoading}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {joinLoading ? 'Joining...' : 'Join Room'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
