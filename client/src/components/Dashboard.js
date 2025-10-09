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
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/rooms/create`, {
        name: 'New Project',
        language: 'javascript'
      });
      const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
      const avatarColor = colors[Math.floor(Math.random() * colors.length)];
      navigate(`/editor/${response.data.roomId}`, { state: { username: promptUsername.trim(), avatarColor } });
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to create room. Please ensure the server is running.';
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
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/rooms/join`, { roomId: roomId.trim(), username: username.trim() });
      navigate(`/editor/${roomId.trim()}`, { state: { username: username.trim(), avatarColor: response.data.avatarColor } });
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to join room. Please check the room ID and ensure the server is running.';
      setError(errorMsg);
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundImage: 'url(https://png.pngtree.com/thumb_back/fh260/background/20201022/pngtree-innovation-abstract-technology-background-template-image_430540.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="max-w-md w-full bg-gray-800/70 rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-center text-white mb-8 flex items-center justify-center"><span className="mr-2 text-2xl"><img
          src="https://png.pngtree.com/element_our/png_detail/20181013/code-icon-design-vector-png_125856.jpg"class="img-fluid rounded-top" alt="Code Icon" className='w-8 rounded-full'/></span>Code Collab</h1>

        {error && <div className="text-red-400 mb-4 text-center">{error}</div>}

        <div className="space-y-6">
          <button
            onClick={handleCreateRoom}
            disabled={createLoading}
            className="w-full bg-gradient-to-r from-gray-700 to-pink-500 text-white py-3 px-4 rounded-md hover:from-gray-600 hover:to-pink-400 disabled:opacity-50"
          >
            {createLoading ? 'Creating...' : 'Create New Room'}
          </button>

          <div className="text-center text-gray-400">or</div>

          <div>
            <input
              type="text"
              placeholder="Enter Room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-4 bg-gray-700 text-white placeholder-gray-400"
            />
            <input
              type="text"
              placeholder="Enter Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-4 bg-gray-700 text-white placeholder-gray-400"
            />
            <button
              onClick={handleJoinRoom}
              disabled={joinLoading}
              className="w-full bg-gradient-to-r from-blue-700 to-cyan-500 text-white py-3 px-4 rounded-md hover:from-blue-900 hover:to-cyan-600 disabled:opacity-50"
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