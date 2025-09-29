import React, { useState, useEffect, useRef } from 'react';

const Chat = ({ socket, roomId, username, theme }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (socket) {
      socket.on('chat-message', (data) => {
        setMessages(prev => [...prev, data]);
      });

      return () => {
        socket.off('chat-message');
      };
    }
  }, [socket]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newMessage.trim() && socket) {
      setLoading(true);
      const messageData = {
        roomId,
        message: newMessage.trim(),
        username
      };
      socket.emit('chat-message', messageData);
      setNewMessage('');
      setLoading(false);
    }
  };

  if (!socket) return null;

  const isDark = theme === 'dark';

  return (
    <div className={`w-80 border-l flex flex-col ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}>
      <div className={`p-4 border-b ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Chat</h3>
      </div>
      <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${isDark ? 'bg-gray-800' : ''}`}>
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.username === username ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs px-3 py-2 rounded-lg ${
              msg.username === username 
                ? 'bg-indigo-500 text-white' 
                : isDark 
                  ? 'bg-gray-700 text-gray-100' 
                  : 'bg-gray-100 text-gray-900'
            }`}>
              <div className="text-sm font-medium">{msg.username}</div>
              <div className="text-sm">{msg.message}</div>
              <div className={`text-xs mt-1 ${isDark ? 'opacity-75 text-gray-300' : 'opacity-75'}`}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className={`p-4 border-t ${isDark ? 'bg-gray-700 border-gray-600' : 'border-gray-200'}`}>
        <div className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
              isDark 
                ? 'bg-gray-600 border-gray-500 text-white placeholder-gray-300 focus:ring-indigo-400' 
                : 'border-gray-300 focus:ring-indigo-500'
            }`}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !newMessage.trim()}
            className={`px-4 py-2 rounded-md hover:opacity-90 disabled:opacity-50 ${
              isDark 
                ? 'bg-indigo-600 text-white' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
};

export default Chat;
