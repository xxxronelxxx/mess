import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useServerConfig } from '../../contexts/ServerConfigContext';
import './Auth.css';

const ServerConfig = () => {
  const { serverConfig, updateServerConfig } = useServerConfig();
  const [url, setUrl] = useState(serverConfig.url);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Проверяем доступность сервера
      const response = await fetch(`${url}/health`);
      if (response.ok) {
        updateServerConfig({ url });
        setSuccess('Сервер успешно настроен!');
        setTimeout(() => navigate('/login'), 1500);
      } else {
        setError('Сервер недоступен');
      }
    } catch (err) {
      setError('Не удается подключиться к серверу');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) {
        setSuccess('Соединение успешно!');
      } else {
        setError('Сервер недоступен');
      }
    } catch (err) {
      setError('Не удается подключиться к серверу');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Настройки сервера</h1>
          <p>Укажите адрес сервера мессенджера</p>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="url">URL сервера</label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:3000"
              required
              disabled={loading}
            />
          </div>

          <div className="form-actions">
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={handleTestConnection}
              disabled={loading}
            >
              Проверить соединение
            </button>
            
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>

        <div className="auth-footer">
          <p>По умолчанию: http://localhost:3000</p>
          <button 
            onClick={() => navigate('/login')} 
            className="btn btn-outline"
          >
            Вернуться к входу
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServerConfig;