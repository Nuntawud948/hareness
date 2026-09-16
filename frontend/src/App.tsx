import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { LoginPage } from './pages/LoginPage';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { KeyManagementPage } from './pages/KeyManagementPage';
import { ChannelSettingsPage } from './pages/ChannelSettingsPage';
import { SystemPromptPage } from './pages/SystemPromptPage';
import { PushWatcherPage } from './pages/PushWatcherPage';
import { UsageDashboardPage } from './pages/UsageDashboardPage';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Navigate to="/keys" replace />} />
            <Route path="/keys" element={<KeyManagementPage />} />
            <Route path="/channels" element={<ChannelSettingsPage />} />
            <Route path="/prompts" element={<SystemPromptPage />} />
            <Route path="/push" element={<PushWatcherPage />} />
            <Route path="/usage" element={<UsageDashboardPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
};
