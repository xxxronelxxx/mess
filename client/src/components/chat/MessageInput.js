import React, { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './MessageInput.css';

const MessageInput = ({ chatId, onNewMessage, serverConfig }) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef();
  const { user } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || !chatId) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${serverConfig.url}/api/messages/${chatId}/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text: text.trim() })
      });

      if (response.ok) {
        const data = await response.json();
        onNewMessage(data.data);
        setText('');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files.length || !chatId) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${serverConfig.url}/api/messages/${chatId}/file`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (response.ok) {
          const data = await response.json();
          onNewMessage(data.data);
        }
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setLoading(false);
      // Очищаем input для возможности повторной загрузки того же файла
      e.target.value = '';
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!chatId) {
    return (
      <div className="message-input disabled">
        <p>Выберите чат для отправки сообщения</p>
      </div>
    );
  }

  return (
    <div className="message-input">
      <form onSubmit={handleSubmit}>
        <div className="input-container">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Введите сообщение..."
            disabled={loading}
            rows={1}
          />
          
          <div className="input-actions">
            <button
              type="button"
              className="file-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              title="Прикрепить файл"
            >
              📎
            </button>
            
            <button
              type="submit"
              className="send-btn"
              disabled={!text.trim() || loading}
            >
              {loading ? '⏳' : '📤'}
            </button>
          </div>
        </div>
      </form>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileUpload}
        style={{ display: 'none' }}
        accept="*/*"
      />
    </div>
  );
};

export default MessageInput;