/**
 * Login page — clean, security-focused auth experience.
 */

import { Form, Input, Button, message, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../api';
import { useAuthStore } from '../stores/authStore';
import LanguageSwitcher from '../components/LanguageSwitcher';

const { Title, Text } = Typography;

export default function LoginPage() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const { t } = useTranslation();

  const handleSubmit = async (values: { username: string; password: string }) => {
    try {
      const resp = await authApi.login(values);
      login(resp.access_token, resp.user);
      message.success(t('auth.login.success', { username: resp.user.username }));
      navigate(resp.user.role === 'admin' ? '/admin' : '/');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      message.error(e.response?.data?.detail ?? t('auth.login.failed'));
    }
  };

  return (
    <div className="auth-page">
      {/* Language switcher */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 10 }}>
        <LanguageSwitcher />
      </div>

      <div className="auth-card" style={{ width: 420 }}>
        {/* Header */}
        <div className="auth-card-header">
          <div className="auth-card-logo">VS</div>
          <Title level={2} className="auth-card-title">VulnSeeker</Title>
          <Text className="auth-card-subtitle">{t('auth.login.subtitle')}</Text>
        </div>

        {/* Body */}
        <div className="auth-card-body">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            size="large"
          >
            <Form.Item
              name="username"
              label={t('auth.login.username')}
              rules={[{ required: true, message: t('auth.login.usernamePlaceholder') }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: 'var(--text-tertiary)' }} />}
                placeholder={t('auth.login.usernamePlaceholder')}
                autoFocus
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={t('auth.login.password')}
              rules={[{ required: true, message: t('auth.login.passwordPlaceholder') }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: 'var(--text-tertiary)' }} />}
                placeholder={t('auth.login.passwordPlaceholder')}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
              <Button type="primary" htmlType="submit" block size="large">
                {t('auth.login.submit')}
              </Button>
            </Form.Item>
          </Form>
        </div>

        {/* Footer */}
        <div className="auth-card-footer">
          <Text>
            {t('auth.login.noAccount')}{' '}
            <a href="/register">{t('auth.login.registerLink')}</a>
          </Text>
        </div>
      </div>
    </div>
  );
}
