import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useServerConfig } from '../../contexts/ServerConfigContext';
import './Sidebar.css';

const Sidebar = () => {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuth();
  const { serverConfig } = useServerConfig();
  const location = useLocation();

  useEffect(() => {
    fetchChats();
  }, []);

  const fetchChats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${serverConfig.url}/api/chats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setChats(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  if (loading) {
    return (
      <div className="sidebar">
        <div className="sidebar-loading">Загрузка чатов...</div>
      </div>
    );
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="user-info">
          <div className="user-avatar">
            {user?.avatar_path ? (
              <img src={`${serverConfig.url}/uploads/${user.avatar_path}`} alt="Avatar" />
            ) : (
              <div className="avatar-placeholder">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="user-details">
            <div className="username">{user?.username}</div>
            <div className="user-status">В сети</div>
          </div>
        </div>
        <button onClick={handleLogout} className="logout-btn">
          Выйти
        </button>
      </div>

      <div className="sidebar-content">
        <div className="chats-section">
          <h3>Чаты</h3>
          <div className="chats-list">
            {chats.map(chat => (
              <Link
                key={chat.id}
                to={`/chat/${chat.id}`}
                className={`chat-item ${location.pathname === `/chat/${chat.id}` ? 'active' : ''}`}
              >
                <div className="chat-avatar">
                  {chat.type === 'favorites' ? '⭐' : '💬'}
                </div>
                <div className="chat-info">
                  <div className="chat-name">
                    {chat.name || (chat.type === 'private' ? 'Приватный чат' : 'Групповой чат')}
                  </div>
                  <div className="chat-preview">
                    {chat.type === 'favorites' ? 'Заметки и избранное' : 'Нажмите для открытия'}
                  </div>
                </div>
                {chat.is_pinned && <div className="pin-indicator">📌</div>}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;