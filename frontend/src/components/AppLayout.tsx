import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Tooltip } from 'antd';
import {
  DashboardOutlined,
  PlusCircleOutlined,
  SafetyCertificateOutlined,
  DatabaseOutlined,
  LogoutOutlined,
  SunOutlined,
  MoonOutlined,
  MenuOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { useTheme } from '../contexts/ThemeContext';
import LanguageSwitcher from './LanguageSwitcher';
import logoSvg from '../assets/logo.svg';
import type { ReactNode } from 'react';

type NavItem = {
  key: string;
  path: string;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
};

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { isDark, toggle: toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = user?.role === 'admin';

  const navItems: NavItem[] = [
    {
      key: 'dashboard',
      path: '/',
      label: t('nav.dashboard'),
      icon: <DashboardOutlined />,
    },
    {
      key: 'new-task',
      path: '/tasks/new',
      label: t('nav.newAnalysis'),
      icon: <PlusCircleOutlined />,
    },
    {
      key: 'admin',
      path: '/admin',
      label: t('nav.admin'),
      icon: <SafetyCertificateOutlined />,
      adminOnly: true,
    },
    {
      key: 'legacy',
      path: '/result/stats',
      label: t('nav.legacySupport'),
      icon: <DatabaseOutlined />,
      adminOnly: true,
    },
  ];

  const isActive = (path: string): boolean => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="app-sidebar-header">
        <a href="/" className="app-sidebar-logo" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
          <div className="app-sidebar-logo-icon">
            <img src={logoSvg} alt="VulnSeeker" />
          </div>
          <span className="app-sidebar-logo-text">VulnSeeker</span>
        </a>
      </div>

      {/* Navigation */}
      <nav className="app-sidebar-nav">
        {visibleItems.map((item) => (
          <button
            key={item.key}
            className={`app-sidebar-nav-item${isActive(item.path) ? ' active' : ''}`}
            onClick={() => { navigate(item.path); setMobileOpen(false); }}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}

        <hr className="app-sidebar-divider" />

        <div className="app-sidebar-section-label">{t('nav.preferences')}</div>

        {/* Theme toggle */}
        <button
          className="app-sidebar-nav-item"
          onClick={toggleTheme}
        >
          {isDark ? <SunOutlined /> : <MoonOutlined />}
          <span>{isDark ? t('nav.lightMode') : t('nav.darkMode')}</span>
        </button>

        {/* Language switcher */}
        <div style={{ padding: '8px 12px' }}>
          <LanguageSwitcher />
        </div>
      </nav>

      {/* User footer */}
      <div className="app-sidebar-footer">
        <div className="app-sidebar-user">
          <div className="app-sidebar-user-avatar">
            {user?.username?.charAt(0).toUpperCase() ?? 'U'}
          </div>
          <div className="app-sidebar-user-info">
            <div className="app-sidebar-user-name">{user?.username}</div>
            <div className="app-sidebar-user-role">{user?.role}</div>
          </div>
          <Tooltip title={t('common.logout')}>
            <button className="app-sidebar-theme-btn" onClick={handleLogout}>
              <LogoutOutlined />
            </button>
          </Tooltip>
        </div>
      </div>
    </>
  );

  return (
    <div className="app-layout">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="app-sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`app-sidebar${mobileOpen ? ' open' : ''}`}>
        {sidebarContent}
      </aside>

      {/* Main content */}
      <main className="app-content">
        {/* Mobile header bar */}
        <div style={{
          display: 'none',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-default)',
          background: 'var(--bg-surface)',
          alignItems: 'center',
          gap: 12,
        }}
        className="mobile-header"
        >
          <Button
            type="text"
            icon={mobileOpen ? <CloseOutlined /> : <MenuOutlined />}
            onClick={() => setMobileOpen(!mobileOpen)}
          />
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16 }}>
            VulnSeeker
          </span>
        </div>

        <div className="app-content-inner">
          {children}
        </div>
      </main>

      {/* Inline style for mobile header visibility */}
      <style>{`
        @media (max-width: 768px) {
          .mobile-header { display: flex !important; }
          .app-content-inner { padding: 16px !important; }
        }
      `}</style>
    </div>
  );
}
