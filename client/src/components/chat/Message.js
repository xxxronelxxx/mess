import React from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import './Message.css';

const Message = ({ message, isOwn, serverConfig }) => {
  const formatTime = (timestamp) => {
    try {
      return format(new Date(timestamp), 'HH:mm', { locale: ru });
    } catch {
      return '--:--';
    }
  };

  const renderMessageContent = () => {
    switch (message.type) {
      case 'text':
        return <div className="message-text">{message.text}</div>;
      
      case 'image':
        return (
          <div className="message-image">
            <img 
              src={`${serverConfig.url}/uploads/${message.file.filePath}`} 
              alt="Image" 
            />
          </div>
        );
      
      case 'video':
        return (
          <div className="message-video">
            <video controls>
              <source src={`${serverConfig.url}/uploads/${message.file.filePath}`} />
              Your browser does not support the video tag.
            </video>
          </div>
        );
      
      case 'file':
        return (
          <div className="message-file">
            <div className="file-info">
              <span className="file-name">{message.file.originalName}</span>
              <span className="file-size">{formatFileSize(message.file.fileSize)}</span>
            </div>
            <a 
              href={`${serverConfig.url}/api/files/${message.file.id}`}
              className="file-download"
              target="_blank"
              rel="noopener noreferrer"
            >
              📥 Скачать
            </a>
          </div>
        );
      
      default:
        return <div className="message-text">Неизвестный тип сообщения</div>;
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className={`message ${isOwn ? 'own' : 'other'}`}>
      <div className="message-content">
        {!isOwn && (
          <div className="message-avatar">
            <div className="avatar-placeholder">
              {message.senderUsername?.charAt(0).toUpperCase()}
            </div>
          </div>
        )}
        
        <div className="message-bubble">
          {!isOwn && (
            <div className="message-sender">{message.senderUsername}</div>
          )}
          
          {renderMessageContent()}
          
          <div className="message-time">
            {formatTime(message.timestamp)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Message;