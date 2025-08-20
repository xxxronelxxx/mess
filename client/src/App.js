import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import AuthContext from './contexts/AuthContext';
import ServerConfigContext from './contexts/ServerConfigContext';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import MainLayout from './components/layout/MainLayout';
import ServerConfig from './components/auth/ServerConfig';
import './styles/App.css';

function App() {
  const [user, setUser] = useState(null);
  const [serverConfig, setServerConfig] = useState(() => {
    const saved = localStorage.getItem('serverConfig');
    return saved ? JSON.parse(saved) : { url: 'http://localhost:3000' };
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    // Save server config to localStorage
    localStorage.setItem('serverConfig', JSON.stringify(serverConfig));
  }, [serverConfig]);

  const login = (userData, token) => {
    setUser(userData);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const updateServerConfig = (newConfig) => {
    setServerConfig(newConfig);
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <div className="loading-text">Loading...</div>
      </div>
    );
  }

  return (
    <ServerConfigContext.Provider value={{ serverConfig, updateServerConfig }}>
      <AuthContext.Provider value={{ user, login, logout }}>
        <div className="app">
          <Routes>
            <Route 
              path="/login" 
              element={user ? <Navigate to="/" replace /> : <Login />} 
            />
            <Route 
              path="/register" 
              element={user ? <Navigate to="/" replace /> : <Register />} 
            />
            <Route 
              path="/server-config" 
              element={<ServerConfig />} 
            />
            <Route 
              path="/*" 
              element={user ? <MainLayout /> : <Navigate to="/login" replace />} 
            />
          </Routes>
          
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#2d2d2d',
                color: '#ffffff',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              },
              success: {
                iconTheme: {
                  primary: '#28a745',
                  secondary: '#ffffff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#dc3545',
                  secondary: '#ffffff',
                },
              },
            }}
          />
        </div>
      </AuthContext.Provider>
    </ServerConfigContext.Provider>
  );
}

export default App;