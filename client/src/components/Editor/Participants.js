import React from 'react';

const Participants = ({ participants }) => {
  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-600">Participants:</span>
      {participants.map((participant) => (
        <div
          key={participant.socketId}
          className="flex items-center space-x-1"
          title={participant.username}
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: participant.avatarColor }}
          >
            {participant.username.charAt(0).toUpperCase()}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Participants;
