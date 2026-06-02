/**
 * Main App component — routing, auth guards, theme, and layout.
 */

import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ConfigProvider, App as AntApp, theme } from 'antd';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from './stores/authStore';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import AppLayout from './components/AppLayout';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import NewTaskPage from './pages/NewTaskPage';
import TaskResultPage from './pages/TaskResultPage';
import TaskVisualizationPage from './pages/TaskVisualizationPage';
import GlobalResultsPage from './pages/GlobalResultsPage';
import LegacySupportPage from './pages/LegacySupportPage';
import AdminPage from './pages/AdminPage';

/* ── Route guards ─────────────────────────────────────────────────────────── */

function ProtectedRoute({ requiredRole }: { requiredRole?: string }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requiredRole && user?.role !== requiredRole) return <Navigate to="/" replace />;
  return <Outlet />;
}

function PublicRoute() {
  const { isAuthenticated, user } = useAuthStore();
  if (isAuthenticated) return <Navigate to={user?.role === 'admin' ? '/admin' : '/'} replace />;
  return <Outlet />;
}

/* ── Inner app (has access to theme context) ───────────────────────────────── */

function ThemedApp() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const { i18n } = useTranslation();
  const { isDark } = useTheme();

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
    return () => {
      i18n.off('languageChanged', handler);
    };
  }, [i18n]);

  return (
    <ConfigProvider
      locale={antdLocale}
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: isDark ? '#22d3ee' : '#0891b2',
          colorInfo: isDark ? '#22d3ee' : '#0891b2',
          colorSuccess: isDark ? '#34d399' : '#16a34a',
          colorWarning: isDark ? '#fbbf24' : '#d97706',
          colorError: isDark ? '#f87171' : '#dc2626',
          borderRadius: 10,
          fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
          fontSize: 14,
          colorLink: isDark ? '#22d3ee' : '#0891b2',
        },
        components: {
          Card: {
            paddingLG: 24,
          },
          Table: {
            headerBg: isDark ? '#0f1424' : '#f8fafc',
            rowHoverBg: isDark ? 'rgba(34, 211, 238, 0.04)' : 'rgba(8, 145, 178, 0.03)',
          },
          Tag: {
            borderRadiusSM: 6,
          },
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
          <Routes>
            {/* Public routes — no sidebar */}
            <Route element={<PublicRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>

            {/* Protected routes — with sidebar layout */}
            <Route element={<ProtectedRoute />}>
              <Route
                element={
                  <AppLayout>
                    <Outlet />
                  </AppLayout>
                }
              >
                <Route path="/" element={<DashboardPage />} />
                <Route path="/tasks/new" element={<NewTaskPage />} />
                <Route path="/tasks/:taskId" element={<TaskResultPage />} />
                <Route path="/tasks/:taskId/visualization" element={<TaskVisualizationPage />} />
                <Route path="/result/results" element={<GlobalResultsPage />} />
              </Route>

              {/* Admin routes — with sidebar layout */}
              <Route element={<ProtectedRoute requiredRole="admin" />}>
                <Route
                  element={
                    <AppLayout>
                      <Outlet />
                    </AppLayout>
                  }
                >
                  <Route path="/result/stats" element={<LegacySupportPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                </Route>
              </Route>
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}

/* ── Root ──────────────────────────────────────────────────────────────────── */

export default function App() {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}
