import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useServerConfig } from '../../contexts/ServerConfigContext';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import './ChatWindow.css';

const ChatWindow = () => {
  const { chatId } = useParams();
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { serverConfig } = useServerConfig();

  useEffect(() => {
    if (chatId) {
      fetchChatInfo();
      fetchMessages();
    } else {
      // Показываем приветственное сообщение
      setChat({ name: 'Добро пожаловать!', type: 'welcome' });
      setMessages([]);
      setLoading(false);
    }
  }, [chatId]);

  const fetchChatInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${serverConfig.url}/api/chats/${chatId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setChat(data.data);
      }
    } catch (error) {
      console.error('Error fetching chat info:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${serverConfig.url}/api/messages/${chatId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.data.messages || []);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewMessage = (message) => {
    setMessages(prev => [message, ...prev]);
  };

  if (loading) {
    return (
      <div className="chat-window">
        <div className="chat-loading">Загрузка чата...</div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      <div className="chat-header">
        <h2>{chat?.name || 'Чат'}</h2>
        {chat?.type && <span className="chat-type">{chat.type}</span>}
      </div>

      <div className="chat-messages">
        <MessageList 
          messages={messages} 
          currentUserId={user?.id}
          serverConfig={serverConfig}
        />
      </div>

      <div className="chat-input">
        <MessageInput 
          chatId={chatId} 
          onNewMessage={handleNewMessage}
          serverConfig={serverConfig}
        />
      </div>
    </div>
  );
};

export default ChatWindow;