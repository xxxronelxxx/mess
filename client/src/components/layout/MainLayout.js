import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './Sidebar';
import ChatWindow from '../chat/ChatWindow';
import './MainLayout.css';

const MainLayout = () => {
  return (
    <div className="main-layout">
      <Sidebar />
      <div className="chat-area">
        <Routes>
          <Route path="/" element={<ChatWindow />} />
          <Route path="/chat/:chatId" element={<ChatWindow />} />
        </Routes>
      </div>
    </div>
  );
};

export default MainLayout;