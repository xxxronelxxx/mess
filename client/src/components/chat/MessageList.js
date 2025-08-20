import React from 'react';
import Message from './Message';
import './MessageList.css';

const MessageList = ({ messages, currentUserId, serverConfig }) => {
  if (!messages || messages.length === 0) {
    return (
      <div className="message-list empty">
        <div className="empty-state">
          <p>Нет сообщений</p>
          <p>Начните разговор!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="message-list">
      {messages.map((message) => (
        <Message
          key={message.id}
          message={message}
          isOwn={message.senderId === currentUserId}
          serverConfig={serverConfig}
        />
      ))}
    </div>
  );
};

export default MessageList;