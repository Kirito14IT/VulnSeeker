/**
 * Main App component with routing and auth guard.
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import { useAuthStore } from './stores/authStore';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import NewTaskPage from './pages/NewTaskPage';
import TaskResultPage from './pages/TaskResultPage';
import GlobalResultsPage from './pages/GlobalResultsPage';
import LegacySupportPage from './pages/LegacySupportPage';
import SecureCodingEvalPage from './pages/SecureCodingEvalPage';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
};

function App() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <ConfigProvider
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
              path="/legacy/results"
              element={<ProtectedRoute><GlobalResultsPage /></ProtectedRoute>}
            />
            <Route
              path="/legacy/stats"
              element={<ProtectedRoute><LegacySupportPage /></ProtectedRoute>}
            />
            <Route
              path="/research/secure-coding-eval"
              element={<ProtectedRoute><SecureCodingEvalPage /></ProtectedRoute>}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}

export default App;
