/**
 * Main App component with routing and auth guard.
 */

import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from './stores/authStore';
import LanguageSwitcher from './components/LanguageSwitcher';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import NewTaskPage from './pages/NewTaskPage';
import TaskResultPage from './pages/TaskResultPage';
import TaskVisualizationPage from './pages/TaskVisualizationPage';
import GlobalResultsPage from './pages/GlobalResultsPage';
import LegacySupportPage from './pages/LegacySupportPage';
import AdminPage from './pages/AdminPage';

const ProtectedRoute = ({ children, requiredRole }: { children: React.ReactNode; requiredRole?: string }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requiredRole && user?.role !== requiredRole) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (isAuthenticated) return <Navigate to={user?.role === 'admin' ? '/admin' : '/'} replace />;
  return <>{children}</>;
};

function App() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const { i18n } = useTranslation();

  const [antdLocale, setAntdLocale] = useState(
    i18n.language.startsWith('zh') ? zhCN : enUS,
  );

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const handler = (lng: string) => {
      setAntdLocale(lng.startsWith('zh') ? zhCN : enUS);
      document.documentElement.lang = lng.startsWith('zh') ? 'zh' : 'en';
    };
    i18n.on('languageChanged', handler);
    document.documentElement.lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
    return () => { i18n.off('languageChanged', handler); };
  }, [i18n]);

  return (
    <ConfigProvider
      locale={antdLocale}
      theme={{
        token: {
          colorPrimary: '#0f766e',
          colorInfo: '#0f766e',
          colorSuccess: '#15803d',
          colorWarning: '#d97706',
          colorError: '#dc2626',
          borderRadius: 12,
          fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
        },
      }}
    >
      <AntApp>
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 1000 }}>
          <LanguageSwitcher />
        </div>
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={<PublicRoute><LoginPage /></PublicRoute>}
            />
            <Route
              path="/register"
              element={<PublicRoute><RegisterPage /></PublicRoute>}
            />
            <Route
              path="/"
              element={<ProtectedRoute><DashboardPage /></ProtectedRoute>}
            />
            <Route
              path="/tasks/new"
              element={<ProtectedRoute><NewTaskPage /></ProtectedRoute>}
            />
            <Route
              path="/tasks/:taskId"
              element={<ProtectedRoute><TaskResultPage /></ProtectedRoute>}
            />
            <Route
              path="/tasks/:taskId/visualization"
              element={<ProtectedRoute><TaskVisualizationPage /></ProtectedRoute>}
            />
            <Route
              path="/result/results"
              element={<ProtectedRoute><GlobalResultsPage /></ProtectedRoute>}
            />
            <Route
              path="/result/stats"
              element={<ProtectedRoute requiredRole="admin"><LegacySupportPage /></ProtectedRoute>}
            />
            <Route
              path="/admin"
              element={<ProtectedRoute requiredRole="admin"><AdminPage /></ProtectedRoute>}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}

export default App;
